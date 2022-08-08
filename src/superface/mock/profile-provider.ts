import {
  BoundProfileProvider,
  Config,
  Events,
  IFileSystem,
  NodeCrypto,
  ProfileProvider,
  ProfileProviderConfiguration,
  ProviderConfiguration,
  registerHooks,
  SuperJson,
} from '@superfaceai/one-sdk';

import { mockProfileAST } from './ast';
import { MockFetchOptions, mockNodeFetch } from './fetch-instance';
import { mockFileSystem } from './file-system';
import { ProfileOptions, ProviderOptions } from './superface.mock';
import { MockTimers } from './timers';

export async function createBoundProfileProvider(options?: {
  superJson?: SuperJson;
  profile?: ProfileOptions;
  provider?: ProviderOptions;
  fileSystemOverride?: Partial<IFileSystem>;
  fetchOptions?: MockFetchOptions;
}): Promise<BoundProfileProvider> {
  const crypto = new NodeCrypto();
  const timers = new MockTimers();
  const events = new Events(timers);
  registerHooks(events, timers);
  const fileSystem = mockFileSystem(options?.fileSystemOverride);
  const config = new Config(fileSystem);

  const profileProvider = new ProfileProvider(
    options?.superJson,
    options?.profile?.ast ?? mockProfileAST,
    new ProviderConfiguration(
      'provider',
      options?.provider?.securityValues ?? [],
      options?.provider?.parameters
    ),
    new ProfileProviderConfiguration(),
    config,
    events,
    fileSystem,
    crypto,
    mockNodeFetch(options?.fetchOptions)
  );

  return await profileProvider.bind({
    security: options?.provider?.securityValues,
  });

  // return new BoundProfileProvider(
  //   options?.profile?.ast ?? mockProfileAST,
  //   options?.provider?.ast ?? mockMapAST,
  //   {
  //     name: options?.provider?.name ?? 'provider',
  //     services: options?.provider?.providerServices ?? [],
  //     securitySchemes: options?.provider?.securitySchemes,
  //     parameters: options?.provider?.intParameters,
  //     defaultService: options?.provider?.defaultService ?? 'service',
  //   },
  //   config,
  //   {
  //     profileProviderSettings: { file: '', defaults: {} },
  //     security: options?.provider?.securityConfigs ?? [],
  //     services:
  //       options?.provider?.serviceSelector ??
  //       new ServiceSelector(options?.provider?.providerServices ?? []),
  //   },
  //   crypto,
  //   mockNodeFetch()
  // );
}
