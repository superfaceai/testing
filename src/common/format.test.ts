import { matchWildCard } from './format';

describe('format', () => {
  describe('matchWildCard', () => {
    it.each([
      '::',
      ':',
      '*',
      'pro*',
      '*file',
      '*rofi*',
      'profile',
      'profile*',
      'profile:*',
      'profile:pro*',
      'profile:*ider',
      'profile:*id*',
      'profile:provider',
      'profile:provider*',
      'profile:provider:*',
      'profile:provider:use*',
      'profile:provider:*case',
      'profile:provider:*seca*',
      'profile:provider:usecase',
      'profile:provider:usecase*',
    ])('returns true', async (env: string) => {
      expect(matchWildCard('profile', 'provider', 'usecase', env)).toBeTruthy();
    });

    it.each([
      '',
      'www*',
      '*ww',
      '*w*',
      'wrongProfile',
      'profile:*ongProvider',
      'profile:wrong*',
      'profile:*ong*',
      'profile:wrongProvider',
      ':wrongProvider',
      'profile:provider:*ongUsecase',
      'profile:provider:wrong*',
      'profile:provider:*w*',
      'profile:provider:wrongUsecase',
      '::wrongUsecase',
    ])('returns false', async (env: string) => {
      expect(matchWildCard('profile', 'provider', 'usecase', env)).toBeFalsy();
    });
  });
});
