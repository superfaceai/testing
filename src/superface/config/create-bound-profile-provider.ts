import {
  MapDocumentNode,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import {
  BoundProfileProvider,
  Config,
  Events,
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
}: {
  superJson: SuperJson;
  profileAst: ProfileDocumentNode;
  mapAst: MapDocumentNode;
  providerJson: ProviderJson;
}): BoundProfileProvider {
  // TODO: pass as params
  const crypto = new NodeCrypto();
  const timers = new NodeTimers();
  const logger = new NodeLogger();
  const events = new Events(timers, logger);

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
    new NodeFetch(timers),
    logger,
    events
  );
}
