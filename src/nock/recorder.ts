import {
  BoundProfileProvider,
  Provider,
  UnexpectedError,
} from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
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
  BaseURLNotFoundError,
  FixturesPathUndefinedError,
  RecordingPathUndefinedError,
  RecordingsNotFoundError,
} from '../common/errors';
import { exists, readFileQuiet } from '../common/io';
import { writeRecordings } from '../common/output-stream';
import { IGenerator } from '../generate-hash';
import {
  InputVariables,
  NockConfig,
  ProcessingFunction,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import {
  assertsDefinitionsAreNotStrings,
  checkSensitiveInformation,
  replaceCredentials,
} from '../superface-test.utils';

export interface IRecorder {
  readonly generator: IGenerator;
  readonly nockConfig?: NockConfig;
  fixturesPath?: string;
  recordingPath?: string;

  setup: (input: NonPrimitive, fixtureName: string, testName?: string) => void;
  start: (
    record: boolean,
    processRecordings: boolean,
    provider: Provider,
    boundProfileProvider: BoundProfileProvider,
    inputVariables?: InputVariables,
    beforeRecordingLoad?: ProcessingFunction
  ) => Promise<void>;
  end: (
    record: boolean,
    processRecordings: boolean,
    provider: Provider,
    boundProfileProvider: BoundProfileProvider,
    inputVariables?: InputVariables,
    beforeRecordingSave?: ProcessingFunction
  ) => Promise<void>;
  restore: () => void;
}

const debug = createDebug('superface:recording');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hash');

export class Recorder {
  fixturesPath?: string;
  recordingPath?: string;

  constructor(
    public readonly generator: IGenerator,
    public readonly nockConfig?: NockConfig
  ) {
    this.setupFixturesPath();
  }

  setup(input: NonPrimitive, fixtureName: string, testName?: string): void {
    // Create a hash for access to recording files
    const hash = this.generator.hash({ input, testName });
    debugHashing('Created hash:', hash);

    this.setupRecordingPath(fixtureName, hash);
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
  async start(
    record: boolean,
    processRecordings: boolean,
    provider: Provider,
    boundProfileProvider: BoundProfileProvider,
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
        provider,
        boundProfileProvider,
        inputVariables,
        beforeRecordingLoad
      );
    }
  }

  private async loadRecordings(
    processRecordings: boolean,
    provider: Provider,
    boundProfileProvider: BoundProfileProvider,
    inputVariables?: InputVariables,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void> {
    const { configuration } = boundProfileProvider;
    const integrationParameters = configuration.parameters ?? {};
    const securitySchemes = configuration.security;
    const securityValues = provider.configuration.security;
    const baseUrl = configuration.services.getUrl();

    if (baseUrl === undefined) {
      throw new BaseURLNotFoundError(provider.configuration.name);
    }

    const definitions = await this.getRecordings();

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

  private async getRecordings(): Promise<RecordingDefinitions> {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    const recordingExists = await exists(this.recordingPath);

    if (!recordingExists) {
      throw new RecordingsNotFoundError();
    }

    const definitionFile = await readFileQuiet(this.recordingPath);

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
  async end(
    record: boolean,
    processRecordings: boolean,
    provider: Provider,
    boundProfileProvider: BoundProfileProvider,
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

      const { configuration } = boundProfileProvider;
      const securityValues = provider.configuration.security;
      const securitySchemes = configuration.security;
      const integrationParameters = configuration.parameters ?? {};

      if (processRecordings) {
        const baseUrl = configuration.services.getUrl();

        if (baseUrl === undefined) {
          throw new BaseURLNotFoundError(provider.configuration.name);
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

  restore(): void {
    restoreRecordings();
    recorder.clear();
    enableNetConnect();
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
}
