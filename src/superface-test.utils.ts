import {
  ApiKeyPlacement,
  isApiKeySecurityScheme,
  isApiKeySecurityValues,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  NormalizedSuperJsonDocument,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  Profile,
  Provider,
  SuperfaceClient,
  SuperJson,
  UnexpectedError,
  UseCase,
} from '@superfaceai/one-sdk';
import nock from 'nock/types';
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
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
} from './common/errors';

/**
 * Asserts that entered sfConfig contains every component and
 * that every component is instance of corresponding class not string.
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
  profileId: string,
  superJsonNormalized: NormalizedSuperJsonDocument
): boolean {
  const providerId = getProviderName(provider);
  const targetedProfileProvider =
    superJsonNormalized.profiles[profileId].providers[providerId];

  if (!('file' in targetedProfileProvider)) {
    return false;
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

  const superJsonResult = await SuperJson.load(
    joinPath(superPath, 'super.json')
  );

  if (superJsonResult.isErr()) {
    throw new SuperJsonLoadingFailedError(superJsonResult.error);
  }

  return superJsonResult.value;
}

export const HIDDEN_CREDENTIALS_PLACEHOLDER =
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

export async function removeOrLoadCredentials({
  securitySchemes,
  securityValues,
  baseUrl,
  payload,
}: {
  securitySchemes: SecurityScheme[];
  securityValues: SecurityValues[];
  baseUrl: string;
  payload: {
    definitions?: RecordingDefinition[];
    scopes?: RecordingScope[];
  };
}): Promise<void> {
  if (payload.definitions) {
    for (const definition of payload.definitions) {
      for (const scheme of securitySchemes) {
        const securityValue = securityValues.find(val => val.id === scheme.id);
        removeCredentials({ definition, scheme, securityValue, baseUrl });
      }
    }
  }

  if (payload.scopes) {
    for (const scope of payload.scopes) {
      for (const scheme of securitySchemes) {
        const securityValue = securityValues.find(val => val.id === scheme.id);
        loadCredentials({ scope, scheme, securityValue });
      }
    }
  }
}

export function loadCredentials({
  scope,
  scheme,
  securityValue,
}: {
  scope: RecordingScope;
  scheme: SecurityScheme;
  securityValue?: SecurityValues;
}): void {
  if (isApiKeySecurityScheme(scheme)) {
    const schemeName = scheme.name ?? AUTH_HEADER_NAME;
    let loadedCredential: string | undefined;

    if (isApiKeySecurityValues(securityValue)) {
      if (securityValue.apikey.startsWith('$')) {
        loadedCredential = process.env[securityValue.apikey.substr(1)];
      } else {
        loadedCredential = securityValue.apikey;
      }
    }

    if (scheme.in === ApiKeyPlacement.QUERY) {
      scope.filteringPath(
        new RegExp(schemeName + '([^&#]+)', 'g'),
        `${schemeName}=${HIDDEN_CREDENTIALS_PLACEHOLDER}`
      );
    } else if (scheme.in === ApiKeyPlacement.PATH) {
      if (loadedCredential !== undefined) {
        scope.filteringPath(
          new RegExp(loadedCredential, 'g'),
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      }
    }
    // if (scheme.in === ApiKeyPlacement.HEADER) {
    //   // TODO: research scope.matchHeader()
    // } else if (scheme.in === ApiKeyPlacement.BODY) {
    //   // TODO: research scope.filteringRequestBody
    // } else if (isBasicAuthSecurityScheme(scheme)) {
    //   // TODO: test this case
    // } else if (isBearerTokenSecurityScheme(scheme)) {
    //   // TODO: test this case as well
  } else if (isDigestSecurityScheme(scheme)) {
    throw new UnexpectedError('not implemented');
  }
}

export function removeCredentials({
  definition,
  scheme,
  securityValue,
  baseUrl,
}: {
  definition: RecordingDefinition;
  scheme: SecurityScheme;
  securityValue?: SecurityValues;
  baseUrl: string;
}): void {
  if (isApiKeySecurityScheme(scheme)) {
    const schemeName = scheme.name ?? AUTH_HEADER_NAME;
    let loadedCredential: string | undefined;

    if (isApiKeySecurityValues(securityValue)) {
      if (securityValue.apikey.startsWith('$')) {
        loadedCredential = process.env[securityValue.apikey.substr(1)];
      } else {
        loadedCredential = securityValue.apikey;
      }
    }

    if (scheme.in === ApiKeyPlacement.HEADER) {
      if (definition.reqheaders?.[schemeName] !== undefined) {
        definition.reqheaders[schemeName] = HIDDEN_CREDENTIALS_PLACEHOLDER;
      }
    } else if (scheme.in === ApiKeyPlacement.BODY) {
      if (definition.body !== undefined) {
        let body = JSON.stringify(definition.body, null, 2);

        if (loadedCredential !== undefined) {
          body = body.replace(
            new RegExp(loadedCredential, 'g'),
            HIDDEN_CREDENTIALS_PLACEHOLDER
          );
        }

        definition.body = JSON.parse(body) as nock.RequestBodyMatcher;
      }
    } else {
      const definitionPath = new URL(baseUrl + definition.path);

      if (scheme.in === ApiKeyPlacement.PATH) {
        if (loadedCredential !== undefined) {
          definitionPath.pathname = definitionPath.pathname.replace(
            new RegExp(loadedCredential, 'g'),
            HIDDEN_CREDENTIALS_PLACEHOLDER
          );
        }
      } else if (scheme.in === ApiKeyPlacement.QUERY) {
        if (definitionPath.searchParams.has(schemeName)) {
          definitionPath.searchParams.set(
            schemeName,
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
