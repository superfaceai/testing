import {
  ApiKeyPlacement,
  HttpScheme,
  SecurityScheme,
  SecurityType,
} from '@superfaceai/ast';
import { define } from 'nock';

import { RecordingDefinition } from '.';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  loadCredentials,
  removeCredentials,
} from './nock.utils';

describe('nock utils', () => {
  describe('loadCredentials', () => {
    describe('when loading apikey', () => {
      it('loads apikey from body', () => {
        const securityScheme: SecurityScheme = {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.BODY,
          name: 'api_key',
        };
        const securityValue = { id: 'api-key', apikey: 'secret' };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: '/path',
            status: 200,
            response: { some: 'data' },
            body: {
              whatever: {
                my_api_key: 'secret',
              },
            },
          },
        ]);

        const filteringBodySpy = jest.spyOn(
          mockedScopes[0],
          'filteringRequestBody'
        );

        loadCredentials({
          scope: mockedScopes[0],
          scheme: securityScheme,
          securityValue,
        });

        expect(filteringBodySpy).toHaveBeenCalledTimes(1);
        expect(filteringBodySpy).toHaveBeenCalledWith(
          /secret/g,
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      });

      it('loads apikey from path', () => {
        const securityScheme: SecurityScheme = {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.PATH,
          name: 'api_key',
        };
        const securityValue = { id: 'api-key', apikey: 'secret' };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: '/path/secret',
            status: 200,
            response: { some: 'data' },
          },
        ]);

        const filteringPathSpy = jest.spyOn(mockedScopes[0], 'filteringPath');

        loadCredentials({
          scope: mockedScopes[0],
          scheme: securityScheme,
          securityValue,
        });

        expect(filteringPathSpy).toHaveBeenCalledTimes(1);
        expect(filteringPathSpy).toHaveBeenCalledWith(
          /secret/g,
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      });

      it('loads apikey from query', () => {
        const securityScheme: SecurityScheme = {
          id: 'api-key',
          type: SecurityType.APIKEY,
          in: ApiKeyPlacement.QUERY,
          name: 'api_key',
        };
        const securityValue = { id: 'api-key', apikey: 'secret' };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: '/path?api_key=secret',
            status: 200,
            response: { some: 'data' },
          },
        ]);

        const filteringPathSpy = jest.spyOn(mockedScopes[0], 'filteringPath');

        loadCredentials({
          scope: mockedScopes[0],
          scheme: securityScheme,
          securityValue,
        });

        expect(filteringPathSpy).toHaveBeenCalledTimes(1);
        expect(filteringPathSpy).toHaveBeenCalledWith(
          /api_key([^&#]+)/g,
          `api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}`
        );
      });
    });
  });

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

        removeCredentials({
          definition,
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.HEADER,
            name: 'api_key',
          },
          securityValue: { id: 'api-key', apikey: 'secret' },
          baseUrl: 'https://localhost',
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

        removeCredentials({
          definition,
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.BODY,
            name: 'api_key',
          },
          securityValue: { id: 'api-key', apikey: 'secret' },
          baseUrl: 'https://localhost',
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

        removeCredentials({
          definition,
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.PATH,
            name: 'api_key',
          },
          securityValue: { id: 'api-key', apikey: 'secret' },
          baseUrl: 'https://localhost',
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

        removeCredentials({
          definition,
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.PATH,
            name: 'api_key',
          },
          securityValue: { id: 'api-key', apikey: 'secret' },
          baseUrl: 'https://gitlab.com/api', //Path ends with /api
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

        removeCredentials({
          definition,
          scheme: {
            id: 'api-key',
            type: SecurityType.APIKEY,
            in: ApiKeyPlacement.QUERY,
            name: 'api_key',
          },
          securityValue: { id: 'api-key', apikey: 'secret' },
          baseUrl: 'https://localhost',
        });

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}&text=123`,
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

        removeCredentials({
          definition,
          scheme: {
            id: 'basic',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BASIC,
          },
          securityValue: { id: 'basic', username: 'user', password: 'pass' },
          baseUrl: 'https://localhost',
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

        removeCredentials({
          definition,
          scheme: {
            id: 'bearer',
            type: SecurityType.HTTP,
            scheme: HttpScheme.BEARER,
          },
          securityValue: { id: 'bearer', token: 'secret' },
          baseUrl: 'https://localhost',
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
    });
  });
});
