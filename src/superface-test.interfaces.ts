import {
  Profile,
  Provider,
  Result,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import { Definition } from 'nock/types';

export interface SuperfaceTestConfigPayload {
  client?: SuperfaceClient;
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
  testInstance?: unknown;
}

export type SuperfaceTestRun = Omit<
  SuperfaceTestConfigPayload,
  'testInstance'
> & {
  currentTestName?: string;
  input: NonPrimitive;
};

export interface SuperfaceTestConfig {
  client?: SuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
}

export type CompleteSuperfaceTestConfig = Required<SuperfaceTestConfig>;

export type TestingReturn = Result<unknown, string>;

export interface NockConfig {
  path?: string;
  fixture?: string;
  enableReqheadersRecording?: boolean;
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
