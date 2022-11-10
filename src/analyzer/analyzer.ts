import { MatchImpact } from '../interfaces';
import {
  ErrorCollection,
  MatchError,
  MatchErrorLength,
  MatchErrorResponse,
  MatchErrorResponseHeaders,
  MatchErrorStatus,
} from '../matcher/errors';

export function analyzeChangeImpact(
  errors: ErrorCollection<MatchError>
): MatchImpact {
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
  const recordingsCountNotMatch = [...errors.added, ...errors.removed].some(
    error => error instanceof MatchErrorLength
  );

  if (
    responseDoesNotMatch ||
    responseHeadersDoesNotMatch ||
    statusCodeDoesNotMatch ||
    recordingsCountNotMatch
  ) {
    return MatchImpact.MAJOR;
  }

  // check for minor changes
  const responseExtended = errors.added.some(
    error => error instanceof MatchErrorResponse
  );
  const responseHeadersAdded = errors.added.some(
    error => error instanceof MatchErrorResponseHeaders
  );

  if (responseExtended || responseHeadersAdded) {
    return MatchImpact.MINOR;
  }

  const errorCount =
    errors.added.length + errors.removed.length + errors.changed.length;

  if (errorCount !== 0) {
    return MatchImpact.PATCH;
  }

  return MatchImpact.NONE;
}
