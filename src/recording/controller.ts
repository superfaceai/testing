import { BoundProfileProvider } from '@superfaceai/one-sdk';
import createDebug from 'debug';

import { AnalysisResult, MatchImpact } from '../analyzer';
import { InputVariables, parseBooleanEnv } from '../client';
import { BaseURLNotFoundError } from '../common/errors';
import { writeRecordings } from '../common/output-stream';
import { matchTraffic } from '../matcher/matcher';
import { endRecording, loadRecordings } from './recorder';
import { ProcessingFunction, RecordingType } from './recording.interfaces';
import { checkSensitiveInformation, replaceCredentials } from './replace/utils';
import {
  composeRecordingPath,
  decodeRecordings,
  getRecordings,
  handleRecordings,
} from './utils';

const debug = createDebug('superface:recording-controller');
const debugRecordings = createDebug('superface:testing:recordings');

export async function processAndLoadRecordings({
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

  await loadRecordings(definitions);
}

export async function endAndProcessRecording({
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
  let definitions = endRecording();
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

  definitions = await decodeRecordings(definitions);
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
      const analysis = await matchTraffic(result.oldRecordings, definitions);

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
