import { inspect } from 'util';

class ErrorBase extends Error {
  constructor(public kind: string, public override message: string) {
    super(message);
    this.name = kind;

    Object.setPrototypeOf(this, ErrorBase.prototype);
  }

  get [Symbol.toStringTag](): string {
    return this.kind;
  }

  override toString(): string {
    return `${this.kind}: ${this.message}`;
  }
}

export class UnexpectedError extends ErrorBase {
  constructor(public override message: string) {
    super('UnexpectedError', message);
  }
}

export class CapabilitiesNotLocalError extends ErrorBase {
  constructor() {
    super(
      'CapabilitiesNotLocalError',
      'Some capabilities are not local, do not forget to set up file paths in super.json.'
    );
  }
}

export class ComponentUndefinedError extends ErrorBase {
  constructor(component: 'Profile' | 'Provider' | 'UseCase') {
    super('ComponentUndefinedError', `Undefined ${component}`);
  }
}

export class NockConfigUndefinedError extends ErrorBase {
  constructor() {
    super('NockConfigUndefinedError', 'Nock configuration missing.');
  }
}

export class RecordingNotStartedError extends ErrorBase {
  constructor(method: 'record' | 'nockBackRecord') {
    super(
      'RecordingNotStartedError',
      `Recording failed, make sure to run \`${method}()\` before ending recording.`
    );
  }
}

export class InstanceMissingError extends ErrorBase {
  constructor(component: 'Profile' | 'Provider' | 'UseCase') {
    super('InstanceMissingError', `Should be ${component} instance.`);
  }
}

export class SuperJsonNotFoundError extends ErrorBase {
  constructor() {
    super('SuperJsonNotFoundError', 'No super.json found.');
  }
}

export function assertIsIOError(
  error: unknown
): asserts error is { code: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: Record<string, any> = error;
    if (typeof err.code === 'string') {
      return;
    }
  }

  throw new UnexpectedError(`${inspect(error)}`);
}
