import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { RecordingDefinition } from '..';
import { replaceCredentialInDefinition } from './utils';

const TMP_PLACEHOLDER = 'placeholder';
const BASE_URL = 'https://localhost';

describe('replaceCredentials', () => {
  describe('when replacing apikey', () => {
    it('replaces apikey in header', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['api_key']: 'secret',
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.HEADER,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,

        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['api_key']: TMP_PLACEHOLDER,
        },
      });
    });

    it('replaces apikey in raw headers', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        rawHeaders: ['api_key', 'secret'],
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.HEADER,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        rawHeaders: ['api_key', TMP_PLACEHOLDER],
      });
    });

    it('replaces apikey in body', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: 'secret',
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.BODY,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: TMP_PLACEHOLDER,
        },
      });
    });

    it('replaces apikey in path', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get/secret?text=123',
        method: 'GET',
        status: 200,
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.PATH,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: `/get/${TMP_PLACEHOLDER}?text=123`,
        method: 'GET',
        status: 200,
      });
    });

    it('replaces apikey in path with non-trivial base url', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/api/v4/get/secret?text=123',
        method: 'GET',
        status: 200,
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.PATH,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: `${BASE_URL}/api`, //Path ends with /api
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: `/api/v4/get/${TMP_PLACEHOLDER}?text=123`,
        method: 'GET',
        status: 200,
      });
    });

    it('replaces apikey in query', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?api_key=secret&text=123',
        method: 'GET',
        status: 200,
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.QUERY,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
        method: 'GET',
        status: 200,
      });
    });

    it('replaces apikey in response', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: 'secret',
        },
        response: {
          some: 'data',
          auth: { my_api_key: 'secret' },
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.BODY,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: TMP_PLACEHOLDER,
        },
        response: {
          some: 'data',
          auth: { my_api_key: TMP_PLACEHOLDER },
        },
      });
    });

    it('replaces apikey in decoded response', () => {
      const secret = 'secret';
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: secret,
        },
        decodedResponse: {
          some: 'data',
          auth: { my_api_key: secret },
        },
        rawHeaders: ['Content-Encoding', 'gzip'],
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.BODY,
          name: 'api_key',
          apikey: secret,
        },
        baseUrl: BASE_URL,
        credential: secret,
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: TMP_PLACEHOLDER,
        },
        decodedResponse: {
          some: 'data',
          auth: { my_api_key: TMP_PLACEHOLDER },
        },
        rawHeaders: ['Content-Encoding', 'gzip'],
      });
    });
  });

  describe('when replacing basic auth credentials', () => {
    it('replaces basic token in Authorization header', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: 'Basic secret',
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'basic',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BASIC,
          username: 'user',
          password: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: `Basic ${TMP_PLACEHOLDER}`,
        },
      });
    });

    it('replaces basic token in raw headers', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: 'Basic secret',
        },
        rawHeaders: ['Authorization', 'secret'],
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'basic',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BASIC,
          username: 'user',
          password: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: `Basic ${TMP_PLACEHOLDER}`,
        },
        rawHeaders: ['Authorization', TMP_PLACEHOLDER],
      });
    });

    it('replaces basic token in response', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: 'Basic secret',
        },
        response: {
          some: 'data',
          auth: { my_api_key: 'secret' },
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'basic',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BASIC,
          username: 'user',
          password: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: `Basic ${TMP_PLACEHOLDER}`,
        },
        response: {
          some: 'data',
          auth: { my_api_key: TMP_PLACEHOLDER },
        },
      });
    });
  });

  describe('when replacing bearer token', () => {
    it('replaces bearer token in Authorization header', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: 'Bearer secret',
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'bearer',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
          token: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: `Bearer ${TMP_PLACEHOLDER}`,
        },
      });
    });

    it('replaces bearer token in raw headers', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: 'Bearer secret',
        },
        rawHeaders: ['Authorization', 'secret'],
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'bearer',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
          token: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: `Bearer ${TMP_PLACEHOLDER}`,
        },
        rawHeaders: ['Authorization', TMP_PLACEHOLDER],
      });
    });

    it('replaces bearer token in response', () => {
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: 'Bearer secret',
        },
        response: {
          some: 'data',
          auth: { my_api_key: 'secret' },
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'bearer',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
          token: 'secret',
        },
        baseUrl: BASE_URL,
        credential: 'secret',
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        reqheaders: {
          ['Authorization']: `Bearer ${TMP_PLACEHOLDER}`,
        },
        response: {
          some: 'data',
          auth: { my_api_key: TMP_PLACEHOLDER },
        },
      });
    });
  });

  describe('when replacing digest token', () => {
    const enteredCredential = 'Digest secret';
    const expectedValue = `Digest ${TMP_PLACEHOLDER}`;
    let header: string;

    describe('in Authorization header', () => {
      beforeAll(() => {
        header = 'Authorization';
      });

      it('replaces digest token', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
        });
      });

      it('replaces digest token in raw headers', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
          rawHeaders: [header, enteredCredential],
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
          rawHeaders: [header, expectedValue],
        });
      });
    });

    describe('in WWW-Authenticate header', () => {
      beforeAll(() => {
        header = 'WWW-Authenticate';
      });

      it('replaces digest token', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
        });
      });

      it('replaces digest token in raw headers', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
          rawHeaders: [header, enteredCredential],
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
          rawHeaders: [header, expectedValue],
        });
      });
    });

    describe('in challenge header', () => {
      beforeAll(() => {
        header = 'Custom-Challenge-Header';
      });

      it('replaces digest token', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
            challengeHeader: header,
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
        });
      });

      it('replaces digest token in raw headers', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
          rawHeaders: [header, enteredCredential],
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
            challengeHeader: header,
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
          rawHeaders: [header, expectedValue],
        });
      });
    });

    describe('in custom authorization header', () => {
      beforeAll(() => {
        header = 'Custom-Authorization-Header';
      });

      it('replaces digest token', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
            authorizationHeader: header,
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
        });
      });

      it('replaces digest token in raw headers', () => {
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: enteredCredential,
          },
          rawHeaders: [header, enteredCredential],
        };

        replaceCredentialInDefinition({
          definition,
          security: {
            id: 'digest',
            type: SecurityType.HTTP,
            scheme: HttpScheme.DIGEST,
            username: 'user',
            password: 'secret',
            authorizationHeader: header,
          },
          baseUrl: BASE_URL,
          credential: 'Unknown',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            [header]: expectedValue,
          },
          rawHeaders: [header, expectedValue],
        });
      });
    });
  });

  describe('when sensitive information are URL encoded', () => {
    it('replaces api key in body', async () => {
      const secret = 'шеллы';
      const encodedSecret = encodeURIComponent(secret);
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: encodedSecret,
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.BODY,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: secret,
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: TMP_PLACEHOLDER,
        },
      });
    });

    it('replaces placeholder for api key in body', async () => {
      const secret = 'шеллы';
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: TMP_PLACEHOLDER,
        },
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.BODY,
          name: 'api_key',
          apikey: 'secret',
        },
        baseUrl: BASE_URL,
        credential: TMP_PLACEHOLDER,
        placeholder: secret,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: '/get?text=123',
        method: 'GET',
        status: 200,
        body: {
          my_api_key: secret,
        },
      });
    });

    it('replaces apikey in query', () => {
      const secret = 'шеллы';
      const encodedSecret = encodeURIComponent(secret);
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: `/get?api_key=${encodedSecret}&text=123`,
        method: 'GET',
        status: 200,
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.QUERY,
          name: 'api_key',
          apikey: secret,
        },
        baseUrl: BASE_URL,
        credential: secret,
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
        method: 'GET',
        status: 200,
      });
    });

    it('replaces apikey in path', () => {
      const secret = 'шеллы';
      const encodedSecret = encodeURIComponent(secret);
      const definition: RecordingDefinition = {
        scope: BASE_URL,
        path: `/get/${encodedSecret}?text=123`,
        method: 'GET',
        status: 200,
      };

      replaceCredentialInDefinition({
        definition,
        security: {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.PATH,
          name: 'api_key',
          apikey: secret,
        },
        baseUrl: BASE_URL,
        credential: secret,
        placeholder: TMP_PLACEHOLDER,
      });

      expect(definition).toEqual({
        scope: BASE_URL,
        path: `/get/${TMP_PLACEHOLDER}?text=123`,
        method: 'GET',
        status: 200,
      });
    });
  });
});
