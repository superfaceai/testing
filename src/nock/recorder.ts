import { BoundProfileProvider } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import {
  activate as activateNock,
  define as loadRecordingDefinitions,
  disableNetConnect,
  isActive as isNockActive,
  recorder,
  restore as restoreRecordings,
} from 'nock';
import { basename, dirname, join as joinPath } from 'path';

import {
  BaseURLNotFoundError,
  RecordingsNotFoundError,
  UnexpectedError,
} from '../common/errors';
import { exists, mkdirQuiet, readFileQuiet, rename } from '../common/io';
import { writeRecordings } from '../common/output-stream';
import {
  AnalysisResult,
  InputVariables,
  ProcessingFunction,
  RecordingDefinition,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import {
  assertsDefinitionsAreNotStrings,
  checkSensitiveInformation,
  parseBooleanEnv,
  replaceCredentials,
} from '../superface-test.utils';
import { matchTraffic } from './matcher';
import { decodeResponse, getResponseHeaderValue } from './matcher.utils';

const debug = createDebug('superface:testing');

/**
 * Starts recording HTTP traffic.
 */
export async function startRecording(
  enableReqheadersRecording?: boolean
): Promise<void> {
  const enable_reqheaders_recording = enableReqheadersRecording ?? false;

  recorder.rec({
    dont_print: true,
    output_objects: true,
    use_separator: false,
    enable_reqheaders_recording,
  });

  debug('Recording HTTP traffic started');
}

/**
 * Loads recorded traffic and mock it.
 *
 * It will also process recording definitions before creating mocked requests
 * to match against constructed request and enable mocking them. This is needed
 * because stored recording fixture is possibly processed and contains placeholders
 * instead of original secrets.
 *
 * Recordings do not get processed if user specifies parameter `processRecordings` as false.
 */
export async function loadRecording({
  recordingPath,
  inputVariables,
  config: { boundProfileProvider, providerName },
  options,
}: {
  recordingPath: string;
  inputVariables?: InputVariables;
  config: {
    boundProfileProvider: BoundProfileProvider;
    providerName: string;
  };
  options?: {
    processRecordings?: boolean;
    beforeRecordingLoad?: ProcessingFunction;
  };
}): Promise<void> {
  const definitions = await getRecordings(recordingPath);
  const { parameters, security, services } = boundProfileProvider.configuration;
  const integrationParameters = parameters ?? {};
  const baseUrl = services.getUrl();

  if (baseUrl === undefined) {
    throw new BaseURLNotFoundError(providerName);
  }

  if (options?.processRecordings) {
    //Use security configuration only
    replaceCredentials({
      definitions,
      security,
      integrationParameters,
      inputVariables,
      baseUrl,
      beforeSave: false,
    });
  }

  if (options?.beforeRecordingLoad) {
    debug(
      "Calling custom 'beforeRecordingLoad' hook on loaded recording definitions"
    );

    await options.beforeRecordingLoad(definitions);
  }

  loadRecordingDefinitions(definitions);

  debug('Loaded and mocked recorded traffic based on recording fixture');

  disableNetConnect();

  if (!isNockActive()) {
    activateNock();
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
export async function endRecording({
  recordingPath,
  processRecordings,
  config: { boundProfileProvider, providerName },
  inputVariables,
  beforeRecordingSave,
}: {
  recordingPath: string;
  processRecordings: boolean;
  config: {
    boundProfileProvider: BoundProfileProvider;
    providerName: string;
  };
  inputVariables?: InputVariables;
  beforeRecordingSave?: ProcessingFunction;
}): Promise<AnalysisResult | undefined> {
  const definitions = recorder.play();
  recorder.clear();
  restoreRecordings();

  debug(
    'Recording ended - Restored HTTP requests and cleared recorded traffic'
  );

  const recordingExists = await exists(composeRecordingPath(recordingPath));
  if (definitions === undefined || definitions.length === 0) {
    await writeRecordings(
      composeRecordingPath(
        recordingPath,
        recordingExists ? { version: 'new' } : undefined
      ),
      []
    );

    return undefined;
  }

  assertsDefinitionsAreNotStrings(definitions);

  // const securityValues = provider.configuration.security;
  const { security, parameters, services } = boundProfileProvider.configuration;
  const integrationParameters = parameters ?? {};

  if (processRecordings) {
    const baseUrl = services.getUrl();

    if (baseUrl === undefined) {
      throw new BaseURLNotFoundError(providerName);
    }

    replaceCredentials({
      definitions,
      security,
      integrationParameters,
      inputVariables,
      baseUrl,
      beforeSave: true,
    });
  }

  if (beforeRecordingSave) {
    debug("Calling custom 'beforeRecordingSave' hook on recorded definitions");

    await beforeRecordingSave(definitions);
  }

  if (
    security.length > 0 ||
    (integrationParameters && Object.values(integrationParameters).length > 0)
  ) {
    checkSensitiveInformation(definitions, security, integrationParameters);
  }

  if (recordingExists) {
    return await matchTraffic(recordingPath, definitions);
  }

  // recording file does not exist -> record new traffic
  await writeRecordings(composeRecordingPath(recordingPath), definitions);
  // save recording with decoded response
  if (parseBooleanEnv(process.env.DECODE_RESPONSE)) {
    await writeDecodedRecordings(recordingPath, definitions);
  }

  debug('Recorded definitions written');

  return undefined;
}

export function composeRecordingPath(
  recordingPath: string,
  options?: {
    version?: string;
    decoded?: boolean;
  }
): string {
  if (options?.version === 'new') {
    return `${recordingPath}-new${options.decoded ? '.decoded.json' : '.json'}`;
  }

  if (options?.version !== undefined) {
    const baseDir = dirname(recordingPath);
    const hash = basename(recordingPath);

    return joinPath(
      baseDir,
      'old',
      `${hash}_${options.version}${options.decoded ? '.decoded.json' : '.json'}`
    );
  }

  return `${recordingPath}${options?.decoded ? '.decoded.json' : '.json'}`;
}

export async function getRecordings(
  recordingPath: string
): Promise<RecordingDefinitions> {
  // try to get new recordings if environment variable is set
  const useNewTraffic = parseBooleanEnv(process.env.USE_NEW_TRAFFIC);
  const newRecordingPath = composeRecordingPath(recordingPath, {
    version: 'new',
  });

  if (useNewTraffic && (await exists(newRecordingPath))) {
    return await parseRecordings(newRecordingPath);
  }

  // otherwise use default ones
  const currentRecordingPath = composeRecordingPath(recordingPath);
  const recordingExists = await exists(currentRecordingPath);

  if (!recordingExists) {
    throw new RecordingsNotFoundError(currentRecordingPath);
  }

  return await parseRecordings(currentRecordingPath);
}

export async function parseRecordings(
  path: string
): Promise<RecordingDefinitions> {
  const definitionFile = await readFileQuiet(path);

  if (definitionFile === undefined) {
    throw new UnexpectedError('Reading new recording file failed');
  }

  debug(`Parsing recording file at: "${path}"`);

  return JSON.parse(definitionFile) as RecordingDefinitions;
}

export async function updateTraffic(recordingPath: string): Promise<void> {
  const pathToCurrent = composeRecordingPath(recordingPath);
  const pathToNew = composeRecordingPath(recordingPath, { version: 'new' });

  await mkdirQuiet(joinPath(dirname(pathToCurrent), 'old'));

  // TODO: compose version based on used map
  let i = 0;
  while (
    await exists(composeRecordingPath(recordingPath, { version: `${i}` }))
  ) {
    i++;
  }

  await rename(
    pathToCurrent,
    composeRecordingPath(recordingPath, { version: `${i}` })
  );
  await rename(pathToNew, pathToCurrent);
}

export async function canUpdateTraffic(
  recordingPath: string
): Promise<boolean> {
  const updateTraffic = parseBooleanEnv(process.env.UPDATE_TRAFFIC);

  if (
    updateTraffic &&
    (await exists(composeRecordingPath(recordingPath, { version: 'new' })))
  ) {
    return true;
  }

  return false;
}

export async function writeDecodedRecordings(
  recordingPath: string,
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
    composeRecordingPath(recordingPath, { ...pathConfig, decoded: true }),
    decodedRecs
  );
}

export async function decodeRecordings(
  recordings: RecordingDefinition[]
): Promise<RecordingDefinition[]> {
  return Promise.all(recordings.map(decodeRecordingResponse));
}

export async function decodeRecordingResponse(
  recording: RecordingDefinition
): Promise<RecordingDefinition> {
  const contentEncoding = getResponseHeaderValue(
    'Content-Encoding',
    recording.rawHeaders ?? []
  );

  const response = await decodeResponse(recording.response, contentEncoding);

  return { ...recording, response };
}
