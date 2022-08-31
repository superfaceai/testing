import { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import {
  detectSuperJson,
  IEnvironment,
  IFileSystem,
  loadSuperJson,
  NodeEnvironment,
  NodeFileSystem,
  normalizeSuperJsonDocument,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import {
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
} from '../../common/errors';

const debugSetup = createDebug('superface:testing:setup');

/**
 * Returns SuperJson based on path detected with its abstract method.
 */
export async function getSuperJson(options?: {
  fileSystem?: IFileSystem;
  environment?: IEnvironment;
}): Promise<{ path: string; document: NormalizedSuperJsonDocument }> {
  const superPath = await detectSuperJson(
    process.cwd(),
    options?.fileSystem ?? NodeFileSystem,
    3
  );

  if (superPath === undefined) {
    throw new SuperJsonNotFoundError();
  }

  const superJsonResult = await loadSuperJson(
    joinPath(superPath, 'super.json'),
    options?.fileSystem ?? NodeFileSystem
  );

  if (superJsonResult.isErr()) {
    throw new SuperJsonLoadingFailedError(superJsonResult.error);
  }

  debugSetup('SuperJson found on path:', superPath);

  return {
    path: superPath,
    document: normalizeSuperJsonDocument(
      superJsonResult.value,
      options?.environment ?? new NodeEnvironment()
    ),
  };
}
