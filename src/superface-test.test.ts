import {
  BoundProfileProvider,
  err,
  MapASTError,
  ok,
} from '@superfaceai/one-sdk';
import nock, { pendingMocks } from 'nock';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { matchWildCard } from './common/format';
import { generate } from './generate-hash';
import { MatchImpact } from './nock/analyzer';
import { MatchErrorLength } from './nock/matcher.errors';
import { endRecording, loadRecording, startRecording } from './nock/recorder';
import { canUpdateTraffic, updateTraffic } from './nock/recorder.utils';
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

jest.mock('./nock/recorder', () => ({
  ...jest.requireActual('./nock/recorder'),
  startRecording: jest.fn(),
  endRecording: jest.fn(),
  loadRecording: jest.fn(),
}));

jest.mock('./nock/recorder.utils', () => ({
  ...jest.requireActual('./nock/recorder.utils'),
  canUpdateTraffic: jest.fn(),
  updateTraffic: jest.fn(),
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
  testPayload.profile
);

const defaultInput = {};
const defaultExpectedHash = generate('{}');

const recordingsConfig = {
  path: joinPath(pathToRecordings, 'provider.recording'),
  type: RecordingType.MAIN,
  key: joinPath(...Object.values(testPayload)),
  hash: defaultExpectedHash,
};

const DEFAULT_RECORDING_NEXT_TO_TEST_PATH = joinPath(
  __dirname,
  'recordings',
  'provider.recording'
);

interface RecordingsOptions {
  recordingsPath?: string;
  recordingsType?: RecordingType;
  recordingsHash?: string;
  recordingsKey?: string;
  config?: {
    providerName?: string;
  };
  processRecordings?: boolean;
  inputVariables?: InputVariables;
}

const prepareRecordingsConfig = (options?: RecordingsOptions) => ({
  recordingsPath: options?.recordingsPath ?? recordingsConfig.path,
  recordingsType: options?.recordingsType ?? RecordingType.MAIN,
  recordingsHash: options?.recordingsHash ?? recordingsConfig.hash,
  recordingsKey: options?.recordingsKey ?? recordingsConfig.key,
});

const prepareLoadRecordingParameters = (
  options?: RecordingsOptions & {
    beforeRecordingLoad?: boolean;
  }
) => ({
  ...prepareRecordingsConfig(options),
  inputVariables: options?.inputVariables,
  config: {
    boundProfileProvider: expect.objectContaining(
      Object.create(BoundProfileProvider)
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
});

const prepareEndRecordingParameters = (
  options?: RecordingsOptions & {
    beforeRecordingSave?: boolean;
  }
) => ({
  ...prepareRecordingsConfig(options),
  inputVariables: options?.inputVariables,
  config: {
    boundProfileProvider: expect.objectContaining(
      Object.create(BoundProfileProvider)
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

  beforeEach(() => {
    superfaceTest = new SuperfaceTest(testPayload);
  });

  afterEach(() => {
    mockBoundProfileProvider.mockClear();
    mocked(matchWildCard).mockReset();
    mocked(canUpdateTraffic).mockReset();
    mocked(updateTraffic).mockReset();
    mocked(startRecording).mockReset();
    mocked(loadRecording).mockReset();
    mocked(endRecording).mockReset();
    mocked(saveReport).mockReset();
  });

  describe('run', () => {
    describe('when recording', () => {
      it('writes and restores recordings', async () => {
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

      it('saves report if new recording contains some changes', async () => {
        const saveReportSpy = mocked(saveReport);

        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(endRecording).mockResolvedValue({
          impact: MatchImpact.MAJOR,
          errors: {
            added: [new MatchErrorLength(1, 2)],
            removed: [],
            changed: [],
          },
        });

        await superfaceTest.run({ input: defaultInput });

        expect(saveReportSpy).toBeCalledTimes(1);
        expect(saveReportSpy).toBeCalledWith({
          input: {},
          result: ok('value'),
          recordingsHash: recordingsConfig.hash,
          recordingsPath: recordingsConfig.path,
          profileId: testPayload.profile,
          providerName: testPayload.provider,
          useCaseName: testPayload.useCase,
          analysis: {
            impact: MatchImpact.MAJOR,
            errors: {
              added: [new MatchErrorLength(1, 2)],
              removed: [],
              changed: [],
            },
          },
        });
      });
    });

    describe('when loading recordings', () => {
      it('loads fixture if it exists, but contains no recordings', async () => {
        const loadRecordingSpy = mocked(loadRecording);
        const enableNetConnectSpy = jest.spyOn(nock, 'enableNetConnect');
        const restoreSpy = jest.spyOn(nock, 'restore');

        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(false);

        await expect(superfaceTest.run({ input: {} })).resolves.not.toThrow();

        expect(loadRecordingSpy).toHaveBeenCalledTimes(1);
        expect(loadRecordingSpy).toHaveBeenCalledWith(
          prepareLoadRecordingParameters()
        );
        expect(restoreSpy).toHaveBeenCalledTimes(1);
        expect(pendingMocks()).toEqual([]);
        expect(enableNetConnectSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('when performing', () => {
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

    describe('when hashing recordings', () => {
      let superfaceTest: SuperfaceTest;

      beforeEach(async () => {
        superfaceTest = new SuperfaceTest(testPayload, {
          testInstance: expect,
        });
      });

      it('loads recordings hashed based on test instance', async () => {
        const expectedTestName = expect.getState().currentTestName;
        const expectedHash = generate(expectedTestName);

        const loadRecordingSpy = mocked(loadRecording);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(false);

        await superfaceTest.run({ input: {} });

        expect(loadRecordingSpy).toHaveBeenCalledWith(
          prepareLoadRecordingParameters({
            recordingsPath: DEFAULT_RECORDING_NEXT_TO_TEST_PATH,
            recordingsHash: expectedHash,
          })
        );
      });

      it('loads recordings hashed based on parameter testName', async () => {
        const testName = 'my-test-name';
        const expectedHash = generate(testName);

        const loadRecordingSpy = mocked(loadRecording);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(false);

        await superfaceTest.run({ input: {}, testName });

        expect(loadRecordingSpy).toHaveBeenCalledWith(
          prepareLoadRecordingParameters({
            recordingsPath: DEFAULT_RECORDING_NEXT_TO_TEST_PATH,
            recordingsHash: expectedHash,
          })
        );
      });

      it('loads recordings hashed based on input', async () => {
        superfaceTest = new SuperfaceTest(testPayload, {
          testInstance: undefined,
        });

        const input = { some: 'value' };
        const expectedHash = generate(JSON.stringify(input));

        const loadRecordingSpy = mocked(loadRecording);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(false);

        await superfaceTest.run({ input, testName: undefined });

        expect(loadRecordingSpy).toHaveBeenCalledWith(
          prepareLoadRecordingParameters({
            recordingsHash: expectedHash,
          })
        );
      });
    });

    describe('when updating', () => {
      let env: string | undefined;

      beforeAll(() => {
        env = process.env.UPDATE_TRAFFIC;

        process.env.UPDATE_TRAFFIC = 'true';
      });

      afterAll(() => {
        process.env.UPDATE_TRAFFIC = env;
      });

      it('merges new recordings with current ones', async () => {
        const canUpdateTrafficSpy =
          mocked(canUpdateTraffic).mockResolvedValue(true);
        const updateTrafficSpy = mocked(updateTraffic);

        mocked(prepareSuperface).mockResolvedValue(mockSuperface());
        mocked(matchWildCard).mockReturnValueOnce(true);
        mocked(startRecording);
        mocked(endRecording);

        await superfaceTest.run({ input: defaultInput });

        expect(canUpdateTrafficSpy).toHaveBeenCalledTimes(1);
        expect(canUpdateTrafficSpy).toHaveBeenCalledWith(recordingsConfig.path);
        expect(updateTrafficSpy).toHaveBeenCalledTimes(1);
        expect(updateTrafficSpy).toHaveBeenCalledWith(recordingsConfig.path);
      });
    });
  });
});
