import {
  MapInterpreterError,
  NonPrimitive,
  Primitive,
  Profile,
  ProfileParameterError,
  Provider,
  Result,
  SDKExecutionError,
  UnexpectedError,
  UseCase,
} from '@superfaceai/one-sdk';
import { Definition, ReplyBody } from 'nock/types';

import { MatchImpact } from './nock/analyzer';
import { ErrorCollection, MatchError } from './nock/matcher.errors';
import { RecordingType } from './nock/recording.interfaces';

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

export type AlertFunction = (report: TestReport) => unknown | Promise<unknown>;

export type SuperfaceTestRun = SuperfaceTestConfig & HashOptions;

export type PerformError =
  | ProfileParameterError
  | MapInterpreterError
  | UnexpectedError
  | SDKExecutionError;
export type TestingReturn = Result<unknown, PerformError | string>;

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

export interface NoImpactResult {
  impact: MatchImpact.NONE;
}

export interface ImpactResult {
  impact: MatchImpact.MAJOR | MatchImpact.MINOR | MatchImpact.PATCH;
  errors: ErrorCollection<MatchError>;
}

export type AnalysisResult = NoImpactResult | ImpactResult;

export type TestAnalysis = {
  impact: MatchImpact;
  profileId: string;
  providerName: string;
  useCaseName: string;
  recordingsPath: string;
  input: NonPrimitive;
  result: TestingReturn;
  errors: ErrorCollection<string>;
};

export type TestReport = TestAnalysis[];
