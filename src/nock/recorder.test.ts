import { ApiKeyPlacement, SecurityType } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  ok,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import { define, disableNetConnect, recorder } from 'nock';
import { mocked } from 'ts-jest/utils';

import { BaseURLNotFoundError } from '../common/errors';
import { mockBoundProfileProvider } from '../superface/mock/boundProfileProvider';
import { RecordingDefinitions } from '../superface-test.interfaces';
import * as utils from '../superface-test.utils';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
} from '../superface-test.utils';
import { loadRecording, startRecording } from './recorder';
import { getRecordings } from './recorder.utils';
import { RecordingType } from './recording.interfaces';

jest.mock('nock');

jest.mock('./recorder.utils', () => ({
  ...jest.requireActual('./recorder.utils'),
  getRecordings: jest.fn(),
}));

const recordingsConfig = {
  recordingsPath: 'path/to/recordings.json',
  recordingsType: RecordingType.MAIN,
  recordingsKey: 'profile/provider/test',
  recordingsHash: '###',
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

describe('Recorder', () => {
  afterEach(() => {
    mocked(getRecordings).mockReset();
    mocked(define).mockReset();
    mocked(disableNetConnect).mockReset();
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
});
