import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  ok,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { MatchImpact } from '../analyzer';
import { BaseURLNotFoundError } from '../common/errors';
import { writeRecordings } from '../common/output-stream';
import { matchTraffic } from '../matcher';
import { mockBoundProfileProvider } from '../superface/mock/boundProfileProvider';
import { endAndProcessRecording, processAndLoadRecordings } from './controller';
import { endRecording, loadRecordings } from './recorder';
import {
  RecordingDefinitions,
  RecordingType,
  TestRecordings,
} from './recording.interfaces';
import { checkSensitiveInformation, replaceCredentials } from './replace/utils';
import { getRecordings, handleRecordings } from './utils';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  getRecordings: jest.fn(),
  handleRecordings: jest.fn(),
}));

jest.mock('./recorder', () => ({
  endRecording: jest.fn(),
  loadRecordings: jest.fn(),
}));

jest.mock('./replace/utils', () => ({
  replaceCredentials: jest.fn(),
  checkSensitiveInformation: jest.fn(),
}));

jest.mock('../common/output-stream', () => ({
  writeRecordings: jest.fn(),
}));

jest.mock('../matcher', () => ({
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

describe('recorder controller', () => {
  afterEach(() => {
    mocked(getRecordings).mockReset();
    mocked(handleRecordings).mockReset();
    mocked(writeRecordings).mockReset();
    mocked(matchTraffic).mockReset();
    mocked(endRecording).mockReset();
    mocked(loadRecordings).mockReset();
    mockBoundProfileProvider.mockClear();
  });

  describe('processAndLoadRecordings', () => {
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
          await processAndLoadRecordings({
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
          path: '/?api_key=SECURITY_api-key',
          status: 200,
          response: { auth: 'PARAMS_param' },
        },
      ];

      const replaceSpy = mocked(replaceCredentials).mockImplementation(
        options => {
          options.definitions.forEach((_, i) => {
            options.definitions[i] = {
              ...options.definitions[i],
              path: `/?api_key=${secret}`,
              response: { auth: integrationParam },
            };
          });
        }
      );
      const loadRecordingsSpy = mocked(loadRecordings);
      mocked(getRecordings).mockResolvedValue(sampleRecordings);

      await processAndLoadRecordings({
        ...recordingsConfig,
        config,
        options: {
          processRecordings: true,
        },
      });

      expect(replaceSpy).toBeCalledTimes(1);
      expect(loadRecordingsSpy).toBeCalledTimes(1);
      expect(loadRecordingsSpy).toBeCalledWith([
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
      const loadRecordingsSpy = mocked(loadRecordings);

      mocked(getRecordings).mockResolvedValue([sampleRecordings]);

      await processAndLoadRecordings({
        ...recordingsConfig,
        config,
        options: {
          beforeRecordingLoad: beforeRecordingLoadSpy,
        },
      });

      expect(beforeRecordingLoadSpy).toBeCalledTimes(1);
      expect(beforeRecordingLoadSpy).toBeCalledWith([sampleRecordings]);
      expect(loadRecordingsSpy).toBeCalledTimes(1);
      expect(loadRecordingsSpy).toBeCalledWith([
        {
          ...sampleRecordings,
          response: { auth: 'HIDDEN' },
        },
      ]);
    });
  });

  describe('endAndProcessRecording', () => {
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
      mocked(endRecording).mockReturnValue([sampleRecordings]);

      await endAndProcessRecording({
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

      const checkSensitiveInformationSpy = mocked(checkSensitiveInformation);
      mocked(endRecording).mockReturnValue([sampleRecordings]);

      await endAndProcessRecording({
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
            endAndProcessRecording({
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

            mocked(endRecording).mockReturnValue([]);

            await endAndProcessRecording({
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

            mocked(endRecording).mockReturnValue([sampleRecordings]);

            await endAndProcessRecording({
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

            mocked(endRecording).mockReturnValue([sampleRecordings]);

            await endAndProcessRecording({
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
          mocked(endRecording).mockReturnValue([]);

          await endAndProcessRecording({
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

        mocked(endRecording).mockReturnValue([
          {
            scope: 'https://localhost',
            path: '/',
            status: 200,
            response: {},
          },
        ]);

        await expect(
          async () =>
            await endAndProcessRecording({
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
        const replaceSpy = mocked(replaceCredentials).mockImplementation(
          options => {
            options.definitions.forEach((_, i) => {
              options.definitions[i] = {
                ...options.definitions[i],
                path: '/?api_key=SECURITY_api-key',
                response: { auth: 'PARAMS_param' },
              };
            });
          }
        );
        const playSpy = mocked(endRecording).mockReturnValue(sampleRecordings);

        await endAndProcessRecording({
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
              path: '/?api_key=SECURITY_api-key',
              status: 200,
              response: { auth: 'PARAMS_param' },
            },
          ],
        });
      });
    });
  });
});
