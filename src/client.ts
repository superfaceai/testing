import {
  AuthCache,
  BoundProfileProvider,
  Config,
  Events,
  IBoundProfileProvider,
  IConfig,
  ICrypto,
  IEnvironment,
  IFetch,
  IFileSystem,
  ILogger,
  Interceptable,
  InternalClient,
  NodeCrypto,
  NodeEnvironment,
  NodeFetch,
  NodeFileSystem,
  NodeLogger,
  NodeTimers,
  Profile,
  ProfileProvider,
  ProfileProviderConfiguration,
  Provider,
  ProviderConfiguration,
  registerHooks,
  SecurityConfiguration,
  SuperCache,
  SuperJson,
  unconfiguredProviderError,
} from '@superfaceai/one-sdk';

import { CompleteSuperfaceTestConfig } from './superface-test.interfaces';

export interface ISuperfaceClient {
  readonly superJson: SuperJson | undefined;
  readonly cache: SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>;

  config: Config;
  events: Events;
  fileSystem: IFileSystem;
  crypto: ICrypto;
  fetchInstance: IFetch & Interceptable & AuthCache;

  getProfile(profileId: string): Promise<Profile>;
  getProvider(providerName: string): Promise<Provider>;
  on(...args: Parameters<Events['on']>): void;

  addBoundProfileProvider(
    config: CompleteSuperfaceTestConfig,
    securityValues?: SecurityConfiguration[]
  ): Promise<BoundProfileProviderConfiguration>;
}

export type BoundProfileProviderConfiguration = ConstructorParameters<
  typeof BoundProfileProvider
>[4];

/**
 * Internal Superface client for testing
 * @internal
 */
export class TestClient implements ISuperfaceClient {
  public readonly cache: SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>;

  public fetchInstance: IFetch & Interceptable & AuthCache;
  public config: Config;
  public fileSystem: IFileSystem;
  public events: Events;
  public environment: IEnvironment;
  public internalClient: InternalClient;
  public logger?: ILogger;
  public timers: NodeTimers;
  public crypto: ICrypto;

  constructor(
    public readonly superJson: SuperJson | undefined,
    parameters?: {
      configOverride?: Partial<IConfig>;
      fileSystemOverride?: Partial<IFileSystem>;
    }
  ) {
    this.logger = new NodeLogger();
    this.crypto = new NodeCrypto();
    this.environment = new NodeEnvironment();
    this.timers = new NodeTimers();
    this.config = new Config(NodeFileSystem, {
      disableReporting: true,
      ...parameters?.configOverride,
    });
    this.events = new Events(this.timers, this.logger);
    registerHooks(this.events, this.timers, this.logger);

    this.cache = new SuperCache<{
      provider: IBoundProfileProvider;
      expiresAt: number;
    }>();

    this.fileSystem = NodeFileSystem;

    if (parameters?.fileSystemOverride !== undefined) {
      this.fileSystem = {
        ...this.fileSystem,
        ...parameters.fileSystemOverride,
      };
    }

    this.fetchInstance = new NodeFetch(this.timers);

    this.internalClient = new InternalClient(
      this.events,
      this.superJson,
      this.config,
      this.timers,
      this.fileSystem,
      this.cache,
      this.crypto,
      this.fetchInstance,
      this.logger
    );
  }

  public async addBoundProfileProvider(
    { profile, provider }: CompleteSuperfaceTestConfig,
    securityValues?: SecurityConfiguration[]
  ): Promise<BoundProfileProviderConfiguration> {
    const profileProvider = new ProfileProvider(
      this.superJson,
      profile.ast,
      provider.configuration,
      new ProfileProviderConfiguration(),
      this.config,
      this.events,
      this.fileSystem,
      this.crypto,
      this.fetchInstance
    );

    // get bound profile provider
    const boundProfileProvider = await profileProvider.bind({
      security: securityValues,
    });

    // put created profile provider into cache
    this.cache.getCached(
      profile.configuration.cacheKey + provider.configuration.cacheKey,
      () => ({ provider: boundProfileProvider, expiresAt: Infinity })
    );

    return boundProfileProvider.configuration;
  }

  public on(...args: Parameters<Events['on']>): void {
    this.events.on(...args);
  }

  public getProfile(profileId: string): Promise<Profile> {
    return this.internalClient.getProfile(profileId);
  }

  public async getProvider(providerName: string): Promise<Provider> {
    return getProvider(this.superJson, providerName);
  }

}

export function getProvider(
  superJson: SuperJson | undefined,
  providerName: string
): Provider {
  if (superJson) {
    const providerSettings = superJson.normalized.providers[providerName];

    if (providerSettings === undefined) {
      throw unconfiguredProviderError(providerName);
    }

    return new Provider(
      new ProviderConfiguration(providerName, providerSettings.security)
    );
  }

  return new Provider(new ProviderConfiguration(providerName, []));
}
