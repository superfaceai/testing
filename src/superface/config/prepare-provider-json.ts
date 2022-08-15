import {
  assertProviderJson,
  NormalizedSuperJsonDocument,
  ProviderJson,
} from '@superfaceai/ast';
import { IFileSystem, Provider } from '@superfaceai/one-sdk';
import { dirname, resolve as resolvePath } from 'path';

import { ProviderJsonUndefinedError } from '../../common/errors';

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

  const providerPath = resolvePath(
    dirname(superJson.path),
    providerSettings.file
  );
  const content = await fileSystem.readFile(providerPath);

  if (content.isErr()) {
    throw content.error;
  }

  return assertProviderJson(JSON.parse(content.value));
}
