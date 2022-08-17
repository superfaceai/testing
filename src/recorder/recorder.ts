import createDebug from 'debug';
import {
  activate as activateNock,
  define,
  disableNetConnect,
  enableNetConnect,
  isActive as isNockActive,
  recorder,
  restore as restoreRecordings,
} from 'nock';

import {
  NockConfig,
  ProcessingFunction,
  RecordingDefinitions,
} from '../interfaces';
import {
  assertsDefinitionsAreNotStrings,
} from './utils';

export interface IRecorder {
  readonly nockConfig?: NockConfig;

  start: () => void;
  end: () => RecordingDefinitions;
  loadRecordings(
    definitions: RecordingDefinitions,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void>;
  restore: () => void;
}

const debug = createDebug('superface:recording');

export class Recorder {
  constructor(
    public readonly nockConfig?: NockConfig
  ) {}

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
  start(): void {
    const enable_reqheaders_recording =
      this.nockConfig?.enableReqheadersRecording ?? false;

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
  end(): RecordingDefinitions {
    const definitions = recorder.play();
    assertsDefinitionsAreNotStrings(definitions);

    recorder.clear();
    restoreRecordings();

    debug(
      'Recording ended - Restored HTTP requests and cleared recorded traffic'
    );

    return definitions;
  }

  async loadRecordings(
    definitions: RecordingDefinitions,
    beforeRecordingLoad?: ProcessingFunction
  ): Promise<void> {
    if (beforeRecordingLoad) {
      debug(
        "Calling custom 'beforeRecordingLoad' hook on loaded recording definitions"
      );

      await beforeRecordingLoad(definitions);
    }

    define(definitions);

    debug('Loaded and mocked recorded traffic based on recording fixture');

    disableNetConnect();

    if (!isNockActive()) {
      activateNock();
    }
  }

  restore(): void {
    restoreRecordings();

    // TODO: test this
    recorder.clear();

    enableNetConnect();
  }
}
