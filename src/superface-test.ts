import {
  BoundProfileProvider,
  err,
  ok,
  PerformError,
  Result,
  SuperfaceClient,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';
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
  InputVariables,
  ProcessingFunction,
  RecordingDefinitions,
  RecordingProcessOptions,
} from '.';
import {
  BaseURLNotFoundError,
  ComponentUndefinedError,
  FixturesPathUndefinedError,
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
import { IGenerator } from './generate-hash';
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
  checkSensitiveInformation,
  getGenerator,
  getProfileId,
  getSuperJson,
  isProfileProviderLocal,
  replaceCredentials,
  searchValues,
} from './superface-test.utils';

const debug = createDebug('superface:testing');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hash');

export class SuperfaceTest {
  private sfConfig: SuperfaceTestConfigPayload;
  private boundProfileProvider?: BoundProfileProvider;
  private nockConfig?: NockConfig;
  private fixturesPath?: string;
  private recordingPath?: string;
  private generator: IGenerator;

  constructor(sfConfig?: SuperfaceTestConfigPayload, nockConfig?: NockConfig) {
    this.sfConfig = sfConfig ?? {};
    this.nockConfig = nockConfig;
    this.generator = getGenerator(sfConfig?.testInstance);

    this.setupFixturesPath();
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
    await this.checkForMapInSuperJson();

    this.boundProfileProvider =
      await this.sfConfig.client.cacheBoundProfileProvider(
        this.sfConfig.profile.configuration,
        this.sfConfig.provider.configuration
      );

    // Create a hash for access to recording files
    const { input, testName } = testCase;
    const hash = this.generator.hash({ input, testName });

    debugHashing('Created hash:', hash);

    this.setupRecordingPath(getFixtureName(this.sfConfig), hash);

    // Parse env variable and check if test should be recorded
    const record = matchWildCard(this.sfConfig, process.env.SUPERFACE_LIVE_API);
    const processRecordings = options?.processRecordings ?? true;
    const inputVariables = searchValues(testCase.input, options?.hideInput);

    await this.startRecording(
      record,
      processRecordings,
      inputVariables,
      options?.beforeRecordingLoad
    );

    let result: Result<unknown, PerformError>;
    try {
      // Run perform method on specified configuration
      result = await this.sfConfig.useCase.perform(input, {
        provider: this.sfConfig.provider,
      });

      await this.endRecording(
        record,
        processRecordings,
        inputVariables,
        options?.beforeRecordingSave
      );
    } catch (error: unknown) {
      restoreRecordings();
      recorder.clear();
      enableNetConnect();

      throw error;
    }

    if (result.isErr()) {
      debug('Perform failed with error:', result.error.toString());

      return err(removeTimestamp(result.error.toString()));
    }

    if (result.isOk()) {
      debug('Perform succeeded with result:', result.value);

      return ok(result.value);
    }

    throw new UnexpectedError('Unexpected result object');
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
    inputVariables?: InputVariables,
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
    const baseUrl = configuration.services.getUrl();

    if (baseUrl === undefined) {
      throw new BaseURLNotFoundError(this.sfConfig.provider.configuration.name);
    }

    if (record) {
      const enable_reqheaders_recording =
        this.nockConfig?.enableReqheadersRecording ?? false;

      recorder.rec({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording,
      });

      debug('Recording HTTP traffic started');
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
          inputVariables,
          baseUrl,
          beforeSave: false,
        });
      }

      if (beforeRecordingLoad) {
        debug(
          "Calling custom 'beforeRecordingLoad' hook on loaded recording definitions"
        );

        await beforeRecordingLoad(definitions);
      }

      define(definitions);

      debug('Loaded and mocked recorded traffic based on recording fixture');

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
    inputVariables?: InputVariables,
    beforeRecordingSave?: ProcessingFunction
  ): Promise<void> {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    if (record) {
      const definitions = recorder.play();
      recorder.clear();
      restoreRecordings();

      debug(
        'Recording ended - Restored HTTP requests and cleared recorded traffic'
      );

      if (definitions === undefined || definitions.length === 0) {
        await writeRecordings(this.recordingPath, []);

        return;
      }

      assertsDefinitionsAreNotStrings(definitions);
      assertsPreparedConfig(this.sfConfig);
      assertBoundProfileProvider(this.boundProfileProvider);

      const { configuration } = this.boundProfileProvider;
      const securityValues = this.sfConfig.provider.configuration.security;
      const securitySchemes = configuration.security;
      const integrationParameters = configuration.parameters ?? {};

      if (processRecordings) {
        const baseUrl = configuration.services.getUrl();

        if (baseUrl === undefined) {
          throw new BaseURLNotFoundError(
            this.sfConfig.provider.configuration.name
          );
        }

        replaceCredentials({
          definitions,
          securitySchemes,
          securityValues,
          integrationParameters,
          inputVariables,
          baseUrl,
          beforeSave: true,
        });
      }

      if (beforeRecordingSave) {
        debug(
          "Calling custom 'beforeRecordingSave' hook on recorded definitions"
        );

        await beforeRecordingSave(definitions);
      }

      if (
        securitySchemes.length > 0 ||
        securityValues.length > 0 ||
        (integrationParameters &&
          Object.values(integrationParameters).length > 0)
      ) {
        checkSensitiveInformation(
          definitions,
          securitySchemes,
          securityValues,
          integrationParameters
        );
      }

      await writeRecordings(this.recordingPath, definitions);
      debug('Recorded definitions written');
    } else {
      restoreRecordings();
      enableNetConnect();

      debug('Restored HTTP requests and enabled outgoing requests');

      return;
    }
  }

  /**
   * Sets up path to all fixtures.
   */
  private setupFixturesPath(): void {
    const { path } = this.nockConfig ?? {};

    if (this.fixturesPath === undefined) {
      this.fixturesPath = path ?? joinPath(process.cwd(), 'nock');
    }

    debugSetup('Prepare path to recording fixtures:', this.fixturesPath);
  }

  /**
   * Sets up path to recording, depends on current Superface configuration and test case input.
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

    debugSetup('Prepare path to recording:', this.recordingPath);
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

    debugSetup('Superface configuration prepared:', this.sfConfig);
  }

  /**
   * Sets up current configuration - transforms every component
   * that is represented by string to instance of that corresponding component.
   */
  private async setupSuperfaceConfig(): Promise<void> {
    if (!this.sfConfig.client) {
      this.sfConfig.client = new SuperfaceClient();

      debugSetup('Superface client initialized:', this.sfConfig.client);
    }

    if (typeof this.sfConfig.profile === 'string') {
      this.sfConfig.profile = await this.sfConfig.client.getProfile(
        this.sfConfig.profile
      );

      debugSetup('Superface Profile transformed:', this.sfConfig.profile);
    }

    if (typeof this.sfConfig.provider === 'string') {
      this.sfConfig.provider = await this.sfConfig.client.getProvider(
        this.sfConfig.provider
      );

      debugSetup('Superface Provider transformed:', this.sfConfig.provider);
    }

    if (typeof this.sfConfig.useCase === 'string') {
      if (this.sfConfig.profile === undefined) {
        throw new ComponentUndefinedError('Profile');
      }

      this.sfConfig.useCase = this.sfConfig.profile.getUseCase(
        this.sfConfig.useCase
      );

      debugSetup('Superface UseCase transformed:', this.sfConfig.useCase);
    }
  }

  /**
   * Checks whether current components in sfConfig
   * are locally linked in super.json.
   */
  private async checkForMapInSuperJson(): Promise<void> {
    assertsPreparedConfig(this.sfConfig);

    const profileId = getProfileId(this.sfConfig.profile);
    const superJson = this.sfConfig.client?.superJson ?? (await getSuperJson());

    isProfileProviderLocal(
      this.sfConfig.provider,
      profileId,
      superJson.normalized
    );
  }
}
