import {
  MapDocumentNode,
  ProfileDocumentNode,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  PerformError,
  Profile,
  Provider,
  Result,
  SuperfaceClient,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';
import { ServiceSelector } from '@superfaceai/one-sdk/dist/private';

import { CompleteSuperfaceTestConfig } from '.';

/* eslint-disable @typescript-eslint/no-unsafe-return */

interface UseCaseOptions {
  isOk?: boolean;
  isErr?: boolean;
  result?: Result<unknown, PerformError>;
}

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

export interface ProfileOptions {
  version?: string;
  cacheKey?: string;
}

export const getProfileMock = jest.fn<
  Promise<Profile>,
  Parameters<(profileId: string, options?: ProfileOptions) => Promise<Profile>>
>(async (profileId: string, options?: ProfileOptions) => ({
  ...Object.create(Profile.prototype),
  client: jest.createMockFromModule<SuperfaceClient>(
    '@superfaceai/one-sdk/dist/client/client'
  ),
  configuration: {
    id: profileId ?? 'profile',
    version: options?.version ?? '1.0.0',
    cacheKey: options?.cacheKey ?? '',
  },
  getUseCase: getUseCaseMock,
}));

export interface ProviderOptions {
  securityValues?: SecurityValues[];
}

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
  },
}));

export interface SuperfaceClientOptions {
  superJson?: SuperJson;
  profileAst?: ProfileDocumentNode;
  mapAst?: MapDocumentNode;
  providerName?: string;
  configuration?: {
    baseUrl: string;
    securitySchemes?: SecurityScheme[];
    parameters?: Record<string, string>;
  };
}

const DEFAULT_SUPERJSON = new SuperJson({
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

export const SuperfaceClientMock = jest.fn<
  SuperfaceClient,
  Parameters<(options?: SuperfaceClientOptions) => SuperfaceClient>
>((options?: SuperfaceClientOptions) => ({
  ...Object.create(SuperfaceClient.prototype),
  superJson: options?.superJson ?? DEFAULT_SUPERJSON,
  getProfile: getProfileMock,
  getProvider: getProviderMock,
  cacheBoundProfileProvider: jest.fn().mockReturnValue({
    profileAst: options?.profileAst ?? {},
    mapAst: options?.mapAst ?? {},
    providerName: options?.providerName ?? 'provider',
    configuration: {
      services: ServiceSelector.withDefaultUrl(
        options?.configuration?.baseUrl ?? 'https://base.url'
      ),
      security: options?.configuration?.securitySchemes ?? [],
      parameters: options?.configuration?.parameters,
    },
  }),
}));

export const getMockedSfConfig = async (options?: {
  superJson?: SuperJson;
  isOk?: boolean;
  isErr?: boolean;
  result?: Result<unknown, PerformError>;
  baseUrl?: string;
  securitySchemes?: SecurityScheme[];
  securityValues?: SecurityValues[];
  parameters?: Record<string, string>;
}): Promise<CompleteSuperfaceTestConfig> => ({
  client: new SuperfaceClientMock({
    superJson: options?.superJson ?? DEFAULT_SUPERJSON,
    configuration: {
      baseUrl: options?.baseUrl ?? 'https://base.url',
      securitySchemes: options?.securitySchemes,
      parameters: options?.parameters,
    },
  }),
  profile: await getProfileMock('profile'),
  provider: await getProviderMock('provider', {
    securityValues: options?.securityValues ?? [],
  }),
  useCase: getUseCaseMock('usecase', {
    isOk: options?.isOk ?? true,
    isErr: options?.isErr,
    result: options?.result,
  }),
});
