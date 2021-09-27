import {
  Profile,
  Provider,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import { Definition as RecordingDefinition } from 'nock/types';

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

export type ProcessingFunction = (
  recordings: RecordingDefinition[]
) => Promise<void> | void;

export interface RecordingProcessFunctions { before?: ProcessingFunction; after?: ProcessingFunction }