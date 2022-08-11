import {
  MapDocumentNode,
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
  NodeTimers,
  profileAstId,
  resolveSecurityConfiguration,
  ServiceSelector,
  SuperJson,
} from '@superfaceai/one-sdk';
// TODO: export from SDK?
import { resolveIntegrationParameters } from '@superfaceai/one-sdk/dist/core/profile-provider/parameters';

// This deals only with BoundProfileProvider instance creation, it should NOT be exported from directory.
export function createBoundProfileProvider({
  superJson,
  profileAst,
  mapAst,
  providerJson,
  options,
}: {
  superJson: SuperJson;
  profileAst: ProfileDocumentNode;
  mapAst: MapDocumentNode;
  providerJson: ProviderJson;
  options?: {
    crypto?: ICrypto;
    timers?: ITimers;
    logger?: ILogger;
    fetchInstance?: IFetch & Interceptable & AuthCache;
  };
}): BoundProfileProvider {
  // TODO: pass as params
  const crypto = options?.crypto ?? new NodeCrypto();
  const timers = options?.timers ?? new NodeTimers();
  const logger = options?.logger ?? new NodeLogger();
  const events = new Events(timers, logger);
  const fetchInstance = options?.fetchInstance ?? new NodeFetch(timers);

  return new BoundProfileProvider(
    profileAst,
    mapAst,
    providerJson,
    new Config(NodeFileSystem, {
      disableReporting: true,
      //More params from parameters
    }),
    {
      services: new ServiceSelector(
        providerJson.services,
        providerJson.defaultService
      ),
      profileProviderSettings:
        superJson.normalized.profiles[profileAstId(profileAst)].providers[
          providerJson.name
        ],
      security: resolveSecurityConfiguration(
        providerJson.securitySchemes ?? [],
        superJson.normalized.providers[providerJson.name].security ?? [],
        providerJson.name
      ),
      parameters: resolveIntegrationParameters(
        providerJson,
        superJson?.normalized.providers[providerJson.name]?.parameters
      ),
    },
    crypto,
    fetchInstance,
    logger,
    events
  );
}
