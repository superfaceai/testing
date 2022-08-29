import {
  HttpScheme,
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
  ProviderJson,
  SecurityType,
} from '@superfaceai/ast';
import {
  AuthCache,
  BoundProfileProvider,
  ICrypto,
  IEnvironment,
  IFetch,
  IFileSystem,
  ILogger,
  Interceptable,
  ITimers,
  NodeEnvironment,
  profileAstId,
  resolveEnv,
  SecurityConfiguration,
  UseCase,
} from '@superfaceai/one-sdk';

import { ComponentUndefinedError } from '../../common/errors';
import { SuperfaceTestConfig } from '../../superface-test.interfaces';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareFiles } from './prepare-files';

export interface SuperfaceConfiguration {
  boundProfileProvider: BoundProfileProvider;
  profileId: string;
  providerName: string;
  usecaseName: string;
  files: {
    superJson: NormalizedSuperJsonDocument;
    profileAst: ProfileDocumentNode;
    mapAst: MapDocumentNode;
    providerJson: ProviderJson;
  };
}

// Prepares runnable bound profile provider
export async function prepareSuperface(
  payload: SuperfaceTestConfig,
  options?: {
    fileSystem?: IFileSystem;
    crypto?: ICrypto;
    timers?: ITimers;
    logger?: ILogger;
    fetchInstance?: IFetch & Interceptable & AuthCache;
  }
): Promise<SuperfaceConfiguration> {
  if (!payload.useCase) {
    throw new ComponentUndefinedError('UseCase');
  }

  const files = await prepareFiles(payload ?? {}, {
    fileSystem: options?.fileSystem,
  });

  const usecaseName =
    payload.useCase instanceof UseCase ? payload.useCase.name : payload.useCase;

  return {
    profileId: profileAstId(files.profileAst),
    providerName: files.providerJson.name,
    usecaseName,
    files,
    boundProfileProvider: createBoundProfileProvider({
      ...files,
      options,
    }),
  };
}

export function resolveSecurityValues(
  configurations: SecurityConfiguration[],
  options?: {
    environment?: IEnvironment;
  }
): SecurityConfiguration[] {
  const environment = options?.environment ?? new NodeEnvironment();

  return configurations.map(configuration => {
    if (configuration.type === SecurityType.APIKEY) {
      configuration.apikey = resolveEnv(configuration.apikey, environment);
    } else if (
      (configuration.type === SecurityType.HTTP &&
        configuration.scheme === HttpScheme.BASIC) ||
      (configuration.type === SecurityType.HTTP &&
        configuration.scheme === HttpScheme.DIGEST)
    ) {
      configuration.username = resolveEnv(configuration.username, environment);
      configuration.password = resolveEnv(configuration.password, environment);
    } else if (
      configuration.type === SecurityType.HTTP &&
      configuration.scheme === HttpScheme.BEARER
    ) {
      configuration.token = resolveEnv(configuration.token, environment);
    }

    return configuration;
  });
}
