import { err, SDKExecutionError, SuperJson } from '@superfaceai/one-sdk';

import { RecordingDefinitions } from '.';
import {
  ComponentUndefinedError,
  InstanceMissingError,
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
  UnexpectedError,
} from './common/errors';
import {
  getMockedSfConfig,
  getProfileMock,
  getProviderMock,
  getUseCaseMock,
  SuperfaceClientMock,
} from './superface.mock';
import {
  assertsDefinitionsAreNotStrings,
  assertsPreparedConfig,
  getProfileId,
  getProviderName,
  getSuperJson,
  getUseCaseName,
  isProfileProviderLocal,
} from './superface-test.utils';

describe('SuperfaceTest', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertsPreparedConfig', () => {
    describe('throws if configuration has string representation of some component', () => {
      it('profile instance missing', async () => {
        const superface = {
          ...(await getMockedSfConfig()),
          profile: 'some-profile',
        };

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrowError(new InstanceMissingError('Profile'));
      });

      it('provider instance missing', async () => {
        const superface = {
          ...(await getMockedSfConfig()),
          provider: 'some-provider',
        };

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrow(new InstanceMissingError('Provider'));
      });

      it('usecase instance missing', async () => {
        const superface = {
          ...(await getMockedSfConfig()),
          useCase: 'some-useCase',
        };

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrow(new InstanceMissingError('UseCase'));
      });
    });

    describe('throws if configuration has some undefined components', () => {
      it('client missing', () => {
        const superface = {};

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrowError(new ComponentUndefinedError('Client'));
      });

      it('profile missing', () => {
        const superface = {
          client: new SuperfaceClientMock(),
        };

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrowError(new ComponentUndefinedError('Profile'));
      });

      it('provider missing', async () => {
        const superface = {
          client: new SuperfaceClientMock(),
          profile: await getProfileMock('profile'),
        };

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrow(new ComponentUndefinedError('Provider'));
      });

      it('usecase missing', async () => {
        const superface = {
          client: new SuperfaceClientMock(),
          profile: await getProfileMock('profile'),
          provider: await getProviderMock('provider'),
        };

        expect(() => {
          assertsPreparedConfig(superface);
        }).toThrow(new ComponentUndefinedError('UseCase'));
      });
    });

    it('does nothing when every instance is present', async () => {
      const sfConfig = await getMockedSfConfig();

      expect(() => {
        assertsPreparedConfig(sfConfig);
      }).not.toThrow();
    });
  });

  describe('isProfileProviderLocal', () => {
    it('returns false when provider is not local', () => {
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
            security: [],
          },
        },
      });

      expect(
        isProfileProviderLocal('provider', 'profile', mockSuperJson.normalized)
      ).toBeFalsy();
    });

    it('returns true when profile provider is local', () => {
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
            security: [],
          },
        },
      });

      expect(
        isProfileProviderLocal('provider', 'profile', mockSuperJson.normalized)
      ).toBeTruthy();
    });
  });

  describe("get component's name", () => {
    it('returns id when Profile instance is given', async () => {
      const profile = await getProfileMock('profile');

      expect(getProfileId(profile)).toEqual('profile');
    });

    it('returns id when Provider instance is given', async () => {
      const provider = await getProviderMock('provider');

      expect(getProviderName(provider)).toEqual('provider');
    });

    it('returns id when UseCase instance is given', () => {
      const useCase = getUseCaseMock('useCase');

      expect(getUseCaseName(useCase)).toEqual('useCase');
    });
  });

  describe('getSuperJson', () => {
    it('throws when detecting superJson fails', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValueOnce(undefined);

      const loadSpy = jest.spyOn(SuperJson, 'load');

      await expect(getSuperJson()).rejects.toThrowError(
        new SuperJsonNotFoundError()
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('throws when superJson loading fails', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValueOnce('.');

      const loadingError = new SDKExecutionError('super.json error', [], []);
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValueOnce(err(loadingError));

      await expect(getSuperJson()).rejects.toThrowError(
        new SuperJsonLoadingFailedError(loadingError)
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('assertsDefinitionsAreNotStrings', () => {
    it('throws when definitions contains string', () => {
      const defs: RecordingDefinitions | string[] = [
        '{ "scope": "root", "method": "POST", "status": 401 }',
        '{ "scope": "root", "method": "GET", "status": 200 }',
      ];

      expect(() => {
        assertsDefinitionsAreNotStrings(defs);
      }).toThrowError(
        new UnexpectedError('definition is a string, not object')
      );
    });
  });
});
