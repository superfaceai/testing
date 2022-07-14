import {
  IErrorCollector,
  MatchError,
  MatchErrorKind,
} from './error-collector.interfaces';

export class ErrorCollector implements IErrorCollector {
  private errors: MatchError[] = [];

  constructor(public readonly recordingPath: string) {}

  add(error: MatchError): void {
    this.errors.push(error);
  }

  get(kind?: MatchErrorKind): MatchError[] {
    if (kind === undefined) {
      return this.errors;
    }

    return this.errors.filter(error => error.kind === kind);
  }
}
