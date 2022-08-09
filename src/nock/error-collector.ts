import createDebug from 'debug';

import { UnexpectedError } from '../common/errors';
import { ErrorCollection, ErrorType, MatchError } from './matcher.errors';

const debugMatching = createDebug('superface:testing:matching');

export class ErrorCollector {
  private readonly added: MatchError[] = [];
  private readonly removed: MatchError[] = [];
  private readonly changed: MatchError[] = [];

  get count(): number {
    return [...this.added, ...this.removed, ...this.changed].length;
  }

  get errors(): ErrorCollection {
    return {
      added: this.added,
      removed: this.removed,
      changed: this.changed,
    };
  }

  add(type: ErrorType, error: MatchError): void {
    debugMatching(error.toString());

    switch (type) {
      case ErrorType.ADD:
        this.added.push(error);
        break;
      case ErrorType.REMOVE:
        this.removed.push(error);
        break;
      case ErrorType.CHANGE:
        this.changed.push(error);
        break;
      default:
        throw new UnexpectedError('Invalid error type');
    }
  }
}
