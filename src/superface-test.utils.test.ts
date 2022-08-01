import {
  ApiKeyPlacement,
  SecurityScheme,
  SecurityType,
  SecurityValues,
} from '@superfaceai/ast';
import { err, SDKExecutionError, SuperJson } from '@superfaceai/one-sdk';

import { RecordingDefinitions } from '.';
import {
  ComponentUndefinedError,
  InstanceMissingError,
  MapUndefinedError,
  ProfileUndefinedError,
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
  UnexpectedError,
} from './common/errors';
import {
  InputGenerateHash,
  JestGenerateHash,
  MochaGenerateHash,
} from './generate-hash';
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
  checkSensitiveInformation,
  getGenerator,
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
      it('profile missing', () => {
        const superface = {};

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
    it('throws profile undefined error when given profile is not defined', () => {
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

      expect(() => {
        isProfileProviderLocal(
          'provider',
          'non-existing-profile',
          mockSuperJson.normalized
        );
      }).toThrowError(new ProfileUndefinedError('non-existing-profile'));
    });

    it('throws map undefined error when provider is not defined', () => {
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

      expect(() => {
        isProfileProviderLocal(
          'not-existing-provider',
          'profile',
          mockSuperJson.normalized
        );
      }).toThrowError(
        new MapUndefinedError('profile', 'not-existing-provider')
      );
    });

    it('throws map undefined error when provider is not local', () => {
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

      expect(() => {
        isProfileProviderLocal('provider', 'profile', mockSuperJson.normalized);
      }).toThrowError(new MapUndefinedError('profile', 'provider'));
    });

    it('does not throw when profile provider is local', () => {
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

      expect(() => {
        isProfileProviderLocal('provider', 'profile', mockSuperJson.normalized);
      }).not.toThrow();
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

  describe('checkSensitiveInformation', () => {
    let consoleOutput: string[] = [];
    const originalWarn = console.warn;
    const mockedWarn = (output: string) => consoleOutput.push(output);

    const schemes: SecurityScheme[] = [
      {
        id: 'api_key',
        type: SecurityType.APIKEY,
        in: ApiKeyPlacement.PATH,
      },
    ];
    const values: SecurityValues[] = [
      {
        id: 'api_key',
        apikey: 'SECRET',
      },
    ];
    const params: Record<string, string> = {
      my_param: 'SECRET',
    };

    beforeEach(() => {
      consoleOutput = [];
      console.warn = mockedWarn;
    });

    afterAll(() => {
      console.warn = originalWarn;
    });

    it('warn when sensitive information is found', () => {
      const definitions: RecordingDefinitions = [
        {
          scope: 'https//api.hubapi.SECRET.com:443',
          method: 'POST',
          path: '/SECRET',
        },
      ];

      checkSensitiveInformation(definitions, schemes, values, params);

      expect(consoleOutput).toEqual([
        "Value for security scheme 'api_key' of type 'apiKey' was found in recorded HTTP traffic.",
        "Value for integration parameter 'my_param' was found in recorded HTTP traffic.",
      ]);
    });

    it("don't warn when no sensitive information is found", () => {
      const definitions: RecordingDefinitions = [
        {
          scope: 'https//api.hubapi.com:443',
          method: 'POST',
          path: '/',
        },
      ];

      checkSensitiveInformation(definitions, schemes, values, params);

      expect(consoleOutput).toEqual([]);
    });
  });

  describe('getGenerator', () => {
    describe('when specified testInstance is jest expect instance', () => {
      it('returns JestGenerateHash instance', () => {
        const mockExpect = ((): void => {
          console.log('simulating expect');
        }) as any;

        mockExpect.getState = () => ({
          currentTestName: 'test name',
        });

        expect(getGenerator(mockExpect)).toBeInstanceOf(JestGenerateHash);
      });
    });

    describe('when specified testInstance is mocha instance', () => {
      describe("from mocha's hooks", () => {
        it('returns MochaGenerateHash instance', () => {
          const mockMocha = {
            test: {
              type: 'hook',
            },
            currentTest: {
              fullTitle: () => 'test name',
            },
          };

          expect(getGenerator(mockMocha)).toBeInstanceOf(MochaGenerateHash);
        });
      });

      describe("from mocha's test", () => {
        it('returns MochaGenerateHash instance when specified testInstance is mocha test instance', () => {
          const mockMocha = {
            test: {
              type: 'test',
              fullTitle: () => 'test name',
            },
          };

          expect(getGenerator(mockMocha)).toBeInstanceOf(MochaGenerateHash);
        });
      });
    });

    describe('when specified testInstance is unknown', () => {
      it('returns InputGenerateHash instance', () => {
        const mockTestInstance = undefined;

        expect(getGenerator(mockTestInstance)).toBeInstanceOf(
          InputGenerateHash
        );
      });
    });
  });
});
