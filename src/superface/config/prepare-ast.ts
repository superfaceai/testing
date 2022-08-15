import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { IFileSystem, Profile } from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import { dirname, resolve as resolvePath } from 'path';

import { MapUndefinedError, ProfileUndefinedError } from '../../common/errors';

export async function getProfileAst(
  profile: Profile | string,
  superJson: { path: string; document: NormalizedSuperJsonDocument },
  fileSystem: IFileSystem
): Promise<ProfileDocumentNode> {
  if (profile instanceof Profile) {
    return profile.ast;
  } else {
    const profileSettings = superJson.document.profiles[profile];

    if (!profileSettings || !('file' in profileSettings)) {
      throw new ProfileUndefinedError(profile);
    }

    const profilePath = resolvePath(
      dirname(superJson.path),
      profileSettings.file
    );
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
  superJson: { path: string; document: NormalizedSuperJsonDocument },
  fileSystem: IFileSystem
): Promise<MapDocumentNode> {
  const profileProviderSettings =
    superJson.document.profiles[profileId]?.providers[providerName];

  if (!profileProviderSettings || !('file' in profileProviderSettings)) {
    throw new MapUndefinedError(profileId, providerName);
  }

  const mapPath = resolvePath(
    dirname(superJson.path),
    profileProviderSettings.file
  );
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
