import {
  Profile,
  Provider,
  Result,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import {
  Definition as RecordingDefinition,
  Scope as RecordingScope,
} from 'nock/types';

export interface SuperfaceTestConfigPayload {
  client?: SuperfaceClient;
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
  testInstance?: unknown;
}

export interface HashOptions {
  input: NonPrimitive;
  testName?: string;
}

export type SuperfaceTestRun = Omit<
  SuperfaceTestConfigPayload,
  'testInstance'
> &
  HashOptions;

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

export type RecordingDefinitions = RecordingDefinition[];
export type RecordingScopes = RecordingScope[];

export type ProcessingFunction = (
  recordings: RecordingDefinitions
) => Promise<void> | void;

export interface RecordingProcessOptions {
  processRecordings?: boolean;
  beforeRecordingSave?: ProcessingFunction;
  beforeRecordingLoad?: ProcessingFunction;
}

export {
  Definition as RecordingDefinition,
  Scope as RecordingScope,
} from 'nock/types';
