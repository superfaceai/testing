import {
  ApiKeyPlacement,
  SecurityType,
  SecurityValues,
} from '@superfaceai/ast';
import { SecurityConfiguration } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { RecordingDefinition } from '../recording.interfaces';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './replace';
import {
  checkSensitiveInformation,
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_INPUT_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
  replaceCredentials,
  resolveCredential,
  resolvePlaceholder,
} from './utils';

jest.mock('./replace', () => ({
  replaceCredentialInDefinition: jest.fn(),
  replaceInputInDefinition: jest.fn(),
  replaceParameterInDefinition: jest.fn(),
}));

describe('replace utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
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
});
