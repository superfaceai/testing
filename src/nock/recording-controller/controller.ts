import { BoundProfileProvider, Provider } from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import {
  BaseURLNotFoundError,
  RecordingPathUndefinedError,
  UnexpectedError,
} from '../../common/errors';
import { exists, readFileQuiet } from '../../common/io';
import { writeRecordings } from '../../common/output-stream';
import {
  IGenerator,
  InputVariables,
  NockConfig,
  ProcessingFunction,
  RecordingDefinitions,
} from '../../interfaces';
import { IRecorder, Recorder } from '../recorder/recorder';
import { checkSensitiveInformation, replaceCredentials } from './utils';

export interface IRecordingController {
  readonly nockConfig?: NockConfig;
  readonly generator: IGenerator;
  fixturesPath?: string;
  recordingPath?: string;

  setup: (input: NonPrimitive, fixtureName: string, testName?: string) => void;
  getRecordings: (version?: string) => Promise<RecordingDefinitions | undefined>;
  write: (recordings: RecordingDefinitions) => Promise<void>;
  start: () => void;
  end: (
    boundProfileProvider: BoundProfileProvider,
    provider: Provider,
    inputVariables?: InputVariables,
    options?: {
      processRecordings?: boolean;
      beforeRecordingSave?: ProcessingFunction;
    }
  ) => Promise<RecordingDefinitions | undefined>;
  loadRecordings(
    definitions: RecordingDefinitions | undefined,
    boundProfileProvider: BoundProfileProvider,
    provider: Provider,
    inputVariables?: InputVariables,
    options?: {
      processRecordings: boolean;
      beforeRecordingLoad?: ProcessingFunction;
    }
  ): Promise<void>;
  restore: () => void;
}

const debug = createDebug('superface:recording-controller');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hashing');

export class RecordingController {
  private recorder: IRecorder;
  fixturesPath?: string;
  recordingPath?: string;

  constructor(
    public readonly generator: IGenerator,
    public readonly nockConfig?: NockConfig
  ) {
    this.recorder = new Recorder(nockConfig);
  }

  setup(input: NonPrimitive, fixtureName: string, testName?: string): void {
    // Create a hash for access to recording files
    const hash = this.generator.hash({ input, testName });
    debugHashing('Created hash:', hash);

    this.setupRecordingPath(hash, fixtureName);
  }

  async getRecordings(_version?: string): Promise<RecordingDefinitions | undefined> {
    if (!this.recordingPath) {
      throw new RecordingPathUndefinedError();
    }

    const recordingExists = await exists(this.recordingPath);

    if (!recordingExists) {
      return undefined;
    }

    const definitionFile = await readFileQuiet(this.recordingPath);

    if (definitionFile === undefined) {
      throw new UnexpectedError('Reading recording file failed');
    }

    // TODO: assert structure
    return JSON.parse(definitionFile) as RecordingDefinitions;
  }

  async write(recordings: RecordingDefinitions): Promise<void> {
    if (this.recordingPath === undefined) {
      throw new RecordingPathUndefinedError();
    }

    await writeRecordings(this.recordingPath, recordings);
  }

  start(): void {
    this.recorder.start();
  }

  async end(
    boundProfileProvider: BoundProfileProvider,
    provider: Provider,
    inputVariables?: InputVariables,
    options?: {
      processRecordings?: boolean;
      beforeRecordingSave?: ProcessingFunction;
    }
  ): Promise<RecordingDefinitions | undefined> {
    const definitions = this.recorder.end();

    if (definitions === undefined || definitions.length === 0) {
      return undefined;
    }

    const { configuration } = boundProfileProvider;
    const securityValues = provider.configuration.security;
    const securitySchemes = configuration.security;
    const integrationParameters = configuration.parameters ?? {};

    if (options?.processRecordings) {
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

    if (options?.beforeRecordingSave) {
      debug(
        "Calling custom 'beforeRecordingSave' hook on recorded definitions"
      );

      await options.beforeRecordingSave(definitions);
    }

    if (
      securitySchemes.length > 0 ||
      securityValues.length > 0 ||
      (integrationParameters && Object.values(integrationParameters).length > 0)
    ) {
      checkSensitiveInformation(
        definitions,
        securitySchemes,
        securityValues,
        integrationParameters
      );
    }

    debug('Recorded definitions written');

    return definitions;
  }

  async loadRecordings(
    definitions: RecordingDefinitions | undefined,
    boundProfileProvider: BoundProfileProvider,
    provider: Provider,
    inputVariables?: InputVariables,
    options?: {
      processRecordings: boolean;
      beforeRecordingLoad?: ProcessingFunction;
    }
  ): Promise<void> {
    if (definitions === undefined) {
      return;
    }

    const { configuration } = boundProfileProvider;
    const integrationParameters = configuration.parameters ?? {};
    const securitySchemes = configuration.security;
    const securityValues = provider.configuration.security;
    const baseUrl = configuration.services.getUrl();

    if (baseUrl === undefined) {
      throw new BaseURLNotFoundError(provider.configuration.name);
    }

    if (options?.processRecordings) {
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

    await this.recorder.loadRecordings(
      definitions,
      options?.beforeRecordingLoad
    );
  }

  restore(): void {
    this.recorder.restore();
  }

  /**
   * Sets up path to recording, depends on current Superface configuration and test case input.
   */
  private setupRecordingPath(inputHash: string, fixtureName: string) {
    const { path, fixture } = this.nockConfig ?? {};

    if (this.fixturesPath === undefined) {
      this.fixturesPath = path ?? joinPath(process.cwd(), 'nock');
    }

    debugSetup('Prepare path to recording fixtures:', this.fixturesPath);

    this.recordingPath = joinPath(
      this.fixturesPath,
      fixtureName,
      `${fixture ?? 'recording'}-${inputHash}.json`
    );

    debugSetup('Prepare path to recording:', this.recordingPath);
  }
}
