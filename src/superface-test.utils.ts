import { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  Profile,
  Provider,
  SecurityScheme,
  SuperfaceClient,
  SuperJson,
  UnexpectedError,
  UseCase,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';
import { URL } from 'url';

import {
  CompleteSuperfaceTestConfig,
  RecordingDefinition,
  RecordingScope,
  SuperfaceTestConfigPayload,
} from '.';
import {
  ComponentUndefinedError,
  InstanceMissingError,
  SuperJsonNotFoundError,
} from './common/errors';

/**
 * Asserts that entered sfConfig contains only instances of classes not strings.
 */
export function assertsPreparedConfig(
  sfConfig: SuperfaceTestConfigPayload
): asserts sfConfig is CompleteSuperfaceTestConfig {
  assertsPreparedClient(sfConfig.client);
  assertsPreparedProfile(sfConfig.profile);
  assertsPreparedProvider(sfConfig.provider);
  assertsPreparedUseCase(sfConfig.useCase);
}

export function assertsPreparedClient(
  client: SuperfaceClient | undefined
): asserts client is SuperfaceClient {
  if (client === undefined) {
    throw new ComponentUndefinedError('Client');
  }
}

export function assertsPreparedProfile(
  profile: Profile | string | undefined
): asserts profile is Profile {
  if (profile === undefined) {
    throw new ComponentUndefinedError('Profile');
  }

  if (typeof profile === 'string') {
    throw new InstanceMissingError('Profile');
  }
}

export function assertsPreparedProvider(
  provider: Provider | string | undefined
): asserts provider is Provider {
  if (provider === undefined) {
    throw new ComponentUndefinedError('Provider');
  }

  if (typeof provider === 'string') {
    throw new InstanceMissingError('Provider');
  }
}

export function assertsPreparedUseCase(
  useCase: UseCase | string | undefined
): asserts useCase is UseCase {
  if (useCase === undefined) {
    throw new ComponentUndefinedError('UseCase');
  }

  if (typeof useCase === 'string') {
    throw new InstanceMissingError('UseCase');
  }
}

/**
 * Checks whether provider is local and contains some file path.
 */
export function isProviderLocal(
  provider: Provider | string,
  profileId: string | undefined,
  superJsonNormalized: NormalizedSuperJsonDocument
): boolean {
  const providerId = getProviderName(provider);

  if (profileId !== undefined) {
    const targetedProfileProvider =
      superJsonNormalized.profiles[profileId].providers[providerId];

    if (!('file' in targetedProfileProvider)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns profile id if entered profile is either instance of Profile or string
 */
export function getProfileId(profile: Profile | string): string {
  if (typeof profile === 'string') {
    return profile;
  } else {
    return profile.configuration.id;
  }

  // throw new Error('Invalid Profile specified');
}

/**
 * Returns provider id if entered provider is either instance of Provider or string
 */
export function getProviderName(provider: Provider | string): string {
  if (typeof provider === 'string') {
    return provider;
  } else {
    return provider.configuration.name;
  }
}

/**
 * Returns usecase name if entered usecase is either instance of UseCase or string
 */
export function getUseCaseName(useCase: UseCase | string): string {
  if (typeof useCase === 'string') {
    return useCase;
  } else {
    return useCase.name;
  }
}

/**
 * Returns SuperJson based on path detected with its abstract method.
 */
export async function getSuperJson(): Promise<SuperJson> {
  const superPath = await SuperJson.detectSuperJson(process.cwd(), 3);

  if (superPath === undefined) {
    throw new SuperJsonNotFoundError();
  }

  return (await SuperJson.load(joinPath(superPath, 'super.json'))).unwrap();
}

const HIDDEN_CREDENTIALS_PLACEHOLDER =
  'credentials-removed-to-keep-them-secure';
const AUTH_HEADER_NAME = 'Authorization';

export function assertsDefinitionsAreNotStrings(
  definitions: string[] | RecordingDefinition[]
): asserts definitions is RecordingDefinition[] {
  for (const def of definitions) {
    if (typeof def === 'string') {
      throw new UnexpectedError('definition is a string, not object');
    }
  }
}

export async function removeSensitiveInformation(
  sfConfig: CompleteSuperfaceTestConfig,
  payload: {
    definitions?: RecordingDefinition[];
    scopes?: RecordingScope[];
  }
): Promise<void> {
  const {
    configuration: { security, baseUrl },
  } = await sfConfig.client.cacheBoundProfileProvider(
    sfConfig.profile.configuration,
    sfConfig.provider.configuration
  );

  if (payload.definitions) {
    for (const definition of payload.definitions) {
      for (const scheme of security) {
        removeCredentials(definition, scheme, baseUrl);
      }
    }
  }

  if (payload.scopes) {
    for (const scope of payload.scopes) {
      for (const scheme of security) {
        loadCredentials(scope, scheme);
      }
    }
  }
}

export function loadCredentials(
  scope: RecordingScope,
  scheme: SecurityScheme
): void {
  if (isApiKeySecurityScheme(scheme)) {
    if (scheme.in === ApiKeyPlacement.HEADER) {
      // TODO: research scope.matchHeader()
    } else if (scheme.in === ApiKeyPlacement.BODY) {
      // TODO: research scope.filteringRequestBody
    } else {
      if (scheme.in === ApiKeyPlacement.PATH) {
        // TODO: implement scope.filteringPath here
      } else if (scheme.in === ApiKeyPlacement.QUERY) {
        scope = scope.filteringPath(
          new RegExp(`/${scheme.name}=(.*(?=&))/g`),
          `${scheme.name}=${HIDDEN_CREDENTIALS_PLACEHOLDER}`
        );
      }
    }
  } else if (isBasicAuthSecurityScheme(scheme)) {
    // TODO: test this case
  } else if (isBearerTokenSecurityScheme(scheme)) {
    // TODO: test this case as well
  } else if (isDigestSecurityScheme(scheme)) {
    throw new UnexpectedError('not implemented');
  }
}

export function removeCredentials(
  definition: RecordingDefinition,
  scheme: SecurityScheme,
  baseUrl: string
): void {
  if (isApiKeySecurityScheme(scheme)) {
    if (scheme.in === ApiKeyPlacement.HEADER) {
      if (definition.reqheaders?.[scheme.name] !== undefined) {
        definition.reqheaders[scheme.name] = HIDDEN_CREDENTIALS_PLACEHOLDER;
      }
    } else if (scheme.in === ApiKeyPlacement.BODY) {
      if (
        typeof definition.body === 'object' &&
        !(definition.body instanceof RegExp) &&
        !(definition.body instanceof Buffer) &&
        !Array.isArray(definition.body) &&
        !('includes' in definition.body) &&
        definition.body[scheme.name] !== undefined
      ) {
        definition.body[scheme.name] = HIDDEN_CREDENTIALS_PLACEHOLDER;
      }

      // TODO: implement hiding api key from different types of body
    } else {
      const definitionPath = new URL(baseUrl + definition.path);

      if (scheme.in === ApiKeyPlacement.PATH) {
        const regex = new RegExp(`/${scheme.name}=(.*(?=/))/g`);

        definitionPath.pathname.replace(
          regex,
          `${scheme.name}=${HIDDEN_CREDENTIALS_PLACEHOLDER}`
        );
      } else if (scheme.in === ApiKeyPlacement.QUERY) {
        if (definitionPath.searchParams.has(scheme.name)) {
          definitionPath.searchParams.set(
            scheme.name,
            HIDDEN_CREDENTIALS_PLACEHOLDER
          );
        }
      }

      definition.path =
        definitionPath.pathname + definitionPath.search + definitionPath.hash;
    }
  } else if (isBasicAuthSecurityScheme(scheme)) {
    if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      definition.reqheaders[
        AUTH_HEADER_NAME
      ] = `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
    }
  } else if (isBearerTokenSecurityScheme(scheme)) {
    if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      definition.reqheaders[
        AUTH_HEADER_NAME
      ] = `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
    }
  } else if (isDigestSecurityScheme(scheme)) {
    throw new UnexpectedError('not implemented');
  }
}
