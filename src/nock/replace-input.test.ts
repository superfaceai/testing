import { RecordingDefinition } from '..';
import { replaceInputInDefinition } from './utils';

const TMP_PLACEHOLDER = 'placeholder';
const BASE_URL = 'https://localhost';

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
    it('replaces input in body', async () => {
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

    it('replaces placeholder for input in body', async () => {
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

    it('replaces input in query', () => {
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

    it('replaces input in path', () => {
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
