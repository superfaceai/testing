import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import { err, MapASTError, ok, ServiceSelector } from '@superfaceai/one-sdk';
import nock, { pendingMocks, recorder } from 'nock';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { RecordingsNotFoundError } from './common/errors';
import { matchWildCard } from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import { generate } from './generate-hash';
import { prepareSuperface } from './superface/config';
import { mockMapAST, mockProfileAST } from './superface/mock/ast';
import { mockBoundProfileProvider } from './superface/mock/boundProfileProvider';
import { mockProviderJson } from './superface/mock/provider';
import { mockSuperJson } from './superface/mock/super-json';
import { SuperfaceTest } from './superface-test';
import { SuperfaceTestConfigPayload } from './superface-test.interfaces';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_INPUT_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
} from './superface-test.utils';

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

const testPayload: SuperfaceTestConfigPayload = {
  profile: 'profile',
  provider: 'provider',
  useCase: 'test',
};

const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), 'nock');

describe('SuperfaceTest', () => {
  const providerJson = mockProviderJson();
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    jest.restoreAllMocks();

    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
  });

  describe('run', () => {
    describe('when recording', () => {
      it('writes and restores recordings', async () => {
        superfaceTest = new SuperfaceTest(testPayload);

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

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

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
        superfaceTest = new SuperfaceTest(testPayload);

        const writeRecordingsSpy = mocked(writeRecordings);
        const recorderSpy = jest.spyOn(recorder, 'rec');
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

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

        superfaceTest = new SuperfaceTest(testPayload);

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: `/?api_key=${secret}`,
            status: 200,
            response: { auth: secret },
          },
        ]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
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
              security: [
                {
                  id: 'api-key',
                  type: SecurityType.APIKEY,
                  in: ApiKeyPlacement.QUERY,
                  name: 'api_key',
                  apikey: secret,
                },
              ],
            }
          ),
        });

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

        superfaceTest = new SuperfaceTest(testPayload);

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: `/?api_key=${param}`,
            status: 200,
            response: { auth: param },
          },
        ]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
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
              parameters: {
                param,
              },
            }
          ),
        });

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

        superfaceTest = new SuperfaceTest(testPayload);

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

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
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
        superfaceTest = new SuperfaceTest(testPayload, {
          testInstance: expect,
        });
      });

      it('writes recordings to file hashed based on test instance', async () => {
        const expectedTestName = expect.getState().currentTestName;
        const expectedHash = generate(expectedTestName);

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

        await superfaceTest.run({ input: {} });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          joinPath(
            DEFAULT_RECORDING_PATH,
            'profile',
            'provider',
            'test',
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

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

        await superfaceTest.run({ input: {}, testName });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          joinPath(
            DEFAULT_RECORDING_PATH,
            'profile',
            'provider',
            'test',
            `recording-${expectedHash}.json`
          ),
          []
        );
      });

      it('writes recordings to file hashed based on input', async () => {
        superfaceTest = new SuperfaceTest(testPayload, {
          testInstance: undefined,
        });

        const input = { some: 'value' };
        const expectedHash = generate(JSON.stringify(input));

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

        await superfaceTest.run({ input, testName: undefined });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          joinPath(
            DEFAULT_RECORDING_PATH,
            'profile',
            'provider',
            'test',
            `recording-${expectedHash}.json`
          ),
          []
        );
      });
    });

    describe('when loading recordings', () => {
      it('throws when recording fixture does not exist', async () => {
        superfaceTest = new SuperfaceTest(testPayload);

        const recorderSpy = jest.spyOn(recorder, 'rec');

        mocked(matchWildCard).mockReturnValueOnce(false);
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

        await expect(superfaceTest.run({ input: {} })).rejects.toThrowError(
          new RecordingsNotFoundError()
        );

        expect(recorderSpy).not.toHaveBeenCalled();
      });

      it('loads fixture if it exists, but contains no recordings', async () => {
        superfaceTest = new SuperfaceTest(testPayload);

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
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({
              localProfile: true,
              localMap: true,
              localProvider: true,
            }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector(
              providerJson.services,
              providerJson.defaultService
            ),
          }),
        });

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

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual(
          ok({
            value: 'result',
          })
        );
      });
    });
  });
});
