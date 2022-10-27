import { ReplyBody } from 'nock/types';

import { UnexpectedError } from '../common/errors';
import {
  decodeResponse,
  getRequestHeaderValue,
  getResponseHeaderValue,
  parseBody,
} from './recorder.utils';

describe('Recorder utils', () => {
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

  describe('decodeResponse', () => {
    const contentEncoding = 'gzip';

    it.each([() => ({ value: 1 }), { value: 1 }, '{value: 1}'])(
      'fails when specified response is not array of hex data',
      async (response: ReplyBody | undefined) => {
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
