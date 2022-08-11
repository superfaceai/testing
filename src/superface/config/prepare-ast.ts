import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { IFileSystem, Profile, SuperJson } from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import { MapUndefinedError, ProfileUndefinedError } from '../../common/errors';

export async function getProfileAst(
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

    // TODO: make parser optional
    if (profilePath.endsWith('.supr')) {
      return parseProfile(new Source(content.value, profilePath));
    } else {
      return assertProfileDocumentNode(JSON.parse(content.value));
    }
  }
}

export async function getMapAst(
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

  // TODO: make parser optional
  if (mapPath.endsWith('.suma')) {
    return parseMap(new Source(content.value, mapPath));
  } else {
    return assertMapDocumentNode(JSON.parse(content.value));
  }
}
