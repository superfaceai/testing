import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import { createHash } from 'crypto';
import createDebug from 'debug';

const debugHashing = createDebug('superface:testing:hash');

export type GenerateFunction =
  | (() => string)
  | ((param: { input: NonPrimitive; testName?: string }) => string);

export interface IGenerator {
  hash: (param: { input: NonPrimitive; testName?: string }) => string;
}

const generate = (value: string): string => {
  debugHashing('Trying to generate hash based on specified value:', value);

  return createHash('md5').update(value).digest('hex');
};

export class JestGenerateHash implements IGenerator {
  constructor(private readonly testName: string) {
    debugHashing('Returning instance of hash generator for jest test instance');
  }

  hash(param: { input: NonPrimitive; testName?: string }): string {
    if (param.testName) {
      return generate(param.testName);
    }

    return generate(this.testName);
  }
}

export class MochaGenerateHash implements IGenerator {
  constructor(private readonly testName: string) {
    debugHashing(
      'Returning instance of hash generator for mocha test instance'
    );
  }

  hash(param: { input: NonPrimitive; testName?: string }): string {
    if (param.testName) {
      return generate(param.testName);
    }

    return generate(this.testName);
  }
}

export class InputGenerateHash implements IGenerator {
  constructor() {
    debugHashing(
      'Returning instance of fallback hash generator based on given input'
    );
  }

  hash(param: { input: NonPrimitive; testName?: string }): string {
    if (param.testName) {
      return generate(param.testName);
    }

    return generate(JSON.stringify(param.input));
  }
}
