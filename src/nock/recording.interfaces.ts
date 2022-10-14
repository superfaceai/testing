import { ReplyBody } from 'nock/types';

import { RecordingDefinition } from '../superface-test.interfaces';

export type RecordingWithDecodedResponse = RecordingDefinition & {
  decodedResponse: ReplyBody;
};

export interface TestRecordings {
  main: Record<string, RecordingWithDecodedResponse[]>;
  prepare?: Record<string, RecordingWithDecodedResponse[]>;
  teardown?: Record<string, RecordingWithDecodedResponse[]>;
}

export enum RecordingType {
  TEST = 'test',
  PREPARE = 'prepare',
  TEARDOWN = 'teardown',
}
