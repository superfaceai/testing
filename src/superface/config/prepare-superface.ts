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

import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { resolveSuperfaceFiles } from './resolve-superface-files';

//Prepares runnable bound profile provider
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
    throw new Error('UseCase must be dofined');
  }
  const usecaseName =
    payload.useCase instanceof UseCase ? payload.useCase.name : payload.useCase;

  const files = await resolveSuperfaceFiles(payload ?? {}, {
    fileSystem: options?.fileSystem,
  });

  return {
    boundProfileProvider: createBoundProfileProvider({
      ...files,
      options: {
        crypto: options?.crypto,
        timers: options?.timers,
        logger: options?.logger,
        fetchInstance: options?.fetchInstance,
      },
    }),
    profileId: profileAstId(files.profileAst),
    providerName: files.providerJson.name,
    files,
    usecaseName,
  };
}
