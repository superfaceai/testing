import {
  NonPrimitive,
  Primitive,
  Profile,
  Provider,
  Result,
  UseCase,
} from '@superfaceai/one-sdk';
import { Definition } from 'nock/types';

export interface SuperfaceTestConfig {
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
}

export type InputVariables = Record<string, Primitive>;

export interface HashOptions {
  input: NonPrimitive;
  testName?: string;
}

export type SuperfaceTestRun = SuperfaceTestConfig & HashOptions;

export type TestingReturn = Result<unknown, string>;

export interface NockConfig {
  path?: string;
  fixture?: string;
  enableReqheadersRecording?: boolean;
  testInstance?: unknown;
}

export type RecordingDefinition = Definition & {
  rawHeaders?: string[];
};
export type RecordingDefinitions = RecordingDefinition[];

export type ProcessingFunction = (
  recordings: RecordingDefinitions
) => Promise<void> | void;

export interface RecordingProcessOptions {
  processRecordings?: boolean;
  beforeRecordingSave?: ProcessingFunction;
  beforeRecordingLoad?: ProcessingFunction;
  hideInput?: string[];
}
