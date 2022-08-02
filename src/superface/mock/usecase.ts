import { SecurityValues } from '@superfaceai/ast';
import {
  Config,
  Events,
  IBoundProfileProvider,
  NodeCrypto,
  NodeFetch,
  PerformError,
  ProviderConfiguration,
  registerHooks,
  Result,
  SuperCache,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';

import { mockFileSystem } from './file-system';
import { createProfile } from './profile';
import { createBoundProfileProvider } from './profile-provider';
import { MockTimers } from './timers';

export async function createUseCase(options?: {
  cacheExpire?: number;
  superJson?: SuperJson;
  isOk?: boolean;
  isErr?: boolean;
  result?: Result<unknown, PerformError>;
  securityValues?: SecurityValues[];
  parameters?: Record<string, string>;
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
  const boundProfileProvider = await createBoundProfileProvider({
    securityValues: options?.securityValues,
  });

  const mockProviderConfiguration = new ProviderConfiguration(
    'provider',
    options?.securityValues ?? [],
    options?.parameters
  );
  cache.getCached(
    profile.configuration.cacheKey + mockProviderConfiguration.cacheKey,
    () => ({
      provider: boundProfileProvider,
      expiresAt: options?.cacheExpire ?? Infinity,
    })
  );

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
    new NodeFetch(timers)
  );
}
