import { createHash } from 'crypto';
import createDebug from 'debug';

import { HashOptions } from './superface-test.interfaces';

const debugHashing = createDebug('superface:testing:hash');

export interface IGenerator {
  hash: (options: HashOptions) => string;
}

export const generate = (value: string): string => {
  debugHashing('Trying to generate hash based on specified value:', value);

  return createHash('md5').update(value).digest('hex');
};

export class JestGenerateHash implements IGenerator {
  constructor(private readonly currentTestName?: unknown) {
    debugHashing('Returning instance of hash generator for jest test instance');
  }

  hash(options: HashOptions): string {
    if (options.testName) {
      return generate(options.testName);
    }

    if (
      this.currentTestName === undefined ||
      typeof this.currentTestName !== 'string'
    ) {
      return generate(JSON.stringify(options.input));
    }

    return generate(this.currentTestName);
  }
}

export class MochaGenerateHash implements IGenerator {
  constructor(private readonly testName: string) {
    debugHashing(
      'Returning instance of hash generator for mocha test instance'
    );
  }

  hash(options: HashOptions): string {
    if (options.testName) {
      return generate(options.testName);
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

  hash({ testName, input }: HashOptions): string {
    if (testName) {
      return generate(testName);
    }

    return generate(JSON.stringify(input));
  }
}
