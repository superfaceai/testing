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
import { mockNodeSandbox } from './sandbox-instance';
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
  const fetch = mockNodeFetch();
  const ast = mockProfileAST;
  const configuration = new ProfileConfiguration(
    options?.name ?? 'profile',
    '1.0.0'
  );
  const sandbox = mockNodeSandbox();

  return new Profile(
    configuration,
    ast,
    events,
    options?.superJson ?? undefined,
    config,
    sandbox,
    timers,
    fileSystem,
    cache,
    crypto,
    fetch,
  );
}
