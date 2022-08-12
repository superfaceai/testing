import {
  assertProviderJson,
  NormalizedSuperJsonDocument,
  ProviderJson,
} from '@superfaceai/ast';
import { IFileSystem, Provider } from '@superfaceai/one-sdk';

import { ProviderJsonUndefinedError } from '../../common/errors';

export async function getProviderJson(
  provider: Provider | string,
  superJson: NormalizedSuperJsonDocument,
  fileSystem: IFileSystem
): Promise<ProviderJson> {
  const providerName =
    provider instanceof Provider ? provider.configuration.name : provider;
  const providerSettings = superJson.providers[providerName];

  if (!providerSettings || !providerSettings.file) {
    throw new ProviderJsonUndefinedError(providerName);
  }

  // superJson.resolvePath(providerSettings.file);
  const providerPath = providerSettings.file;
  const content = await fileSystem.readFile(providerPath);

  if (content.isErr()) {
    throw content.error;
  }

  return assertProviderJson(JSON.parse(content.value));
}
