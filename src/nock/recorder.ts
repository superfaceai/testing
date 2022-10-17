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
import {
  exists,
  mkdirQuiet,
  readFileQuiet,
  rename,
  rimraf,
} from '../common/io';
import { writeRecordings } from '../common/output-stream';
import {
  AnalysisResult,
  InputVariables,
  ProcessingFunction,
} from '../superface-test.interfaces';
import {
  assertsDefinitionsAreNotStrings,
  checkSensitiveInformation,
  parseBooleanEnv,
  replaceCredentials,
} from '../superface-test.utils';
import { MatchImpact } from './analyzer';
import { matchTraffic } from './matcher';
import {
  RecordingType,
  RecordingWithDecodedResponse,
  TestRecordings,
} from './recording.interfaces';

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
  recordingsPath,
  recordingsType,
  recordingsKey,
  recordingsHash,
  inputVariables,
  config: { boundProfileProvider, providerName },
  options,
}: {
  recordingsPath: string;
  recordingsType: RecordingType;
  recordingsKey: string;
  recordingsHash: string;
  config: {
    boundProfileProvider: BoundProfileProvider;
    providerName: string;
  };
  inputVariables?: InputVariables;
  options?: {
    processRecordings?: boolean;
    beforeRecordingLoad?: ProcessingFunction;
  };
}): Promise<void> {
  const definitions = await getRecordings(
    recordingsPath,
    recordingsType,
    recordingsKey,
    recordingsHash
  );
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

type UpdateResult =
  | { kind: 'default'; file: TestRecordings }
  | {
      kind: 'new';
      file: TestRecordings;
      oldRecordings: RecordingWithDecodedResponse[];
    };

async function updateRecordings(
  recordingsFile: TestRecordings,
  newRecordingsFilePath: string,
  recordingsIndex: string,
  recordingsHash: string,
  recordings: RecordingWithDecodedResponse[]
): Promise<UpdateResult | undefined> {
  let newRecordingsFile: TestRecordings | undefined;

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
  // TODO: add argument to opt in
  if (targetRecordings !== undefined) {
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

    return {
      kind: 'new',
      file: newRecordingsFile,
      oldRecordings: targetRecordings,
    };
  }

  // otherwise store specified recordings to default file
  recordingsFile = {
    ...recordingsFile,
    [recordingsIndex]: {
      ...recordingsFile[recordingsIndex],
      [recordingsHash]: recordings,
    },
  };

  return { kind: 'default', file: recordingsFile };
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
  recordingsPath,
  recordingsType,
  recordingsKey,
  recordingsHash,
  processRecordings,
  config: { boundProfileProvider, providerName },
  inputVariables,
  beforeRecordingSave,
}: {
  recordingsPath: string;
  recordingsType: RecordingType;
  recordingsKey: string;
  recordingsHash: string;
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

  const path = composeRecordingPath(recordingsPath);
  const newRecordingsFilePath = composeRecordingPath(recordingsPath, 'new');
  const canSaveNewTraffic = parseBooleanEnv(process.env.STORE_NEW_TRAFFIC);
  let recordingsFile: TestRecordings;

  const recordingsIndex =
    recordingsType !== RecordingType.MAIN
      ? `${recordingsType}-${recordingsKey}`
      : recordingsKey;

  if (definitions === undefined || definitions.length === 0) {
    let result;

    if (await exists(path)) {
      recordingsFile = await parseRecordingsFile(path);

      result = await updateRecordings(
        recordingsFile,
        newRecordingsFilePath,
        recordingsIndex,
        recordingsHash,
        []
      );
    } else {
      recordingsFile = {
        [recordingsIndex]: {
          [recordingsHash]: [],
        },
      };

      result = {
        kind: 'default',
        file: recordingsFile,
      };
    }

    if (result !== undefined) {
      if (result.kind === 'default') {
        await writeRecordings(path, result.file);
      } else if (result.kind === 'new' && canSaveNewTraffic) {
        await writeRecordings(newRecordingsFilePath, result.file);
      }
    }

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

  let result;
  if (await exists(path)) {
    recordingsFile = await parseRecordingsFile(path);

    result = await updateRecordings(
      recordingsFile,
      newRecordingsFilePath,
      recordingsIndex,
      recordingsHash,
      definitions as RecordingWithDecodedResponse[]
    );
  } else {
    recordingsFile = {
      [recordingsIndex]: {
        [recordingsHash]: definitions as RecordingWithDecodedResponse[],
      },
    };

    result = {
      kind: 'default',
      file: recordingsFile,
    };
  }

  if (result !== undefined) {
    if (result.kind === 'default') {
      await writeRecordings(path, result.file);
    } else if (result.kind === 'new') {
      if (canSaveNewTraffic) {
        const analysis = await matchTraffic(
          result.oldRecordings ?? [],
          definitions
        );

        if (analysis.impact !== MatchImpact.NONE) {
          await writeRecordings(newRecordingsFilePath, result.file);
        }

        return analysis;
      } else {
        // REWRITING old file
        console.warn(`Rewriting recording file at ${path}\nRecording index path: ${recordingsIndex}.${recordingsHash}`)
        await writeRecordings(path, result.file);
      }
    }

    debug('Recorded definitions written');
  }

  return undefined;
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

export async function getRecordings(
  recordingsPath: string,
  recordingsType: RecordingType,
  recordingsKey: string,
  recordingsHash: string
): Promise<RecordingWithDecodedResponse[]> {
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

export function findRecordings(
  recordingsFile: TestRecordings,
  recordingsIndex: string,
  recordingsHash: string
): RecordingWithDecodedResponse[] | undefined {
  if (recordingsFile[recordingsIndex] === undefined) {
    return undefined;
  }

  return recordingsFile[recordingsIndex][recordingsHash];
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
