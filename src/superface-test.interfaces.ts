import {
  BoundProfileProvider,
  Profile,
  Provider,
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
}

export type SuperfaceTestRun = SuperfaceTestConfigPayload & {
  input: NonPrimitive;
};

export interface SuperfaceTestConfig {
  client?: SuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
  boundProfileProvider?: BoundProfileProvider;
}

export type CompleteSuperfaceTestConfig = Required<SuperfaceTestConfig>;

export type TestingReturn =
  | {
      value: unknown;
    }
  | {
      error: string;
    };

export interface NockConfig {
  path?: string;
  fixture?: string;
  enableReqheadersRecording?: boolean;
}

export type RecordingDefinitions = RecordingDefinition[];
export type RecordingScopes = RecordingScope[];

export type BeforeSaveFunction = (
  recordings: RecordingDefinitions
) => Promise<void> | void;

export type AfterLoadFunction = (
  scopes: RecordingScopes
) => Promise<void> | void;

export interface RecordingProcessOptions {
  processRecordings?: boolean;
  beforeRecordingSave?: BeforeSaveFunction;
  afterRecordingLoad?: AfterLoadFunction;
}

export {
  Definition as RecordingDefinition,
  Scope as RecordingScope,
} from 'nock/types';
