import { RecordingDefinitions } from '../superface-test.interfaces';

export type TestRecordings = Record<
  string,
  Record<string, RecordingDefinitions>
>;

export enum RecordingType {
  MAIN = 'main',
  PREPARE = 'prepare',
  TEARDOWN = 'teardown',
}
