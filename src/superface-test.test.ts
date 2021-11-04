import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import {
  err,
  MapASTError,
  ok,
  Profile,
  Provider,
  SuperfaceClient,
  SuperJson,
} from '@superfaceai/one-sdk';
import { getLocal } from 'mockttp';
import nock, { pendingMocks, recorder } from 'nock';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import {
  ComponentUndefinedError,
  MapUndefinedError,
  RecordingsNotFoundError,
} from './common/errors';
import { matchWildCard } from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import { HIDDEN_CREDENTIALS_PLACEHOLDER } from './nock.utils';
import {
  getMockedSfConfig,
  getProfileMock,
  getProviderMock,
  getUseCaseMock,
  SuperfaceClientMock,
} from './superface.mock';
import { SuperfaceTest } from './superface-test';

/* eslint-disable @typescript-eslint/unbound-method */

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

const mockServer = getLocal();
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
      let client: SuperfaceClient,
        mockedProfile: Profile,
        mockedProvider: Provider;

      beforeAll(async () => {
        client = new SuperfaceClientMock();
        mockedProfile = await getProfileMock('profile');
        mockedProvider = await getProviderMock('provider');
      });

      it('throws when Profile is not entered', async () => {
        const superface = new SuperfaceTest({ client });

        await expect(
          superface.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('Profile'));
      });

      it('throws when UseCase is entered, but Profile is not entered', async () => {
        const superface = new SuperfaceTest({
          client,
          useCase: 'some-use-case',
        });

        await expect(
          superface.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('Profile'));
      });

      it('throws when Provider is not entered', async () => {
        const superface = new SuperfaceTest({ client, profile: mockedProfile });

        await expect(
          superface.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('Provider'));
      });

      it('throws when UseCase is not entered', async () => {
        const superface = new SuperfaceTest({
          client,
          profile: mockedProfile,
          provider: mockedProvider,
        });

        await expect(
          superface.run({
            input: {},
          })
        ).rejects.toThrowError(new ComponentUndefinedError('UseCase'));
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

      it('writes and restores recordings', async () => {
        superfaceTest = new SuperfaceTest(await getMockedSfConfig());

        await mockServer
          .get('/')
          .withHeaders({ Accept: 'application/json' })
          .thenJson(200, { some: 'data' });

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

      it('writes and restores modified recordings when security is used', async () => {
        superfaceTest = new SuperfaceTest(
          await getMockedSfConfig({
            baseUrl: 'https://localhost',
            securitySchemes: [
              {
                id: 'api-key',
                type: 'apiKey' as SecurityType.APIKEY,
                in: 'query' as ApiKeyPlacement.QUERY,
                name: 'api_key',
              },
            ],
            securityValues: [{ id: 'api-key', apikey: 'secret' }],
          })
        );

        const writeRecordingsSpy = mocked(writeRecordings);
        const playSpy = jest.spyOn(recorder, 'play').mockReturnValueOnce([
          {
            scope: 'https://localhost',
            path: '/?api_key=secret',
            status: 200,
            response: { some: 'data' },
          },
        ]);
        const endRecSpy = jest.spyOn(nock, 'restore');

        mocked(exists).mockResolvedValue(true);
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: {} });

        expect(playSpy).toHaveBeenCalledTimes(1);
        expect(endRecSpy).toHaveBeenCalledTimes(1);

        expect(writeRecordingsSpy).toHaveBeenCalledTimes(1);
        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringContaining(DEFAULT_RECORDING_PATH),
          [
            {
              scope: 'https://localhost',
              path: `/?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
              status: 200,
              response: {
                some: 'data',
              },
            },
          ]
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

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
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

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
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
