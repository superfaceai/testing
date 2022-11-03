import { BoundProfileProvider } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { decodeBuffer } from 'http-encoding';
import {
  activate as activateNock,
  define as loadRecordingDefinitions,
  disableNetConnect,
  isActive as isNockActive,
  recorder,
  ReplyBody,
  restore as restoreRecordings,
} from 'nock';
import { basename, dirname, join as joinPath } from 'path';
import { URLSearchParams } from 'url';

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
  let definitions = recorder.play();
  recorder.clear();
  restoreRecordings();

  debug(
    'Recording ended - Restored HTTP requests and cleared recorded traffic'
  );

  const recordingExists = await exists(composeRecordingPath(recordingPath));
  if (definitions === undefined || definitions.length === 0) {
    const path = composeRecordingPath(
      recordingPath,
      recordingExists ? { version: 'new' } : undefined
    );

    await writeRecordings(path, []);

    return undefined;
  }

  assertsDefinitionsAreNotStrings(definitions);

  definitions = await decodeRecordings(definitions);
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
    (integrationParameters &&
      Object.values(integrationParameters).length > 0) ||
    (inputVariables && Object.values(inputVariables).length > 0)
  ) {
    checkSensitiveInformation(
      definitions,
      security,
      integrationParameters,
      inputVariables
    );
  }

  if (recordingExists) {
    return await matchTraffic(recordingPath, definitions);
  }

  // recording file does not exist -> record new traffic
  const path = composeRecordingPath(recordingPath);

  await writeRecordings(path, definitions);

  debug('Recorded definitions written');

  return undefined;
}

export function composeRecordingPath(
  recordingPath: string,
  options?: {
    version?: string;
  }
): string {
  if (options?.version === 'new') {
    return `${recordingPath}-new.json`;
  }

  if (options?.version !== undefined) {
    const baseDir = dirname(recordingPath);
    const hash = basename(recordingPath);

    return joinPath(baseDir, 'old', `${hash}-${options.version}.json`);
  }

  return `${recordingPath}.json`;
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

  if (contentEncoding === undefined) {
    return recording;
  }

  const decodedResponse = await decodeResponse(
    recording.response,
    contentEncoding
  );

  return {
    ...recording,
    decodedResponse,
  };
}

export function getRequestHeaderValue(
  headerName: string,
  payload: Record<string, string | string[]>
): string | string[] | undefined {
  const headerKey = Object.keys(payload).find(
    key => key.toLowerCase() === headerName.toLowerCase()
  );

  return headerKey ? payload[headerKey] : undefined;
}

export function getResponseHeaderValue(
  headerName: string,
  payload: string[]
): string | undefined {
  for (let i = 0; i < payload.length; i += 2) {
    if (payload[i].toLowerCase() === headerName.toLowerCase()) {
      return payload[i + 1];
    }
  }

  return undefined;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function composeBuffer(response: any[]): Buffer {
  return Buffer.concat(response.map(res => Buffer.from(res, 'hex')));
}

export async function decodeResponse(
  response: ReplyBody | undefined,
  contentEncoding: string
): Promise<ReplyBody | undefined> {
  if (response === undefined) {
    return response;
  }

  if (!Array.isArray(response)) {
    throw new UnexpectedError(
      `Response is encoded by "${contentEncoding}" and is not an array`
    );
  }

  const buffer = composeBuffer(response);

  if (contentEncoding.toLowerCase() === 'gzip') {
    return JSON.parse(
      (await decodeBuffer(buffer, contentEncoding)).toString()
    ) as ReplyBody;
  } else {
    throw new UnexpectedError(
      `Content encoding ${contentEncoding} is not supported`
    );
  }
}

/**
 * Expect something like `To=%2Bxxx&From=%2Bxxx&Body=Hello+World%21`
 * and want back: `{ To: "+xxx", From: "+xxx", Body: "Hello World!" }`
 *
 * Limitation:
 *  since URLSearchParams always transform params to string we can't
 *  generate correct schema for this if it contains numbers or booleans
 */
export function parseBody(
  body: string,
  _accept?: string
): Record<string, unknown> | undefined {
  if (body === '') {
    return undefined;
  }

  const parsedBody = decodeURIComponent(body);
  const result: Record<string, unknown> = {};
  const params = new URLSearchParams(parsedBody);

  for (const [key, value] of params.entries()) {
    // parse value
    let parsedValue: unknown;
    if (value.startsWith('{') || value.startsWith('[')) {
      parsedValue = JSON.parse(value);
    } else {
      parsedValue = value;
    }

    result[key] = parsedValue;
  }

  return result;
}
