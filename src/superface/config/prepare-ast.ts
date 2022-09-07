import {
  assertMapDocumentNode,
  assertProfileDocumentNode,
  EXTENSIONS,
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { IFileSystem, Profile } from '@superfaceai/one-sdk';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import createDebug from 'debug';
import { resolve as resolvePath } from 'path';

import {
  MapUndefinedError,
  ProfileUndefinedError,
  UnexpectedError,
} from '../../common/errors';
import { exists } from '../../common/io';

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

    return await getProfileDocument(profilePath, fileSystem);
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

  return await getMapDocument(mapPath, fileSystem);
}

async function readAst(
  path: string,
  fileSystem: IFileSystem
): Promise<unknown> {
  const content = await fileSystem.readFile(path);

  if (content.isErr()) {
    throw content.error;
  }

  return JSON.parse(content.value) as unknown;
}

async function getProfileDocument(
  path: string,
  fileSystem: IFileSystem
): Promise<ProfileDocumentNode> {
  const isAst = path.endsWith(EXTENSIONS.profile.build);
  const isSource = path.endsWith(EXTENSIONS.profile.source);

  if (isAst) {
    return assertProfileDocumentNode(await readAst(path, fileSystem));
  } else if (isSource) {
    const astPath = path.replace(
      EXTENSIONS.profile.source,
      EXTENSIONS.profile.build
    );
    const astExist = await exists(astPath);

    if (astExist) {
      return assertProfileDocumentNode(await readAst(astPath, fileSystem));
    }

    const content = await fileSystem.readFile(path);

    if (content.isErr()) {
      throw content.error;
    }

    debugSetup('Trying to parse profile:', path);

    return parseProfile(new Source(content.value, path));
  } else {
    throw new UnexpectedError(`Specified path is invalid:\n${path}`);
  }
}

async function getMapDocument(
  path: string,
  fileSystem: IFileSystem
): Promise<MapDocumentNode> {
  const isAst = path.endsWith(EXTENSIONS.map.build);
  const isSource = path.endsWith(EXTENSIONS.map.source);

  if (isAst) {
    return assertMapDocumentNode(await readAst(path, fileSystem));
  } else if (isSource) {
    const astPath = path.replace(EXTENSIONS.map.source, EXTENSIONS.map.build);
    const astExist = await exists(astPath);

    if (astExist) {
      return assertMapDocumentNode(await readAst(astPath, fileSystem));
    }

    const content = await fileSystem.readFile(path);

    if (content.isErr()) {
      throw content.error;
    }

    debugSetup('Trying to parse map:', path);

    return parseMap(new Source(content.value, path));
  } else {
    throw new UnexpectedError(`Specified path is invalid:\n${path}`);
  }
}
