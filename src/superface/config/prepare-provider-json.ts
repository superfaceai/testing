import {
  assertProviderJson,
  NormalizedSuperJsonDocument,
  ProviderJson,
} from '@superfaceai/ast';
import { IFileSystem, Provider } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { resolve as resolvePath } from 'path';

import { ProviderJsonUndefinedError } from '../../common/errors';

const debugSetup = createDebug('superface:testing:setup');

export async function getProviderJson(
  provider: Provider | string,
  superJson: { path: string; document: NormalizedSuperJsonDocument },
  fileSystem: IFileSystem
): Promise<ProviderJson> {
  const providerName =
    provider instanceof Provider ? provider.configuration.name : provider;
  const providerSettings = superJson.document.providers[providerName];

  if (!providerSettings || !providerSettings.file) {
    throw new ProviderJsonUndefinedError(providerName);
  }

  const providerPath = resolvePath(superJson.path, providerSettings.file);

  debugSetup('Found provider settings in super.json:', providerSettings);
  debugSetup('ProviderJson resolved path:', providerPath);

  const content = await fileSystem.readFile(providerPath);

  if (content.isErr()) {
    throw content.error;
  }

  return assertProviderJson(JSON.parse(content.value));
}
