import {
  InputGenerateHash,
  JestGenerateHash,
  MochaGenerateHash,
} from './generator';
import { parseTestInstance } from './utils';

describe('hash generator utils', () => {
  describe('parseTestInstance', () => {
    describe('when specified testInstance is jest expect instance', () => {
      it('returns JestGenerateHash instance', () => {
        const mockExpect = ((): void => {
          console.log('simulating jest expect');
        }) as any;

        mockExpect.getState = () => ({
          currentTestName: 'test name',
        });

        const parsedTestInstance = parseTestInstance(mockExpect);

        expect(parsedTestInstance.generator).toBeInstanceOf(JestGenerateHash);
      });

      it('returns `getTestFilePath` function', () => {
        const mockExpect = ((): void => {
          console.log('simulating jest expect');
        }) as any;

        mockExpect.getState = () => ({
          testPath: '/path/to/test/file.test.ts',
        });

        const parsedTestInstance = parseTestInstance(mockExpect);

        expect(parsedTestInstance.getTestFilePath()).toBe(
          '/path/to/test/file.test.ts'
        );
      });
    });

    describe('when specified testInstance is mocha instance', () => {
      describe("from mocha's hooks", () => {
        it('returns MochaGenerateHash instance', () => {
          const mockMocha = {
            test: {
              type: 'hook',
            },
            currentTest: {
              fullTitle: () => 'test name',
            },
          };

          const parsedTestInstance = parseTestInstance(mockMocha);

          expect(parsedTestInstance.generator).toBeInstanceOf(
            MochaGenerateHash
          );
        });
      });

      describe("from mocha's test", () => {
        it('returns MochaGenerateHash instance when specified testInstance is mocha test instance', () => {
          const mockMocha = {
            test: {
              type: 'test',
              fullTitle: () => 'test name',
            },
          };

          const parsedTestInstance = parseTestInstance(mockMocha);

          expect(parsedTestInstance.generator).toBeInstanceOf(
            MochaGenerateHash
          );
        });

        // TODO: extend parsing of mocha to return path to test file
        it('returns `getTestFilePath` function', () => {
          const mockMocha = {};

          const parsedTestInstance = parseTestInstance(mockMocha);

          expect(parsedTestInstance.getTestFilePath()).toBeUndefined();
        });
      });
    });

    describe('when specified testInstance is unknown', () => {
      it('returns InputGenerateHash instance', () => {
        const mockTestInstance = undefined;

        const parsedTestInstance = parseTestInstance(mockTestInstance);

        expect(parsedTestInstance.generator).toBeInstanceOf(InputGenerateHash);
      });

      it('returns `getTestFilePath` function', () => {
        const mockTestInstance = undefined;

        const parsedTestInstance = parseTestInstance(mockTestInstance);

        expect(parsedTestInstance.getTestFilePath()).toBeUndefined();
      });
    });
  });
});
