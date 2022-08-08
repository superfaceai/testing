import {
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  BoundProfileProvider,
  profileAstId,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';

import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { resolveSuperfaceFiles } from './resolve-superface-files';

//Prepares runnable bound profile provider
export async function prepareSuperface(
  payload: SuperfaceTestConfigPayload
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

  const files = await resolveSuperfaceFiles(payload ?? {});

  return {
    boundProfileProvider: createBoundProfileProvider(files),
    profileId: profileAstId(files.profileAst),
    providerName: files.providerJson.name,
    files,
    usecaseName,
  };
}
