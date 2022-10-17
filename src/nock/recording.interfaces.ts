import { ReplyBody } from 'nock/types';

import { RecordingDefinition } from '../superface-test.interfaces';

export type RecordingWithDecodedResponse = RecordingDefinition & {
  decodedResponse: ReplyBody;
};

export type TestRecordings = Record<
  string,
  Record<string, RecordingWithDecodedResponse[]>
>;

export enum RecordingType {
  MAIN = 'main',
  PREPARE = 'prepare',
  TEARDOWN = 'teardown',
}
