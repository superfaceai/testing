import {
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  IFileSystem,
  NodeFileSystem,
  profileAstId,
} from '@superfaceai/one-sdk';

import {
  ComponentUndefinedError,
  SuperJsonNotFoundError,
} from '../../common/errors';
import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { getSuperJson } from '../../superface-test.utils';
import { getMapAst, getProfileAst } from './prepare-ast';
import { getProviderJson } from './prepare-provider-json';

// This deals only with files resolution, it should NOT be exported from directory.
export async function prepareFiles(
  payload: SuperfaceTestConfigPayload,
  options?: {
    fileSystem?: IFileSystem;
  }
): Promise<{
  superJson: NormalizedSuperJsonDocument;
  profileAst: ProfileDocumentNode;
  providerJson: ProviderJson;
  mapAst: MapDocumentNode;
}> {
  const superJson = await getSuperJson();

  if (!superJson) {
    throw new SuperJsonNotFoundError();
  }

  const fs = options?.fileSystem ?? NodeFileSystem;

  // Load profile
  if (!payload.profile) {
    throw new ComponentUndefinedError('Profile');
  }

  const profileAst = await getProfileAst(payload.profile, superJson, fs);

  // Load provider
  if (!payload.provider) {
    throw new ComponentUndefinedError('Provider');
  }

  const providerJson = await getProviderJson(payload.provider, superJson, fs);

  // Load map
  const mapAst = await getMapAst(
    profileAstId(profileAst),
    providerJson.name,
    superJson,
    fs
  );

  return {
    superJson,
    profileAst,
    providerJson,
    mapAst,
  };
}
