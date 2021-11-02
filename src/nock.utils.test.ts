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
  loadCredentialsToScope,
  loadParamsToScope,
  removeCredentialsFromDefinition,
  removeParamsFromDefinition,
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

        loadCredentialsToScope({
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

        loadCredentialsToScope({
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

        loadCredentialsToScope({
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

  describe('loadParameters', () => {
    describe('when loading integration parameters', () => {
      it('loads parameter from body', () => {
        const parameterValue = { param: 'integration-parameter' };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: '/path',
            status: 200,
            response: { some: 'data' },
            body: {
              whatever: {
                my_api_key: parameterValue.param,
              },
            },
          },
        ]);

        const filteringBodySpy = jest.spyOn(
          mockedScopes[0],
          'filteringRequestBody'
        );

        loadParamsToScope(mockedScopes[0], parameterValue);

        expect(filteringBodySpy).toHaveBeenCalledTimes(1);
        expect(filteringBodySpy).toHaveBeenCalledWith(
          /integration-parameter/g,
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      });

      it('loads parameter from path', () => {
        const parameterValue = { param: 'integration-parameter' };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: '/path/' + parameterValue.param,
            status: 200,
            response: { some: 'data' },
          },
        ]);

        const filteringPathSpy = jest.spyOn(mockedScopes[0], 'filteringPath');

        loadParamsToScope(mockedScopes[0], parameterValue);

        expect(filteringPathSpy).toHaveBeenCalledTimes(1);
        expect(filteringPathSpy).toHaveBeenCalledWith(
          /integration-parameter/g,
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      });

      it('loads parameter from query', () => {
        const parameterValue = { param: 'integration-parameter' };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: '/path?api_key=' + parameterValue.param,
            status: 200,
            response: { some: 'data' },
          },
        ]);

        const filteringPathSpy = jest.spyOn(mockedScopes[0], 'filteringPath');

        loadParamsToScope(mockedScopes[0], parameterValue);

        expect(filteringPathSpy).toHaveBeenCalledTimes(1);
        expect(filteringPathSpy).toHaveBeenCalledWith(
          /integration-parameter/g,
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      });

      it('loads multiple parameters from query', () => {
        const parameterValue = {
          param: 'integration-parameter',
          two: 'secret',
        };
        const mockedScopes = define([
          {
            scope: 'https://localhost',
            method: 'GET',
            path: `/path?api_key=${parameterValue.param}&two=${parameterValue.two}`,
            status: 200,
            response: { some: 'data' },
          },
        ]);

        const filteringPathSpy = jest.spyOn(mockedScopes[0], 'filteringPath');

        loadParamsToScope(mockedScopes[0], parameterValue);

        expect(filteringPathSpy).toHaveBeenCalledTimes(1);
        expect(filteringPathSpy).toHaveBeenCalledWith(
          /integration-parameter|secret/g,
          HIDDEN_CREDENTIALS_PLACEHOLDER
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

        removeCredentialsFromDefinition({
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

        removeCredentialsFromDefinition({
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

        removeCredentialsFromDefinition({
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

      it('removes apikey from query', () => {
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
          path: '/get?api_key=secret&text=123',
          method: 'GET',
          status: 200,
        };

        removeCredentialsFromDefinition({
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

        removeCredentialsFromDefinition({
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

        removeCredentialsFromDefinition({
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

  describe('removeParameters', () => {
    describe('when removing integration parameters', () => {
      it('removes parameter from header', () => {
        const parameterValue = { param: 'integration-parameter' };
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          reqheaders: {
            ['api_key']: parameterValue.param,
          },
        };

        removeParamsFromDefinition(
          definition,
          parameterValue,
          'https://localhost'
        );

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

      it('removes parameter from body', () => {
        const parameterValue = { param: 'integration-parameter' };
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
          path: '/get?text=123',
          method: 'GET',
          status: 200,
          body: {
            my_api_key: parameterValue.param,
          },
        };

        removeParamsFromDefinition(
          definition,
          parameterValue,
          'https://localhost'
        );

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

      it('removes parameter from path', () => {
        const parameterValue = { param: 'integration-parameter' };
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
          path: `/get/${parameterValue.param}?text=123`,
          method: 'GET',
          status: 200,
        };

        removeParamsFromDefinition(
          definition,
          parameterValue,
          'https://localhost'
        );

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get/${HIDDEN_CREDENTIALS_PLACEHOLDER}?text=123`,
          method: 'GET',
          status: 200,
        });
      });

      it('removes parameter from query', () => {
        const parameterValue = { param: 'integration-parameter' };
        const definition: RecordingDefinition = {
          scope: 'https://localhost',
          path: `/get?api_key=${parameterValue.param}&text=123`,
          method: 'GET',
          status: 200,
        };

        removeParamsFromDefinition(
          definition,
          parameterValue,
          'https://localhost'
        );

        expect(definition).toEqual({
          scope: 'https://localhost',
          path: `/get?api_key=${HIDDEN_CREDENTIALS_PLACEHOLDER}&text=123`,
          method: 'GET',
          status: 200,
        });
      });
    });
  });
});
