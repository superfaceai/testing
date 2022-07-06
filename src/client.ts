import { SuperJsonDocument } from '@superfaceai/ast';
import {
  Config,
  Events,
  IBoundProfileProvider,
  IConfig,
  ICrypto,
  IEnvironment,
  IFileSystem,
  ILogger,
  InternalClient,
  noConfiguredProviderError,
  NodeCrypto,
  NodeEnvironment,
  NodeFetch,
  NodeFileSystem,
  NodeLogger,
  NodeTimers,
  Profile,
  Provider,
  ProviderConfiguration,
  registerHooks,
  SuperCache,
  SuperJson,
  unconfiguredProviderError,
} from '@superfaceai/one-sdk';

export interface ISuperfaceClient {
  readonly superJson: SuperJson;
  readonly boundProfileProviderCache: SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>;

  getProfile(profileId: string): Promise<Profile>;
  getProvider(providerName: string): Promise<Provider>;
  getProviderForProfile(profileId: string): Promise<Provider>;
  on(...args: Parameters<Events['on']>): void;
}

/**
 * Internal Superface client for testing
 * @internal
 */
export class TestClient implements ISuperfaceClient {
  public readonly superJson: SuperJson;
  public readonly boundProfileProviderCache: SuperCache<{
    provider: IBoundProfileProvider;
    expiresAt: number;
  }>;

  public config: Config;
  public events: Events;
  public environment: IEnvironment;
  public internalClient: InternalClient;
  public logger?: ILogger;
  public timers: NodeTimers;
  public crypto: ICrypto;

  constructor(
    superJson?: SuperJson | SuperJsonDocument,
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

    this.boundProfileProviderCache = new SuperCache<{
      provider: IBoundProfileProvider;
      expiresAt: number;
    }>();

    let fileSystem: IFileSystem = NodeFileSystem;

    if (parameters?.fileSystemOverride !== undefined) {
      fileSystem = {
        ...fileSystem,
        ...parameters.fileSystemOverride,
      };
    }

    this.superJson = resolveSuperJson(
      this.config.superfacePath,
      this.environment,
      this.crypto,
      superJson,
      this.logger
    );

    this.internalClient = new InternalClient(
      this.events,
      this.superJson,
      this.config,
      this.timers,
      fileSystem,
      this.boundProfileProviderCache,
      this.crypto,
      new NodeFetch(this.timers),
      this.logger
    );
  }

  // public addBoundProfileProvider(
  //   profile: ProfileDocumentNode,
  //   map: MapDocumentNode,
  //   providerJson: ProviderJson,
  //   baseUrl: string,
  //   securityValues: SecurityConfiguration[] = [],
  //   profileConfigOverride?: ProfileConfiguration
  // ): void {
  //   const providerConfiguration = new ProviderConfiguration(
  //     providerJson.name,
  //     []
  //   );
  //   const boundProfileProvider = new BoundProfileProvider(
  //     profile,
  //     map,
  //     providerJson,
  //     this.config,
  //     {
  //       services: ServiceSelector.withDefaultUrl(baseUrl),
  //       security: securityValues,
  //     },
  //     this.crypto,
  //     new NodeFetch(this.timers),
  //     this.logger,
  //     this.events
  //   );

  //   const profileId = ProfileId.fromParameters({
  //     scope: profile.header.scope,
  //     name: profile.header.name,
  //     version: ProfileVersion.fromParameters(profile.header.version),
  //   });
  //   const profileConfiguration =
  //     profileConfigOverride ??
  //     new ProfileConfiguration(
  //       profileId.withoutVersion,
  //       profileId.version?.toString() ?? 'unknown'
  //     );

  //   this.cache.getCached(
  //     profileConfiguration.cacheKey + providerConfiguration.cacheKey,
  //     () => ({ provider: boundProfileProvider, expiresAt: Infinity })
  //   );
  // }

  public on(...args: Parameters<Events['on']>): void {
    this.events.on(...args);
  }

  public getProfile(profileId: string): Promise<Profile> {
    return this.internalClient.getProfile(profileId);
  }

  public async getProvider(providerName: string): Promise<Provider> {
    return getProvider(this.superJson, providerName);
  }

  public async getProviderForProfile(profileId: string): Promise<Provider> {
    return getProviderForProfile(this.superJson, profileId);
  }
}

const resolveSuperJson = (
  path: string,
  environment: IEnvironment,
  crypto: ICrypto,
  superJson?: SuperJson | SuperJsonDocument,
  logger?: ILogger
): SuperJson => {
  if (superJson === undefined) {
    return SuperJson.loadSync(
      path,
      NodeFileSystem,
      environment,
      crypto,
      logger
    ).unwrap();
  }

  if (superJson instanceof SuperJson) {
    return superJson;
  }

  return new SuperJson(superJson);
};

export function getProvider(
  superJson: SuperJson,
  providerName: string
): Provider {
  const providerSettings = superJson.normalized.providers[providerName];

  if (providerSettings === undefined) {
    throw unconfiguredProviderError(providerName);
  }

  return new Provider(
    new ProviderConfiguration(providerName, providerSettings.security)
  );
}

export function getProviderForProfile(
  superJson: SuperJson,
  profileId: string
): Provider {
  const priorityProviders =
    superJson.normalized.profiles[profileId]?.priority ?? [];
  if (priorityProviders.length > 0) {
    const name = priorityProviders[0];

    return getProvider(superJson, name);
  }

  const knownProfileProviders = Object.keys(
    superJson.normalized.profiles[profileId]?.providers ?? {}
  );
  if (knownProfileProviders.length > 0) {
    const name = knownProfileProviders[0];

    return getProvider(superJson, name);
  }

  throw noConfiguredProviderError(profileId);
}
