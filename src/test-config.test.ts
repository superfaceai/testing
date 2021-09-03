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
import { getLocal } from 'mockttp';
import nock, { back as nockBack, recorder as nockRecorder } from 'nock';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { exists } from './common/io';
import { OutputStream } from './common/output-stream';
import { TestConfig } from './test-config';
import { TestConfigPayload, TestConfiguration } from './test-config.interfaces';

const mockServer = getLocal();

jest.mock('./common/io', () => ({
  exists: jest.fn(),
}));

jest.mock('@superfaceai/one-sdk/dist/client/client');
jest.mock('@superfaceai/one-sdk/dist/client/profile');
jest.mock('@superfaceai/one-sdk/dist/client/usecase');
jest.mock('@superfaceai/one-sdk/dist/internal/superjson');

jest.mock('nock');

const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), '.', 'recording.json');

describe('TestConfig', () => {
  let testConfig: TestConfig;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    testConfig = new TestConfig({});
  });

  describe('test', () => {
    it('throws when detecting superJson fails', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue(undefined);

      const loadSpy = jest.spyOn(SuperJson, 'load');

      testConfig = new TestConfig({});

      await expect(testConfig.test()).rejects.toThrow('no super.json found');

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(0);
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

      testConfig = new TestConfig({
        profile: 'profile',
        provider: 'provider',
        useCase: 'usecase',
      });

      await expect(testConfig.test()).rejects.toThrow('super.json error');

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

      const testConfig1 = new TestConfig({});
      const testConfig2 = new TestConfig({
        profile: mockedProfile,
      });
      const testConfig3 = new TestConfig({
        profile: mockedProfile,
        provider: mockedProvider,
      });
      const testConfig4 = new TestConfig({
        profile: mockedProfile,
        provider: mockedProvider,
        useCase: mockedUseCase,
      });

      await expect(testConfig1.test()).rejects.toThrow('Undefined Profile');
      await expect(testConfig2.test()).rejects.toThrow('Undefined Provider');
      await expect(testConfig3.test()).rejects.toThrow('Undefined UseCase');
      await expect(testConfig4.test()).resolves.toBeUndefined();

      expect(detectSpy).toHaveBeenCalledTimes(4);
      expect(loadSpy).toHaveBeenCalledTimes(4);
    });
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

    it('throws when detecting superJson fails', async () => {
      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue(undefined);

      const loadSpy = jest.spyOn(SuperJson, 'load');

      testConfig = new TestConfig({});

      await expect(testConfig.run({})).rejects.toThrow('no super.json found');

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(0);
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

      testConfig = new TestConfig({
        profile: 'profile',
        provider: 'provider',
        useCase: 'usecase',
      });

      await expect(testConfig.run({})).rejects.toThrow('super.json error');

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('throws when config is not present', async () => {
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
      const mockedProvider = new Provider(
        client,
        new ProviderConfiguration('provider', [])
      );

      testConfig = new TestConfig({
        profile: mockedProfile,
        provider: mockedProvider,
      });

      await expect(testConfig.run({})).rejects.toThrow('perform failed');

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
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

      testConfig = new TestConfig({
        profile: mockedProfile,
        provider: mockedProvider,
        useCase: mockedUseCase,
      });

      await expect(testConfig.run({})).resolves.toMatchObject({
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

      testConfig = new TestConfig({
        profile: mockedProfile,
        provider: mockedProvider,
        useCase: mockedUseCase,
      });

      await expect(testConfig.run({})).resolves.toMatchObject({
        value: "result"
      });

      expect(performSpy).toHaveBeenCalledTimes(1);
      expect(performSpy).toHaveBeenCalledWith({}, { provider: mockedProvider });
      
      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setup', () => {
    it('saves entered configuration', () => {
      testConfig = new TestConfig({
        profile: 'initial-profile',
        provider: 'initial-provider',
        useCase: 'initial-usecase',
      });

      expect(
        testConfig.setup({
          profile: 'new-profile',
          provider: 'new-provider',
          useCase: 'new-usecase',
        })
      ).toBeUndefined();
      expect(testConfig.sfConfig).toMatchObject<TestConfigPayload>({
        profile: 'new-profile',
        provider: 'new-provider',
        useCase: 'new-usecase',
      });

      expect(
        testConfig.setup({
          useCase: 'another-new-usecase',
        })
      ).toBeUndefined();
      expect(testConfig.sfConfig).toMatchObject<TestConfigPayload>({
        profile: 'new-profile',
        provider: 'new-provider',
        useCase: 'another-new-usecase',
      });
    });
    
    it('does nothing when no payload is specified', () => {
      testConfig = new TestConfig({
        profile: 'some-profile',
      });

      expect(testConfig.setup({})).toBeUndefined();
      expect(testConfig.sfConfig).toMatchObject<TestConfigPayload>({
        profile: 'some-profile',
      });
    });
  });

  describe('record', () => {
    it('throws when nockConfig is not specified', async () => {
      await expect(testConfig.record()).rejects.toThrow(
        'nock configuration missing'
      );
    });

    it('starts recording when fixture does not exist', async () => {
      testConfig = new TestConfig({}, {});

      const recorderSpy = jest.spyOn(nockRecorder, 'rec');

      mocked(exists).mockResolvedValue(false);
      await expect(testConfig.record()).resolves.toBeUndefined();

      expect(recorderSpy).toHaveBeenCalledTimes(1);
      expect(recorderSpy).toHaveBeenCalledWith({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording: true,
      });
    });

    it('loads fixture if it exist', async () => {
      testConfig = new TestConfig({}, {});

      const loadRecordingSpy = jest.spyOn(nock, 'load').mockReturnValue([]);
      const recorderSpy = jest.spyOn(nockRecorder, 'rec');

      mocked(exists).mockResolvedValue(true);
      await expect(testConfig.record()).resolves.toBeUndefined();

      expect(loadRecordingSpy).toHaveBeenCalledTimes(1);
      expect(loadRecordingSpy).toHaveBeenCalledWith(DEFAULT_RECORDING_PATH);
      expect(recorderSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('endRecording', () => {
    beforeAll(async () => {
      await mockServer.start();
    });

    afterAll(async () => {
      await mockServer.stop();
    });
    
    it('throws when nockConfig is not specified', async () => {
      await expect(testConfig.endRecording()).rejects.toThrow(
        'nock configuration missing'
      );
    });

    it('throws when fixture path is not set', async () => {
      await expect(testConfig.endRecording({})).rejects.toThrow(
        'Fixture path is not defined, make sure to run `record()` before ending recording.'
      );
    });

    it('returns if file at fixture path exists', async () => {
      testConfig = new TestConfig({}, {});

      await testConfig.record();

      const writeIfAbsentSpy = jest.spyOn(OutputStream, 'writeIfAbsent');
      const endRecSpy = jest.spyOn(nock, 'restore');
      mocked(exists).mockResolvedValue(true);

      await expect(testConfig.endRecording()).resolves.toBeUndefined();
      expect(writeIfAbsentSpy).toHaveBeenCalledTimes(0);
      expect(endRecSpy).toHaveBeenCalledTimes(0);
    });

    it('writes and restores recordings', async () => {
      testConfig = new TestConfig({}, {});

      await testConfig.record();

      await mockServer
        .get('/')
        .withHeaders({ Accept: 'application/json' })
        .thenJson(200, { some: 'data' });

      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);
      const playSpy = jest
        .spyOn(nockRecorder, 'play')
        .mockReturnValue([
          { scope: 'root', path: '/', status: 200, response: { some: 'data' } },
        ]);
      const endRecSpy = jest.spyOn(nock, 'restore');

      mocked(exists).mockResolvedValue(false);

      await expect(testConfig.endRecording()).resolves.toBeUndefined();

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
        { dirs: true }
      );

      expect(playSpy).toHaveBeenCalledTimes(1);
      expect(endRecSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupNockBack', () => {
    it('throws when nockConfig is not specified', async () => {
      expect(() => testConfig.setupNockBack()).toThrow(
        'nock configuration missing'
      );
    });

    it('sets nockBack mode and path to fixtures', () => {
      const setModeSpy = jest.spyOn(nockBack, 'setMode');

      expect(() => {
        testConfig.setupNockBack({});
      }).not.toThrow();

      expect(nockBack.fixtures).toEqual(joinPath(process.cwd(), '.'));

      expect(setModeSpy).toHaveBeenCalledTimes(1);
      expect(setModeSpy).toHaveBeenCalledWith('record');
    });
  });

  describe('nockBackRecord', () => {
    it('throws when nockConfig is not specified', async () => {
      await expect(testConfig.nockBackRecord()).rejects.toThrow(
        'nock configuration missing'
      );
    });

    it('starts recording with nockBack', async () => {
      testConfig = new TestConfig({}, {});

      const nockDoneMock = jest.fn(() => {
        return;
      });
      const nockBackSpy = jest.spyOn(nock, 'back').mockResolvedValue({
        nockDone: nockDoneMock,
        context: {
          isLoaded: true,
          scopes: [],
          assertScopesFinished: () => {
            return;
          },
        },
      });

      await expect(testConfig.nockBackRecord()).resolves.toBeUndefined();

      expect(nockBackSpy).toHaveBeenCalledTimes(1);
      expect(nockBackSpy).toHaveBeenCalledWith('recording.json');

      expect(nockDoneMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('endNockBackRecording', () => {
    it('throws when nockDone is not defined', async () => {
      expect(() => testConfig.endNockBackRecording()).toThrow(
        'Nock recording failed, make sure to run `nockBackRecord()` before ending recording.'
      );
    });

    it('records and restores recordings', async () => {
      testConfig = new TestConfig({}, {});

      const nockDoneMock = jest.fn(() => {
        return;
      });
      const nockBackSpy = jest.spyOn(nock, 'back').mockResolvedValue({
        nockDone: nockDoneMock,
        context: {
          isLoaded: false,
          scopes: [],
          assertScopesFinished: () => {
            return;
          },
        },
      });
      const endRecSpy = jest.spyOn(nock, 'restore');

      testConfig.setupNockBack();
      await testConfig.nockBackRecord();

      expect(nockBackSpy).toHaveBeenCalledTimes(1);
      expect(nockBackSpy).toHaveBeenCalledWith('recording.json');

      await mockServer
        .get('/')
        .withHeaders({ Accept: 'application/json' })
        .thenJson(200, { some: 'data' });

      expect(() => {
        testConfig.endNockBackRecording();
      }).not.toThrow();

      expect(nockDoneMock).toHaveBeenCalledTimes(1);
      expect(endRecSpy).toHaveBeenCalledTimes(1);
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

      const expectedSfConfig: TestConfigPayload = {
        useCase: 'some-use-case',
      };

      const client = new SuperfaceClient();

      testConfig = new TestConfig({
        client,
        useCase: 'some-use-case',
      });

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(testConfig.test()).rejects.toThrow(
        'To setup usecase, you need to specify profile as well.'
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(testConfig.sfConfig).toMatchObject(expectedSfConfig);
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
      
      testConfig = new TestConfig({
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

      const getProfileSpy = mocked(SuperfaceClient.prototype).getProfile.mockResolvedValue(
        mockedProfile
      );
      const getProviderSpy = mocked(SuperfaceClient.prototype).getProvider.mockResolvedValue(
        mockedProvider
      );
      const getUseCaseSpy= mocked(Profile.prototype).getUseCase.mockReturnValue(mockedUseCase);

      const detectSpy = jest
        .spyOn(SuperJson, 'detectSuperJson')
        .mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(testConfig.test()).resolves.toBeUndefined();

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(getProfileSpy).toHaveBeenCalledTimes(1)
      expect(getProviderSpy).toHaveBeenCalledTimes(1)
      expect(getUseCaseSpy).toHaveBeenCalledTimes(1)

      const profile = await client.getProfile('profile');
      const provider = await client.getProvider('provider');
      const useCase = profile.getUseCase('some-use-case');

      const expectedSfConfig: TestConfiguration = {
        client,
        profile,
        provider,
        useCase,
      };

      expect(testConfig.sfConfig).toMatchObject(expectedSfConfig);
    });
  });

  describe('when capabilities are not local', () => {
    beforeEach(() => {
      testConfig = new TestConfig({
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

      await expect(testConfig.test()).rejects.toThrow(errorMessage);
      await expect(testConfig.run({})).rejects.toThrow(errorMessage);

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

      await expect(testConfig.test()).rejects.toThrow(errorMessage);
      await expect(testConfig.run({})).rejects.toThrow(errorMessage);

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

      await expect(testConfig.test()).rejects.toThrow(errorMessage);
      await expect(testConfig.run({})).rejects.toThrow(errorMessage);

      expect(detectSpy).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalledTimes(2);
      expect(loadSyncSpy).toHaveBeenCalledTimes(0);
    });
  });
});
