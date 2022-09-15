import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import { err, MapASTError, ok } from '@superfaceai/one-sdk';
import nock, { pendingMocks, recorder } from 'nock';
import { join as joinPath, resolve as resolvePath } from 'path';
import { mocked } from 'ts-jest/utils';

import { RecordingsNotFoundError } from './common/errors';
import { matchWildCard } from './common/format';
import { exists, readFileQuiet } from './common/io';
import { writeRecordings } from './common/output-stream';
import { generate } from './generate-hash';
import { Matcher } from './nock/matcher';
import { MatchErrorResponse } from './nock/matcher.errors';
import { saveReport } from './reporter';
import { prepareSuperface } from './superface/config';
import { mockSuperface } from './superface/mock/superface';
import { SuperfaceTest } from './superface-test';
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

const testPayload = {
  profile: 'profile',
  provider: 'provider',
  useCase: 'test',
};

jest.mock('./reporter', () => ({
  saveReport: jest.fn(),
}));

const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), 'nock');

describe('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
    mocked(saveReport).mockReset();
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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

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

      describe('and when old traffic already exists', () => {
        it('does not write recordings when old and new traffic match', async () => {
          superfaceTest = new SuperfaceTest(testPayload);

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

          mocked(prepareSuperface).mockResolvedValue(mockSuperface());
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
          superfaceTest = new SuperfaceTest(testPayload);

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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

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
        const testName = 'my-test-name';
        const expectedHash = generate(testName);
        const recordingPath = resolvePath(
          `nock/${testPayload.profile}/${testPayload.provider}/${testPayload.useCase}/recording-${expectedHash}.json`
        );

        superfaceTest = new SuperfaceTest(testPayload);

        const recorderSpy = jest.spyOn(recorder, 'rec');

        mocked(matchWildCard).mockReturnValueOnce(false);
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

        await expect(
          superfaceTest.run({ input: {}, testName })
        ).rejects.toThrowError(new RecordingsNotFoundError(recordingPath));

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
        mocked(prepareSuperface).mockResolvedValue(mockSuperface());

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
        mocked(prepareSuperface).mockResolvedValue(
          mockSuperface({
            boundProfileProvider: {
              result: err(new MapASTError('error')),
            },
          })
        );

        superfaceTest = new SuperfaceTest(testPayload);

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
