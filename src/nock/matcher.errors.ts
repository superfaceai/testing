import { inspect } from 'util';

import { ErrorBase } from '../common/errors';

export class MatchError extends ErrorBase {
  constructor(kind: string, message: string) {
    super(kind, message);
  }
}

export class MatchErrorLength extends MatchError {
  constructor(public oldLength: number, public newLength: number) {
    super(
      'MatchErrorLength',
      `Number of recorded HTTP calls do not match: ${oldLength} : ${newLength}`
    );

    Object.setPrototypeOf(this, MatchErrorLength.prototype);
  }
}

export class MatchErrorMethod extends MatchError {
  constructor(
    public oldMethod: string | undefined,
    public newMethod: string | undefined
  ) {
    super(
      'MatchErrorMethod',
      `Request method does not match: "${oldMethod ?? 'not-existing'}" : "${
        newMethod ?? 'not-existing'
      }"`
    );

    Object.setPrototypeOf(this, MatchErrorMethod.prototype);
  }
}

export class MatchErrorStatus extends MatchError {
  constructor(
    public oldStatus: number | undefined,
    public newStatus: number | undefined
  ) {
    super(
      'MatchErrorStatus',
      `Status codes do not match: "${oldStatus ?? 'not-existing'}" : "${
        newStatus ?? 'not-existing'
      }"`
    );

    Object.setPrototypeOf(this, MatchErrorStatus.prototype);
  }
}

export class MatchErrorBaseURL extends MatchError {
  constructor(public oldBaseURL: string, public newBaseURL: string) {
    super(
      'MatchErrorBaseURL',
      `Request Base URL does not match: "${oldBaseURL}" : "${newBaseURL}"`
    );

    Object.setPrototypeOf(this, MatchErrorBaseURL.prototype);
  }
}

export class MatchErrorPath extends MatchError {
  constructor(public oldPath: string, public newPath: string) {
    super('MatchErrorPath', `Paths do not match: "${oldPath}" : "${newPath}"`);

    Object.setPrototypeOf(this, MatchErrorPath.prototype);
  }
}

export class MatchErrorRequestHeaders extends MatchError {
  constructor(
    public headerName: string,
    public oldRequestHeader?: string,
    public newRequestHeader?: string
  ) {
    super(
      'MatchErrorRequestHeaders',
      `Request header "${headerName}" does not match: "${
        oldRequestHeader ?? 'not-existing'
      }" : "${newRequestHeader ?? 'not-existing'}"`
    );

    Object.setPrototypeOf(this, MatchErrorRequestHeaders.prototype);
  }
}

export class MatchErrorResponseHeaders extends MatchError {
  constructor(
    public headerName: string,
    public oldResponseHeader?: string,
    public newResponseHeader?: string
  ) {
    super(
      'MatchErrorResponseHeaders',
      `Response header "${headerName}" does not match: "${
        oldResponseHeader ?? 'not-existing'
      }" - "${newResponseHeader ?? 'not-existing'}"`
    );

    Object.setPrototypeOf(this, MatchErrorResponseHeaders.prototype);
  }
}

export class MatchErrorRequestBody extends MatchError {
  constructor(
    payload: { oldRequestBody?: unknown; newRequestBody?: unknown } | string
  ) {
    const message =
      typeof payload === 'string'
        ? `Request body does not match: ${payload}`
        : `Request body does not match: "${
            inspect(payload.oldRequestBody) ?? 'not-existing'
          }" : "${inspect(payload.newRequestBody) ?? 'not-existing'}"`;

    super('MatchErrorRequestBody', message);

    Object.setPrototypeOf(this, MatchErrorRequestBody.prototype);
  }
}

export class MatchErrorResponse extends MatchError {
  constructor(
    public payload: { oldResponse?: unknown; newResponse?: unknown },
    public stringPayload: string
  ) {
    super(
      'MatchErrorResponse',
      `Response does not match: "${
        inspect(payload.oldResponse) ?? 'not-existing'
      }" : "${inspect(payload.newResponse) ?? 'not-existing'}"\n` +
        stringPayload
    );

    Object.setPrototypeOf(this, MatchErrorResponse.prototype);
  }
}

export interface ErrorCollection {
  added: MatchError[];
  removed: MatchError[];
  changed: MatchError[];
}

export enum ErrorType {
  ADD = 'add',
  REMOVE = 'remove',
  CHANGE = 'change',
}
