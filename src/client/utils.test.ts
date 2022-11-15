import { parseBooleanEnv, searchValues } from './utils';

describe('SuperfaceTest Utils', () => {
  describe('searchValues', () => {
    it('returns undefined when accessors are undefined', () => {
      expect(searchValues({}, undefined)).toBeUndefined();
    });

    it('returns value from input', () => {
      const input = {
        val: 'secret',
      };

      expect(searchValues(input, ['val'])).toEqual({
        val: 'secret',
      });
    });

    it('returns nested value from input', () => {
      const input = {
        obj: {
          val: 'secret',
        },
      };

      expect(searchValues(input, ['obj.val'])).toEqual({
        'obj.val': 'secret',
      });
    });

    it('returns multiple values from input', () => {
      const input = {
        f1: 'field',
        obj: {
          f2: 'secret',
        },
      };

      expect(searchValues(input, ['f1', 'obj.f2'])).toEqual({
        f1: 'field',
        'obj.f2': 'secret',
      });
    });

    it('throws error when targeted value is not primitive', () => {
      const input = {
        obj: {
          val: 'secret',
        },
      };

      expect(() => searchValues(input, ['obj'])).toThrowError(
        'Input property: obj is not primitive value'
      );
    });
  });

  describe('parseBooleanEnv', () => {
    it('returns false when variable is not set', () => {
      expect(parseBooleanEnv(undefined)).toBeFalsy();
    });

    it('returns false when variable is defined and contains false', () => {
      expect(parseBooleanEnv('false')).toBeFalsy();
    });

    it('returns true when variable is set and contains true', () => {
      expect(parseBooleanEnv('true')).toBeTruthy();
    });
  });
});
