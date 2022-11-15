import { ReplyBody } from 'nock/types';
import { mocked } from 'ts-jest/utils';

import {
  RecordingsFileNotFoundError,
  RecordingsHashNotFoundError,
  RecordingsIndexNotFoundError,
  UnexpectedError,
} from '../common/errors';
import {
  exists,
  mkdirQuiet,
  readFileQuiet,
  rename,
  rimraf,
} from '../common/io';
import { writeRecordings } from '../common/output-stream';
import { RecordingDefinition, RecordingType } from './recording.interfaces';
import {
  assertsDefinitionsAreNotStrings,
  canUpdateTraffic,
  composeRecordingPath,
  decodeResponse,
  getRecordings,
  getRequestHeaderValue,
  getResponseHeaderValue,
  handleRecordings,
  parseBody,
  parseRecordingsFile,
  updateTraffic,
} from './utils';

const recordingsFilePath = 'path/to/recordings.json';
const newRecordingsFilePath = 'path/to/recordings-new.json';
const recordingsIndex = 'profile/provider/test';
const recordingsHash = '###';

const recordingsConfig = {
  path: 'path/to/recordings',
  type: RecordingType.MAIN,
  key: recordingsIndex,
  hash: recordingsHash,
};

jest.mock('../common/io', () => ({
  exists: jest.fn(),
  readFileQuiet: jest.fn(),
  mkdirQuiet: jest.fn(),
  rename: jest.fn(),
  rimraf: jest.fn(),
}));

jest.mock('../common/output-stream', () => ({
  writeRecordings: jest.fn(),
}));

describe('recording utils', () => {
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

  describe('getRecordings', () => {
    it('throws Error when no recordings file exist', async () => {
      await expect(
        getRecordings(
          recordingsConfig.path,
          RecordingType.MAIN,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      ).rejects.toThrowError(
        new RecordingsFileNotFoundError(recordingsFilePath)
      );
    });

    describe('when using new recordings file', () => {
      let env: string | undefined;

      beforeAll(() => {
        env = process.env.USE_NEW_TRAFFIC;
        process.env.USE_NEW_TRAFFIC = 'true';
      });

      afterAll(() => {
        process.env.USE_NEW_TRAFFIC = env;
      });

      it('throws Error when no new recordings file exist', async () => {
        mocked(exists).mockResolvedValueOnce(true);

        await expect(
          getRecordings(
            recordingsConfig.path,
            RecordingType.MAIN,
            recordingsConfig.key,
            recordingsConfig.hash
          )
        ).rejects.toThrowError(
          new RecordingsFileNotFoundError(newRecordingsFilePath)
        );
      });
    });

    it('throws Error when recordings file does not contain targeted recordings index', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFileQuiet).mockResolvedValue('{}');

      await expect(
        getRecordings(
          recordingsConfig.path,
          RecordingType.MAIN,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      ).rejects.toThrowError(
        new RecordingsIndexNotFoundError(
          recordingsFilePath,
          recordingsConfig.key
        )
      );
    });

    it('throws Error when recordings file does not contain targeted recordings hash', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFileQuiet).mockResolvedValue('{"profile/provider/test": {}}');

      await expect(
        getRecordings(
          recordingsConfig.path,
          RecordingType.MAIN,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      ).rejects.toThrowError(
        new RecordingsHashNotFoundError(
          recordingsFilePath,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      );
    });

    it('returns targeted recordings if they exist', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFileQuiet).mockResolvedValue(
        '{"profile/provider/test": {"###":[]}}'
      );

      await expect(
        getRecordings(
          recordingsConfig.path,
          RecordingType.MAIN,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      ).resolves.toEqual([]);
    });

    it('returns recordings for prepare if they exist', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFileQuiet).mockResolvedValue(
        '{"prepare-profile/provider/test": {"###":[]}}'
      );

      await expect(
        getRecordings(
          recordingsConfig.path,
          RecordingType.PREPARE,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      ).resolves.toEqual([]);
    });

    it('returns recordings for teardown if they exist', async () => {
      mocked(exists).mockResolvedValue(true);
      mocked(readFileQuiet).mockResolvedValue(
        '{"teardown-profile/provider/test": {"###":[]}}'
      );

      await expect(
        getRecordings(
          recordingsConfig.path,
          RecordingType.TEARDOWN,
          recordingsConfig.key,
          recordingsConfig.hash
        )
      ).resolves.toEqual([]);
    });
  });

  describe('handleRecordings', () => {
    describe('when recordings file does not exist', () => {
      it('returns default with composed recordings file', async () => {
        mocked(exists).mockResolvedValue(false);

        await expect(
          handleRecordings({
            recordingsFilePath,
            newRecordingsFilePath,
            recordingsIndex,
            recordingsHash,
            recordings: [],
            canSaveNewTraffic: false,
          })
        ).resolves.toEqual({
          kind: 'default',
          file: {
            'profile/provider/test': {
              '###': [],
            },
          },
        });
      });
    });

    describe('when recordings file exists', () => {
      describe('and when targeted recordings are not present', () => {
        it('merges current file with incoming traffic', async () => {
          mocked(exists).mockResolvedValue(true);
          mocked(readFileQuiet).mockResolvedValue(
            '{"profile/provider/test": {"hash": []}}'
          );

          await expect(
            handleRecordings({
              recordingsFilePath,
              newRecordingsFilePath,
              recordingsIndex,
              recordingsHash,
              recordings: [],
              canSaveNewTraffic: false,
            })
          ).resolves.toEqual({
            kind: 'default',
            file: {
              'profile/provider/test': {
                hash: [],
                '###': [],
              },
            },
          });
        });
      });

      describe('and when targeted recordings are present', () => {
        describe('and when present and incoming recordings are both empty', () => {
          it('returns undefined - do not change anything', async () => {
            mocked(exists).mockResolvedValue(true);
            mocked(readFileQuiet).mockResolvedValue(
              '{"profile/provider/test": {"###": []}}'
            );

            await expect(
              handleRecordings({
                recordingsFilePath,
                newRecordingsFilePath,
                recordingsIndex,
                recordingsHash,
                recordings: [],
                canSaveNewTraffic: false,
              })
            ).resolves.toBeUndefined();
          });
        });

        describe('and when storing new recordings is allowed', () => {
          it('returns new with composed new recordings file and old targeted recordings', async () => {
            // checking for current recordings file
            mocked(exists).mockResolvedValueOnce(true);
            // parsing current recordings file
            mocked(readFileQuiet).mockResolvedValueOnce(
              '{"profile/provider/test": {"###": [{}]}}'
            );

            // checking for new recordings file
            mocked(exists).mockResolvedValueOnce(true);
            // parsing new recordings file
            mocked(readFileQuiet).mockResolvedValueOnce(
              '{"profile/provider/test": {"hash": []}}'
            );

            await expect(
              handleRecordings({
                recordingsFilePath,
                newRecordingsFilePath,
                recordingsIndex,
                recordingsHash,
                recordings: [],
                canSaveNewTraffic: true,
              })
            ).resolves.toEqual({
              kind: 'new',
              file: { 'profile/provider/test': { hash: [], '###': [] } },
              oldRecordings: [{}],
            });
          });
        });
      });
    });
  });

  describe('composeRecordingPath', () => {
    describe('when version is not specified', () => {
      it('returns path to current recordings file', () => {
        expect(composeRecordingPath(recordingsConfig.path)).toBe(
          recordingsFilePath
        );
      });
    });

    describe('when specified version is "new"', () => {
      it('returns path to new recordings file', () => {
        expect(composeRecordingPath(recordingsConfig.path, 'new')).toBe(
          newRecordingsFilePath
        );
      });
    });

    describe('when specified version is different than "new"', () => {
      it('returns path to versioned recordings file', () => {
        expect(composeRecordingPath(recordingsConfig.path, '1')).toBe(
          'path/to/old/recordings_1.json'
        );
      });
    });
  });

  describe('parseRecordingsFile', () => {
    it('throws when reading fails', async () => {
      mocked(readFileQuiet).mockResolvedValue(undefined);

      await expect(
        parseRecordingsFile(recordingsConfig.path)
      ).rejects.toThrowError(
        new UnexpectedError('Reading new recording file failed')
      );
    });

    it('parses file if reading succeeds', async () => {
      mocked(readFileQuiet).mockResolvedValue(
        '{"profile/provider/test": {"###":[]}}'
      );

      await expect(parseRecordingsFile(recordingsConfig.path)).resolves.toEqual(
        {
          'profile/provider/test': {
            '###': [],
          },
        }
      );
    });
  });

  describe('updateTraffic', () => {
    it('updates current recording file with new traffic', async () => {
      const mkdirSpy = mocked(mkdirQuiet);
      const existSpy = mocked(exists).mockResolvedValueOnce(true);
      const readFileSpy = mocked(readFileQuiet);
      const renameSpy = mocked(rename);
      const writeRecordingsSpy = mocked(writeRecordings);
      const rimrafSpy = mocked(rimraf);

      // current recordings file
      readFileSpy.mockResolvedValueOnce(
        '{"profile/provider/test": {"###":[], "hash": []}}'
      );

      // new recordings file
      readFileSpy.mockResolvedValueOnce(
        '{"profile/provider/test": {"###":[{"scope": "http://localhost"}]}}'
      );

      await expect(
        updateTraffic(recordingsConfig.path)
      ).resolves.toBeUndefined();

      expect(mkdirSpy).toBeCalledTimes(1);
      expect(mkdirSpy).toBeCalledWith('path/to/old');

      expect(existSpy).toBeCalledTimes(2);
      expect(existSpy).toHaveBeenNthCalledWith(
        1,
        'path/to/old/recordings_0.json'
      );
      expect(existSpy).toHaveBeenNthCalledWith(
        2,
        'path/to/old/recordings_1.json'
      );

      expect(readFileSpy).toBeCalledTimes(2);

      expect(renameSpy).toBeCalledTimes(1);
      expect(renameSpy).toBeCalledWith(
        recordingsFilePath,
        'path/to/old/recordings_1.json'
      );

      expect(writeRecordingsSpy).toBeCalledTimes(1);
      expect(writeRecordingsSpy).toBeCalledWith(recordingsFilePath, {
        'profile/provider/test': {
          hash: [],
          '###': [{ scope: 'http://localhost' }],
        },
      });

      expect(rimrafSpy).toBeCalledTimes(1);
      expect(rimrafSpy).toBeCalledWith(newRecordingsFilePath);
    });
  });

  describe('canUpdateTraffic', () => {
    it('returns false when env variable is not set', async () => {
      await expect(
        canUpdateTraffic(recordingsConfig.path)
      ).resolves.toBeFalsy();
    });

    it('returns false when new recordings file does not exist', async () => {
      const env = process.env.UPDATE_TRAFFIC;
      process.env.UPDATE_TRAFFIC = 'true';

      mocked(exists).mockResolvedValue(false);

      await expect(
        canUpdateTraffic(recordingsConfig.path)
      ).resolves.toBeFalsy();

      process.env.UPDATE_TRAFFIC = env;
    });

    it('returns true when new recordings file exists', async () => {
      const env = process.env.UPDATE_TRAFFIC;
      process.env.UPDATE_TRAFFIC = 'true';

      mocked(exists).mockResolvedValue(true);

      await expect(
        canUpdateTraffic(recordingsConfig.path)
      ).resolves.toBeTruthy();

      process.env.UPDATE_TRAFFIC = env;
    });
  });

  describe('getRequestHeaderValue', () => {
    it('returns string request header value', () => {
      const headers = { 'Content-Type': 'application/json' };
      const expectedResult = 'application/json';

      expect(getRequestHeaderValue('content-type', headers)).toBe(
        expectedResult
      );
    });

    it('returns array of strings header value', () => {
      const headers = {
        'Content-Type': ['application/json', 'application/xml'],
      };
      const expectedResult = ['application/json', 'application/xml'];

      expect(getRequestHeaderValue('content-type', headers)).toEqual(
        expectedResult
      );
    });
  });

  describe('getResponseHeaderValue', () => {
    it('returns response header value', () => {
      const headers = ['Content-Type', 'application/json'];
      const expectedResult = 'application/json';

      expect(getResponseHeaderValue('content-type', headers)).toBe(
        expectedResult
      );
    });
  });

  describe('decodeResponse', () => {
    const contentEncoding = 'gzip';

    it.each([() => ({ value: 1 }), { value: 1 }, '{value: 1}'])(
      'fails when specified response is not array of hex data',
      async (response: ReplyBody | undefined) => {
        await expect(
          decodeResponse(response, contentEncoding)
        ).rejects.toThrowError(
          new UnexpectedError(
            `Response is encoded by "${contentEncoding}" and is not an array`
          )
        );
      }
    );
  });

  describe('parseBody', () => {
    it('returns undefined when body is empty string', () => {
      const body = '';

      expect(parseBody(body)).toBeUndefined();
    });

    it.each([
      'from%3D%7B%22name%22%3A%22test%22%7D%26to%3Dtest',
      'from={"name":"test"}&to=test',
    ])('returns decoded request body', body => {
      const expectedValue = {
        from: { name: 'test' },
        to: 'test',
      };

      expect(parseBody(body)).toEqual(expectedValue);
    });
  });
});
