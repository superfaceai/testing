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

import { ComponentUndefinedError } from '../../common/errors';
import { SuperfaceTestConfig } from '../../interfaces';
import { getMapAst, getProfileAst } from './prepare-ast';
import { getProviderJson } from './prepare-provider-json';
import { getSuperJson } from './prepare-super-json';

// This deals only with files resolution, it should NOT be exported from directory.
export async function prepareFiles(
  payload: SuperfaceTestConfig,
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
    superJson: superJson.document,
    profileAst,
    providerJson,
    mapAst,
  };
}
