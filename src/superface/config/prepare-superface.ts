import {
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  AuthCache,
  BoundProfileProvider,
  ICrypto,
  IFetch,
  IFileSystem,
  ILogger,
  Interceptable,
  ITimers,
  profileAstId,
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
  useCaseName: string;
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

  const useCaseName =
    payload.useCase instanceof UseCase ? payload.useCase.name : payload.useCase;

  return {
    profileId: profileAstId(files.profileAst),
    providerName: files.providerJson.name,
    useCaseName,
    files,
    boundProfileProvider: createBoundProfileProvider({
      ...files,
      options,
    }),
  };
}
