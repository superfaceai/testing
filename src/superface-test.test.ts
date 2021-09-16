import {
  err,
  MapASTError,
  ok,
  Profile,
  ProfileConfiguration,
  Provider,
  ProviderConfiguration,
  SuperfaceClient,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';
import { mocked } from 'ts-jest/utils';

import {
  ComponentUndefinedError,
  SuperJsonNotFoundError,
} from './common/errors';
import { SuperfaceTest } from './superface-test';
import {
  SuperfaceTestConfig,
  SuperfaceTestConfigPayload,
} from './superface-test.interfaces';

// const mockServer = getLocal();

jest.mock('./common/io', () => ({
  exists: jest.fn(),
  writeIfAbsent: jest.fn(),
}));

jest.mock('@superfaceai/one-sdk/dist/client/client');
jest.mock('@superfaceai/one-sdk/dist/client/profile');
jest.mock('@superfaceai/one-sdk/dist/client/usecase');
jest.mock('@superfaceai/one-sdk/dist/internal/superjson');

jest.mock('nock');

// const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), '.', 'recording.json');

describe.skip('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    superfaceTest = new SuperfaceTest({});
  });

  describe('run', () => {
    const mockSuperJson = new SuperJson({
      profiles: {
        profile: {
          file: 'path/to/profile.supr',
          providers: {
            provider: {
              file: 'path/to/map.suma',
            },
          },
        },
      },
      providers: {
        provider: {
          file: 'path/to/provider.json',
          security: [],
        },
      },
    });
    Object.assign(mockSuperJson, {
      normalized: {
        profiles: {
          profile: {
            file: 'path/to/profile.supr',
            defaults: {},
            providers: {
              provider: {
                file: 'path/to/map.suma',
                defaults: {},
              },
            },
          },
        },
        providers: {
          provider: {
            file: 'path/to/provider.json',
            security: [],
          },
        },
      },
    });

    it('throws when superJson loading fails', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(
          err(new SDKExecutionError('super.json error', [], []))
        );

      superfaceTest = new SuperfaceTest({
        profile: 'profile',
        provider: 'provider',
        useCase: 'usecase',
      });

      await expect(superfaceTest.run({ input: '' })).rejects.toThrow(
        'super.json error'
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('throws when config is not present', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            file: 'path/to/profile.supr',
            providers: {
              provider: {
                file: 'path/to/map.suma',
              },
            },
          },
        },
        providers: {
          provider: {
            file: 'path/to/provider.json',
            security: [],
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              file: 'path/to/profile.supr',
              defaults: {},
              providers: {
                provider: {
                  file: 'path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              file: 'path/to/provider.json',
              security: [],
            },
          },
        },
      });

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const client = new SuperfaceClient();
      const mockedProfile = new Profile(
        client,
        new ProfileConfiguration('profile', '1.0.0')
      );
      Object.assign(mockedProfile, {
        configuration: { id: 'profile', version: '1.0.0' },
      });
      const mockedUseCase = new UseCase(mockedProfile, 'some-use-case');
      const mockedProvider = new Provider(
        client,
        new ProviderConfiguration('provider', [])
      );

      const superfaceTest1 = new SuperfaceTest({});
      const superfaceTest2 = new SuperfaceTest({
        profile: mockedProfile,
      });
      const superfaceTest3 = new SuperfaceTest({
        profile: mockedProfile,
        provider: mockedProvider,
      });
      const superfaceTest4 = new SuperfaceTest({
        profile: mockedProfile,
        provider: mockedProvider,
        useCase: mockedUseCase,
      });

      await expect(superfaceTest1.run({ input: '' })).rejects.toThrowError(
        new ComponentUndefinedError('Profile')
      );
      await expect(superfaceTest2.run({ input: '' })).rejects.toThrowError(
        new ComponentUndefinedError('Provider')
      );
      await expect(superfaceTest3.run({ input: '' })).rejects.toThrowError(
        new ComponentUndefinedError('UseCase')
      );
      await expect(superfaceTest4.run({ input: '' })).resolves.toBeUndefined();

      expect(detectSpy).toHaveBeenCalledTimes(4);
      expect(loadSpy).toHaveBeenCalledTimes(4);
    });

    it('throws when detecting superJson fails', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue(undefined);

      const loadSpy = jest.spyOn(SuperJson, 'load');

      superfaceTest = new SuperfaceTest({});

      await expect(superfaceTest.run({ input: '' })).rejects.toThrowError(
        new SuperJsonNotFoundError()
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('retuns error from perform', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const client = new SuperfaceClient();
      const mockedProfile = new Profile(
        client,
        new ProfileConfiguration('profile', '1.0.0')
      );
      Object.assign(mockedProfile, {
        configuration: { id: 'profile', version: '1.0.0' },
      });
      const mockedUseCase = new UseCase(mockedProfile, 'some-use-case');
      const mockedProvider = new Provider(
        client,
        new ProviderConfiguration('provider', [])
      );

      const performSpy = jest
        .spyOn(mockedUseCase, 'perform')
        .mockResolvedValue(err(new MapASTError('error')));

      superfaceTest = new SuperfaceTest({
        profile: mockedProfile,
        provider: mockedProvider,
        useCase: mockedUseCase,
      });

      await expect(superfaceTest.run({ input: '' })).resolves.toMatchObject({
        error: new MapASTError('error').toString(),
      });

      expect(performSpy).toHaveBeenCalledTimes(1);
      expect(performSpy).toHaveBeenCalledWith({}, { provider: mockedProvider });

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('retuns value from perform', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');

      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const client = new SuperfaceClient();
      const mockedProfile = new Profile(
        client,
        new ProfileConfiguration('profile', '1.0.0')
      );
      Object.assign(mockedProfile, {
        configuration: { id: 'profile', version: '1.0.0' },
      });
      const mockedUseCase = new UseCase(mockedProfile, 'some-use-case');
      const mockedProvider = new Provider(
        client,
        new ProviderConfiguration('provider', [])
      );

      const performSpy = jest
        .spyOn(mockedUseCase, 'perform')
        .mockResolvedValue(ok('result'));

      superfaceTest = new SuperfaceTest({
        profile: mockedProfile,
        provider: mockedProvider,
        useCase: mockedUseCase,
      });

      await expect(superfaceTest.run({ input: '' })).resolves.toMatchObject({
        value: 'result',
      });

      expect(performSpy).toHaveBeenCalledTimes(1);
      expect(performSpy).toHaveBeenCalledWith({}, { provider: mockedProvider });

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    describe.skip('recording', () => {
      /* TODO: update tests bellow
    beforeAll(async () => {
      await mockServer.start();
    });

    afterAll(async () => {
      await mockServer.stop();
    });

    // startRecording
    it('throws when nockConfig is not specified', async () => {
      await expect(superfaceTest.run({input: ""})).rejects.toThrowError(
        new NockConfigUndefinedError()
      );
    });

    it('starts recording when fixture does not exist', async () => {
      superfaceTest = new SuperfaceTest({}, {});

      const recorderSpy = jest.spyOn(nockRecorder, 'rec');

      mocked(exists).mockResolvedValue(false);
      await expect(superfaceTest.record()).resolves.toBeUndefined();

      expect(recorderSpy).toHaveBeenCalledTimes(1);
      expect(recorderSpy).toHaveBeenCalledWith({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording: true,
      });
    });

    it('loads fixture if it exist', async () => {
      superfaceTest = new SuperfaceTest({}, {});

      const loadRecordingSpy = jest.spyOn(nock, 'load').mockReturnValue([]);
      const recorderSpy = jest.spyOn(nockRecorder, 'rec');

      mocked(exists).mockResolvedValue(true);
      await expect(superfaceTest.record()).resolves.toBeUndefined();

      expect(loadRecordingSpy).toHaveBeenCalledTimes(1);
      expect(loadRecordingSpy).toHaveBeenCalledWith(DEFAULT_RECORDING_PATH);
      expect(recorderSpy).not.toHaveBeenCalled();
    });

    // end recording
    it('throws when fixture path is not set', async () => {
      await expect(superfaceTest.endRecording({})).rejects.toThrowError(
        new RecordingPathUndefinedError('record')
      );
    });

    it('returns if file at fixture path exists', async () => {
      superfaceTest = new SuperfaceTest({}, {});

      await superfaceTest.record();

      const writeIfAbsentSpy = mocked(writeIfAbsent);
      const endRecSpy = jest.spyOn(nock, 'restore');
      mocked(exists).mockResolvedValue(true);

      await expect(superfaceTest.endRecording()).resolves.toBeUndefined();
      expect(writeIfAbsentSpy).not.toHaveBeenCalled();
      expect(endRecSpy).not.toHaveBeenCalled();
    });

    it('writes and restores recordings', async () => {
      superfaceTest = new SuperfaceTest({}, {});

      await superfaceTest.record();

      await mockServer
        .get('/')
        .withHeaders({ Accept: 'application/json' })
        .thenJson(200, { some: 'data' });

      const writeIfAbsentSpy = mocked(writeIfAbsent).mockResolvedValue(true);
      const playSpy = jest
        .spyOn(nockRecorder, 'play')
        .mockReturnValue([
          { scope: 'root', path: '/', status: 200, response: { some: 'data' } },
        ]);
      const endRecSpy = jest.spyOn(nock, 'restore');

      mocked(exists).mockResolvedValue(false);

      await expect(superfaceTest.endRecording()).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
      expect(writeIfAbsentSpy).toHaveBeenCalledWith(
        DEFAULT_RECORDING_PATH,
        `[
  {
    "scope": "root",
    "path": "/",
    "status": 200,
    "response": {
      "some": "data"
    }
  }
]`,
        { dirs: true, force: false }
      );

      expect(playSpy).toHaveBeenCalledTimes(1);
      expect(endRecSpy).toHaveBeenCalledTimes(1);
    });
    */
    });
  });

  describe('when preparing configuration', () => {
    it('throws error when usecase is string and profile is undefined', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            file: 'path/to/profile.supr',
            providers: {
              provider: {
                file: 'path/to/map.suma',
              },
            },
          },
        },
        providers: {
          provider: {
            file: 'path/to/provider.json',
            security: [],
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              file: 'path/to/profile.supr',
              defaults: {},
              providers: {
                provider: {
                  file: 'path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              file: 'path/to/provider.json',
              security: [],
            },
          },
        },
      });

      const expectedSfConfig: SuperfaceTestConfigPayload = {
        useCase: 'some-use-case',
      };

      const client = new SuperfaceClient();

      superfaceTest = new SuperfaceTest({
        client,
        useCase: 'some-use-case',
      });

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        superfaceTest.run({
          input: '',
        })
      ).rejects.toThrowError(new ComponentUndefinedError('Profile'));

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(superfaceTest.sfConfig).toMatchObject(expectedSfConfig);
    });

    it('reconstructs valid string configuration', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            file: 'path/to/profile.supr',
            providers: {
              provider: {
                file: 'path/to/map.suma',
              },
            },
          },
        },
        providers: {
          provider: {
            file: 'path/to/provider.json',
            security: [],
          },
        },
      });
      Object.assign(mockSuperJson, {
        normalized: {
          profiles: {
            profile: {
              file: 'path/to/profile.supr',
              defaults: {},
              providers: {
                provider: {
                  file: 'path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              file: 'path/to/provider.json',
              security: [],
            },
          },
        },
      });

      const client = new SuperfaceClient();

      superfaceTest = new SuperfaceTest({
        client,
        profile: 'profile',
        provider: 'provider',
        useCase: 'some-use-case',
      });

      const mockedProfile = new Profile(
        client,
        new ProfileConfiguration('profile', '1.0.0')
      );
      const mockedUseCase = new UseCase(mockedProfile, 'some-use-case');
      const mockedProvider = new Provider(
        client,
        new ProviderConfiguration('provider', [])
      );

      const getProfileSpy = mocked(
        SuperfaceClient.prototype
      ).getProfile.mockResolvedValue(mockedProfile);
      const getProviderSpy = mocked(
        SuperfaceClient.prototype
      ).getProvider.mockResolvedValue(mockedProvider);
      const getUseCaseSpy = mocked(
        Profile.prototype
      ).getUseCase.mockReturnValue(mockedUseCase);

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        superfaceTest.run({
          input: '',
        })
      ).resolves.toBeUndefined();

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(getProfileSpy).toHaveBeenCalledTimes(1);
      expect(getProviderSpy).toHaveBeenCalledTimes(1);
      expect(getUseCaseSpy).toHaveBeenCalledTimes(1);

      const profile = await client.getProfile('profile');
      const provider = await client.getProvider('provider');
      const useCase = profile.getUseCase('some-use-case');

      const expectedSfConfig: SuperfaceTestConfig = {
        client,
        profile,
        provider,
        useCase,
      };

      expect(superfaceTest.sfConfig).toMatchObject(expectedSfConfig);
    });
  });

  describe('when capabilities are not local', () => {
    beforeEach(() => {
      superfaceTest = new SuperfaceTest({
        profile: 'profile',
        provider: 'provider',
        useCase: 'usecase',
      });
    });

    it('throws error when profile, profileProvider nor provider is not local', async () => {
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

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const errorMessage =
        'Some capabilities are not local, do not forget to set up file paths in super.json.';

      await expect(
        superfaceTest.run({
          input: '',
        })
      ).rejects.toThrow(errorMessage);

      expect(detectSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalledTimes(2);
    });

    it('throws error when profile nor provider is not local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            version: '0.0.1',
            providers: {
              provider: {
                file: 'path/to/map.suma',
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
                  file: 'path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              security: [],
            },
          },
        },
      });

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      const errorMessage =
        'Some capabilities are not local, do not forget to set up file paths in super.json.';

      await expect(
        superfaceTest.run({
          input: '',
        })
      ).rejects.toThrow(errorMessage);

      expect(detectSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalledTimes(2);
    });

    it('throws error when profileProvider is not local', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          profile: {
            file: 'path/to/profile.supr',
            providers: {
              provider: {
                file: 'path/to/map.suma',
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
              file: 'path/to/profile.supr',
              defaults: {},
              providers: {
                provider: {
                  file: 'path/to/map.suma',
                  defaults: {},
                },
              },
            },
          },
          providers: {
            provider: {
              security: [],
            },
          },
        },
      });

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      const loadSyncSpy = jest
        .spyOn(SuperJson, 'loadSync')
        .mockReturnValue(ok(mockSuperJson));

      const errorMessage =
        'Some capabilities are not local, do not forget to set up file paths in super.json.';

      await expect(superfaceTest.run({ input: '' })).rejects.toThrow(
        errorMessage
      );

      expect(detectSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalledTimes(2);
      expect(loadSyncSpy).not.toHaveBeenCalled();
    });
  });
});
