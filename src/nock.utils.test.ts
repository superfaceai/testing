import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { RecordingDefinition } from '.';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './nock.utils';

const TMP_PLACEHOLDER = 'placeholder';
const BASE_URL = 'https://localhost';

describe('nock utils', () => {
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.BODY,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.PATH,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.PATH,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.QUERY,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.BODY,
            name: 'api_key',
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
          scheme: {
            id: 'basic',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BASIC,
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
          scheme: {
            id: 'basic',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BASIC,
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
          scheme: {
            id: 'basic',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BASIC,
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
          scheme: {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
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
          scheme: {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
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
          scheme: {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.BODY,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.BODY,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.QUERY,
            name: 'api_key',
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
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.PATH,
            name: 'api_key',
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

  describe('replaceParameters', () => {
    describe('when replacing integration parameters', () => {
      it('does not mutate recording when parameter is empty', () => {
        const parameterValue = '';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: parameterValue,
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: '',
          },
        });
      });

      it('replaces parameter in header', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: parameterValue,
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
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

      it('replaces parameter in body', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: parameterValue,
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
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

      it('replaces parameter in path', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get/${parameterValue}?text=123`,
          method: 'GET',
          status: 200,
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces parameter in query', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get?api_key=${parameterValue}&text=123`,
          method: 'GET',
          status: 200,
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces parameter in scope', () => {
        const parameterValue = 'integration-parameter';
        const baseUrl = `https://api.${parameterValue}.com`;
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
        };

        replaceParameterInDefinition({
          definition,
          baseUrl,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: `https://api.${TMP_PLACEHOLDER}.com`,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces parameter in raw headers', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', parameterValue],
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', TMP_PLACEHOLDER],
        });
      });

      it('replaces parameter in response', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          response: {
            some: 'data',
            auth: { my_api_key: parameterValue },
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          response: {
            some: 'data',
            auth: { my_api_key: TMP_PLACEHOLDER },
          },
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

        replaceParameterInDefinition({
          definition,
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

        replaceParameterInDefinition({
          definition,
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

        replaceParameterInDefinition({
          definition,
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

        replaceParameterInDefinition({
          definition,
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

  describe('replaceInput', () => {
    describe('when replacing input values', () => {
      it('does not mutate recording when input value is empty', () => {
        const inputValue = '';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: inputValue,
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: '',
          },
        });
      });

      it('replaces input value in header', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: inputValue,
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
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

      it('replaces input value in body', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: inputValue,
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
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

      it('replaces input value in path', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get/${inputValue}?text=123`,
          method: 'GET',
          status: 200,
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces input value in query', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get?api_key=${inputValue}&text=123`,
          method: 'GET',
          status: 200,
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces input value in raw headers', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', inputValue],
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', TMP_PLACEHOLDER],
        });
      });

      it('replaces input value in response', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          response: {
            some: 'data',
            auth: { my_api_key: inputValue },
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl: BASE_URL,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: BASE_URL,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          response: {
            some: 'data',
            auth: { my_api_key: TMP_PLACEHOLDER },
          },
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

        replaceInputInDefinition({
          definition,
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

        replaceInputInDefinition({
          definition,
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

        replaceInputInDefinition({
          definition,
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

        replaceInputInDefinition({
          definition,
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
});
