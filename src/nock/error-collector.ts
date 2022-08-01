import createDebug from 'debug';

import {
  IErrorCollector,
  MatchError,
  MatchErrorKind,
} from './error-collector.interfaces';
import { errorMessages } from './matcher.utils';

const debugMatching = createDebug('superface:testing:matching');

export class ErrorCollector implements IErrorCollector {
  private errors: (MatchError & { message: string })[] = [];

  constructor(public readonly recordingPath: string) {}

  add(error: MatchError): void {
    const message = this.getErrorMessage(error);

    debugMatching(message);

    this.errors.push({
      ...error,
      message,
    });
  }

  get(kind?: MatchErrorKind): (MatchError & { message: string })[] {
    if (kind === undefined) {
      return this.errors;
    }

    return this.errors.filter(error => error.kind === kind);
  }

  private getErrorMessage(error: MatchError): string {
    switch (error.kind) {
      case MatchErrorKind.LENGTH:
        return errorMessages.incorrectRecordingsCount(error.old, error.new);
      case MatchErrorKind.METHOD:
        return errorMessages.incorrectMethod(error.old, error.new);
      case MatchErrorKind.STATUS:
        return errorMessages.incorrectStatusCode(error.old, error.new);
      case MatchErrorKind.BASE_URL:
        return errorMessages.incorrectBaseUrl(error.old, error.new);
      case MatchErrorKind.PATH:
        return errorMessages.incorrectPath(error.old, error.new);
      case MatchErrorKind.REQUEST_HEADERS:
        return errorMessages.incorrectRequestHeader(
          error.headerName,
          error.old,
          error.new
        );
      case MatchErrorKind.RESPONSE_HEADERS:
        return errorMessages.incorrectResponseHeader(
          error.headerName,
          error.old,
          error.new
        );
      case MatchErrorKind.REQUEST_BODY:
        return errorMessages.incorrectRequestBody(
          error.schemeValidation ?? { old: error.old, new: error.new }
        );
      case MatchErrorKind.RESPONSE:
        return errorMessages.incorrectResponse(
          error.schemeValidation ?? { old: error.old, new: error.new }
        );
    }
  }
}
