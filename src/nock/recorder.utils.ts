import createDebug from 'debug';
import { basename, dirname, join as joinPath } from 'path';

import {
  RecordingsFileNotFoundError,
  RecordingsHashNotFoundError,
  RecordingsIndexNotFoundError,
  UnexpectedError,
} from '../common/errors';
import {
  exists,
  mkdirQuiet,
  readFileQuiet,
  rename,
  rimraf,
} from '../common/io';
import { writeRecordings } from '../common/output-stream';
import { RecordingDefinitions } from '../superface-test.interfaces';
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
    throw new RecordingsFileNotFoundError(path);
  }

  const useNewTraffic = parseBooleanEnv(process.env.USE_NEW_TRAFFIC);
  const newRecordingsPath = composeRecordingPath(recordingsPath, 'new');
  const newRecordingsFileExists = await exists(newRecordingsPath);

  if (useNewTraffic && !newRecordingsFileExists) {
    throw new RecordingsFileNotFoundError(newRecordingsPath);
  }

  const finalPath = useNewTraffic ? newRecordingsPath : path;
  const recordingsIndex =
    recordingsType !== RecordingType.MAIN
      ? `${recordingsType}-${recordingsKey}`
      : recordingsKey;

  const recordings = (await parseRecordingsFile(finalPath))[recordingsIndex];

  if (recordings === undefined) {
    throw new RecordingsIndexNotFoundError(finalPath, recordingsIndex);
  }

  const finalRecordings = recordings[recordingsHash];

  if (finalRecordings === undefined) {
    throw new RecordingsHashNotFoundError(
      finalPath,
      recordingsIndex,
      recordingsHash
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
