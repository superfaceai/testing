import {
  BoundProfileProvider,
  err,
  ok,
  PerformError,
  SuperfaceClient,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';
import {
  activate as activateNock,
  define as loadRecordingDefinitions,
  disableNetConnect,
  enableNetConnect,
  isActive as isNockActive,
  recorder,
  restore as restoreRecordings,
} from 'nock';
import { basename, dirname, join as joinPath } from 'path';

import {
  BaseURLNotFoundError,
  ComponentUndefinedError,
  FixturesPathUndefinedError,
  RecordingPathUndefinedError,
  RecordingsNotFoundError,
  UnexpectedError,
} from './common/errors';
import { getFixtureName, matchWildCard } from './common/format';
import { exists, mkdirQuiet, readFileQuiet, rename } from './common/io';
import { writeRecordings } from './common/output-stream';
import { IGenerator } from './generate-hash';
import { analyzeChangeImpact } from './nock/analyzer';
import { Matcher } from './nock/matcher';
import {
  AlertFunction,
  CompleteSuperfaceTestConfig,
  InputVariables,
  NockConfig,
  ProcessingFunction,
  RecordingDefinitions,
  RecordingProcessOptions,
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
  mapError,
  parsePublishEnv,
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

    // Replace currently supported recordings with unsupported (new recordings with changes)
    if (await this.canReplaceRecording()) {
      await this.replaceUnsupportedRecording();
    }

    // Parse env variable and check if test should be recorded
    const record = matchWildCard(this.sfConfig, process.env.SUPERFACE_LIVE_API);
    const processRecordings = options?.processRecordings ?? true;
    const inputVariables = searchValues(testCase.input, options?.hideInput);

    await this.startRecording(
      record,
      processRecordings,
      inputVariables,
      options?.recordingVersion,
      options?.beforeRecordingLoad
    );

    let result: TestingReturn;
    try {
      // Run perform method on specified configuration
      result = await this.sfConfig.useCase.perform(input, {
        provider: this.sfConfig.provider,
      });

      await this.endRecording({
        record,
        processRecordings,
        inputVariables,
        beforeRecordingSave: options?.beforeRecordingSave,
        alert: options?.alert,
      });
    } catch (error: unknown) {
      restoreRecordings();
      recorder.clear();
      enableNetConnect();

      throw error;
    }

    if (result.isErr()) {
      debug('Perform failed with error:', result.error.toString());

      if (options?.fullError) {
        return err(mapError(result.error as PerformError));
      }

      return err(result.error.toString());
    }

    if (result.isOk()) {
      debug('Perform succeeded with result:', result.value);

      return ok(result.value);
    }

    throw new UnexpectedError('Unexpected result object');
  }

  private async replaceUnsupportedRecording(): Promise<void> {
    const pathToUnsupported = this.composeRecordingPath('unsupported');
    const pathToCurrent = this.composeRecordingPath();

    await mkdirQuiet(joinPath(dirname(pathToCurrent), 'old'));

    // TODO: compose version based on executed usecase
    await rename(pathToCurrent, this.composeRecordingPath('1.0.0'));
    await rename(pathToUnsupported, pathToCurrent);
  }

  private async canReplaceRecording(): Promise<boolean> {
    const replaceRecording = parsePublishEnv(
      process.env.PUBLISH_UNSUPPORTED_RECORDINGS
    );

    if (
      replaceRecording &&
      (await exists(this.composeRecordingPath('unsupported')))
    ) {
      return true;
    }

    return false;
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
    recordingVersion?: string,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void> {
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
      await this.loadRecordings(
        processRecordings,
        inputVariables,
        recordingVersion,
        beforeRecordingLoad
      );
    }
  }

  private async loadRecordings(
    processRecordings: boolean,
    inputVariables?: InputVariables,
    recordingVersion?: string,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void> {
    // TODO: validate version format
    const definitions = await this.getRecordings(recordingVersion);

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

    loadRecordingDefinitions(definitions);

    debug('Loaded and mocked recorded traffic based on recording fixture');

    disableNetConnect();

    if (!isNockActive()) {
      activateNock();
    }
  }

  async getRecordings(version?: string): Promise<RecordingDefinitions> {
    const recordingPath = this.composeRecordingPath(version);
    const recordingExists = await exists(recordingPath);

    if (!recordingExists) {
      throw new RecordingsNotFoundError(recordingPath);
    }

    const definitionFile = await readFileQuiet(recordingPath);

    if (definitionFile === undefined) {
      throw new UnexpectedError('Reading recording file failed');
    }

    return JSON.parse(definitionFile) as RecordingDefinitions;
  }

  /**
   * Checks if recording started and if yes, it ends recording and
   * saves recording to file configured based on nock configuration from constructor.
   *
   * It will also process the recording definitions and hide sensitive information
   * based on security schemes and integration parameters defined in provider.json,
   * unless user pass in false for parameter `processRecordings`.
   */
  private async endRecording({
    record,
    processRecordings,
    inputVariables,
    beforeRecordingSave,
    alert,
  }: {
    record: boolean;
    processRecordings: boolean;
    inputVariables?: InputVariables;
    beforeRecordingSave?: ProcessingFunction;
    alert?: AlertFunction;
  }): Promise<void> {
    if (record) {
      const definitions = recorder.play();
      recorder.clear();
      restoreRecordings();

      debug(
        'Recording ended - Restored HTTP requests and cleared recorded traffic'
      );

      if (definitions.length === 0) {
        await writeRecordings(this.composeRecordingPath(), []);

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

      const recordingExists = await exists(this.composeRecordingPath());

      if (recordingExists) {
        await this.matchTraffic(definitions, alert);
      } else {
        // recording file does not exist -> record new traffic
        await writeRecordings(this.composeRecordingPath(), definitions);
      }

      debug('Recorded definitions written');
    } else {
      restoreRecordings();
      enableNetConnect();

      debug('Restored HTTP requests and enabled outgoing requests');

      return;
    }
  }

  private async matchTraffic(
    newTraffic: RecordingDefinitions,
    alert?: AlertFunction
  ) {
    // recording file exist -> record and compare new traffic
    const oldRecording = await readFileQuiet(this.composeRecordingPath());

    if (oldRecording === undefined) {
      throw new UnexpectedError('Reading old recording file failed');
    }

    const oldRecordingDefs = JSON.parse(oldRecording) as RecordingDefinitions;

    // Match new HTTP traffic to saved for breaking changes
    const match = await Matcher.match(oldRecordingDefs, newTraffic);

    if (match.valid) {
      // do not save new recording as there were no breaking changes found
    } else {
      const impact = analyzeChangeImpact(match.errors);

      // Alert changes
      if (alert !== undefined) {
        const config = this.sfConfig as CompleteSuperfaceTestConfig;

        await alert({
          impact,
          profileId: config.profile.configuration.id,
          providerName: config.provider.configuration.name,
          useCaseName: config.useCase.name,
          recordingPath: this.recordingPath ?? '',
        });
      }

      // Save new recording as unsupported
      await writeRecordings(
        this.composeRecordingPath('unsupported'),
        newTraffic
      );
    }
  }

  private composeRecordingPath(version?: string): string {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    if (version === 'unsupported') {
      return `${this.recordingPath}-unsupported.json`;
    }

    if (version !== undefined) {
      const baseDir = dirname(this.recordingPath);
      const hash = basename(this.recordingPath);

      return joinPath(baseDir, 'old', `${hash}_${version}.json`);
    }

    return `${this.recordingPath}.json`;
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
      `${this.nockConfig?.fixture ?? 'recording'}-${inputHash}`
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
