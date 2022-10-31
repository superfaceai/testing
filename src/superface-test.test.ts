import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  err,
  MapASTError,
  ok,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import nock, { pendingMocks, recorder } from 'nock';
import { join as joinPath, resolve as resolvePath } from 'path';
import { mocked } from 'ts-jest/utils';

import { RecordingsFileNotFoundError } from './common/errors';
import { matchWildCard } from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import { generate } from './generate-hash';
import { Matcher } from './nock/matcher';
import { MatchErrorResponse } from './nock/matcher.errors';
import { endRecording, loadRecording, startRecording } from './nock/recorder';
import { RecordingType } from './nock/recording.interfaces';
import { saveReport } from './reporter';
import { prepareSuperface } from './superface/config';
import { mockBoundProfileProvider } from './superface/mock/boundProfileProvider';
import { mockSuperface } from './superface/mock/superface';
import { SuperfaceTest } from './superface-test';
import {
  InputVariables,
  RecordingDefinitions,
} from './superface-test.interfaces';
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

// jest.mock('./nock/recorder', () => ({
//   ...jest.requireActual('./nock/recorder'),
//   startRecording: jest.fn(),
//   endRecording: jest.fn(),
//   loadRecording: jest.fn(),
// }));

jest.mock('./common/output-stream', () => ({
  ...jest.requireActual('./common/output-stream'),
  writeRecordings: jest.fn(),
}));

jest.mock('./reporter', () => ({
  saveReport: jest.fn(),
}));

const testPayload = {
  profile: 'profile',
  provider: 'provider',
  useCase: 'test',
};

const pathToRecordings = joinPath(
  process.cwd(),
  'recordings',
  ...Object.values(testPayload)
);

const DEFAULT_RECORDING_NEXT_TO_TEST_PATH = joinPath(
  '.',
  'recordings',
  'provider.recording.json'
);

const DEFAULT_RECORDING_PATH = joinPath(
  pathToRecordings,
  'provider.recording.json'
);

const DEFAULT_NEW_RECORDING_PATH = joinPath(
  pathToRecordings,
  'provider.recording-new.json'
);

const defaultInput = {};
const defaultExpectedHash = generate('{}');

const recordingsConfig = {
  path: joinPath(pathToRecordings, 'provider.recording'),
  type: RecordingType.MAIN,
  key: joinPath(...Object.values(testPayload)),
  hash: defaultExpectedHash,
};

const prepareBoundProfileProvider = (options?: {
  credential?: string;
  parameter?: string;
}): BoundProfileProvider => {
  return mockBoundProfileProvider(ok('value'), {
    security: options?.credential
      ? [
          {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.QUERY,
            name: 'api_key',
            apikey: options.credential,
          },
        ]
      : undefined,
    parameters: options?.parameter ? { param: options.parameter } : undefined,
    services: new ServiceSelector(
      [{ id: 'test-service', baseUrl: 'https://localhost' }],
      'test-service'
    ),
  });
};

const prepareLoadRecordingParameters = (options?: {
  recordingsPath?: string;
  recordingsType?: RecordingType;
  recordingsHash?: string;
  recordingsKey?: string;
  inputVariables: InputVariables;
  config?: {
    boundProfileProvider?: Parameters<typeof prepareBoundProfileProvider>;
    providerName?: string;
  };
  beforeRecordingLoad?: boolean;
  processRecordings?: boolean;
}): Parameters<typeof loadRecording> => [
  {
    recordingsPath: options?.recordingsPath ?? recordingsConfig.path,
    recordingsType: options?.recordingsType ?? RecordingType.MAIN,
    recordingsHash: options?.recordingsHash ?? recordingsConfig.hash,
    recordingsKey: options?.recordingsKey ?? recordingsConfig.key,
    inputVariables: options?.inputVariables,
    config: {
      boundProfileProvider: prepareBoundProfileProvider(
        ...(options?.config?.boundProfileProvider ?? [])
      ),
      providerName: options?.config?.providerName ?? 'provider',
    },
    options: {
      beforeRecordingLoad: options?.beforeRecordingLoad
        ? /* eslint-disable-next-line @typescript-eslint/no-empty-function */
          (_: RecordingDefinitions) => {}
        : undefined,
      processRecordings: options?.processRecordings ?? true,
    },
  },
];

const prepareEndRecordingParameters = (options?: {
  recordingsPath?: string;
  recordingsType?: RecordingType;
  recordingsHash?: string;
  recordingsKey?: string;
  inputVariables: InputVariables;
  config?: {
    boundProfileProvider?: Parameters<typeof prepareBoundProfileProvider>;
    providerName?: string;
  };
  beforeRecordingSave?: boolean;
  processRecordings?: boolean;
}) => ({
  recordingsPath: options?.recordingsPath ?? recordingsConfig.path,
  recordingsType: options?.recordingsType ?? RecordingType.MAIN,
  recordingsHash: options?.recordingsHash ?? recordingsConfig.hash,
  recordingsKey: options?.recordingsKey ?? recordingsConfig.key,
  inputVariables: options?.inputVariables,
  config: {
    boundProfileProvider: prepareBoundProfileProvider(
      ...(options?.config?.boundProfileProvider ?? [])
    ),
    providerName: options?.config?.providerName ?? 'provider',
  },
  options: {
    beforeRecordingSave: options?.beforeRecordingSave
      ? /* eslint-disable-next-line @typescript-eslint/no-empty-function */
        (_: RecordingDefinitions) => {}
      : undefined,
    processRecordings: options?.processRecordings ?? true,
  },
});

describe('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
    mocked(saveReport).mockReset();
    mockBoundProfileProvider.mockClear();
    // mocked(startRecording).mockReset();
    // mocked(endRecording).mockReset();
    // mocked(loadRecording).mockReset();
  });

  describe('run', () => {
    describe('when recording', () => {
      beforeEach(() => {
        superfaceTest = new SuperfaceTest(testPayload);
      });

      it.skip('writes and restores recordings', async () => {
        const startRecordingSpy = mocked(startRecording);
        const endRecordingSpy = mocked(endRecording);

        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(true);

        await superfaceTest.run({ input: defaultInput });

        expect(startRecordingSpy).toHaveBeenCalledTimes(1);
        expect(endRecordingSpy).toHaveBeenCalledTimes(1);
        expect(endRecordingSpy).toHaveBeenCalledWith(
          prepareEndRecordingParameters()
        );
      });

      it('writes recordings when no traffic was recorded', async () => {
        const writeRecordingsSpy = mocked(writeRecordings);
        const recorderSpy = jest.spyOn(recorder, 'rec');
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        await superfaceTest.run({ input: defaultInput });

        expect(recorderSpy).toHaveBeenCalledTimes(1);

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_PATH),
          {
            'profile/provider/test': {
              [defaultExpectedHash]: [],
            },
          }
        );
      });

      it('writes and restores modified recordings when security is used', async () => {
        const secret = 'secret';

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
        mocked(prepareSuperface).mockResolvedValue(
          mockSuperface({
            boundProfileProvider: {
              result: err(new MapASTError('error')),
              security: [
                {
                  id: 'api-key',
                  type: SecurityType.APIKEY,
                  in: ApiKeyPlacement.QUERY,
                  name: 'api_key',
                  apikey: secret,
                },
              ],
            },
          })
        );

        await superfaceTest.run({ input: defaultInput });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_PATH),
          {
            'profile/provider/test': {
              [defaultExpectedHash]: [
                {
                  scope: 'https://localhost',
                  path: `/?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}api-key`,
                  status: 200,
                  response: {
                    auth: `${HIDDEN_CREDENTIALS_PLACEHOLDER}api-key`,
                  },
                },
              ],
            },
          }
        );
      });

      it('writes and restores modified recordings when integration parameters are used', async () => {
        const param = 'integration-parameter';

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
        mocked(prepareSuperface).mockResolvedValue(
          mockSuperface({
            boundProfileProvider: {
              result: err(new MapASTError('error')),
              parameters: {
                param,
              },
            },
          })
        );

        await superfaceTest.run({ input: defaultInput });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_PATH),
          {
            'profile/provider/test': {
              [defaultExpectedHash]: [
                {
                  scope: 'https://localhost',
                  path: `/?api_key=${HIDDEN_PARAMETERS_PLACEHOLDER}param`,
                  status: 200,
                  response: {
                    auth: `${HIDDEN_PARAMETERS_PLACEHOLDER}param`,
                  },
                },
              ],
            },
          }
        );
      });

      it('writes and restores modified recordings when hiding input is used', async () => {
        const token = 'secret';
        const refresh = 'refresh-token';

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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        const input = { auth: { token, refresh } };
        const expectedHash = generate(JSON.stringify(input));

        await superfaceTest.run(
          { input },
          { hideInput: ['auth.token', 'auth.refresh'] }
        );

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_PATH),
          {
            'profile/provider/test': {
              [expectedHash]: [
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
              ],
            },
          }
        );
      });

      describe('and when old traffic already exists', () => {
        describe('and when saving to new files is enabled', () => {
          beforeEach(() => {
            process.env.STORE_NEW_TRAFFIC = 'true';
          });

          afterEach(() => {
            process.env.STORE_NEW_TRAFFIC = undefined;
          });

          it('does not write recordings when old and new traffic match', async () => {
            const sampleRecording = {
              scope: 'https://localhost',
              path: `/path`,
              status: 200,
              response: { value: 1 },
            };

            const writeRecordingsSpy = mocked(writeRecordings);
            const matcherSpy = jest
              .spyOn(Matcher, 'match')
              .mockResolvedValue({ valid: true });

            jest.spyOn(recorder, 'play').mockReturnValueOnce([sampleRecording]);
            mocked(prepareSuperface).mockResolvedValue(mockSuperface());
            mocked(exists).mockResolvedValue(true);
            mocked(matchWildCard).mockReturnValueOnce(true);
            mocked(readFileQuiet).mockResolvedValue(
              JSON.stringify({
                'profile/provider/test': {
                  [defaultExpectedHash]: [sampleRecording],
                },
              })
            );

            await superfaceTest.run({ input: defaultInput });

            expect(writeRecordingsSpy).not.toBeCalled();
            expect(matcherSpy).toBeCalledTimes(1);
            expect(matcherSpy).toBeCalledWith(
              [sampleRecording],
              [sampleRecording]
            );
          });

          it('writes recordings when old and new traffic does not match', async () => {
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

            mocked(prepareSuperface).mockResolvedValue(mockSuperface());
            mocked(exists).mockResolvedValue(true);
            mocked(matchWildCard).mockReturnValueOnce(true);
            mocked(readFileQuiet).mockResolvedValue(
              JSON.stringify({
                'profile/provider/test': {
                  [defaultExpectedHash]: [oldRecording],
                },
              })
            );

            await superfaceTest.run({ input: defaultInput });

            expect(matcherSpy).toBeCalledTimes(1);
            expect(matcherSpy).toBeCalledWith([oldRecording], [newRecording]);

            expect(writeRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).toBeCalledWith(
              expect.stringMatching(DEFAULT_NEW_RECORDING_PATH),
              {
                'profile/provider/test': {
                  [defaultExpectedHash]: [newRecording],
                },
              }
            );

            expect(saveReportSpy).toBeCalledTimes(1);
          });
        });

        describe('and when saving to new files is disabled (no matching)', () => {
          it('overwrites recordings', async () => {
            const sampleRecording = {
              scope: 'https://localhost',
              path: `/path`,
              status: 200,
              response: { value: 1 },
            };

            const writeRecordingsSpy = mocked(writeRecordings);
            const saveReportSpy = mocked(saveReport);
            const matcherSpy = jest.spyOn(Matcher, 'match');

            jest.spyOn(recorder, 'play').mockReturnValueOnce([sampleRecording]);

            mocked(prepareSuperface).mockResolvedValue(mockSuperface());
            mocked(exists).mockResolvedValue(true);
            mocked(matchWildCard).mockReturnValueOnce(true);
            mocked(readFileQuiet).mockResolvedValue(
              JSON.stringify({
                'profile/provider/test': {
                  [defaultExpectedHash]: [sampleRecording],
                },
              })
            );

            await superfaceTest.run({ input: defaultInput });

            expect(matcherSpy).not.toBeCalled();

            expect(writeRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).toBeCalledWith(
              expect.stringMatching(DEFAULT_RECORDING_PATH),
              {
                'profile/provider/test': {
                  [defaultExpectedHash]: [sampleRecording],
                },
              }
            );

            expect(saveReportSpy).not.toBeCalled();
          });
        });
      });
    });

    describe('when hashing recordings', () => {
      beforeEach(async () => {
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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        await superfaceTest.run({ input: {} });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_NEXT_TO_TEST_PATH),
          {
            'profile/provider/test': {
              [expectedHash]: [],
            },
          }
        );
      });

      it('writes recordings to file hashed based on parameter testName', async () => {
        const testName = 'my-test-name';
        const expectedHash = generate(testName);

        const writeRecordingsSpy = mocked(writeRecordings);
        jest.spyOn(recorder, 'play').mockReturnValueOnce([]);

        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        await superfaceTest.run({ input: {}, testName });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_NEXT_TO_TEST_PATH),
          {
            'profile/provider/test': {
              [expectedHash]: [],
            },
          }
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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        await superfaceTest.run({ input, testName: undefined });

        expect(writeRecordingsSpy).toHaveBeenCalledWith(
          expect.stringMatching(DEFAULT_RECORDING_PATH),
          {
            'profile/provider/test': {
              [expectedHash]: [],
            },
          }
        );
      });
    });

    describe('when loading recordings', () => {
      beforeEach(() => {
        superfaceTest = new SuperfaceTest(testPayload);
      });

      it('throws when recording fixture does not exist', async () => {
        const testName = 'my-test-name';
        const recordingPath = resolvePath(
          `recordings/${testPayload.profile}/${testPayload.provider}/${testPayload.useCase}/${testPayload.provider}.recording.json`
        );

        const recorderSpy = jest.spyOn(recorder, 'rec');
        const defineRecordingSpy = jest.spyOn(nock, 'define');

        mocked(matchWildCard).mockReturnValueOnce(false);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        await expect(
          superfaceTest.run({ input: {}, testName })
        ).rejects.toThrowError(new RecordingsFileNotFoundError(recordingPath));

        expect(recorderSpy).not.toHaveBeenCalled();
        expect(defineRecordingSpy).not.toHaveBeenCalled();
      });

      it.skip('loads fixture if it exists, but contains no recordings', async () => {
        const loadRecordingSpy = mocked(loadRecording);
        const disableNetConnectSpy = jest.spyOn(nock, 'disableNetConnect');
        const enableNetConnectSpy = jest.spyOn(nock, 'enableNetConnect');
        const restoreSpy = jest.spyOn(nock, 'restore');

        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(false);

        await expect(superfaceTest.run({ input: {} })).resolves.not.toThrow();

        expect(loadRecordingSpy).toHaveBeenCalledTimes(1);
        expect(loadRecordingSpy).toHaveBeenCalledWith(
          ...prepareLoadRecordingParameters()
        );
        expect(restoreSpy).toHaveBeenCalledTimes(1);
        expect(pendingMocks()).toEqual([]);
        expect(disableNetConnectSpy).toHaveBeenCalledTimes(1);
        expect(enableNetConnectSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('when performing', () => {
      beforeEach(() => {
        superfaceTest = new SuperfaceTest(testPayload);
      });

      it('returns error from perform', async () => {
        mocked(prepareSuperface).mockResolvedValue(
          mockSuperface({
            boundProfileProvider: {
              result: err(new MapASTError('error')),
            },
          })
        );

        mocked(matchWildCard).mockReturnValueOnce(true);

        await expect(
          superfaceTest.run({ input: {} }, { fullError: true })
        ).resolves.toEqual({
          error: new MapASTError('error'),
        });
      });

      it('retuns value from perform', async () => {
        mocked(prepareSuperface).mockResolvedValue(
          mockSuperface({
            boundProfileProvider: {
              result: ok({ value: 'result' }),
            },
          })
        );

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
