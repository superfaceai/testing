import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { IFileSystem, Profile } from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import createDebug from 'debug';
import { resolve as resolvePath } from 'path';

import { MapUndefinedError, ProfileUndefinedError } from '../../common/errors';

const debugSetup = createDebug('superface:testing:setup');

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

    const profilePath = resolvePath(superJson.path, profileSettings.file);

    debugSetup('Found profile settings in super.json:', profileSettings);
    debugSetup('Profile resolved path:', profilePath);

    const content = await fileSystem.readFile(profilePath);

    if (content.isErr()) {
      throw content.error;
    }

    // TODO: make parser optional
    if (profilePath.endsWith('.supr')) {
      debugSetup('Trying to parse profile:', profilePath);

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

  const mapPath = resolvePath(superJson.path, profileProviderSettings.file);

  debugSetup(
    'Found profile provider settings in super.json:',
    profileProviderSettings
  );
  debugSetup('Map resolved path:', mapPath);

  const content = await fileSystem.readFile(mapPath);

  if (content.isErr()) {
    throw content.error;
  }

  // TODO: make parser optional
  if (mapPath.endsWith('.suma')) {
    debugSetup('Trying to parse map:', mapPath);

    return parseMap(new Source(content.value, mapPath));
  } else {
    return assertMapDocumentNode(JSON.parse(content.value));
  }
}
