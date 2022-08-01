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
  constructor(private readonly payload: { currentTestName?: unknown }) {
    debugHashing('Returning instance of hash generator for jest test instance');
  }

  hash(options: HashOptions): string {
    if (options.testName) {
      return generate(options.testName);
    }

    if (
      this.payload.currentTestName === undefined ||
      typeof this.payload.currentTestName !== 'string'
    ) {
      return generate(JSON.stringify(options.input));
    }

    // removes jest tag to support same recordings
    const testName = this.payload.currentTestName.replace(/\(.*\) *: */, '');

    return generate(testName);
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
