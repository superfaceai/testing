import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  assertProviderJson,
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  IFileSystem,
  NodeFileSystem,
  Profile,
  profileAstId,
  Provider,
  SuperJson,
} from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import {
  ComponentUndefinedError,
  MapUndefinedError,
  ProfileUndefinedError,
  ProviderJsonUndefinedError,
  SuperJsonNotFoundError,
} from '../../common/errors';
import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { getSuperJson } from '../../superface-test.utils';

// This deals only with files resolution, it should NOT be exported from directory.
export async function prepareFiles(
  payload: SuperfaceTestConfigPayload,
  options?: {
    fileSystem?: IFileSystem;
  }
): Promise<{
  superJson: SuperJson;
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

async function getProfileAst(
  profile: Profile | string,
  superJson: SuperJson,
  fileSystem: IFileSystem
): Promise<ProfileDocumentNode> {
  if (profile instanceof Profile) {
    return profile.ast;
  } else {
    const profileSettings = superJson.normalized.profiles[profile];

    if (!profileSettings || !('file' in profileSettings)) {
      throw new ProfileUndefinedError(profile);
    }

    const profilePath = superJson.resolvePath(profileSettings.file);
    const content = await fileSystem.readFile(profilePath);

    if (content.isErr()) {
      throw content.error;
    }

    if (profilePath.endsWith('.supr')) {
      return parseProfile(new Source(content.value, profilePath));
    } else {
      return assertProfileDocumentNode(JSON.parse(content.value));
    }
  }
}

async function getMapAst(
  profileId: string,
  providerName: string,
  superJson: SuperJson,
  fileSystem: IFileSystem
): Promise<MapDocumentNode> {
  const profileProviderSettings =
    superJson.normalized.profiles[profileId]?.providers[providerName];

  if (!profileProviderSettings || !('file' in profileProviderSettings)) {
    throw new MapUndefinedError(profileId, providerName);
  }

  const mapPath = superJson.resolvePath(profileProviderSettings.file);
  const content = await fileSystem.readFile(mapPath);

  if (content.isErr()) {
    throw content.error;
  }

  if (mapPath.endsWith('.suma')) {
    return parseMap(new Source(content.value, mapPath));
  } else {
    return assertMapDocumentNode(JSON.parse(content.value));
  }
}

async function getProviderJson(
  provider: Provider | string,
  superJson: SuperJson,
  fileSystem: IFileSystem
): Promise<ProviderJson> {
  const providerName =
    provider instanceof Provider ? provider.configuration.name : provider;
  const providerSettings = superJson.normalized.providers[providerName];

  if (!providerSettings || !providerSettings.file) {
    throw new ProviderJsonUndefinedError(providerName);
  }

  const providerPath = superJson.resolvePath(providerSettings.file);
  const content = await fileSystem.readFile(providerPath);

  if (content.isErr()) {
    throw content.error;
  }

  return assertProviderJson(JSON.parse(content.value));
}
