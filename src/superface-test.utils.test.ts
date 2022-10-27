import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import { SecurityConfiguration } from '@superfaceai/one-sdk';

import { RecordingDefinitions } from '.';
import { UnexpectedError } from './common/errors';
import {
  InputGenerateHash,
  JestGenerateHash,
  MochaGenerateHash,
} from './generate-hash';
import {
  assertsDefinitionsAreNotStrings,
  checkSensitiveInformation,
  parseTestInstance,
} from './superface-test.utils';

describe('SuperfaceTest Utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('assertsDefinitionsAreNotStrings', () => {
    it('throws when definitions contains string', () => {
      const defs: RecordingDefinitions | string[] = [
        '{ "scope": "root", "method": "POST", "status": 401 }',
        '{ "scope": "root", "method": "GET", "status": 200 }',
      ];

      expect(() => {
        assertsDefinitionsAreNotStrings(defs);
      }).toThrowError(
        new UnexpectedError('definition is a string, not object')
      );
    });
  });

  describe('checkSensitiveInformation', () => {
    let consoleOutput: string[] = [];
    const originalWarn = console.warn;
    const mockedWarn = (output: string) => consoleOutput.push(output);

    const configurations: SecurityConfiguration[] = [
      {
        id: 'api_key',
        type: SecurityType.APIKEY,
        in: ApiKeyPlacement.PATH,
        apikey: 'SECRET',
      },
    ];
    const params: Record<string, string> = {
      my_param: 'SECRET_PARAM',
    };

    beforeEach(() => {
      consoleOutput = [];
      console.warn = mockedWarn;
    });

    afterAll(() => {
      console.warn = originalWarn;
    });

    it('warn when sensitive information is found', () => {
      const definitions: RecordingDefinitions = [
        {
          scope: 'https//api.hubapi.SECRET.com:443',
          method: 'POST',
          path: '/SECRET',
          decodedResponse: { val: 'SECRET_PARAM' },
        },
      ];

      checkSensitiveInformation(definitions, configurations, params);

      expect(consoleOutput).toEqual([
        "Value for security scheme 'api_key' of type 'apiKey' was found in recorded HTTP traffic.",
        "Value for integration parameter 'my_param' was found in recorded HTTP traffic.",
      ]);
    });

    it("don't warn when no sensitive information is found", () => {
      const definitions: RecordingDefinitions = [
        {
          scope: 'https//api.hubapi.com:443',
          method: 'POST',
          path: '/',
        },
      ];

      checkSensitiveInformation(definitions, configurations, params);

      expect(consoleOutput).toEqual([]);
    });
  });

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
