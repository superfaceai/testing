import {
  ApiKeyPlacement,
  SecurityType,
  SecurityValues,
} from '@superfaceai/ast';
import { SecurityConfiguration } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { RecordingDefinition } from '.';
import { UnexpectedError } from './common/errors';
import {
  InputGenerateHash,
  JestGenerateHash,
  MochaGenerateHash,
} from './generate-hash';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './nock';
import {
  assertsDefinitionsAreNotStrings,
  checkSensitiveInformation,
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_INPUT_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
  parseBooleanEnv,
  parseTestInstance,
  replaceCredentials,
  resolveCredential,
  resolvePlaceholder,
  searchValues,
} from './superface-test.utils';

jest.mock('./nock', () => ({
  replaceCredentialInDefinition: jest.fn(),
  replaceInputInDefinition: jest.fn(),
  replaceParameterInDefinition: jest.fn(),
}));

describe('SuperfaceTest Utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('assertsDefinitionsAreNotStrings', () => {
    it('throws when definitions contains string', () => {
      const defs: RecordingDefinition[] | string[] = [
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

  describe('resolveCredential', () => {
    describe('when using inlined value', () => {
      describe('and when resolving apiKey', () => {
        it('returns resolved apiKey', () => {
          const securityValue: SecurityValues = {
            id: '#',
            apikey: 'secret',
          };
          expect(resolveCredential(securityValue)).toBe('secret');
        });
      });

      describe('and when resolving basic credentials', () => {
        it('returns resolved basic credentials', () => {
          const expectedCredential =
            Buffer.from('user:secret').toString('base64');
          const securityValue: SecurityValues = {
            id: '#',
            username: 'user',
            password: 'secret',
          };

          expect(resolveCredential(securityValue)).toBe(expectedCredential);
        });
      });

      describe('and when resolving token', () => {
        it('returns resolved token', () => {
          const securityValue: SecurityValues = {
            id: '#',
            token: 'secret',
          };

          expect(resolveCredential(securityValue)).toBe('secret');
        });
      });
    });

    describe('when using using env variable', () => {
      let env: string | undefined;

      beforeAll(() => {
        env = process.env.TOKEN;

        process.env.TOKEN = 'secret';
      });

      afterAll(() => {
        process.env.TOKEN = env;
      });

      describe('and when resolving apiKey', () => {
        it('returns resolved apiKey', () => {
          const securityValue: SecurityValues = {
            id: '#',
            apikey: '$TOKEN',
          };

          expect(resolveCredential(securityValue)).toBe('secret');
        });
      });

      describe('and when resolving basic credentials', () => {
        it('returns resolved basic credentials', () => {
          const expectedCredential =
            Buffer.from('secret:secret').toString('base64');
          const securityValue: SecurityValues = {
            id: '#',
            username: '$TOKEN',
            password: '$TOKEN',
          };

          expect(resolveCredential(securityValue)).toBe(expectedCredential);
        });
      });

      describe('and when resolving token', () => {
        it('returns resolved token', () => {
          const securityValue: SecurityValues = {
            id: '#',
            token: '$TOKEN',
          };

          expect(resolveCredential(securityValue)).toBe('secret');
        });
      });
    });
  });

  describe('resolvePlaceholder', () => {
    describe('when beforeSave is true', () => {
      const beforeSave = true;

      describe('and when resolving security value', () => {
        it('resolves credential and placeholder', () => {
          expect(
            resolvePlaceholder({
              kind: 'credential',
              name: 'apiKey',
              value: 'secret',
              beforeSave,
            })
          ).toEqual({
            credential: 'secret',
            placeholder: HIDDEN_CREDENTIALS_PLACEHOLDER + 'apiKey',
          });
        });
      });

      describe('and when resolving integration parameter', () => {
        it('resolves credential and placeholder', () => {
          expect(
            resolvePlaceholder({
              kind: 'parameter',
              name: 'apiKey',
              value: 'secret',
              beforeSave,
            })
          ).toEqual({
            credential: 'secret',
            placeholder: HIDDEN_PARAMETERS_PLACEHOLDER + 'apiKey',
          });
        });
      });

      describe('and when resolving input value', () => {
        it('resolves credential and placeholder', () => {
          expect(
            resolvePlaceholder({
              kind: 'input',
              name: 'apiKey',
              value: 'secret',
              beforeSave,
            })
          ).toEqual({
            credential: 'secret',
            placeholder: HIDDEN_INPUT_PLACEHOLDER + 'apiKey',
          });
        });
      });
    });

    describe('when beforeSave is false', () => {
      const beforeSave = false;

      describe('and when resolving security value', () => {
        it('resolves credential and placeholder', () => {
          expect(
            resolvePlaceholder({
              kind: 'credential',
              name: 'apiKey',
              value: 'secret',
              beforeSave,
            })
          ).toEqual({
            credential: HIDDEN_CREDENTIALS_PLACEHOLDER + 'apiKey',
            placeholder: 'secret',
          });
        });
      });

      describe('and when resolving integration parameter', () => {
        it('resolves credential and placeholder', () => {
          expect(
            resolvePlaceholder({
              kind: 'parameter',
              name: 'apiKey',
              value: 'secret',
              beforeSave,
            })
          ).toEqual({
            credential: HIDDEN_PARAMETERS_PLACEHOLDER + 'apiKey',
            placeholder: 'secret',
          });
        });
      });

      describe('and when resolving input value', () => {
        it('resolves credential and placeholder', () => {
          expect(
            resolvePlaceholder({
              kind: 'input',
              name: 'apiKey',
              value: 'secret',
              beforeSave,
            })
          ).toEqual({
            credential: HIDDEN_INPUT_PLACEHOLDER + 'apiKey',
            placeholder: 'secret',
          });
        });
      });
    });
  });

  describe('replaceCredentials', () => {
    const sampleRecordings: RecordingDefinition = {
      scope: 'https://localhost',
      path: '/secret',
      status: 200,
      response: {},
    };

    it('does not replace anything if no credentials, parameters or input values were specified', () => {
      const replaceCredentialInDefinitionSpy = mocked(
        replaceCredentialInDefinition
      );
      const replaceParameterInDefinitionSpy = mocked(
        replaceParameterInDefinition
      );
      const replaceInputInDefinitionSpy = mocked(replaceInputInDefinition);

      replaceCredentials({
        definitions: [],
        security: [],
        integrationParameters: {},
        beforeSave: true,
        baseUrl: 'http://localhost',
      });

      expect(replaceCredentialInDefinitionSpy).not.toBeCalled();
      expect(replaceParameterInDefinitionSpy).not.toBeCalled();
      expect(replaceInputInDefinitionSpy).not.toBeCalled();
    });

    describe('when replacing security value', () => {
      it('replaces credential and placeholder', () => {
        const replaceCredentialInDefinitionSpy = mocked(
          replaceCredentialInDefinition
        );
        const replaceParameterInDefinitionSpy = mocked(
          replaceParameterInDefinition
        );
        const replaceInputInDefinitionSpy = mocked(replaceInputInDefinition);

        replaceCredentials({
          definitions: [sampleRecordings],
          security: [
            {
              id: 'apiKey',
              type: SecurityType.APIKEY,
              in: ApiKeyPlacement.PATH,
              apikey: 'secret',
            },
          ],
          integrationParameters: {},
          inputVariables: {},
          beforeSave: true,
          baseUrl: 'http://localhost',
        });

        expect(replaceCredentialInDefinitionSpy).toBeCalledTimes(1);
        expect(replaceParameterInDefinitionSpy).not.toBeCalled();
        expect(replaceInputInDefinitionSpy).not.toBeCalled();
      });
    });

    describe('when replacing integration parameter', () => {
      it('replaces credential and placeholder', () => {
        const replaceCredentialInDefinitionSpy = mocked(
          replaceCredentialInDefinition
        );
        const replaceParameterInDefinitionSpy = mocked(
          replaceParameterInDefinition
        );
        const replaceInputInDefinitionSpy = mocked(replaceInputInDefinition);

        replaceCredentials({
          definitions: [sampleRecordings],
          security: [],
          integrationParameters: { val: 'secret' },
          inputVariables: {},
          beforeSave: true,
          baseUrl: 'http://localhost',
        });

        expect(replaceCredentialInDefinitionSpy).not.toBeCalled();
        expect(replaceParameterInDefinitionSpy).toBeCalledTimes(1);
        expect(replaceInputInDefinitionSpy).not.toBeCalled();
      });
    });

    describe('when replacing input value', () => {
      it('replaces credential and placeholder', () => {
        const replaceCredentialInDefinitionSpy = mocked(
          replaceCredentialInDefinition
        );
        const replaceParameterInDefinitionSpy = mocked(
          replaceParameterInDefinition
        );
        const replaceInputInDefinitionSpy = mocked(replaceInputInDefinition);

        replaceCredentials({
          definitions: [sampleRecordings],
          security: [],
          integrationParameters: {},
          inputVariables: { val: 'secret' },
          beforeSave: true,
          baseUrl: 'http://localhost',
        });

        expect(replaceCredentialInDefinitionSpy).not.toBeCalled();
        expect(replaceParameterInDefinitionSpy).not.toBeCalled();
        expect(replaceInputInDefinitionSpy).toBeCalledTimes(1);
      });
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
      const definitions: RecordingDefinition[] = [
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
      const definitions: RecordingDefinition[] = [
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

  describe('searchValues', () => {
    it('returns undefined when accessors are undefined', () => {
      expect(searchValues({}, undefined)).toBeUndefined();
    });

    it('returns value from input', () => {
      const input = {
        val: 'secret',
      };

      expect(searchValues(input, ['val'])).toEqual({
        val: 'secret',
      });
    });

    it('returns nested value from input', () => {
      const input = {
        obj: {
          val: 'secret',
        },
      };

      expect(searchValues(input, ['obj.val'])).toEqual({
        'obj.val': 'secret',
      });
    });

    it('returns multiple values from input', () => {
      const input = {
        f1: 'field',
        obj: {
          f2: 'secret',
        },
      };

      expect(searchValues(input, ['f1', 'obj.f2'])).toEqual({
        f1: 'field',
        'obj.f2': 'secret',
      });
    });

    it('throws error when targeted value is not primitive', () => {
      const input = {
        obj: {
          val: 'secret',
        },
      };

      expect(() => searchValues(input, ['obj'])).toThrowError(
        'Input property: obj is not primitive value'
      );
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

  describe('parseBooleanEnv', () => {
    it('returns false when variable is not set', () => {
      expect(parseBooleanEnv(undefined)).toBeFalsy();
    });

    it('returns false when variable is defined and contains false', () => {
      expect(parseBooleanEnv('false')).toBeFalsy();
    });

    it('returns true when variable is set and contains true', () => {
      expect(parseBooleanEnv('true')).toBeTruthy();
    });
  });
});
