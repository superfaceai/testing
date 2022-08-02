import {
  BoundProfileProvider,
  NonPrimitive,
  Primitive,
  Profile,
  Provider,
  Result,
  UseCase,
} from '@superfaceai/one-sdk';
import { Definition } from 'nock/types';

import { ISuperfaceClient } from './superface/client';

export interface SuperfaceTestConfigPayload {
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
}

export type InputVariables = Record<string, Primitive>;

export interface HashOptions {
  input: NonPrimitive;
  testName?: string;
}

export type SuperfaceTestRun = SuperfaceTestConfigPayload & HashOptions;

export interface SuperfaceTestConfig {
  client?: ISuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
  boundProfileProvider?: BoundProfileProvider;
}
export type CompleteSuperfaceTestConfig = Required<SuperfaceTestConfig>;

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
