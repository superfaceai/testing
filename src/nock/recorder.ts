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

import { BaseURLNotFoundError } from '../common/errors';
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
  composeRecordingPath,
  getRecordings,
  handleRecordings,
} from './recorder.utils';
import { RecordingType } from './recording.interfaces';

const debug = createDebug('superface:testing');
const debugRecordings = createDebug('superface:testing:recordings');

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
  config: { boundProfileProvider, providerName },
  inputVariables,
  options,
}: {
  recordingsPath: string;
  recordingsType: RecordingType;
  recordingsKey: string;
  recordingsHash: string;
  inputVariables?: InputVariables;
  config: {
    boundProfileProvider: BoundProfileProvider;
    providerName: string;
  };
  options?: {
    processRecordings?: boolean;
    beforeRecordingSave?: ProcessingFunction;
  };
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

  const recordingsIndex =
    recordingsType !== RecordingType.MAIN
      ? `${recordingsType}-${recordingsKey}`
      : recordingsKey;

  debugRecordings(`Recordings location: ${recordingsIndex}.${recordingsHash}`);

  if (definitions === undefined || definitions.length === 0) {
    const result = await handleRecordings({
      recordingsFilePath: path,
      newRecordingsFilePath,
      recordingsIndex,
      recordingsHash,
      canSaveNewTraffic,
      recordings: [],
    });

    if (result !== undefined) {
      if (result.kind === 'default') {
        await writeRecordings(path, result.file);
      } else if (result.kind === 'new') {
        await writeRecordings(newRecordingsFilePath, result.file);
      }
    }

    return undefined;
  }

  assertsDefinitionsAreNotStrings(definitions);

  // const securityValues = provider.configuration.security;
  const { security, parameters, services } = boundProfileProvider.configuration;
  const integrationParameters = parameters ?? {};

  if (options?.processRecordings) {
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

  if (options?.beforeRecordingSave) {
    debug("Calling custom 'beforeRecordingSave' hook on recorded definitions");

    await options.beforeRecordingSave(definitions);
  }

  if (
    security.length > 0 ||
    (integrationParameters && Object.values(integrationParameters).length > 0)
  ) {
    checkSensitiveInformation(definitions, security, integrationParameters);
  }

  const result = await handleRecordings({
    recordingsFilePath: path,
    newRecordingsFilePath,
    recordingsIndex,
    recordingsHash,
    canSaveNewTraffic,
    recordings: definitions,
  });

  if (result !== undefined) {
    if (result.kind === 'default') {
      debugRecordings('Writing to current recordings file', result.file);

      await writeRecordings(path, result.file);
    } else if (result.kind === 'new') {
      const analysis = await matchTraffic(
        result.oldRecordings ?? [],
        definitions
      );

      debugRecordings('Matched incoming traffic with old one', analysis);

      if (analysis.impact !== MatchImpact.NONE) {
        debugRecordings('Writing to new recordings file', result.file);

        await writeRecordings(newRecordingsFilePath, result.file);
      }

      debugRecordings('No impact, incoming traffic is not stored');

      return analysis;
    }

    debug('Recorded definitions written');
  }

  return undefined;
}
