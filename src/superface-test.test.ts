import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import { err, MapASTError, ok, SuperJson } from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import nock from 'nock';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import {
  ComponentUndefinedError,
  MapUndefinedError,
  RecordingsNotFoundError,
} from './common/errors';
import { matchWildCard } from './common/format';
import { exists } from './common/io';
import { writeRecordings } from './common/output-stream';
import {
  getMockedSfConfig,
  getProfileMock,
  getProviderMock,
  getUseCaseMock,
  SuperfaceClientMock,
} from './superface.mock';
import { SuperfaceTest } from './superface-test';
import * as utils from './superface-test.utils';

/* eslint-disable @typescript-eslint/unbound-method */

const mockServer = getLocal();

jest.mock('./common/io', () => ({
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

const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), 'nock');

describe('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    jest.restoreAllMocks();

    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
  });

  beforeEach(() => {
    superfaceTest = new SuperfaceTest();
  });

  describe('run', () => {
    describe('when preparing configuration', () => {
      it('throws when config is not prepared', async () => {
        const client = new SuperfaceClientMock();
        const mockedProfile = await getProfileMock('profile');
        const mockedProvider = await getProviderMock('provider');
        const mockedUseCase = getUseCaseMock('usecase', { isOk: true });

        const test1 = new SuperfaceTest({ client });
        const test2 = new SuperfaceTest({ client, useCase: 'some-use-case' });
        const test3 = new SuperfaceTest({ client, profile: mockedProfile });
        const test4 = new SuperfaceTest({
          client,
          profile: mockedProfile,
          provider: mockedProvider,
        });
        const test5 = new SuperfaceTest({
          client,
          profile: mockedProfile,
          provider: mockedProvider,
          useCase: mockedUseCase,
        });

        mocked(matchWildCard).mockReturnValue(true);

        await expect(
          test1.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('Profile'));

        await expect(test2.run({ client, input: {} })).rejects.toThrowError(
          new ComponentUndefinedError('Profile')
        );

        await expect(
          test3.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('Provider'));

        await expect(
          test4.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('UseCase'));

        await expect(
          test5.run({
            input: {},
          })
        ).resolves.toMatchObject({
          value: undefined,
        });
      });
    });

    describe('when checking for local map', () => {
      it('throws error when profileProvider is not local', async () => {
        const mockSuperJson = new SuperJson({
          profiles: {
            profile: {
              file: 'path/to/profile.supr',
              providers: {
                provider: {},
              },
            },
          },
          providers: {
            provider: {
              security: [],
            },
          },
        });

        superfaceTest = new SuperfaceTest(
          await getMockedSfConfig({ superJson: mockSuperJson })
        );

        await expect(superfaceTest.run({ input: {} })).rejects.toThrowError(
          new MapUndefinedError('profile', 'provider')
        );
      });
    });

    describe('when recording', () => {
      beforeAll(async () => {
        await mockServer.start();
      });

      afterAll(async () => {
        await mockServer.stop();
      });

      describe('loading recordings', () => {
        it('throws when recording fixture does not exist', async () => {
          superfaceTest = new SuperfaceTest(await getMockedSfConfig());

          const recorderSpy = jest.spyOn(nock.recorder, 'rec');

          mocked(exists).mockResolvedValueOnce(false);
          mocked(matchWildCard).mockReturnValueOnce(false);

          await expect(superfaceTest.run({ input: {} })).rejects.toThrowError(
            new RecordingsNotFoundError()
          );

          expect(recorderSpy).not.toHaveBeenCalled();
        });

        it('throws when recording fixture contains no recordings', async () => {
          superfaceTest = new SuperfaceTest(await getMockedSfConfig());

          const recorderSpy = jest.spyOn(nock.recorder, 'rec');
          const loadRecordingSpy = jest
            .spyOn(nock, 'load')
            .mockReturnValueOnce([]);

          mocked(exists).mockResolvedValueOnce(true);
          mocked(matchWildCard).mockReturnValueOnce(false);

          await expect(superfaceTest.run({ input: {} })).rejects.toThrowError(
            new RecordingsNotFoundError()
          );

          expect(loadRecordingSpy).toHaveBeenCalledTimes(1);
          expect(recorderSpy).not.toHaveBeenCalled();
        });

        it('loads fixture if it exists', async () => {
          superfaceTest = new SuperfaceTest(await getMockedSfConfig());

          const loadRecordingSpy = jest
            .spyOn(nock, 'load')
            .mockReturnValueOnce([expect.anything()]);
          const disableNetConnectSpy = jest.spyOn(nock, 'disableNetConnect');
          const enableNetConnectSpy = jest.spyOn(nock, 'enableNetConnect');
          const recorderSpy = jest.spyOn(nock.recorder, 'rec');
          const endRecSpy = jest.spyOn(nock, 'restore');
          const writeRecordingsSpy = mocked(writeRecordings);

          mocked(exists).mockResolvedValueOnce(true);
          mocked(matchWildCard).mockReturnValueOnce(false);

          await expect(superfaceTest.run({ input: {} })).resolves.toMatchObject(
            {
              value: undefined,
            }
          );

          expect(loadRecordingSpy).toHaveBeenCalledTimes(1);
          expect(loadRecordingSpy).toHaveBeenCalledWith(
            expect.stringContaining(DEFAULT_RECORDING_PATH)
          );
          expect(disableNetConnectSpy).toHaveBeenCalledTimes(1);
          expect(recorderSpy).not.toHaveBeenCalled();
          expect(enableNetConnectSpy).toHaveBeenCalledTimes(1);
          expect(endRecSpy).not.toHaveBeenCalled();
          expect(writeRecordingsSpy).not.toHaveBeenCalled();
        });

        it.skip('loads credentials that were hidden after recording', async () => {
          superfaceTest = new SuperfaceTest(
            await getMockedSfConfig({
              baseUrl: 'https://localhost',
              securitySchemes: [
                {
                  id: 'api-key',
                  type: SecurityType.APIKEY,
                  in: ApiKeyPlacement.QUERY,
                  name: 'api_key',
                },
              ],
              securityValues: [{ id: 'api-key', apikey: 'XXX' }],
            })
          );
          const mockedScopes = nock.define([
            {
              scope: 'https://localhost',
              method: 'GET',
              path: `/path?api_key=${utils.HIDDEN_CREDENTIALS_PLACEHOLDER}`,
              status: 200,
              response: { some: 'data' },
            },
          ]);
          const loadScopesSpy = jest
            .spyOn(nock, 'load')
            .mockReturnValue(mockedScopes);
          const loadCredentialsSpy = jest.spyOn(utils, 'loadCredentials');

          mocked(exists).mockResolvedValue(true);
          mocked(matchWildCard).mockReturnValueOnce(false);

          await expect(superfaceTest.run({ input: {} })).resolves.toMatchObject(
            {
              value: undefined,
            }
          );

          expect(loadScopesSpy).toHaveBeenCalledTimes(1);
          expect(loadCredentialsSpy).toHaveBeenCalledTimes(1);
          expect(loadCredentialsSpy).toHaveBeenCalledWith({
            scope: expect.objectContaining({
              interceptors: [
                {
                  queries: {
                    api_key: utils.HIDDEN_CREDENTIALS_PLACEHOLDER,
                  },
                },
              ],
            }),
            scheme: {
              id: 'api-key',
              type: 'apiKey',
              in: 'query',
              name: 'api_key',
            },
            securityValue: { id: 'api-key', apikey: 'XXX' },
          });
        });
      });

      describe('writing recordings', () => {
        it('writes and restores recordings', async () => {
          superfaceTest = new SuperfaceTest(await getMockedSfConfig());

          await mockServer
            .get('/')
            .withHeaders({ Accept: 'application/json' })
            .thenJson(200, { some: 'data' });

          const writeRecordingsSpy = mocked(writeRecordings);
          const recorderSpy = jest.spyOn(nock.recorder, 'rec');
          const playSpy = jest
            .spyOn(nock.recorder, 'play')
            .mockReturnValueOnce([
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

        it.skip('writes modified recordings to file', async () => {
          superfaceTest = new SuperfaceTest(
            await getMockedSfConfig({
              baseUrl: 'https://localhost',
              securitySchemes: [
                {
                  id: 'api-key',
                  type: SecurityType.APIKEY,
                  in: ApiKeyPlacement.QUERY,
                  name: 'api_key',
                },
              ],
              securityValues: [{ id: 'api-key', apikey: 'XXX' }],
            })
          );

          const mockedDefinitions = [
            {
              scope: 'https://localhost',
              method: 'GET',
              path: '/path?api_key=XXX',
              status: 200,
              response: { some: 'data' },
            },
          ];
          const expectedDefinitions = [
            {
              scope: 'https://localhost',
              method: 'GET',
              path: `/path?api_key=${utils.HIDDEN_CREDENTIALS_PLACEHOLDER}`,
              status: 200,
              response: { some: 'data' },
            },
          ];
          const playRecorderSpy = jest
            .spyOn(nock.recorder, 'play')
            .mockReturnValue(mockedDefinitions);
          const removeCredentialsSpy = jest.spyOn(utils, 'removeCredentials');
          const writeRecordingsSpy = mocked(writeRecordings);

          mocked(exists).mockResolvedValue(true);
          mocked(matchWildCard).mockReturnValueOnce(true);

          await expect(superfaceTest.run({ input: {} })).resolves.toMatchObject(
            {
              value: undefined,
            }
          );

          expect(playRecorderSpy).toHaveBeenCalledTimes(1);
          expect(removeCredentialsSpy).toHaveBeenCalledTimes(1);
          expect(writeRecordingsSpy).toHaveBeenCalledTimes(1);
          expect(writeRecordingsSpy).toHaveBeenCalledWith(
            expect.any(String),
            expectedDefinitions
          );
        });
      });
    });

    describe('when performing', () => {
      it('returns error from perform', async () => {
        const mockedProvider = await getProviderMock('provider');
        const mockedUseCase = getUseCaseMock('usecase');

        superfaceTest = new SuperfaceTest({
          ...(await getMockedSfConfig()),
          provider: mockedProvider,
          useCase: mockedUseCase,
        });

        const performSpy = jest
          .spyOn(mockedUseCase, 'perform')
          .mockResolvedValueOnce(err(new MapASTError('error')));

        mocked(matchWildCard).mockReturnValueOnce(true);

        await expect(superfaceTest.run({ input: {} })).resolves.toMatchObject({
          error: new MapASTError('error').toString(),
        });

        expect(performSpy).toHaveBeenCalledTimes(1);
        expect(performSpy).toHaveBeenCalledWith(
          {},
          { provider: mockedProvider }
        );
      });

      it('retuns value from perform', async () => {
        const mockedProvider = await getProviderMock('provider');
        const mockedUseCase = getUseCaseMock('usecase', {
          isOk: true,
          result: ok('result'),
        });

        superfaceTest = new SuperfaceTest({
          ...(await getMockedSfConfig()),
          provider: mockedProvider,
          useCase: mockedUseCase,
        });

        mocked(matchWildCard).mockReturnValueOnce(true);

        await expect(superfaceTest.run({ input: {} })).resolves.toMatchObject({
          value: 'result',
        });

        expect(mockedUseCase.perform).toHaveBeenCalledTimes(1);
        expect(mockedUseCase.perform).toHaveBeenCalledWith(
          {},
          { provider: mockedProvider }
        );
      });
    });
  });
});
