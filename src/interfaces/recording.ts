import { Definition, ReplyBody } from 'nock/types';

export enum RecordingType {
  MAIN = 'main',
  PREPARE = 'prepare',
  TEARDOWN = 'teardown',
}

export interface NockConfig {
  path?: string;
  fixture?: string;
  enableReqheadersRecording?: boolean;
  testInstance?: unknown;
}

export type RecordingDefinition = Definition & {
  rawHeaders?: string[];
  decodedResponse?: ReplyBody;
};
export type RecordingDefinitions = RecordingDefinition[];

export type TestRecordings = Record<
  string,
  Record<string, RecordingDefinitions>
>;

export type ProcessingFunction = (
  recordings: RecordingDefinitions
) => Promise<void> | void;

export interface RecordingProcessOptions {
  recordingType?: RecordingType;
  processRecordings?: boolean;
  beforeRecordingSave?: ProcessingFunction;
  beforeRecordingLoad?: ProcessingFunction;
  hideInput?: string[];
  fullError?: boolean;
}
