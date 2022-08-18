import {
  PerformError,
  Profile,
  Provider,
  Result,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';
import {
  NonPrimitive,
  Primitive,
} from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import { Definition } from 'nock/types';

import { AnalysisResult } from './nock/analyzer';

export interface SuperfaceTestConfigPayload {
  client?: SuperfaceClient;
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
  testInstance?: unknown;
}

export type InputVariables = Record<string, Primitive>;

export interface HashOptions {
  input: NonPrimitive;
  testName?: string;
}

export type AlertFunction = (report: TestReport) => unknown | Promise<unknown>;

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

export type TestingReturn = Result<unknown, PerformError | string>;

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
  fullError?: boolean;
}

export type TestCoverageBase = AnalysisResult & {
  input: NonPrimitive;
  result: TestingReturn;
};

// TODO: add this to testanalysis somehow
// export type TestCoverage =
//   | {
//       pass: true;
//       value: unknown;
//     }
//   | {
//       pass: false;
//       error: PerformError | string;
//     };

export type TestReport = TestCoverageBase[];
