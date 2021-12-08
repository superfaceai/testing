import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { RecordingDefinition } from '.';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './nock.utils';

const TMP_PLACEHOLDER = 'placeholder';

describe('nock utils', () => {
  describe('replaceCredentials', () => {
    describe('when replacing apikey', () => {
      it('replaces apikey from header', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: TMP_PLACEHOLDER,
          },
        });
      });

      it('replaces apikey from raw headers', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          rawHeaders: ['api_key', TMP_PLACEHOLDER],
        });
      });

      it('replaces apikey from body', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: TMP_PLACEHOLDER,
          },
        });
      });

      it('replaces apikey from path', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces apikey from path with non-trivial base url', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://gitlab.com/api', //Path ends with /api
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/api/v4/get/${TMP_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces apikey from query', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces apikey from response', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
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
      it('replaces basic token from Authorization header', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Basic ${TMP_PLACEHOLDER}`,
          },
        });
      });

      it('replaces basic token from raw headers', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Basic ${TMP_PLACEHOLDER}`,
          },
          rawHeaders: ['Authorization', TMP_PLACEHOLDER],
        });
      });

      it('replaces basic token from response', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
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
      it('replaces bearer token from Authorization header', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Bearer ${TMP_PLACEHOLDER}`,
          },
        });
      });

      it('replaces bearer token from raw headers', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Bearer ${TMP_PLACEHOLDER}`,
          },
          rawHeaders: ['Authorization', TMP_PLACEHOLDER],
        });
      });

      it('replaces bearer token from response', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
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
          baseUrl: 'https://localhost',
          credential: 'secret',
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
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
  });

  describe('replaceParameters', () => {
    describe('when replacing integration parameters', () => {
      const baseUrl = 'https://localhost';

      it('does not mutate recording when parameter is empty', () => {
        const parameterValue = '';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: parameterValue,
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: '',
          },
        });
      });

      it('replaces parameter from header', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: parameterValue,
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: TMP_PLACEHOLDER,
          },
        });
      });

      it('replaces parameter from body', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: parameterValue,
          },
        };

        replaceParameterInDefinition({
          definition,
          baseUrl,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: TMP_PLACEHOLDER,
          },
        });
      });

      it('replaces parameter from path', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get/${parameterValue}?text=123`,
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
          scope: baseUrl,
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces parameter from query', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get?api_key=${parameterValue}&text=123`,
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
          scope: baseUrl,
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces parameter from scope', () => {
        const baseUrl = 'https://api.integration-parameter.com';
        const parameterValue = 'integration-parameter';
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

      it('replaces parameter from raw headers', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', parameterValue],
        };

        replaceParameterInDefinition({
          definition,
          baseUrl,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', TMP_PLACEHOLDER],
        });
      });

      it('replaces parameter from response', () => {
        const parameterValue = 'integration-parameter';
        const definition: RecordingDefinition = {
          scope: baseUrl,
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
          baseUrl,
          credential: parameterValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
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
  });

  describe('replaceInput', () => {
    describe('when replacing input values', () => {
      const baseUrl = 'https://localhost';

      it('does not mutate recording when input value is empty', () => {
        const inputValue = '';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: inputValue,
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: '',
          },
        });
      });

      it('replaces input value from header', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: inputValue,
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: TMP_PLACEHOLDER,
          },
        });
      });

      it('replaces input value from body', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: inputValue,
          },
        };

        replaceInputInDefinition({
          definition,
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: TMP_PLACEHOLDER,
          },
        });
      });

      it('replaces input value from path', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get/${inputValue}?text=123`,
          method: 'GET',
          status: 200,
        };

        replaceInputInDefinition({
          definition,
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces input value from query', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get?api_key=${inputValue}&text=123`,
          method: 'GET',
          status: 200,
        };

        replaceInputInDefinition({
          definition,
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('replaces input value from raw headers', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', inputValue],
        };

        replaceInputInDefinition({
          definition,
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', TMP_PLACEHOLDER],
        });
      });

      it('replaces input value from response', () => {
        const inputValue = 'input-primitive-value';
        const definition: RecordingDefinition = {
          scope: baseUrl,
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
          baseUrl,
          credential: inputValue,
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
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
  });
});
