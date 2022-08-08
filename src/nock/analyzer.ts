import { CompleteSuperfaceTestConfig } from '../superface-test.interfaces';
import {
  ErrorCollection,
  MatchErrorLength,
  MatchErrorResponse,
  MatchErrorStatus,
} from './matcher.errors';

export type MatchImpact = 'major' | 'minor' | 'patch';
export interface AnalysisResult {
  profile: string;
  provider: string;
  useCase: string;

  recordingPath: string;

  impact: MatchImpact;

  errors: ErrorCollection;
}

export function analyzeErrors(
  sfConfig: CompleteSuperfaceTestConfig,
  errors: ErrorCollection,
  recordingPath: string
): AnalysisResult {
  return {
    profile: sfConfig.profile.configuration.id,
    provider: sfConfig.provider.configuration.name,
    useCase: sfConfig.useCase.name,
    recordingPath,
    impact: determineImpact(errors),
    errors,
  };
}

function determineImpact(errors: ErrorCollection): MatchImpact {
  // check for breaking changes
  const responseDoesNotMatch = errors.changed.some(
    error => error instanceof MatchErrorResponse
  );
  const statusCodeDoesNotMatch = errors.changed.some(
    error => error instanceof MatchErrorStatus
  );
  const responseHeadersDoesNotMatch = [
    ...errors.removed,
    ...errors.changed,
  ].some(error => error instanceof MatchErrorResponse);
  const recordingsCountMatch = [...errors.added, ...errors.removed].some(
    error => error instanceof MatchErrorLength
  );

  if (
    responseDoesNotMatch ||
    responseHeadersDoesNotMatch ||
    statusCodeDoesNotMatch ||
    recordingsCountMatch
  ) {
    return 'major';
  }

  // check for minor changes
  // TODO: determine minor change based on added data in response
  // - needs different solution than JSON schema validation

  const responseHeadersAdded = errors.added.some(
    error => error instanceof MatchErrorResponse
  );
  if (responseHeadersAdded) {
    return 'minor';
  }

  return 'patch';
}
