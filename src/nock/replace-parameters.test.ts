import { RecordingDefinition } from '..';
import { replaceParameterInDefinition } from './utils';

const TMP_PLACEHOLDER = 'placeholder';
const BASE_URL = 'https://localhost';

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
    it('replaces parameter in body', async () => {
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

    it('replaces placeholder for parameter in body', async () => {
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

    it('replaces parameter in query', () => {
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

    it('replaces parameter in path', () => {
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
