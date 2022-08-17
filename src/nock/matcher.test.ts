import {
  ReplyBody,
  RequestBodyMatcher,
  RequestHeaderMatcher,
} from 'nock/types';

import {
  RecordingDefinition,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import { Matcher } from './matcher';
import {
  MatchErrorBaseURL,
  MatchErrorLength,
  MatchErrorMethod,
  MatchErrorPath,
  MatchErrorRequestBody,
  MatchErrorRequestHeaders,
  MatchErrorResponse,
  MatchErrorResponseHeaders,
  MatchErrorStatus,
} from './matcher.errors';

const oldContentType = 'application/json; charset=utf-8';
const oldAccept = 'plain/text';
const oldBody = 'body=true';
const oldResponse = {
  created: {
    name: 'intelligence',
    color: 'blue',
  },
};

const getRecording = (options?: {
  baseUrl?: string;
  method?: string;
  path?: string;
  body?: RequestBodyMatcher;
  status?: number;
  response?: ReplyBody;
  rawHeaders?: string[];
  requestHeaders?: Record<string, RequestHeaderMatcher>;
}): RecordingDefinition => ({
  scope: options?.baseUrl ?? 'https://localhost',
  method: options?.method ?? 'POST',
  path: options?.path ?? '/attributes?name=intelligence&color=blue',
  body: options?.body ?? oldBody,
  status: options?.status ?? 201,
  response: options?.response ?? oldResponse,
  rawHeaders: options?.rawHeaders ?? [
    'Access-Control-Allow-Origin',
    '*',
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Content-Type',
    oldContentType,
  ],
  reqheaders: options?.requestHeaders ?? {
    Accept: oldAccept,
  },
});

const sampleRecordings: RecordingDefinitions = [getRecording()];

describe('Matcher', () => {
  it('returns no errors when recordings match', async () => {
    const newRecordings: RecordingDefinitions = [getRecording()];

    await expect(
      Matcher.match(sampleRecordings, newRecordings)
    ).resolves.toEqual({ valid: true });
  });

  describe('when number of recordings does not match', () => {
    it('returns removed error for length of recordings', async () => {
      const newRecordings: RecordingDefinitions = [];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          changed: [],
          removed: [
            new MatchErrorLength(sampleRecordings.length, newRecordings.length),
          ],
        },
      });
    });

    it('returns added error for length of recordings', async () => {
      const newRecordings: RecordingDefinitions = sampleRecordings;

      await expect(Matcher.match([], newRecordings)).resolves.toEqual({
        valid: false,
        errors: {
          changed: [],
          removed: [],
          added: [new MatchErrorLength(0, newRecordings.length)],
        },
      });
    });
  });

  describe('when method does not match', () => {
    it('returns changed error for method', async () => {
      const newRecordings = [getRecording({ method: 'GET' })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [new MatchErrorMethod('POST', 'GET')],
        },
      });
    });
  });

  describe('when response status does not match', () => {
    it('returns changed error for status', async () => {
      const newRecordings = [getRecording({ status: 404 })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [new MatchErrorStatus(201, 404)],
        },
      });
    });
  });

  describe('when request base URL does not match', () => {
    it('returns changed error for base url', async () => {
      const newBaseUrl = 'https://localhost/new/path';
      const newRecordings = [getRecording({ baseUrl: newBaseUrl })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [new MatchErrorBaseURL('https://localhost', newBaseUrl)],
        },
      });
    });
  });

  describe('when request path does not match', () => {
    it('returns changed error for path', async () => {
      const newPath = '/new/path';
      const newRecordings = [getRecording({ path: newPath })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [
            new MatchErrorPath(
              '/attributes?name=intelligence&color=blue',
              newPath
            ),
          ],
        },
      });
    });
  });

  describe('when request headers does not match', () => {
    it('returns changed error for header', async () => {
      const newHeaderValue = 'application/json';
      const newRecordings = [
        getRecording({ requestHeaders: { Accept: newHeaderValue } }),
      ];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [
            new MatchErrorRequestHeaders('Accept', oldAccept, newHeaderValue),
          ],
        },
      });
    });

    it('returns added error for header', async () => {
      const newHeaderValue = 'application/json';
      const oldRecordings = [getRecording({ requestHeaders: {} })];
      const newRecordings = [
        getRecording({ requestHeaders: { Accept: newHeaderValue } }),
      ];

      await expect(
        Matcher.match(oldRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          removed: [],
          changed: [],
          added: [
            new MatchErrorRequestHeaders('Accept', undefined, newHeaderValue),
          ],
        },
      });
    });

    it('returns removed error for header', async () => {
      const newHeaderValue = undefined;
      const newRecordings = [getRecording({ requestHeaders: {} })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          changed: [],
          removed: [
            new MatchErrorRequestHeaders('Accept', oldAccept, newHeaderValue),
          ],
        },
      });
    });
  });

  describe('when response headers does not match', () => {
    it('returns changed error for header', async () => {
      const newHeaderValue = 'application/json';
      const newRecordings = [
        getRecording({ rawHeaders: ['Content-Type', newHeaderValue] }),
      ];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [
            new MatchErrorResponseHeaders(
              'Content-Type',
              oldContentType,
              newHeaderValue
            ),
          ],
        },
      });
    });

    it('returns added error for header', async () => {
      const newHeaderValue = 'application/json';
      const oldRecordings = [getRecording({ rawHeaders: [] })];
      const newRecordings = [
        getRecording({ rawHeaders: ['Content-Type', newHeaderValue] }),
      ];

      await expect(
        Matcher.match(oldRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          removed: [],
          changed: [],
          added: [
            new MatchErrorResponseHeaders(
              'Content-Type',
              undefined,
              newHeaderValue
            ),
          ],
        },
      });
    });

    it('returns removed error for header', async () => {
      const newHeaderValue = undefined;
      const newRecordings = [getRecording({ rawHeaders: [] })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          changed: [],
          removed: [
            new MatchErrorResponseHeaders(
              'Content-Type',
              oldContentType,
              newHeaderValue
            ),
          ],
        },
      });
    });
  });

  describe('when request body does not match', () => {
    it('returns changed error for request body', async () => {
      const newBody = 'newBody=true';
      const newRecordings = [getRecording({ body: newBody })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [
            new MatchErrorRequestBody(
              "data must have required property 'body'"
            ),
          ],
        },
      });
    });

    it('returns added error for request body as empty string', async () => {
      const newBody = 'newBody=true';
      const oldRecordings = [getRecording({ body: '' })];
      const newRecordings = [getRecording({ body: newBody })];

      await expect(
        Matcher.match(oldRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [
            new MatchErrorRequestBody({
              oldRequestBody: undefined,
              newRequestBody: { newBody: 'true' },
            }),
          ],
          removed: [],
          changed: [],
        },
      });
    });

    it('returns added error for request body as undefined', async () => {
      const newBody = 'newBody=true';
      const oldRecordings = [
        {
          scope: 'https://localhost',
          method: 'POST',
          path: '/attributes?name=intelligence&color=blue',
          body: undefined,
          status: 201,
          response: oldResponse,
          rawHeaders: [
            'Access-Control-Allow-Origin',
            '*',
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization',
            'Content-Type',
            oldContentType,
          ],
          reqheaders: {
            Accept: oldAccept,
          },
        },
      ];
      const newRecordings = [getRecording({ body: newBody })];

      await expect(
        Matcher.match(oldRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [
            new MatchErrorRequestBody({
              oldRequestBody: undefined,
              newRequestBody: { newBody: 'true' },
            }),
          ],
          removed: [],
          changed: [],
        },
      });
    });

    it('returns removed error for request body as empty string', async () => {
      const newRecordings = [getRecording({ body: '' })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [
            new MatchErrorRequestBody({
              oldRequestBody: { body: 'true' },
              newRequestBody: undefined,
            }),
          ],
          changed: [],
        },
      });
    });

    it('returns removed error for request body as undefined', async () => {
      const newRecordings = [
        {
          scope: 'https://localhost',
          method: 'POST',
          path: '/attributes?name=intelligence&color=blue',
          body: undefined,
          status: 201,
          response: oldResponse,
          rawHeaders: [
            'Access-Control-Allow-Origin',
            '*',
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization',
            'Content-Type',
            oldContentType,
          ],
          reqheaders: {
            Accept: oldAccept,
          },
        },
      ];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [
            new MatchErrorRequestBody({
              oldRequestBody: { body: 'true' },
              newRequestBody: undefined,
            }),
          ],
          changed: [],
        },
      });
    });
  });

  describe('when response does not match', () => {
    it('returns changed error for response', async () => {
      const newResponse = {};
      const newRecordings = [getRecording({ response: newResponse })];

      await expect(
        Matcher.match(sampleRecordings, newRecordings)
      ).resolves.toEqual({
        valid: false,
        errors: {
          added: [],
          removed: [],
          changed: [
            new MatchErrorResponse(
              { oldResponse, newResponse },
              "data must have required property 'created'"
            ),
          ],
        },
      });
    });
  });
});
