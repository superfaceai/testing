import { NonPrimitive } from '@superfaceai/one-sdk';

import { TestingReturn } from '../client/superface-test.interfaces';
import { MatchError } from '../matcher/errors';
import { ErrorCollection } from '../matcher/matcher.interfaces';

export enum MatchImpact {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  NONE = 'none',
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
