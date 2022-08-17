import { UnexpectedError } from '../common/errors';
import {
  decodeResponse,
  getRequestHeader,
  getRequestHeaderValue,
  getResponseHeader,
  getResponseHeaderValue,
  parseBody,
} from './matcher.utils';

describe('Matcher utils', () => {
  describe('getRequestHeaderValue', () => {
    it('returns string request header value', () => {
      const headers = { 'Content-Type': 'application/json' };
      const expectedResult = 'application/json';

      expect(getRequestHeaderValue('content-type', headers)).toBe(
        expectedResult
      );
    });

    it('returns array of strings header value', () => {
      const headers = {
        'Content-Type': ['application/json', 'application/xml'],
      };
      const expectedResult = ['application/json', 'application/xml'];

      expect(getRequestHeaderValue('content-type', headers)).toEqual(
        expectedResult
      );
    });
  });

  describe('getResponseHeaderValue', () => {
    it('returns response header value', () => {
      const headers = ['Content-Type', 'application/json'];
      const expectedResult = 'application/json';

      expect(getResponseHeaderValue('content-type', headers)).toBe(
        expectedResult
      );
    });
  });

  describe('getResponseHeader', () => {
    it('returns response header old and new values', () => {
      const oldHeaders = ['Content-Type', 'application/json'];
      const newHeaders = ['content-type', 'plain/text'];
      const expectedResult = {
        old: 'application/json',
        new: 'plain/text',
      };

      expect(getResponseHeader(oldHeaders, newHeaders, 'content-type')).toEqual(
        expectedResult
      );
    });
  });

  describe('getRequestHeader', () => {
    it('returns request header value', () => {
      const oldHeaders = { 'Content-Type': 'application/json' };
      const newHeaders = { 'content-type': 'plain/text' };
      const expectedResult = {
        old: 'application/json',
        new: 'plain/text',
      };

      expect(getRequestHeader(oldHeaders, newHeaders, 'content-type')).toEqual(
        expectedResult
      );
    });

    it('returns request header value with multiple values', () => {
      const oldHeaders = {
        'Content-Type': ['application/json', 'application/xml'],
      };
      const newHeaders = { 'content-type': 'plain/text' };
      const expectedResult = {
        old: 'application/json, application/xml',
        new: 'plain/text',
      };

      expect(getRequestHeader(oldHeaders, newHeaders, 'content-type')).toEqual(
        expectedResult
      );
    });
  });

  describe('decodeResponse', () => {
    const contentEncoding = 'gzip';

    it.each([() => ({ value: 1 }), { value: 1 }, '{value: 1}', true, 1])(
      'fails when specified response is not array of hex data',
      async (response: unknown) => {
        await expect(
          decodeResponse(response, contentEncoding)
        ).rejects.toThrowError(
          new UnexpectedError(
            `Response is encoded by "${contentEncoding}" and is not an array`
          )
        );
      }
    );
  });

  describe('parseBody', () => {
    it('returns undefined when body is empty string', () => {
      const body = '';

      expect(parseBody(body)).toBeUndefined();
    });

    it.each([
      'from%3D%7B%22name%22%3A%22test%22%7D%26to%3Dtest',
      'from={"name":"test"}&to=test',
    ])('returns decoded request body', body => {
      const expectedValue = {
        from: { name: 'test' },
        to: 'test',
      };

      expect(parseBody(body)).toEqual(expectedValue);
    });
  });
});
