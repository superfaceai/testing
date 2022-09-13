import { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import {
  Config,
  Events,
  IBoundProfileProvider,
  NodeCrypto,
  Profile,
  ProfileConfiguration,
  SuperCache,
} from '@superfaceai/one-sdk';

import { mockProfileAST } from './ast';
import { mockNodeFetch } from './fetch-instance';
import { mockFileSystem } from './file-system';
import { MockTimers } from './timers';

const crypto = new NodeCrypto();

export function createProfile(options?: {
  superJson?: NormalizedSuperJsonDocument;
  name?: string;
}): Profile {
  const timers = new MockTimers();
  const events = new Events(timers);
  const cache = new SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>();
  const fileSystem = mockFileSystem();
  const config = new Config(fileSystem);
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
    fileSystem,
    cache,
    crypto,
    mockNodeFetch()
  );
}
