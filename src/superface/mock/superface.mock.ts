import {
  IntegrationParameter,
  MapDocumentNode,
  ProfileDocumentNode,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  BoundProfileProvider,
  Config,
  Events,
  NodeCrypto,
  NodeFetch,
  NodeLogger,
  PerformError,
  Profile,
  ProfileBase,
  Provider,
  Result,
  SecurityConfiguration,
  SuperfaceClient,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';

import { CompleteSuperfaceTestConfig } from '../../superface-test.interfaces';
import { ISuperfaceClient } from '../client';
import { mockProfileAST } from './ast';
import { mockFileSystem } from './file-system';
import { createProfile } from './profile';
import { createProvider } from './provider';
import { MockTimers } from './timers';
import { createUseCase } from './usecase';

/* eslint-disable @typescript-eslint/no-unsafe-return */

export const getUseCaseMock = jest.fn<
  UseCase,
  Parameters<(name: string, options?: UseCaseOptions) => UseCase>
>((name: string, options?: UseCaseOptions) => ({
  ...Object.create(UseCase.prototype),
  perform: jest.fn().mockResolvedValue({
    isOk:
      options?.isOk !== undefined
        ? jest.fn().mockResolvedValue(options.isOk)
        : jest.fn(),
    isErr:
      options?.isErr !== undefined
        ? jest.fn().mockResolvedValue(options.isErr)
        : jest.fn(),
    unwrap: options?.result?.unwrap ?? jest.fn(),
    value: options?.result?.isOk() && options.result.value,
    error: options?.result?.isErr() && options.result.error,
  }),
  name,
}));

export const getProfileMock = jest.fn<
  Promise<Profile>,
  Parameters<(profileId: string, options?: ProfileOptions) => Promise<Profile>>
>(async (profileId: string, options?: ProfileOptions) => ({
  ...Object.create(ProfileBase.prototype),
  getUseCase: getUseCaseMock,
  configuration: {
    id: profileId ?? 'profile',
    version: options?.version ?? '1.0.0',
    cacheKey: options?.cacheKey ?? '',
  },
  ast: options?.ast ?? mockProfileAST,
  events: new Events(new MockTimers(), new NodeLogger()),
  config: new Config(mockFileSystem(), {
    disableReporting: true,
  }),
  timers: new MockTimers(),
  fileSystem: mockFileSystem(),
  boundProfileProviderCache: {},
  crypto: new NodeCrypto(),
  fetchInstance: NodeFetch,
}));

export const getProviderMock = jest.fn<
  Promise<Provider>,
  Parameters<
    (providerName: string, options?: ProviderOptions) => Promise<Provider>
  >
>(async (providerName: string, options?: ProviderOptions) => ({
  ...Object.create(Provider.prototype),
  configuration: {
    name: providerName,
    security: options?.securityValues ?? [],
    parameters: options?.parameters,
  },
}));

export const DEFAULT_SUPERJSON = new SuperJson({
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

export interface SuperfaceClientOptions {
  superJson?: SuperJson;
  profileAst?: ProfileDocumentNode;
  mapAst?: MapDocumentNode;
  providerName?: string;
  configuration?: {
    baseUrl: string;
    securityConfigurations?: SecurityConfiguration[];
    securityValues?: SecurityValues[];
    parameters?: Record<string, string>;
  };
  providerJson: {
    name?: string;
    securitySchemes?: SecurityScheme[];
    defaultService?: string;
    parameters?: IntegrationParameter[];
  };
}

export const BoundProfileProviderMock = jest.fn<
  BoundProfileProvider,
  Parameters<(options?: SuperfaceClientOptions) => BoundProfileProvider>
>((options?: SuperfaceClientOptions) => ({
  ...Object.create(BoundProfileProvider.prototype),
  profileAst: options?.profileAst,
  mapAst: options?.mapAst,
  provider: options?.providerJson,
  config: new Config(mockFileSystem(), {
    disableReporting: true,
  }),
  events: new Events(new MockTimers(), new NodeLogger()),
  crypto: new NodeCrypto(),
  fetchInstance: NodeFetch,
  configuration: {
    security: options?.configuration?.securityConfigurations,
    parameters: options?.configuration?.parameters,
  },
}));

export const SuperfaceClientMock = jest.fn<
  ISuperfaceClient,
  Parameters<(options?: SuperfaceClientOptions) => ISuperfaceClient>
>((options?: SuperfaceClientOptions) => ({
  ...Object.create(SuperfaceClient.prototype),
  superJson: options?.superJson ?? DEFAULT_SUPERJSON,
  getProfile: getProfileMock,
  getProvider: getProviderMock,
  cacheBoundProfileProvider: jest
    .fn()
    .mockReturnValue(BoundProfileProviderMock(options)),
}));

// export const getMockedSfConfig = async (options?: {
//   superJson?: SuperJson;
//   isOk?: boolean;
//   isErr?: boolean;
//   result?: Result<unknown, PerformError>;
//   baseUrl?: string;
//   securitySchemes?: SecurityScheme[];
//   securityConfigurations?: SecurityConfiguration[];
//   securityValues?: SecurityValues[];
//   parameters?: Record<string, string>;
//   intParameters?: IntegrationParameter[];
//   profileAst?: ProfileDocumentNode,
//   mapAst?: MapDocumentNode,
// }): Promise<CompleteSuperfaceTestConfig> => ({
//   client: new SuperfaceClientMock({
//     profileAst: options?.profileAst ?? mockProfileAST,
//     mapAst: options?.mapAst ?? mockMapAST,
//     superJson: options?.superJson ?? DEFAULT_SUPERJSON,
//     configuration: {
//       baseUrl: options?.baseUrl ?? 'https://base.url',
//       securityConfigurations: options?.securityConfigurations,
//       parameters: options?.parameters,
//     },
//     providerJson: {
//       parameters: options?.intParameters,
//       securitySchemes: options?.securitySchemes,
//     },
//   }),
//   profile: await getProfileMock('profile', {
//     ast: options?.profileAst,
//   }),
//   provider: await getProviderMock('provider', {
//     securityValues: options?.securityValues ?? [],
//     parameters: options?.parameters,
//   }),
//   useCase: getUseCaseMock('usecase', {
//     isOk: options?.isOk ?? true,
//     isErr: options?.isErr,
//     result: options?.result,
//   }),
//   boundProfileProvider: BoundProfileProviderMock({
//     profileAst: options?.profileAst ?? mockProfileAST,
//     mapAst: options?.mapAst ?? mockMapAST,
//     superJson: options?.superJson ?? DEFAULT_SUPERJSON,
//     configuration: {
//       baseUrl: options?.baseUrl ?? 'https://base.url',
//       securityConfigurations: options?.securityConfigurations,
//       parameters: options?.parameters,
//     },
//     providerJson: {
//       parameters: options?.intParameters,
//       securitySchemes: options?.securitySchemes,
//     },
//   }),
// });

export interface ProfileOptions {
  name?: string;
  version?: string;
  cacheKey?: string;
  ast?: ProfileDocumentNode;
}
export interface ProviderOptions {
  name?: string;
  baseUrl?: string;
  securitySchemes?: SecurityScheme[];
  securityValues?: SecurityValues[];
  parameters?: Record<string, string>;
  intParameters?: IntegrationParameter[];
  ast?: MapDocumentNode;
}
interface UseCaseOptions {
  isOk?: boolean;
  isErr?: boolean;
  result?: Result<unknown, PerformError>;
  securityValues?: SecurityValues[];
  parameters?: Record<string, string>;
}

export const getMockedSfConfig = async (options?: {
  superJson?: SuperJson;
  profile?: ProfileOptions;
  provider?: ProviderOptions;
  useCase?: UseCaseOptions;
}): Promise<
  Pick<CompleteSuperfaceTestConfig, 'profile' | 'provider' | 'useCase'>
> => ({
  profile: createProfile({
    superJson: options?.superJson,
    ...options?.profile,
  }),
  provider: createProvider(options?.provider),
  useCase: await createUseCase({
    superJson: options?.superJson,
    ...options?.useCase,
  }),
});
