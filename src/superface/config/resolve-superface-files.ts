import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  assertProviderJson,
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  NodeFileSystem,
  Profile,
  profileAstId,
  Provider,
  SuperJson,
} from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';

import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { getSuperJson } from '../../superface-test.utils';

// This deals only with files resolution, it should NOT be exported from directory.
export async function resolveSuperfaceFiles(
  payload: SuperfaceTestConfigPayload
): Promise<{
  superJson: SuperJson;
  profileAst: ProfileDocumentNode;
  providerJson: ProviderJson;
  mapAst: MapDocumentNode;
}> {
  const superJson = await getSuperJson();
  let profileAst: ProfileDocumentNode;
  let providerJson: ProviderJson;
  let mapAst: MapDocumentNode;

  // TODO move to top, pass as param
  const fs = NodeFileSystem;

  // FIX: errors are trash
  if (!superJson) {
    throw new Error('SJ not found');
  }

  // Load profile
  if (!payload.profile) {
    throw new Error('Profile undefined');
  }
  if (payload.profile instanceof Profile) {
    profileAst = payload.profile.ast;
  } else {
    const profileSettings = superJson.normalized.profiles[payload.profile];
    if (!profileSettings) {
      throw new Error('not defined in profile settings');
    }
    if (!('file' in profileSettings)) {
      throw new Error('file not defined in profile settings');
    }
    const profilePath = superJson.resolvePath(profileSettings.file);

    const content = await fs.readFile(profilePath);

    if (content.isErr()) {
      throw content.error;
    }
    if (profilePath.endsWith('.supr')) {
      profileAst = parseProfile(new Source(content.value, profilePath));
    } else {
      profileAst = assertProfileDocumentNode(JSON.parse(content.value));
    }
  }
  // Load provider

  if (!payload.provider) {
    throw new Error('Provider undefined');
  }
  if (payload.provider instanceof Provider) {
    throw new Error('Provider not valid');
  } else {
    const providerSettings = superJson.normalized.providers[payload.provider];
    if (!providerSettings) {
      throw new Error('not defined provider settings');
    }
    if (!providerSettings.file) {
      throw new Error('file not defined in provider settings');
    }
    const providerPath = superJson.resolvePath(providerSettings.file);

    const content = await fs.readFile(providerPath);

    if (content.isErr()) {
      throw content.error;
    }
    providerJson = assertProviderJson(JSON.parse(content.value));
  }

  // Load map

  const profileProviderSettings =
    superJson.normalized.profiles[profileAstId(profileAst)]?.providers[
      providerJson.name
    ];
  if (!profileProviderSettings) {
    throw new Error('not defined profile provider settings');
  }
  if (!('file' in profileProviderSettings)) {
    throw new Error('file not defined in provider settings');
  }
  const mapPath = superJson.resolvePath(profileProviderSettings.file);

  const content = await fs.readFile(mapPath);

  if (content.isErr()) {
    throw content.error;
  }
  if (mapPath.endsWith('.suma')) {
    mapAst = parseMap(new Source(content.value, mapPath));
  } else {
    mapAst = assertMapDocumentNode(JSON.parse(content.value));
  }

  return {
    superJson,
    profileAst,
    providerJson,
    mapAst,
  };
}
