import { BoundProfileProvider, Provider } from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import { BaseURLNotFoundError, UnexpectedError } from '../common/errors';
import { exists, readFileQuiet } from '../common/io';
import {
  CompleteSuperfaceTestConfig,
  IGenerator,
  InputVariables,
  NockConfig,
  ProcessingFunction,
  RecordingDefinitions,
} from '../interfaces';
import { endRecording, loadRecordings } from './recorder';
import { checkSensitiveInformation, replaceCredentials } from './utils';

const debug = createDebug('superface:recording-controller');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hashing');

/**
 * Sets up path to recording, depends on current Superface configuration and test case input.
 */
export function setupRecordingPath(
  generator: IGenerator,
  input: NonPrimitive,
  fixtureName: string,
  options?: { nockConfig?: NockConfig; testName?: string }
): string {
  // Create a hash for access to recording files
  const hash = generator.hash({ input, testName: options?.testName });
  debugHashing('Created hash:', hash);

  const { path, fixture } = options?.nockConfig ?? {};
  const fixturesPath = path ?? joinPath(process.cwd(), 'nock');

  debugSetup('Prepare path to recording fixtures:', fixturesPath);

  const recordingPath = joinPath(
    fixturesPath,
    fixtureName,
    `${fixture ?? 'recording'}-${hash}.json`
  );

  debugSetup('Prepare path to recording:', recordingPath);

  return recordingPath;
}

export async function getRecordings(
  recordingPath: string,
  _version?: string
): Promise<RecordingDefinitions | undefined> {
  const recordingExists = await exists(recordingPath);

  if (!recordingExists) {
    return undefined;
  }

  const definitionFile = await readFileQuiet(recordingPath);

  if (definitionFile === undefined) {
    throw new UnexpectedError('Reading recording file failed');
  }

  // TODO: assert structure
  return JSON.parse(definitionFile) as RecordingDefinitions;
}

export async function endAndProcessRecording(
  {
    provider,
    boundProfileProvider,
  }: Pick<CompleteSuperfaceTestConfig, 'provider' | 'boundProfileProvider'>,
  inputVariables?: InputVariables,
  options?: {
    processRecordings?: boolean;
    beforeRecordingSave?: ProcessingFunction;
  }
): Promise<RecordingDefinitions | undefined> {
  const definitions = endRecording();

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
    debug("Calling custom 'beforeRecordingSave' hook on recorded definitions");

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

export async function processAndLoadRecordings(
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

  await loadRecordings(definitions, options?.beforeRecordingLoad);
}
