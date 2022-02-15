import { SDKExecutionError } from '@superfaceai/one-sdk';
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

export class MapUndefinedError extends ErrorBase {
  constructor(profile: string, provider: string) {
    super(
      'MapUndefinedError',
      `Map for ${profile} and ${provider} does not exist.\nUse \`superface create --map --profileId ${profile} --providerName ${provider}\` to create it.`
    );
  }
}

export class ProfileUndefinedError extends ErrorBase {
  constructor(profile: string) {
    super(
      'ProfileUndefinedError',
      `Profile ${profile} does not exist.\nUse \`superface create --profile --profileId ${profile}\` to create it.`
    );
  }
}

export class ComponentUndefinedError extends ErrorBase {
  constructor(
    component:
      | 'Client'
      | 'Profile'
      | 'Provider'
      | 'UseCase'
      | 'BoundProfileProvider'
  ) {
    super('ComponentUndefinedError', `Undefined ${component}`);
  }
}

export class FixturesPathUndefinedError extends ErrorBase {
  constructor() {
    super('FixturePathUndefinedError', 'Fixture path missing.');
  }
}

export class RecordingPathUndefinedError extends ErrorBase {
  constructor() {
    super('RecordingPathUndefinedError', 'Recording path missing.');
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

export class SuperJsonLoadingFailedError extends ErrorBase {
  constructor(originalError: SDKExecutionError) {
    super(
      'SuperJsonNotFoundError',
      `Loading super.json failed.\n${originalError.toString()}`
    );
  }
}

export class RecordingsNotFoundError extends ErrorBase {
  constructor() {
    super(
      'RecordingsNotFoundError',
      'Recordings could not be found for running mocked tests.\nYou must call the live API first to record API traffic.\nUse the environment variable SUPERFACE_LIVE_API to call the API and record traffic.\nSee https://github.com/superfaceai/testing#recording to learn more.'
    );
  }
}

export class BaseURLNotFoundError extends ErrorBase {
  constructor(provider: string) {
    super(
      'BaseURLNotFoundError',
      `No base URL was found for provider ${provider}, configure a service in provider.json.`
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

  throw new UnexpectedError(inspect(error));
}
