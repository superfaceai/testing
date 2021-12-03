import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { RecordingDefinition } from '.';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
  replaceCredentialInDefinition,
  replaceParameterInDefinition,
} from './nock.utils';

describe('nock utils', () => {
  describe('removeCredentials', () => {
    describe('when removing apikey', () => {
      it('removes apikey from header', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: HIDDEN_CREDENTIALS_PLACEHOLDER,
          },
        });
      });

      it('removes apikey from raw headers', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          rawHeaders: ['api_key', HIDDEN_CREDENTIALS_PLACEHOLDER],
        });
      });

      it('removes apikey from body', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: HIDDEN_CREDENTIALS_PLACEHOLDER,
          },
        });
      });

      it('removes apikey from path', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get/${HIDDEN_CREDENTIALS_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes apikey from path with non-trivial base url', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/api/v4/get/${HIDDEN_CREDENTIALS_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes apikey from query', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes apikey from response', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: HIDDEN_CREDENTIALS_PLACEHOLDER,
          },
          response: {
            some: 'data',
            auth: { my_api_key: HIDDEN_CREDENTIALS_PLACEHOLDER },
          },
        });
      });
    });

    describe('when removing basic auth credentials', () => {
      it('removes basic token from Authorization header', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
          },
        });
      });

      it('removes basic token from raw headers', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
          },
          rawHeaders: ['Authorization', HIDDEN_CREDENTIALS_PLACEHOLDER],
        });
      });

      it('removes basic token from response', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
          },
          response: {
            some: 'data',
            auth: { my_api_key: HIDDEN_CREDENTIALS_PLACEHOLDER },
          },
        });
      });
    });

    describe('when removing bearer token', () => {
      it('removes bearer token from Authorization header', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
          },
        });
      });

      it('removes bearer token from raw headers', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
          },
          rawHeaders: ['Authorization', HIDDEN_CREDENTIALS_PLACEHOLDER],
        });
      });

      it('removes bearer token from response', () => {
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
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['Authorization']: `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`,
          },
          response: {
            some: 'data',
            auth: { my_api_key: HIDDEN_CREDENTIALS_PLACEHOLDER },
          },
        });
      });
    });
  });

  describe('removeParameters', () => {
    describe('when removing integration parameters', () => {
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

      it('removes parameter from header', () => {
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
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: HIDDEN_PARAMETERS_PLACEHOLDER,
          },
        });
      });

      it('removes parameter from body', () => {
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
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: HIDDEN_PARAMETERS_PLACEHOLDER,
          },
        });
      });

      it('removes parameter from path', () => {
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
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get/${HIDDEN_PARAMETERS_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes parameter from query', () => {
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
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?api_key=${HIDDEN_PARAMETERS_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes parameter from scope', () => {
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
        });

        expect(definition).toEqual({
          scope: `https://api.${HIDDEN_PARAMETERS_PLACEHOLDER}.com`,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes parameter from raw headers', () => {
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
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          rawHeaders: ['Authorization', HIDDEN_PARAMETERS_PLACEHOLDER],
        });
      });

      it('removes parameter from response', () => {
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
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
          response: {
            some: 'data',
            auth: { my_api_key: HIDDEN_PARAMETERS_PLACEHOLDER },
          },
        });
      });
    });
  });
});
