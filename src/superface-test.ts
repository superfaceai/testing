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
import { decodeRecordings, writeRecordings } from './common/output-stream';
import { IGenerator } from './generate-hash';
import { analyzeChangeImpact } from './nock/analyzer';
import { Matcher } from './nock/matcher';
import { report, saveReport } from './reporter';
import {
  AlertFunction,
  AnalysisResult,
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
  parseBooleanEnv,
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
  private analysis?: AnalysisResult;
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

    // Replace currently supported traffic with new (with changes)
    if (await this.canUpdateTraffic()) {
      await this.updateTraffic();
    }

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
      });
    } catch (error: unknown) {
      restoreRecordings();
      recorder.clear();
      enableNetConnect();

      throw error;
    }

    if (
      this.analysis &&
      !parseBooleanEnv(process.env.DISABLE_PROVIDER_CHANGES_COVERAGE)
    ) {
      await saveReport({
        input,
        result,
        path: getFixtureName(this.sfConfig),
        hash: this.generator.hash({ input, testName }),
        recordingPath: this.recordingPath ?? '',
        profileId: this.sfConfig.profile.configuration.id,
        providerName: this.sfConfig.provider.configuration.name,
        useCaseName: this.sfConfig.useCase.name,
        analysis: this.analysis,
      });
    }

    this.analysis = undefined;

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

  // static async collectData(): Promise<void> {
  //   await collect();
  // }

  static async report(
    alert: AlertFunction,
    options?: {
      onlyFailedTests?: boolean;
    }
  ): Promise<void> {
    await report(alert, options);
  }

  private async updateTraffic(): Promise<void> {
    const pathToCurrent = this.composeRecordingPath();
    const pathToNew = this.composeRecordingPath({ version: 'new' });

    await mkdirQuiet(joinPath(dirname(pathToCurrent), 'old'));

    // TODO: compose version based on used map
    let i = 0;
    while (await exists(this.composeRecordingPath({ version: `${i}` }))) {
      i++;
    }

    await rename(pathToCurrent, this.composeRecordingPath({ version: `${i}` }));
    await rename(pathToNew, pathToCurrent);
  }

  private async canUpdateTraffic(): Promise<boolean> {
    const updateTraffic = parseBooleanEnv(process.env.UPDATE_TRAFFIC);

    if (
      updateTraffic &&
      (await exists(this.composeRecordingPath({ version: 'new' })))
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
        beforeRecordingLoad
      );
    }
  }

  private async loadRecordings(
    processRecordings: boolean,
    inputVariables?: InputVariables,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void> {
    const definitions = await this.getRecordings();

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

  async getRecordings(): Promise<RecordingDefinitions> {
    const useNewTraffic = parseBooleanEnv(process.env.USE_NEW_TRAFFIC);
    const newRecordingPath = this.composeRecordingPath({ version: 'new' });

    if (useNewTraffic && (await exists(newRecordingPath))) {
      return await this.parseRecordings(newRecordingPath);
    }

    const currentRecordingPath = this.composeRecordingPath();
    const recordingExists = await exists(currentRecordingPath);

    if (!recordingExists) {
      throw new RecordingsNotFoundError(currentRecordingPath);
    }

    return await this.parseRecordings(currentRecordingPath);
  }

  private async parseRecordings(path: string): Promise<RecordingDefinitions> {
    const definitionFile = await readFileQuiet(path);

    if (definitionFile === undefined) {
      throw new UnexpectedError('Reading new recording file failed');
    }

    debug(`Parsing recording file at: "${path}"`);

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
  }: {
    record: boolean;
    processRecordings: boolean;
    inputVariables?: InputVariables;
    beforeRecordingSave?: ProcessingFunction;
  }): Promise<void> {
    if (record) {
      const definitions = recorder.play();
      recorder.clear();
      restoreRecordings();

      debug(
        'Recording ended - Restored HTTP requests and cleared recorded traffic'
      );

      const recordingExists = await exists(this.composeRecordingPath());

      if (definitions.length === 0) {
        await writeRecordings(
          this.composeRecordingPath(
            recordingExists ? { version: 'new' } : undefined
          ),
          []
        );

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

      if (recordingExists) {
        await this.matchTraffic(definitions);
      } else {
        // recording file does not exist -> record new traffic
        await writeRecordings(this.composeRecordingPath(), definitions);

        // save recording with decoded response
        if (parseBooleanEnv(process.env.DECODE_RESPONSE)) {
          await this.writeDecodedRecordings(definitions);
        }
      }

      debug('Recorded definitions written');
    } else {
      restoreRecordings();
      enableNetConnect();

      debug('Restored HTTP requests and enabled outgoing requests');

      return;
    }
  }

  private async matchTraffic(newTraffic: RecordingDefinitions) {
    // recording file exist -> record and compare new traffic
    const oldRecording = await readFileQuiet(this.composeRecordingPath());
    const oldRecordingDecodedPath = this.composeRecordingPath({
      decoded: true,
    });

    if (oldRecording === undefined) {
      throw new UnexpectedError('Reading old recording file failed');
    }

    const oldRecordingDefs = JSON.parse(oldRecording) as RecordingDefinitions;

    // Match new HTTP traffic to saved for breaking changes
    const match = await Matcher.match(oldRecordingDefs, newTraffic);

    if (match.valid) {
      // do not save new recording as there were no breaking changes found
      // only write recordings with decoded responses if they do not exist
      if (
        parseBooleanEnv(process.env.DECODE_RESPONSE) &&
        !(await exists(oldRecordingDecodedPath))
      ) {
        await this.writeDecodedRecordings(newTraffic);
      }
    } else {
      const impact = analyzeChangeImpact(match.errors);

      this.analysis = {
        impact,
        errors: match.errors,
      };

      // Save new traffic
      await writeRecordings(
        this.composeRecordingPath({ version: 'new' }),
        newTraffic
      );

      // save new traffic with decoded response
      if (parseBooleanEnv(process.env.DECODE_RESPONSE)) {
        await this.writeDecodedRecordings(newTraffic, {
          version: 'new',
        });
      }
    }
  }

  private async writeDecodedRecordings(
    recordings: RecordingDefinitions,
    pathConfig?: { version?: string }
  ): Promise<void> {
    const encodedRecordings = recordings.filter(def =>
      Array.isArray(def.response)
    );

    if (encodedRecordings.length === 0) {
      return;
    }

    const decodedRecs = await decodeRecordings(encodedRecordings);

    await writeRecordings(
      this.composeRecordingPath({ ...pathConfig, decoded: true }),
      decodedRecs
    );
  }

  private composeRecordingPath(options?: {
    version?: string;
    decoded?: boolean;
  }): string {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    if (options?.version === 'new') {
      return `${this.recordingPath}-new${
        options.decoded ? '.decoded.json' : '.json'
      }`;
    }

    if (options?.version !== undefined) {
      const baseDir = dirname(this.recordingPath);
      const hash = basename(this.recordingPath);

      return joinPath(
        baseDir,
        'old',
        `${hash}_${options.version}${
          options.decoded ? '.decoded.json' : '.json'
        }`
      );
    }

    return `${this.recordingPath}${
      options?.decoded ? '.decoded.json' : '.json'
    }`;
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
