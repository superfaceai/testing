import {
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  AuthCache,
  BoundProfileProvider,
  Config,
  Events,
  ICrypto,
  IFetch,
  ILogger,
  Interceptable,
  ITimers,
  NodeCrypto,
  NodeFetch,
  NodeFileSystem,
  NodeLogger,
  NodeSandbox,
  NodeTimers,
  profileAstId,
  resolveSecurityConfiguration,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import { resolveIntegrationParameters } from '@superfaceai/one-sdk/dist/core/profile-provider/parameters';
import { ISandbox } from '@superfaceai/one-sdk/dist/interfaces/sandbox';

// This deals only with BoundProfileProvider instance creation, it should NOT be exported from directory.
export function createBoundProfileProvider({
  superJson,
  profileAst,
  mapAst,
  providerJson,
  options,
  configOptions,
}: {
  superJson: NormalizedSuperJsonDocument;
  profileAst: ProfileDocumentNode;
  mapAst: MapDocumentNode;
  providerJson: ProviderJson;
  options?: {
    crypto?: ICrypto;
    fetchInstance?: IFetch & Interceptable & AuthCache;
    logger?: ILogger;
    timers?: ITimers;
    sandbox?: ISandbox;
  };
  configOptions?: {
    cachePath?: string;
    disableReporting?: boolean;
    metricDebounceTimeMax?: number;
    metricDebounceTimeMin?: number;
    sandboxTimeout?: number;
    sdkAuthToken?: string;
    superfaceApiUrl?: string;
    superfaceCacheTimeout?: number;
    superfacePath?: string;
    debug?: boolean;
    cache?: boolean;
  };
}): BoundProfileProvider {
  const crypto = options?.crypto ?? new NodeCrypto();
  const timers = options?.timers ?? new NodeTimers();
  const logger = options?.logger ?? new NodeLogger();
  const sandbox = options?.sandbox ?? new NodeSandbox();
  const fetchInstance = options?.fetchInstance ?? new NodeFetch(timers);
  const events = new Events(timers, logger);
  const config = new Config(NodeFileSystem, {
    disableReporting: true,
    ...configOptions,
  });

  return new BoundProfileProvider(
    profileAst,
    mapAst,
    providerJson,
    config,
    sandbox,
    {
      services: new ServiceSelector(
        providerJson.services,
        providerJson.defaultService
      ),
      profileProviderSettings:
        superJson.profiles[profileAstId(profileAst)].providers[
        providerJson.name
        ],
      security: resolveSecurityConfiguration(
        providerJson.securitySchemes ?? [],
        superJson.providers[providerJson.name].security ?? [],
        providerJson.name
      ),
      parameters: resolveIntegrationParameters(
        providerJson,
        superJson?.providers[providerJson.name]?.parameters
      ),
    },
    crypto,
    fetchInstance,
    logger,
    events
  );
}
