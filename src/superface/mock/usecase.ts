import {
  Config,
  Events,
  IBoundProfileProvider,
  NodeCrypto,
  PerformError,
  registerHooks,
  Result,
  SuperCache,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';
import { mockNodeFetch } from './fetch-instance';

import { mockFileSystem } from './file-system';
import { createProfile } from './profile';
import { ProviderOptions } from './superface.mock';
import { MockTimers } from './timers';

export async function createUseCase(options?: {
  cacheExpire?: number;
  superJson?: SuperJson;
  isOk?: boolean;
  isErr?: boolean;
  result?: Result<unknown, PerformError>;
  provider?: ProviderOptions
}): Promise<UseCase> {
  const crypto = new NodeCrypto();
  const timers = new MockTimers();
  const events = new Events(timers);
  registerHooks(events, timers);
  const cache = new SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>();
  const fileSystem = mockFileSystem();
  const config = new Config(fileSystem);

  const profile = createProfile();

  return new UseCase(
    profile,
    'usecase',
    events,
    config,
    options?.superJson ?? undefined,
    timers,
    fileSystem,
    crypto,
    cache,
    mockNodeFetch()
  );
}
