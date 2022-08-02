import {
  Config,
  Events,
  IBoundProfileProvider,
  NodeCrypto,
  NodeFetch,
  Profile,
  ProfileConfiguration,
  SuperCache,
  SuperJson,
} from '@superfaceai/one-sdk';

import { mockProfileAST } from './ast';
import { mockFileSystem } from './file-system';
import { MockTimers } from './timers';

const crypto = new NodeCrypto();

export function createProfile(options?: {
  superJson?: SuperJson;
  name?: string;
}): Profile {
  const timers = new MockTimers();
  const events = new Events(timers);
  const cache = new SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>();
  const config = new Config(mockFileSystem());
  const ast = mockProfileAST;
  const configuration = new ProfileConfiguration(
    options?.name ?? 'profile',
    '1.0.0'
  );

  return new Profile(
    configuration,
    ast,
    events,
    options?.superJson ?? undefined,
    config,
    timers,
    mockFileSystem(),
    cache,
    crypto,
    new NodeFetch(timers)
  );
}
