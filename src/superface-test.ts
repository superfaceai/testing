import {
  BoundProfileProvider,
  err,
  ok,
  PerformError,
  Result,
  SuperfaceClient,
} from '@superfaceai/one-sdk';
import { createHash } from 'crypto';
import {
  activate as activateNock,
  define,
  disableNetConnect,
  enableNetConnect,
  isActive as isNockActive,
  recorder,
  restore as restoreRecordings,
} from 'nock';
import { join as joinPath } from 'path';

import {
  ProcessingFunction,
  RecordingDefinitions,
  RecordingProcessOptions,
} from '.';
import {
  ComponentUndefinedError,
  FixturesPathUndefinedError,
  MapUndefinedError,
  RecordingPathUndefinedError,
  RecordingsNotFoundError,
  UnexpectedError,
} from './common/errors';
import {
  getFixtureName,
  matchWildCard,
  removeTimestamp,
} from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import {
  NockConfig,
  SuperfaceTestConfigPayload,
  SuperfaceTestRun,
  TestingReturn,
} from './superface-test.interfaces';
import {
  assertBoundProfileProvider,
  assertsDefinitionsAreNotStrings,
  assertsPreparedConfig,
  getProfileId,
  getProviderName,
  getSuperJson,
  isProfileProviderLocal,
  replaceCredentials,
} from './superface-test.utils';

export class SuperfaceTest {
  private sfConfig: SuperfaceTestConfigPayload;
  private boundProfileProvider?: BoundProfileProvider;
  private nockConfig?: NockConfig;
  private fixturesPath?: string;
  private recordingPath?: string;

  constructor(sfConfig?: SuperfaceTestConfigPayload, nockConfig?: NockConfig) {
    this.sfConfig = sfConfig ?? {};
    this.nockConfig = nockConfig;

    this.setupFixturesPath();
  }

  /**
   * Sets up path to all fixtures.
   */
  private setupFixturesPath(): void {
    const { path } = this.nockConfig ?? {};

    if (this.fixturesPath === undefined) {
      this.fixturesPath = path ?? joinPath(process.cwd(), 'nock');
    }
  }

  /**
   * Sets up path to recording, depends on current Superface configuration.
   */
  private setupRecordingPath(fixtureName: string, inputHash: string) {
    if (!this.fixturesPath) {
      throw new FixturesPathUndefinedError();
    }

    this.recordingPath = joinPath(
      this.fixturesPath,
      fixtureName,
      `${this.nockConfig?.fixture ?? 'recording'}-${inputHash}.json`
    );
  }

  /**
   * Tests current configuration whether all necessary components
   * are defined and ready to use and tries to perform entered usecase.
   */
  async run(
    testCase: SuperfaceTestRun,
    options?: RecordingProcessOptions
  ): Promise<TestingReturn> {
    this.prepareSuperfaceConfig(testCase);
    await this.setupSuperfaceConfig();

    assertsPreparedConfig(this.sfConfig);
    if (!(await this.checkForMapInSuperJson())) {
      throw new MapUndefinedError(
        getProfileId(this.sfConfig.profile),
        getProviderName(this.sfConfig.provider)
      );
    }

    this.boundProfileProvider =
      await this.sfConfig.client.cacheBoundProfileProvider(
        this.sfConfig.profile.configuration,
        this.sfConfig.provider.configuration
      );

    const hash = createHash('md5')
      .update(JSON.stringify(testCase.input))
      .digest('hex');

    this.setupRecordingPath(getFixtureName(this.sfConfig), hash);

    // parse env variable and check if test should be recorded
    const record = matchWildCard(this.sfConfig, process.env.SUPERFACE_LIVE_API);
    const processRecordings = options?.processRecordings ?? true;

    await this.startRecording(
      record,
      processRecordings,
      options?.beforeRecordingLoad
    );

    let result: Result<unknown, PerformError>;
    try {
      result = await this.sfConfig.useCase.perform(testCase.input, {
        provider: this.sfConfig.provider,
      });

      await this.endRecording(
        record,
        processRecordings,
        options?.beforeRecordingSave
      );
    } catch (error: unknown) {
      restoreRecordings();
      recorder.clear();
      enableNetConnect();

      throw error;
    }

    if (result.isErr()) {
      return err(removeTimestamp(result.error.toString()));
    }

    if (result.isOk()) {
      return ok(result.value);
    }

    throw new UnexpectedError('Unexpected result object');
  }

  /**
   * Sets up entered payload to current Superface configuration
   */
  private prepareSuperfaceConfig(payload: SuperfaceTestConfigPayload): void {
    if (payload.client !== undefined) {
      this.sfConfig.client = payload.client;
    }

    if (payload.profile !== undefined) {
      this.sfConfig.profile = payload.profile;
    }

    if (payload.provider !== undefined) {
      this.sfConfig.provider = payload.provider;
    }

    if (payload.useCase !== undefined) {
      this.sfConfig.useCase = payload.useCase;
    }
  }

  /**
   * Sets up current configuration - transforms every component
   * that is represented by string to instance of that corresponding component.
   */
  private async setupSuperfaceConfig(): Promise<void> {
    if (!this.sfConfig.client) {
      this.sfConfig.client = new SuperfaceClient();
    }

    if (typeof this.sfConfig.profile === 'string') {
      this.sfConfig.profile = await this.sfConfig.client.getProfile(
        this.sfConfig.profile
      );
    }

    if (typeof this.sfConfig.provider === 'string') {
      this.sfConfig.provider = await this.sfConfig.client.getProvider(
        this.sfConfig.provider
      );
    }

    if (typeof this.sfConfig.useCase === 'string') {
      if (this.sfConfig.profile === undefined) {
        throw new ComponentUndefinedError('Profile');
      }

      this.sfConfig.useCase = this.sfConfig.profile.getUseCase(
        this.sfConfig.useCase
      );
    }
  }

  /**
   * Checks whether profile provider configured in constructor
   * is locally linked in super.json.
   */
  private async checkForMapInSuperJson(): Promise<boolean> {
    const superJson = this.sfConfig.client?.superJson ?? (await getSuperJson());
    const superJsonNormalized = superJson.normalized;

    let profileId: string | undefined;

    if (this.sfConfig.profile !== undefined) {
      profileId = getProfileId(this.sfConfig.profile);
    } else {
      return false;
    }

    if (this.sfConfig.provider !== undefined) {
      return isProfileProviderLocal(
        this.sfConfig.provider,
        profileId,
        superJsonNormalized
      );
    }

    return true;
  }

  /**
   * Starts recording or loads recording fixture if exists.
   * 
   * It will also process recording definitions before creating mocked requests
   * to match against constructed request and enable mocking them. This is needed
   * because stored recording fixture is possibly processed and contains placeholders
   * instead of original secrets.
   * 
   * Recordings do not get processed if user specifies parameter `processRecordings` as false.
   */
  private async startRecording(
    record: boolean,
    processRecordings: boolean,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void> {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    assertsPreparedConfig(this.sfConfig);
    assertBoundProfileProvider(this.boundProfileProvider);

    const { configuration } = this.boundProfileProvider;
    const integrationParameters = configuration.parameters ?? {};
    const securitySchemes = configuration.security;
    const securityValues = this.sfConfig.provider.configuration.security;
    const baseUrl = configuration.baseUrl;

    if (record) {
      const enable_reqheaders_recording =
        this.nockConfig?.enableReqheadersRecording ?? false;

      recorder.rec({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording,
      });

      if (
        securitySchemes.length > 0 ||
        securityValues.length > 0 ||
        (integrationParameters &&
          Object.values(integrationParameters).length > 0)
      ) {
        console.warn(
          'Your recordings might contain sensitive information. Make sure to check them before publishing.'
        );
      }
    } else {
      const recordingExists = await exists(this.recordingPath);

      if (!recordingExists) {
        throw new RecordingsNotFoundError();
      }

      const definitionFile = await readFileQuiet(this.recordingPath);

      if (definitionFile === undefined) {
        throw new UnexpectedError('Reading recording file failed');
      }

      const definitions = JSON.parse(definitionFile) as RecordingDefinitions;

      if (processRecordings) {
        replaceCredentials({
          definitions,
          securitySchemes,
          securityValues,
          integrationParameters,
          baseUrl,
          beforeSave: false,
        });
      }

      if (beforeRecordingLoad) {
        await beforeRecordingLoad(definitions);
      }

      const scopes = define(definitions);

      if (scopes.length === 0) {
        console.warn(
          'Make sure your recording files contains corresponding HTTP calls.'
        );
      }

      disableNetConnect();

      if (!isNockActive()) {
        activateNock();
      }
    }
  }

  /**
   * Checks if recording started and if yes, it ends recording and
   * saves recording to file configured based on nock configuration from constructor.
   *
   * It will also process the recording definitions and hide sensitive information
   * based on security schemes and integration parameters defined in provider.json,
   * unless user pass in false for parameter `processRecordings`.
   */
  private async endRecording(
    record: boolean,
    processRecordings: boolean,
    beforeRecordingSave?: ProcessingFunction
  ): Promise<void> {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    if (record) {
      const definitions = recorder.play();
      recorder.clear();
      restoreRecordings();

      if (definitions === undefined || definitions.length === 0) {
        return;
      }

      assertsDefinitionsAreNotStrings(definitions);

      if (processRecordings) {
        assertsPreparedConfig(this.sfConfig);
        assertBoundProfileProvider(this.boundProfileProvider);

        const { configuration } = this.boundProfileProvider;
        const securityValues = this.sfConfig.provider.configuration.security;
        const securitySchemes = configuration.security;
        const integrationParameters = configuration.parameters ?? {};
        const baseUrl = configuration.baseUrl;

        replaceCredentials({
          definitions,
          securitySchemes,
          securityValues,
          integrationParameters,
          baseUrl,
          beforeSave: true,
        });
      }

      if (beforeRecordingSave) {
        await beforeRecordingSave(definitions);
      }

      await writeRecordings(this.recordingPath, definitions);
    } else {
      restoreRecordings();
      enableNetConnect();

      return;
    }
  }
}
