import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  ok,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import { define, disableNetConnect, recorder } from 'nock';
import { mocked } from 'ts-jest/utils';

import { BaseURLNotFoundError } from '../common/errors';
import { writeRecordings } from '../common/output-stream';
import { mockBoundProfileProvider } from '../superface/mock/boundProfileProvider';
import { RecordingDefinitions } from '../superface-test.interfaces';
import * as utils from '../superface-test.utils';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
} from '../superface-test.utils';
import { MatchImpact } from './analyzer';
import { matchTraffic } from './matcher';
import { endRecording, loadRecording, startRecording } from './recorder';
import { getRecordings, handleRecordings } from './recorder.utils';
import { RecordingType, TestRecordings } from './recording.interfaces';

jest.mock('nock');

jest.mock('./recorder.utils', () => ({
  ...jest.requireActual('./recorder.utils'),
  getRecordings: jest.fn(),
  handleRecordings: jest.fn(),
}));

jest.mock('../common/output-stream', () => ({
  writeRecordings: jest.fn(),
}));

jest.mock('./matcher', () => ({
  matchTraffic: jest.fn(),
}));

const recordingsConfig = {
  recordingsPath: 'path/to/recordings',
  recordingsType: RecordingType.MAIN,
  recordingsKey: 'profile/provider/test',
  recordingsHash: '###',
};

const sampleRecordings = {
  scope: 'https://localhost',
  path: '/',
  status: 200,
  response: {},
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
      [{ id: 'default', baseUrl: 'http://localhost' }],
      'default'
    ),
  });
};

const prepareFile = (recordings: RecordingDefinitions): TestRecordings => ({
  'profile/provider/test': {
    '###': recordings,
  },
});

describe('Recorder', () => {
  afterEach(() => {
    mocked(getRecordings).mockReset();
    mocked(writeRecordings).mockReset();
    mocked(handleRecordings).mockReset();
    mocked(matchTraffic).mockReset();
    mocked(define).mockReset();
    mocked(disableNetConnect).mockReset();
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    mocked(recorder.play).mockReset();
    mockBoundProfileProvider.mockClear();
  });

  describe('startRecording', () => {
    it('starts nock recording', async () => {
      const recorderSpy = jest.spyOn(recorder, 'rec');

      await startRecording();

      expect(recorderSpy).toBeCalledTimes(1);
      expect(recorderSpy).toBeCalledWith({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording: false,
      });
    });
  });

  describe('loadRecording', () => {
    it('throws when service does not have base Url', async () => {
      const config = {
        boundProfileProvider: mockBoundProfileProvider(ok('value'), {
          services: new ServiceSelector([], 'default'),
        }),
        providerName: 'provider',
      };

      mocked(getRecordings).mockResolvedValue([]);

      await expect(
        async () =>
          await loadRecording({
            ...recordingsConfig,
            config,
          })
      ).rejects.toThrowError(new BaseURLNotFoundError('provider'));
    });

    it('Replaces credentials in recordings if parameter processRecordings is specified', async () => {
      const secret = 'secret';
      const integrationParam = 'integration-parameter';

      const config = {
        boundProfileProvider: prepareBoundProfileProvider({
          credential: secret,
          parameter: integrationParam,
        }),
        providerName: 'provider',
      };
      const sampleRecordings = [
        {
          scope: 'https://localhost',
          path: `/?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}api-key`,
          status: 200,
          response: { auth: `${HIDDEN_PARAMETERS_PLACEHOLDER}param` },
        },
      ];

      const replaceSpy = jest.spyOn(utils, 'replaceCredentials');
      const nockLoadSpy = mocked(define);
      mocked(getRecordings).mockResolvedValue(sampleRecordings);

      await loadRecording({
        ...recordingsConfig,
        config,
        options: {
          processRecordings: true,
        },
      });

      expect(replaceSpy).toBeCalledTimes(1);
      expect(nockLoadSpy).toBeCalledTimes(1);
      expect(nockLoadSpy).toBeCalledWith([
        {
          scope: 'https://localhost',
          path: `/?api_key=${secret}`,
          status: 200,
          response: { auth: integrationParam },
        },
      ]);
    });

    it('Calls external hook beforeRecordingLoad if specified', async () => {
      const secret = 'secret';
      const config = {
        boundProfileProvider: prepareBoundProfileProvider(),
        providerName: 'provider',
      };
      const sampleRecordings = {
        scope: 'https://localhost',
        path: '/',
        status: 200,
        response: { auth: secret },
      };

      const beforeRecordingLoad = jest.fn(
        (recordings: RecordingDefinitions) => {
          recordings.forEach((_, i) => {
            recordings[i].response = {
              auth: 'HIDDEN',
            };
          });
        }
      );
      const beforeRecordingLoadSpy = mocked(beforeRecordingLoad);
      const nockLoadSpy = mocked(define);

      mocked(getRecordings).mockResolvedValue([sampleRecordings]);

      await loadRecording({
        ...recordingsConfig,
        config,
        options: {
          beforeRecordingLoad: beforeRecordingLoadSpy,
        },
      });

      expect(beforeRecordingLoadSpy).toBeCalledTimes(1);
      expect(beforeRecordingLoadSpy).toBeCalledWith([sampleRecordings]);
      expect(nockLoadSpy).toBeCalledTimes(1);
      expect(nockLoadSpy).toBeCalledWith([
        {
          ...sampleRecordings,
          response: { auth: 'HIDDEN' },
        },
      ]);
    });

    it('Disables HTTP traffic', async () => {
      const config = {
        boundProfileProvider: prepareBoundProfileProvider(),
        providerName: 'provider',
      };

      const disableNetConnectSpy = mocked(disableNetConnect);
      mocked(define);
      mocked(getRecordings).mockResolvedValue([]);

      await loadRecording({
        ...recordingsConfig,
        config,
      });

      expect(disableNetConnectSpy).toBeCalledTimes(1);
    });
  });

  describe('endRecording', () => {
    it('calls external hook beforeRecordingSave if specified', async () => {
      const secret = 'secret';
      const config = {
        boundProfileProvider: prepareBoundProfileProvider(),
        providerName: 'provider',
      };
      const sampleRecordings = {
        scope: 'https://localhost',
        path: '/',
        status: 200,
        response: { auth: secret },
      };

      const beforeRecordingSave = jest.fn(
        (recordings: RecordingDefinitions) => {
          recordings.forEach((_, i) => {
            recordings[i].response = {
              auth: 'HIDDEN',
            };
          });
        }
      );

      const beforeRecordingSaveSpy = mocked(beforeRecordingSave);
      jest.spyOn(recorder, 'play').mockReturnValue([sampleRecordings]);

      await endRecording({
        ...recordingsConfig,
        config,
        options: {
          beforeRecordingSave: beforeRecordingSaveSpy,
        },
      });

      expect(beforeRecordingSaveSpy).toBeCalledTimes(1);
      expect(beforeRecordingSaveSpy).toBeCalledWith([sampleRecordings]);
    });

    it('checks for sensitive information', async () => {
      const secret = 'secret';
      const config = {
        boundProfileProvider: prepareBoundProfileProvider({
          credential: secret,
        }),
        providerName: 'provider',
      };
      const sampleRecordings = {
        scope: 'https://localhost',
        path: '/',
        status: 200,
        response: { auth: secret },
      };

      const checkSensitiveInformationSpy = jest.spyOn(
        utils,
        'checkSensitiveInformation'
      );

      jest.spyOn(recorder, 'play').mockReturnValue([sampleRecordings]);

      await endRecording({
        ...recordingsConfig,
        config,
      });

      expect(checkSensitiveInformationSpy).toBeCalledTimes(1);
      expect(checkSensitiveInformationSpy).toBeCalledWith(
        [sampleRecordings],
        [
          {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.QUERY,
            name: 'api_key',
            apikey: secret,
          },
        ],
        {},
        undefined
      );
    });

    describe('when recordings file does not exists', () => {
      describe('and when incoming recordings are empty', () => {
        it('writes empty recordings and returns undefined', async () => {
          const file: TestRecordings = prepareFile([]);
          const config = {
            boundProfileProvider: prepareBoundProfileProvider(),
            providerName: 'provider',
          };

          const handleRecordingsSpy = mocked(
            handleRecordings
          ).mockResolvedValue({
            kind: 'default',
            file,
          });
          const writeRecordingsSpy = mocked(writeRecordings);

          await expect(
            endRecording({
              ...recordingsConfig,
              config,
            })
          ).resolves.toBeUndefined();

          expect(handleRecordingsSpy).toBeCalledTimes(1);
          expect(writeRecordingsSpy).toBeCalledTimes(1);
          expect(writeRecordingsSpy).toBeCalledWith(
            'path/to/recordings.json',
            file
          );
        });
      });
    });

    describe('when recordings file already exists', () => {
      describe('and when storing new recordings is allowed', () => {
        let storeNewTraffic: string | undefined;

        beforeAll(() => {
          storeNewTraffic = process.env.STORE_NEW_TRAFFIC;
          process.env.STORE_NEW_TRAFFIC = 'true';
        });

        afterAll(() => {
          process.env.STORE_NEW_TRAFFIC = storeNewTraffic;
        });

        afterEach(() => {
          mocked(matchTraffic).mockReset();
        });

        describe('and when incoming recordings are empty', () => {
          it('writes empty recordings to new file', async () => {
            const sampleRecordings = {
              scope: 'https://localhost',
              path: '/',
              status: 200,
              response: {},
            };
            const file = prepareFile([]);
            const config = {
              boundProfileProvider: prepareBoundProfileProvider(),
              providerName: 'provider',
            };

            const handleRecordingsSpy = mocked(
              handleRecordings
            ).mockResolvedValue({
              kind: 'new',
              file,
              oldRecordings: [sampleRecordings],
            });
            const writeRecordingsSpy = mocked(writeRecordings);
            const matchTrafficSpy = mocked(matchTraffic);

            jest.spyOn(recorder, 'play').mockReturnValue([]);

            await endRecording({
              ...recordingsConfig,
              config,
            });

            expect(matchTrafficSpy).not.toBeCalled();
            expect(handleRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).toBeCalledWith(
              'path/to/recordings-new.json',
              file
            );
          });
        });

        describe('and when incoming recordings are not empty', () => {
          it('write them to new file if they do not match with old ones', async () => {
            const sampleRecordings = {
              scope: 'https://localhost',
              path: '/',
              status: 200,
              response: {},
            };
            const file = prepareFile([]);
            const config = {
              boundProfileProvider: prepareBoundProfileProvider(),
              providerName: 'provider',
            };

            const handleRecordingsSpy = mocked(
              handleRecordings
            ).mockResolvedValue({
              kind: 'new',
              file,
              oldRecordings: [sampleRecordings],
            });
            const writeRecordingsSpy = mocked(writeRecordings);
            const matchTrafficSpy = mocked(matchTraffic).mockResolvedValue({
              impact: MatchImpact.MAJOR,
              errors: {
                added: [],
                removed: [],
                changed: [],
              },
            });

            jest.spyOn(recorder, 'play').mockReturnValue([sampleRecordings]);

            await endRecording({
              ...recordingsConfig,
              config,
            });

            expect(matchTrafficSpy).toBeCalledTimes(1);
            expect(handleRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).toBeCalledWith(
              'path/to/recordings-new.json',
              file
            );
          });

          it('do not write them to new file if they match with old ones', async () => {
            const file = prepareFile([]);
            const config = {
              boundProfileProvider: prepareBoundProfileProvider(),
              providerName: 'provider',
            };

            const handleRecordingsSpy = mocked(
              handleRecordings
            ).mockResolvedValue({
              kind: 'new',
              file,
              oldRecordings: [sampleRecordings],
            });
            const writeRecordingsSpy = mocked(writeRecordings);
            const matchTrafficSpy = mocked(matchTraffic).mockResolvedValue({
              impact: MatchImpact.NONE,
            });

            jest.spyOn(recorder, 'play').mockReturnValue([sampleRecordings]);

            await endRecording({
              ...recordingsConfig,
              config,
            });

            expect(matchTrafficSpy).toBeCalledTimes(1);
            expect(handleRecordingsSpy).toBeCalledTimes(1);
            expect(writeRecordingsSpy).not.toBeCalled();
          });
        });
      });

      describe('and when storing new recordings is not allowed', () => {
        let storeNewTraffic: string | undefined;

        beforeAll(() => {
          storeNewTraffic = process.env.STORE_NEW_TRAFFIC;
          process.env.STORE_NEW_TRAFFIC = undefined;
        });

        afterAll(() => {
          process.env.STORE_NEW_TRAFFIC = storeNewTraffic;
        });

        it('overwrites current recordings file with incoming recordings', async () => {
          const file = prepareFile([]);
          const config = {
            boundProfileProvider: prepareBoundProfileProvider(),
            providerName: 'provider',
          };

          const handleRecordingsSpy = mocked(
            handleRecordings
          ).mockResolvedValue({
            kind: 'default',
            file,
          });
          const writeRecordingsSpy = mocked(writeRecordings);
          jest.spyOn(recorder, 'play').mockReturnValue([]);

          await endRecording({
            ...recordingsConfig,
            config,
          });

          expect(handleRecordingsSpy).toBeCalledTimes(1);
          expect(writeRecordingsSpy).toBeCalledTimes(1);
          expect(writeRecordingsSpy).toBeCalledWith(
            'path/to/recordings.json',
            file
          );
        });
      });
    });

    describe('when parameter processRecordings is specified', () => {
      it('throws when provider service does not have base Url', async () => {
        const config = {
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            services: new ServiceSelector([], 'default'),
          }),
          providerName: 'provider',
        };

        jest.spyOn(recorder, 'play').mockReturnValue([
          {
            scope: 'https://localhost',
            path: '/',
            status: 200,
            response: {},
          },
        ]);

        await expect(
          async () =>
            await endRecording({
              ...recordingsConfig,
              config,
              options: {
                processRecordings: true,
              },
            })
        ).rejects.toThrowError(new BaseURLNotFoundError('provider'));
      });

      it('replaces credentials in recordings', async () => {
        const secret = 'secret';
        const integrationParam = 'integration-parameter';

        const config = {
          boundProfileProvider: mockBoundProfileProvider(ok('value'), {
            security: [
              {
                id: 'api-key',
                type: SecurityType.APIKEY,
                in: ApiKeyPlacement.QUERY,
                name: 'api_key',
                apikey: secret,
              },
            ],
            parameters: { param: integrationParam },
            services: new ServiceSelector(
              [{ id: 'default', baseUrl: 'http://localhost' }],
              'default'
            ),
          }),
          providerName: 'provider',
        };
        const sampleRecordings = [
          {
            scope: 'https://localhost',
            path: `/?api_key=${secret}`,
            status: 200,
            response: { auth: integrationParam },
          },
        ];

        mocked(getRecordings).mockResolvedValue(sampleRecordings);
        const handleRecordingsSpy = mocked(handleRecordings).mockResolvedValue({
          kind: 'default',
          file: prepareFile(sampleRecordings),
        });
        const replaceSpy = jest.spyOn(utils, 'replaceCredentials');
        const playSpy = jest
          .spyOn(recorder, 'play')
          .mockReturnValue(sampleRecordings);

        await endRecording({
          ...recordingsConfig,
          config,
          options: {
            processRecordings: true,
          },
        });

        expect(playSpy).toBeCalledTimes(1);
        expect(replaceSpy).toBeCalledTimes(1);
        expect(handleRecordingsSpy).toBeCalledTimes(1);
        expect(handleRecordingsSpy).toBeCalledWith({
          recordingsFilePath: 'path/to/recordings.json',
          newRecordingsFilePath: 'path/to/recordings-new.json',
          recordingsIndex: 'profile/provider/test',
          recordingsHash: '###',
          canSaveNewTraffic: false,
          recordings: [
            {
              scope: 'https://localhost',
              path: `/?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}api-key`,
              status: 200,
              response: { auth: `${HIDDEN_PARAMETERS_PLACEHOLDER}param` },
            },
          ],
        });
      });
    });
  });
});
