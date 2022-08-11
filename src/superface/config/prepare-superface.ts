import {
  MapDocumentNode,
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
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';

import { ComponentUndefinedError } from '../../common/errors';
import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareFiles } from './prepare-files';

// Prepares runnable bound profile provider
export async function prepareSuperface(
  payload: SuperfaceTestConfigPayload,
  options?: {
    fileSystem?: IFileSystem;
    crypto?: ICrypto;
    timers?: ITimers;
    logger?: ILogger;
    fetchInstance?: IFetch & Interceptable & AuthCache;
  }
): Promise<{
  boundProfileProvider: BoundProfileProvider;
  profileId: string;
  providerName: string;
  usecaseName: string;
  files: {
    superJson: SuperJson;
    profileAst: ProfileDocumentNode;
    mapAst: MapDocumentNode;
    providerJson: ProviderJson;
  };
}> {
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
