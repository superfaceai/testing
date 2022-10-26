import { getRequestHeader, getResponseHeader } from './matcher.utils';

describe('Matcher utils', () => {
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
});
