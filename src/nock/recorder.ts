import { BoundProfileProvider } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import {
  activate as activateNock,
  define,
  disableNetConnect,
  isActive as isNockActive,
  recorder,
  restore as restoreRecordings,
} from 'nock';

import {
  BaseURLNotFoundError,
  RecordingsNotFoundError,
  UnexpectedError,
} from '../common/errors';
import { exists, readFileQuiet } from '../common/io';
import { writeRecordings } from '../common/output-stream';
import {
  InputVariables,
  ProcessingFunction,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import {
  assertsDefinitionsAreNotStrings,
  checkSensitiveInformation,
  replaceCredentials,
} from '../superface-test.utils';

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
}) {
  const { parameters, security, services } = boundProfileProvider.configuration;
  const integrationParameters = parameters ?? {};
  const baseUrl = services.getUrl();

  if (baseUrl === undefined) {
    throw new BaseURLNotFoundError(providerName);
  }

  const recordingExists = await exists(recordingPath);

  if (!recordingExists) {
    throw new RecordingsNotFoundError();
  }

  const definitionFile = await readFileQuiet(recordingPath);

  if (definitionFile === undefined) {
    throw new UnexpectedError('Reading recording file failed');
  }

  const definitions = JSON.parse(definitionFile) as RecordingDefinitions;

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

  define(definitions);

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
}): Promise<void> {
  const definitions = recorder.play();
  recorder.clear();
  restoreRecordings();

  debug(
    'Recording ended - Restored HTTP requests and cleared recorded traffic'
  );

  if (definitions === undefined || definitions.length === 0) {
    await writeRecordings(recordingPath, []);

    return;
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
    // securityValues.length > 0 ||
    (integrationParameters && Object.values(integrationParameters).length > 0)
  ) {
    checkSensitiveInformation(definitions, security, integrationParameters);
  }

  await writeRecordings(recordingPath, definitions);
  debug('Recorded definitions written');
}
