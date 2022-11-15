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
  NockConfig,
  RecordingDefinitions,
} from '../recording/recording.interfaces';
import { assertsDefinitionsAreNotStrings } from './utils';

const debug = createDebug('superface:recording');

/**
 * Starts recording or loads recording fixture if exists.
 *
 * It will also process recording definitions before creating mocked requests
 * to match against constructed request and enable mocking them. This is needed
 * because stored recording fixture is possibly processed and contains placeholders
 * instead of original secrets.
 *
 * Recordings do not get processed if user specifies parameter `processRecordings` as false.
 */
export function startRecording(nockConfig?: NockConfig): void {
  const enable_reqheaders_recording =
    nockConfig?.enableReqheadersRecording ?? false;

  recorder.rec({
    dont_print: true,
    output_objects: true,
    use_separator: false,
    enable_reqheaders_recording,
  });

  debug('Recording HTTP traffic started');
}

/**
 * Checks if recording started and if yes, it ends recording and
 * saves recording to file configured based on nock configuration from constructor.
 *
 * It will also process the recording definitions and hide sensitive information
 * based on security schemes and integration parameters defined in provider.json,
 * unless user pass in false for parameter `processRecordings`.
 */
export function endRecording(): RecordingDefinitions {
  const definitions = recorder.play();
  assertsDefinitionsAreNotStrings(definitions);

  recorder.clear();
  restoreRecordings();

  debug(
    'Recording ended - Restored HTTP requests and cleared recorded traffic'
  );

  return definitions;
}

export async function loadRecordings(
  definitions: RecordingDefinitions
): Promise<void> {
  define(definitions);

  debug('Loaded and mocked recorded traffic based on recording fixture');

  disableNetConnect();

  if (!isNockActive()) {
    activateNock();
  }
}
