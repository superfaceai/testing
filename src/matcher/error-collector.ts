import createDebug from 'debug';

import { ErrorCollection, ErrorType, MatchError } from './errors';

const debugMatching = createDebug('superface:testing:matching');

export class ErrorCollector {
  private readonly added: MatchError[] = [];
  private readonly removed: MatchError[] = [];
  private readonly changed: MatchError[] = [];

  get count(): number {
    return this.added.length + this.removed.length + this.changed.length;
  }

  get errors(): ErrorCollection<MatchError> {
    return {
      added: this.added,
      removed: this.removed,
      changed: this.changed,
    };
  }

  add(type: ErrorType, error: MatchError): void {
    debugMatching(error.toString());

    if (type === ErrorType.ADD) {
      this.added.push(error);
    } else if (type === ErrorType.REMOVE) {
      this.removed.push(error);
    } else if (type === ErrorType.CHANGE) {
      this.changed.push(error);
    }
  }
}
