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
import nock, { pendingMocks, recorder } from 'nock';
import { join as joinPath, resolve as resolvePath } from 'path';
import { mocked } from 'ts-jest/utils';

import {
  ComponentUndefinedError,
  MapUndefinedError,
  RecordingsNotFoundError,
} from './common/errors';
import { matchWildCard } from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import { generate } from './generate-hash';
import { Matcher } from './nock/matcher';
import { MatchErrorResponse } from './nock/matcher.errors';
import { saveReport } from './reporter';
import {
  getMockedSfConfig,
  getProfileMock,
  getProviderMock,
  getUseCaseMock,
  SuperfaceClientMock,
} from './superface.mock';
import { SuperfaceTest } from './superface-test';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_INPUT_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
} from './superface-test.utils';

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

jest.mock('./reporter');

const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), 'nock');

describe('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    jest.restoreAllMocks();

    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
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

        mocked(exists).mockResolvedValue(false);
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

        mocked(exists).mockResolvedValue(false);
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

        mocked(exists).mockResolvedValue(false);
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
            baseUrl: 'https://localhost',
            parameters: {
              param,
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

        mocked(exists).mockResolvedValue(false);
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
          await getMockedSfConfig({ baseUrl: 'https://localhost' })
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

        mocked(exists).mockResolvedValue(false);
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

      describe('and there already exists old traffic', () => {
        it('does not write recordings when old and new traffic match', async () => {
          superfaceTest = new SuperfaceTest(await getMockedSfConfig());

          const sampleRecording = {
            scope: 'https://localhost',
            path: `/path`,
            status: 200,
            response: { value: 1 },
          };

          const writeRecordingsSpy = mocked(writeRecordings);
          jest.spyOn(recorder, 'play').mockReturnValueOnce([sampleRecording]);
          const matcherSpy = jest
            .spyOn(Matcher, 'match')
            .mockResolvedValue({ valid: true });

          mocked(exists).mockResolvedValue(true);
          mocked(matchWildCard).mockReturnValueOnce(true);
          mocked(readFileQuiet).mockResolvedValue(
            JSON.stringify([sampleRecording])
          );

          await superfaceTest.run({ input: {} });

          expect(writeRecordingsSpy).not.toBeCalled();
          expect(matcherSpy).toBeCalledTimes(1);
          expect(matcherSpy).toBeCalledWith(
            [sampleRecording],
            [sampleRecording]
          );
        });

        it('writes recordings when old and new traffic does not match', async () => {
          superfaceTest = new SuperfaceTest(await getMockedSfConfig());

          const oldRecording = {
            scope: 'https://localhost',
            path: `/path`,
            status: 200,
            response: { value: 1 },
          };

          const newRecording = {
            scope: 'https://localhost',
            path: `/path`,
            status: 200,
            response: { new_value: 1 },
          };

          jest.spyOn(recorder, 'play').mockReturnValueOnce([newRecording]);

          const writeRecordingsSpy = mocked(writeRecordings);
          const errors = {
            added: [],
            removed: [],
            changed: [
              new MatchErrorResponse(
                {
                  oldResponse: { value: 1 },
                  newResponse: { new_value: 1 },
                },
                'response property "value" is not present'
              ),
            ],
          };
          const matcherSpy = jest.spyOn(Matcher, 'match').mockResolvedValue({
            valid: false,
            errors,
          });
          const saveReportSpy = mocked(saveReport);

          mocked(exists).mockResolvedValue(true);
          mocked(matchWildCard).mockReturnValueOnce(true);
          mocked(readFileQuiet).mockResolvedValue(
            JSON.stringify([oldRecording])
          );

          await superfaceTest.run({ input: {} });

          expect(matcherSpy).toBeCalledTimes(1);
          expect(matcherSpy).toBeCalledWith([oldRecording], [newRecording]);

          expect(writeRecordingsSpy).toBeCalledTimes(1);
          expect(writeRecordingsSpy).toBeCalledWith(
            expect.stringContaining('new'),
            [newRecording]
          );

          expect(saveReportSpy).toBeCalledTimes(1);
        });
      });
    });

    describe('when hashing recordings', () => {
      beforeAll(async () => {
        superfaceTest = new SuperfaceTest({
          ...(await getMockedSfConfig()),
          testInstance: expect,
        });
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
        superfaceTest = new SuperfaceTest({
          ...(await getMockedSfConfig()),
          testInstance: undefined,
        });

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
        const config = await getMockedSfConfig();
        const testName = 'my-test-name';
        const expectedHash = generate(testName);
        const recordingPath = resolvePath(
          `nock/${config.profile.configuration.id}/${config.provider.configuration.name}/${config.useCase.name}/recording-${expectedHash}.json`
        );

        superfaceTest = new SuperfaceTest(config);

        const recorderSpy = jest.spyOn(recorder, 'rec');

        mocked(exists).mockResolvedValueOnce(false);
        mocked(matchWildCard).mockReturnValueOnce(false);

        await expect(
          superfaceTest.run({ input: {}, testName })
        ).rejects.toThrowError(new RecordingsNotFoundError(recordingPath));

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
      it('returns full error from perform', async () => {
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

        await expect(
          superfaceTest.run({ input: {} }, { fullError: true })
        ).resolves.toEqual({
          error: new MapASTError('error'),
        });

        expect(performSpy).toHaveBeenCalledTimes(1);
        expect(performSpy).toHaveBeenCalledWith(
          {},
          { provider: mockedProvider }
        );
      });

      it('returns (by default) stringified error from perform', async () => {
        const mockedProvider = await getProviderMock('provider');
        const mockedUseCase = getUseCaseMock('usecase');
        const mockedMapASTError = new MapASTError('error');

        superfaceTest = new SuperfaceTest({
          ...(await getMockedSfConfig()),
          provider: mockedProvider,
          useCase: mockedUseCase,
        });

        const performSpy = jest
          .spyOn(mockedUseCase, 'perform')
          .mockResolvedValueOnce(err(mockedMapASTError));

        mocked(matchWildCard).mockReturnValueOnce(true);

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
          error: mockedMapASTError.toString(),
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
