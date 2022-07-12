import { IGenerator } from '../../interfaces';
import {
  InputGenerateHash,
  JestGenerateHash,
  MochaGenerateHash,
} from './generator';

function hasProperty<K extends PropertyKey>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
  propKey: K
): obj is Record<K, unknown> {
  return !!obj && propKey in obj;
}

function isFunction<R extends unknown>(
  value: unknown,
  returnType?: R
): value is () => R {
  if (returnType) {
    return typeof value === 'function' && typeof value() === typeof returnType;
  }

  return typeof value === 'function';
}

/**
 * Checks for structural typing of specified `testInstance` and returns
 * corresponding instance of hash generator
 *
 * It checks for jest's `expect` instance and mocha's `this` instance,
 * otherwise it generates hash according to specified `testName` or `input` in test run
 */
export function getGenerator(testInstance: unknown): IGenerator {
  // jest instance of `expect` contains function `getState()` which should contain `currentTestName`
  if (testInstance && isFunction(testInstance)) {
    if (
      hasProperty(testInstance, 'getState') &&
      isFunction(testInstance.getState)
    ) {
      const state = testInstance.getState();

      if (state) {
        return new JestGenerateHash(state as { currentTestName?: unknown });
      }
    }
  }

  // mocha instance `this` contains information about tests in multiple contexts
  if (testInstance && typeof testInstance === 'object') {
    if (
      hasProperty(testInstance, 'test') &&
      hasProperty(testInstance.test, 'type')
    ) {
      // inside hook - using `this.currentTest.fullTitle()`
      if (testInstance.test.type === 'hook') {
        if (hasProperty(testInstance, 'currentTest')) {
          if (
            hasProperty(testInstance.currentTest, 'fullTitle') &&
            isFunction(testInstance.currentTest.fullTitle)
          ) {
            const value = testInstance.currentTest.fullTitle();

            if (typeof value === 'string') {
              return new MochaGenerateHash(value);
            }
          }
        }
      }

      // inside test - using `this.test.fullTitle()`
      if (testInstance.test.type === 'test') {
        if (
          hasProperty(testInstance.test, 'fullTitle') &&
          isFunction(testInstance.test.fullTitle)
        ) {
          const value = testInstance.test.fullTitle();

          if (typeof value === 'string') {
            return new MochaGenerateHash(value);
          }
        }
      }
    }
  }

  return new InputGenerateHash();
}
