import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';

import { RecordingDefinition } from '.';
import {
  replaceCredentialInDefinition,
  replaceParameterInDefinition,
} from './nock.utils';

const TMP_PLACEHOLDER = 'placeholder';

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
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
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
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/api/v4/get/${TMP_PLACEHOLDER}?text=123`,
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
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
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
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get/${TMP_PLACEHOLDER}?text=123`,
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
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: baseUrl,
          path: `/get?api_key=${TMP_PLACEHOLDER}&text=123`,
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
          placeholder: TMP_PLACEHOLDER,
        });

        expect(definition).toEqual({
          scope: `https://api.${TMP_PLACEHOLDER}.com`,
          path: `/get?text=123`,
          method: 'GET',
          status: 200,
        });
      });
    });
  });
});
