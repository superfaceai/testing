import createDebug from 'debug';
import { decodeBuffer } from 'http-encoding';
import { ReplyBody } from 'nock/types';
import { basename, dirname, join as joinPath } from 'path';
import { URLSearchParams } from 'url';

import { RecordingsNotFoundError, UnexpectedError } from '../common/errors';
import {
  exists,
  mkdirQuiet,
  readFileQuiet,
  rename,
  rimraf,
} from '../common/io';
import { writeRecordings } from '../common/output-stream';
import {
  RecordingDefinition,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import { parseBooleanEnv } from '../superface-test.utils';
import { RecordingType, TestRecordings } from './recording.interfaces';

const debug = createDebug('superface:testing');
const debugRecordings = createDebug('superface:testing:recordings');

export async function getRecordings(
  recordingsPath: string,
  recordingsType: RecordingType,
  recordingsKey: string,
  recordingsHash: string
): Promise<RecordingDefinitions> {
  // try to get new recordings if environment variable is set
  const path = composeRecordingPath(recordingsPath);
  const recordingsFileExists = await exists(path);

  if (!recordingsFileExists) {
    throw new RecordingsNotFoundError(path);
  }

  const useNewTraffic = parseBooleanEnv(process.env.USE_NEW_TRAFFIC);
  const newRecordingsPath = composeRecordingPath(recordingsPath, 'new');
  const newRecordingsFileExists = await exists(newRecordingsPath);

  if (useNewTraffic && !newRecordingsFileExists) {
    throw new RecordingsNotFoundError(newRecordingsPath);
  }

  const finalPath = useNewTraffic ? newRecordingsPath : path;
  const recordingsIndex =
    recordingsType !== RecordingType.MAIN
      ? `${recordingsType}-${recordingsKey}`
      : recordingsKey;

  const recordings = (await parseRecordingsFile(finalPath))[recordingsIndex];

  if (recordings === undefined) {
    throw new Error(
      `Recording under ${recordingsIndex} can't be found at ${finalPath}.`
    );
  }

  const finalRecordings = recordings[recordingsHash];

  // TODO: add new specific error
  if (finalRecordings === undefined) {
    throw new UnexpectedError(
      `Recordings under hash ${recordingsHash} are not found. At ${finalPath}`
    );
  }

  return finalRecordings;
}

export type UpdateResult =
  | { kind: 'default'; file: TestRecordings }
  | {
      kind: 'new';
      file: TestRecordings;
      oldRecordings: RecordingDefinitions;
    };

function findRecordings(
  recordingsFile: TestRecordings,
  recordingsIndex: string,
  recordingsHash: string
): RecordingDefinitions | undefined {
  if (recordingsFile[recordingsIndex] === undefined) {
    return undefined;
  }

  return recordingsFile[recordingsIndex][recordingsHash];
}

async function updateNewRecordingFile(
  newRecordingsFilePath: string,
  recordingsIndex: string,
  recordingsHash: string,
  recordings: RecordingDefinitions
): Promise<TestRecordings> {
  let newRecordingsFile: TestRecordings;

  if (await exists(newRecordingsFilePath)) {
    newRecordingsFile = await parseRecordingsFile(newRecordingsFilePath);

    newRecordingsFile = {
      ...newRecordingsFile,
      [recordingsIndex]: {
        ...newRecordingsFile[recordingsIndex],
        [recordingsHash]: recordings,
      },
    };
  } else {
    newRecordingsFile = {
      [recordingsIndex]: {
        [recordingsHash]: recordings,
      },
    };
  }

  return newRecordingsFile;
}

async function updateRecordings({
  recordings,
  recordingsFilePath,
  newRecordingsFilePath,
  recordingsIndex,
  recordingsHash,
  canSaveNewTraffic,
}: {
  recordings: RecordingDefinitions;
  recordingsFilePath: string;
  newRecordingsFilePath: string;
  recordingsIndex: string;
  recordingsHash: string;
  canSaveNewTraffic: boolean;
}): Promise<UpdateResult | undefined> {
  const recordingsFile = await parseRecordingsFile(recordingsFilePath);
  const targetRecordings = findRecordings(
    recordingsFile,
    recordingsIndex,
    recordingsHash
  );

  // if there already exist recordings for specified hash with empty list
  // do not overwrite - return
  if (
    targetRecordings !== undefined &&
    targetRecordings.length === 0 &&
    recordings.length === 0
  ) {
    return undefined;
  }

  // if there already exist recordings for specified hash with some recordings
  // save new traffic to new file
  if (canSaveNewTraffic && targetRecordings !== undefined) {
    return {
      kind: 'new',
      file: await updateNewRecordingFile(
        newRecordingsFilePath,
        recordingsIndex,
        recordingsHash,
        recordings
      ),
      oldRecordings: targetRecordings,
    };
  }

  // otherwise store specified recordings to default file
  return {
    kind: 'default',
    file: {
      ...recordingsFile,
      [recordingsIndex]: {
        ...recordingsFile[recordingsIndex],
        [recordingsHash]: recordings,
      },
    },
  };
}

export async function handleRecordings({
  recordingsFilePath,
  newRecordingsFilePath,
  recordingsIndex,
  recordingsHash,
  recordings,
  canSaveNewTraffic,
}: {
  recordingsFilePath: string;
  newRecordingsFilePath: string;
  recordingsIndex: string;
  recordingsHash: string;
  recordings: RecordingDefinitions;
  canSaveNewTraffic: boolean;
}): Promise<UpdateResult | undefined> {
  if (await exists(recordingsFilePath)) {
    return await updateRecordings({
      recordings,
      recordingsFilePath,
      newRecordingsFilePath,
      recordingsIndex,
      recordingsHash,
      canSaveNewTraffic,
    });
  }

  return {
    kind: 'default',
    file: {
      [recordingsIndex]: {
        [recordingsHash]: recordings,
      },
    },
  };
}

export function composeRecordingPath(
  recordingPath: string,
  version?: string
): string {
  if (version === 'new') {
    return `${recordingPath}-new.json`;
  }

  if (version !== undefined) {
    const baseDir = dirname(recordingPath);
    const baseName = basename(recordingPath);

    return joinPath(baseDir, 'old', `${baseName}_${version}.json`);
  }

  return `${recordingPath}.json`;
}

export async function parseRecordingsFile(
  path: string
): Promise<TestRecordings> {
  const definitionFile = await readFileQuiet(path);

  if (definitionFile === undefined) {
    throw new UnexpectedError('Reading new recording file failed');
  }

  debug(`Parsing recording file at: "${path}"`);

  return JSON.parse(definitionFile) as TestRecordings;
}

export async function updateTraffic(recordingPath: string): Promise<void> {
  const pathToCurrent = composeRecordingPath(recordingPath);
  const pathToNew = composeRecordingPath(recordingPath, 'new');

  await mkdirQuiet(joinPath(dirname(pathToCurrent), 'old'));

  // TODO: compose version based on used map
  let i = 0;
  while (await exists(composeRecordingPath(recordingPath, `${i}`))) {
    i++;
  }

  const currentTestFile = await parseRecordingsFile(pathToCurrent);
  const newTestFile = await parseRecordingsFile(pathToNew);

  debugRecordings('Current recordings file:', currentTestFile);
  debugRecordings('New recordings file:', newTestFile);

  // loop through new file and merge it with current one
  for (const [index, recordOfRecordings] of Object.entries(newTestFile)) {
    if (currentTestFile[index] === undefined) {
      currentTestFile[index] = recordOfRecordings;
    } else {
      for (const [hash, recordings] of Object.entries(recordOfRecordings)) {
        currentTestFile[index][hash] = recordings;
      }
    }
  }

  debugRecordings('Current recordings file after merge:', currentTestFile);

  // move old current file to directory /old
  await rename(pathToCurrent, composeRecordingPath(recordingPath, `${i}`));
  // write merged file in place of current file
  await writeRecordings(pathToCurrent, currentTestFile);
  // remove new file
  await rimraf(pathToNew);
}

export async function canUpdateTraffic(
  recordingPath: string
): Promise<boolean> {
  const updateTraffic = parseBooleanEnv(process.env.UPDATE_TRAFFIC);

  if (
    updateTraffic &&
    (await exists(composeRecordingPath(recordingPath, 'new')))
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

  if (contentEncoding) {
    recording.decodedResponse = await decodeResponse(
      recording.response,
      contentEncoding
    );
  }

  return recording;
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

const migrateDebug = createDebug('superface:testing:migrate');
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
    const parsedResponse = (await decodeBuffer(buffer, contentEncoding)).toString();
    migrateDebug('response decoded:', parsedResponse);

    try {
      return JSON.parse(parsedResponse) as ReplyBody;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return parsedResponse;
      }

      throw error;
    }
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
