import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import {
  err,
  MapASTError,
  ok,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import nock, { pendingMocks, recorder } from 'nock';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import {
  RecordingsNotFoundError,
} from './common/errors';
import { matchWildCard } from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import { generate } from './generate-hash';
import { mockMapAST, mockProfileAST } from './superface/mock/ast';
import { mockProviderJson } from './superface/mock/provider';
import {
  getMockedSfConfig,
  mockSuperJson,
} from './superface/mock/superface.mock';
import { SuperfaceTest } from './superface-test';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_INPUT_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
} from './superface-test.utils';
import { prepareSuperface } from './superface/config';
import { mockBoundProfileProvider } from './superface/mock/boundProfileProvider';
import { SuperfaceTestConfigPayload } from './superface-test.interfaces';

/* eslint-disable @typescript-eslint/unbound-method */

jest.mock('./superface/config');

jest.mock('./common/io', () => ({
  readFileQuiet: jest.fn(),
  exists: jest.fn(),
}));

jest.mock('./common/format', () => ({
  ...jest.requireActual('./common/format'),
  matchWildCard: jest.fn(),
}));

jest.mock('./common/output-stream', () => ({
  ...jest.requireActual('./common/output-stream'),
  writeRecordings: jest.fn(),
}));

// jest.mock('./superface-test.utils', () => ({
//   ...jest.requireActual('./superface-test.utils'),
//   getSuperJson: jest.fn(),
// }));

// jest.mock('./superface/client', () => ({
//   ...jest.requireActual('./superface/client'),
//   addBoundProfileProvider: jest.fn(),
// }));

const testPayload: SuperfaceTestConfigPayload = {
  profile: 'profile',
  provider: 'provider',
  useCase: 'test'
}

const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), 'nock');

describe.skip('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    jest.restoreAllMocks();

    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
  });

  // TODO:
  // describe('with superJson', () => {});
  // describe('without superJson', () => {});

  describe('run', () => {
    describe('when recording', () => {
      it('writes and restores recordings', async () => {
        superfaceTest = new SuperfaceTest(await getMockedSfConfig());

        const writeRecordingsSpy = mocked(writeRecordings);
        const recorderSpy = jest.spyOn(recorder, 'rec');
        const playSpy = jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: '/',
            status: 200,
            response: { some: 'data' },
          },
        ]);
        const endRecSpy = jest.spyOn(nock, 'restore');

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {} });

        expect(recorderSpy).toHaveBeenCalledTimes(1);
        expect(recorderSpy).toHaveBeenCalledWith({
          dont_print: true,
          output_objects: true,
          use_separator: false,
          enable_reqheaders_recording: false,
        });

        expect(playSpy).toHaveBeenCalledTimes(1);
        expect(endRecSpy).toHaveBeenCalledTimes(1);

        expect(writeRecordingsSpy).toHaveBeenCalledTimes(1);
        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringContaining(DEFAULT_RECORDING_PATH),
          [
            {
              scope: 'https://localhost',
              path: '/',
              status: 200,
              response: {
                some: 'data',
              },
            },
          ]
        );
      });

      it('writes recordings when no traffic was recorded', async () => {
        superfaceTest = new SuperfaceTest(await getMockedSfConfig());

        const writeRecordingsSpy = mocked(writeRecordings);
        const recorderSpy = jest.spyOn(recorder, 'rec');
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {} });

        expect(recorderSpy).toHaveBeenCalledTimes(1);
        expect(recorderSpy).toHaveBeenCalledWith({
          dont_print: true,
          output_objects: true,
          use_separator: false,
          enable_reqheaders_recording: false,
        });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringContaining(DEFAULT_RECORDING_PATH),
          []
        );
      });

      it('writes and restores modified recordings when security is used', async () => {
        const secret = 'secret';
        superfaceTest = new SuperfaceTest(
          await getMockedSfConfig({
            provider: {
              baseUrl: 'https://localhost',
              securitySchemes: [
                {
                  id: 'api-key',
                  type: 'apiKey' as SecurityType.APIKEY,
                  in: 'query' as ApiKeyPlacement.QUERY,
                  name: 'api_key',
                },
              ],
              securityValues: [{ id: 'api-key', apikey: secret }],
            },
          })
        );

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: `/?api_key=${secret}`,
            status: 200,
            response: { auth: secret },
          },
        ]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {} });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringContaining(DEFAULT_RECORDING_PATH),
          [
            {
              scope: 'https://localhost',
              path: `/?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}api-key`,
              status: 200,
              response: {
                auth: `${HIDDEN_CREDENTIALS_PLACEHOLDER}api-key`,
              },
            },
          ]
        );
      });

      it('writes and restores modified recordings when integration parameters are used', async () => {
        const param = 'integration-parameter';
        superfaceTest = new SuperfaceTest(
          await getMockedSfConfig({
            provider: {
              baseUrl: 'https://localhost',
              parameters: {
                param,
              },
            },
          })
        );

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: `/?api_key=${param}`,
            status: 200,
            response: { auth: param },
          },
        ]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {} });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringContaining(DEFAULT_RECORDING_PATH),
          [
            {
              scope: 'https://localhost',
              path: `/?api_key=${HIDDEN_PARAMETERS_PLACEHOLDER}param`,
              status: 200,
              response: {
                auth: `${HIDDEN_PARAMETERS_PLACEHOLDER}param`,
              },
            },
          ]
        );
      });

      it('writes and restores modified recordings when hiding input is used', async () => {
        const token = 'secret';
        const refresh = 'refresh-token';

        superfaceTest = new SuperfaceTest(
          await getMockedSfConfig({
            provider: { baseUrl: 'https://localhost' },
          })
        );

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: `/?token=${token}`,
            status: 200,
            response: {
              auth: {
                value: token,
                refresh,
              },
            },
          },
        ]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run(
          { input: { auth: { token, refresh } } },
          { hideInput: ['auth.token', 'auth.refresh'] }
        );

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringContaining(DEFAULT_RECORDING_PATH),
          [
            {
              scope: 'https://localhost',
              path: `/?token=${HIDDEN_INPUT_PLACEHOLDER}auth.token`,
              status: 200,
              response: {
                auth: {
                  value: `${HIDDEN_INPUT_PLACEHOLDER}auth.token`,
                  refresh: `${HIDDEN_INPUT_PLACEHOLDER}auth.refresh`,
                },
              },
            },
          ]
        );
      });
    });

    describe('when hashing recordings', () => {
      beforeAll(async () => {
        superfaceTest = new SuperfaceTest(
          {
            ...(await getMockedSfConfig()),
          },
          {
            testInstance: expect,
          }
        );
      });

      it('writes recordings to file hashed based on test instance', async () => {
        const expectedTestName = expect.getState().currentTestName;
        const expectedHash = generate(expectedTestName);

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {} });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          joinPath(
            DEFAULT_RECORDING_PATH,
            'profile',
            'provider',
            'usecase',
            `recording-${expectedHash}.json`
          ),
          []
        );
      });

      it('writes recordings to file hashed based on parameter testName', async () => {
        const testName = 'my-test-name';
        const expectedHash = generate(testName);

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {}, testName });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          joinPath(
            DEFAULT_RECORDING_PATH,
            'profile',
            'provider',
            'usecase',
            `recording-${expectedHash}.json`
          ),
          []
        );
      });

      it('writes recordings to file hashed based on input', async () => {
        superfaceTest = new SuperfaceTest(
          {
            ...(await getMockedSfConfig()),
          },
          {
            testInstance: undefined,
          }
        );

        const input = { some: 'value' };
        const expectedHash = generate(JSON.stringify(input));

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input, testName: undefined });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          joinPath(
            DEFAULT_RECORDING_PATH,
            'profile',
            'provider',
            'usecase',
            `recording-${expectedHash}.json`
          ),
          []
        );
      });
    });

    describe('when loading recordings', () => {
      it('throws when recording fixture does not exist', async () => {
        superfaceTest = new SuperfaceTest(await getMockedSfConfig());

        const recorderSpy = jest.spyOn(recorder, 'rec');

        mocked(exists).mockResolvedValueOnce(false);
        mocked(matchWildCard).mockReturnValueOnce(false);

        await expect(superfaceTest.run({ input: {} })).rejects.toThrowError(
          new RecordingsNotFoundError()
        );

        expect(recorderSpy).not.toHaveBeenCalled();
      });

      it('loads fixture if it exists, but contains no recordings', async () => {
        superfaceTest = new SuperfaceTest(await getMockedSfConfig());

        const defineRecordingSpy = jest
          .spyOn(nock, 'define')
          .mockReturnValueOnce([]);
        const disableNetConnectSpy = jest.spyOn(nock, 'disableNetConnect');
        const enableNetConnectSpy = jest.spyOn(nock, 'enableNetConnect');
        const endRecSpy = jest.spyOn(nock, 'restore');
        const recorderSpy = jest.spyOn(recorder, 'rec');
        const writeRecordingsSpy = mocked(writeRecordings);

        mocked(exists).mockResolvedValueOnce(true);
        mocked(readFileQuiet).mockResolvedValueOnce('[]');
        mocked(matchWildCard).mockReturnValueOnce(false);

        await expect(superfaceTest.run({ input: {} })).resolves.not.toThrow();

        expect(pendingMocks()).toEqual([]);
        expect(defineRecordingSpy).toHaveBeenCalledTimes(1);
        expect(disableNetConnectSpy).toHaveBeenCalledTimes(1);
        expect(enableNetConnectSpy).toHaveBeenCalledTimes(1);
        expect(endRecSpy).toHaveBeenCalledTimes(1);
        expect(recorderSpy).not.toHaveBeenCalled();
        expect(writeRecordingsSpy).not.toHaveBeenCalled();
      });
    });

    describe('when performing', () => {
      const providerJson = mockProviderJson();

      it('returns error from perform', async () => {
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({ localMap: true, localProvider: true }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(
            err(new MapASTError('error')),
            {
              services: new ServiceSelector(
                providerJson.services,
                providerJson.defaultService
              ),
            }
          ),
        });

        superfaceTest = new SuperfaceTest(testPayload);

        mocked(matchWildCard).mockReturnValueOnce(true);

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
          error: new MapASTError('error').toString(),
        });
      });

      it('retuns value from perform', async () => {
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({ localMap: true, localProvider: true }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(
            ok({ value: 'result' }),
            {
              services: new ServiceSelector(
                providerJson.services,
                providerJson.defaultService
              ),
            }
          ),
        });

        superfaceTest = new SuperfaceTest(testPayload);

        mocked(matchWildCard).mockReturnValueOnce(true);

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
          value: 'result',
        });
      });
    });
  });
});
