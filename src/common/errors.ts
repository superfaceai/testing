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
  constructor(component: 'Client' | 'Profile' | 'Provider' | 'UseCase') {
    super('ComponentUndefinedError', `Undefined ${component}`);
  }
}

export class NockConfigUndefinedError extends ErrorBase {
  constructor() {
    super('NockConfigUndefinedError', 'Nock configuration missing.');
  }
}

export class FixturesPathUndefinedError extends ErrorBase {
  constructor() {
    super('FixturePathUndefinedError', 'Fixture path missing.');
  }
}

export class RecordingPathUndefinedError extends ErrorBase {
  constructor() {
    super('RecordingPathUndefinedError', `Recording path missing.`);
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

export class RecordingsNotFoundError extends ErrorBase {
  constructor() {
    super(
      'RecordingsNotFoundError',
      'Recording could not be found, if you want to record new traffic, configure enviroment variable SUPERFACE_LIVE_API'
    );
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
