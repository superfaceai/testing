import {
  Profile,
  ProfileConfiguration,
  Provider,
  ProviderConfiguration,
  SuperfaceClient,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';

import { TestConfig } from './test-config';
import {
  assertsPreparedConfig,
  isProfileLocal,
  isProviderLocal,
} from './test-config.utils';

jest.mock('@superfaceai/one-sdk/dist/client/client');
jest.mock('@superfaceai/one-sdk/dist/client/profile');
jest.mock('@superfaceai/one-sdk/dist/client/usecase');
jest.mock('@superfaceai/one-sdk/dist/internal/superjson');

jest.mock('nock');

describe('TestConfig', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('assertsPreparedConfig', () => {
    it('throws if configuration has string representation of some component', () => {
      const testConfig1 = new TestConfig({
        profile: 'some-profile',
      });

      expect(() => {
        assertsPreparedConfig(testConfig1.sfConfig);
      }).toThrow('Should be Profile instance');

      const testConfig2 = new TestConfig({
        provider: 'some-provider',
      });

      expect(() => {
        assertsPreparedConfig(testConfig2.sfConfig);
      }).toThrow('Should be Provider instance');

      const testConfig3 = new TestConfig({
        useCase: 'some-useCase',
      });

      expect(() => {
        assertsPreparedConfig(testConfig3.sfConfig);
      }).toThrow('Should be UseCase instance');
    });

    it('does nothing when configuration contains instances or configuration is empty', () => {
      const client = new SuperfaceClient();
      const mockedProfile = new Profile(
        client,
        new ProfileConfiguration('some-profile', '1.0.0')
      );

      const testConfig1 = new TestConfig({
        profile: mockedProfile,
        provider: new Provider(
          client,
          new ProviderConfiguration('some-provider', [])
        ),
        useCase: new UseCase(mockedProfile, 'some-usecase'),
      });

      expect(() => {
        assertsPreparedConfig(testConfig1.sfConfig);
      }).not.toThrow();

      const testConfig2 = new TestConfig({});

      expect(() => {
        assertsPreparedConfig(testConfig2.sfConfig);
      }).not.toThrow();
    });
  });

  describe('isProfileLocal', () => {
    it('returns false when profile is not local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            version: '0.0.1',
            providers: {
              provider: {},
            },
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              version: '0.0.1',
              defaults: {},
              providers: {
                provider: {
                  defaults: {},
                },
              },
            },
          },
        },
      });

      expect(isProfileLocal('profile', mockSuperJson.normalized)).toBeFalsy();
    });

    it('returns true when profile is local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            file: 'some/path/to/profile.supr',
            providers: {
              provider: {},
            },
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              file: 'some/path/to/profile.supr',
              defaults: {},
              providers: {
                provider: {
                  defaults: {},
                },
              },
            },
          },
        },
      });

      expect(isProfileLocal('profile', mockSuperJson.normalized)).toBeTruthy();
    });
  });

  describe('isProviderLocal', () => {
    it('returns false when provider is not local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            version: '0.0.1',
            providers: {
              provider: {
                file: 'some/path/to/map.suma',
              },
            },
          },
        },
        providers: {
          provider: {
            security: [],
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              version: '0.0.1',
              defaults: {},
              providers: {
                provider: {
                  file: 'some/path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              security: [],
              defaults: {},
            },
          },
        },
      });

      expect(
        isProviderLocal('provider', 'profile', mockSuperJson.normalized)
      ).toBeFalsy();
    });

    it('returns false when profile provider is not local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            version: '0.0.1',
            providers: {
              provider: {},
            },
          },
        },
        providers: {
          provider: {
            file: 'some/path/to/provider.json',
            security: [],
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              version: '0.0.1',
              defaults: {},
              providers: {
                provider: {
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              file: 'some/path/to/provider.json',
              security: [],
              defaults: {},
            },
          },
        },
      });

      expect(
        isProviderLocal('provider', 'profile', mockSuperJson.normalized)
      ).toBeFalsy();
    });

    it('returns true when provider and profile provider is local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            file: 'some/path/to/profile.supr',
            providers: {
              provider: {
                file: 'some/path/to/map.suma',
              },
            },
          },
        },
        providers: {
          provider: {
            file: 'some/path/to/provider.json',
            security: [],
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              file: 'some/path/to/profile.supr',
              defaults: {},
              providers: {
                provider: {
                  file: 'some/path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              file: 'some/path/to/provider.json',
              security: [],
              defaults: {},
            },
          },
        },
      });

      expect(
        isProviderLocal('provider', 'profile', mockSuperJson.normalized)
      ).toBeTruthy();
    });
  });
});
