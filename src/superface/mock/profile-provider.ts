import { ProfileDocumentNode, SecurityValues } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  Config,
  Events,
  NodeCrypto,
  NodeFetch,
  ProfileProvider,
  ProfileProviderConfiguration,
  ProviderConfiguration,
  registerHooks,
  SuperJson,
} from '@superfaceai/one-sdk';

import { mockProfileAST } from './ast';
import { mockFileSystem } from './file-system';
import { MockTimers } from './timers';

export async function createBoundProfileProvider(options?: {
  superJson?: SuperJson;
  profileAst?: ProfileDocumentNode;
  providerConfiguration?: ProviderConfiguration;
  securityValues?: SecurityValues[];
  parameters?: Record<string, string>;
}): Promise<BoundProfileProvider> {
  const crypto = new NodeCrypto();
  const timers = new MockTimers();
  const events = new Events(timers);
  registerHooks(events, timers);
  const fileSystem = mockFileSystem();
  const config = new Config(fileSystem);

  const profileProvider = new ProfileProvider(
    options?.superJson,
    options?.profileAst ?? mockProfileAST,
    options?.providerConfiguration ??
      new ProviderConfiguration(
        'provider',
        options?.securityValues ?? [],
        options?.parameters
      ),
    new ProfileProviderConfiguration(),
    config,
    events,
    fileSystem,
    crypto,
    new NodeFetch(timers)
  );

  return await profileProvider.bind({
    security: options?.securityValues,
  });
}
