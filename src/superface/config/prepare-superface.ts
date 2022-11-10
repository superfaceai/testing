import {
  AuthCache,
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
import { SuperfaceConfiguration, SuperfaceTestConfig } from '../../interfaces';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareFiles } from './prepare-files';

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
