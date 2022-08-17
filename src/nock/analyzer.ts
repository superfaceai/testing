import {
  ErrorCollection,
  MatchErrorLength,
  MatchErrorResponse,
  MatchErrorResponseHeaders,
  MatchErrorStatus,
} from './matcher.errors';

export enum MatchImpact {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  NONE = 'none',
}

export interface AnalysisResult {
  profileId: string;
  providerName: string;
  useCaseName: string;
  recordingPath: string;
  impact: MatchImpact;
  errors: ErrorCollection;
}

export function analyzeChangeImpact(errors: ErrorCollection): MatchImpact {
  // check for breaking changes
  const responseDoesNotMatch = [...errors.removed, ...errors.changed].some(
    error => error instanceof MatchErrorResponse
  );
  const statusCodeDoesNotMatch = errors.changed.some(
    error => error instanceof MatchErrorStatus
  );
  const responseHeadersDoesNotMatch = [
    ...errors.removed,
    ...errors.changed,
  ].some(error => error instanceof MatchErrorResponseHeaders);
  const recordingsCountMatch = [...errors.added, ...errors.removed].some(
    error => error instanceof MatchErrorLength
  );

  if (
    responseDoesNotMatch ||
    responseHeadersDoesNotMatch ||
    statusCodeDoesNotMatch ||
    recordingsCountMatch
  ) {
    return MatchImpact.MAJOR;
  }

  // check for minor changes
  // TODO: determine minor change based on added data in response
  // - needs different solution than JSON schema validation
  const responseExtended = errors.added.some(
    error => error instanceof MatchErrorResponse
  );
  const responseHeadersAdded = errors.added.some(
    error => error instanceof MatchErrorResponseHeaders
  );

  if (responseExtended || responseHeadersAdded) {
    return MatchImpact.MINOR;
  }

  if ([...errors.added, ...errors.removed, ...errors.changed].length !== 0) {
    return MatchImpact.PATCH;
  }

  return MatchImpact.NONE;
}
