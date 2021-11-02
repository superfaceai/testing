import {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  HttpScheme,
  isApiKeySecurityValues,
  SecurityScheme,
  SecurityType,
  SecurityValues,
} from '@superfaceai/ast';
import { RequestBodyMatcher } from 'nock/types';
import { URL } from 'url';

import { RecordingDefinition, RecordingScope } from '.';
import { UnexpectedError } from './common/errors';

export const HIDDEN_CREDENTIALS_PLACEHOLDER =
  'credentials-removed-to-keep-them-secure';
const AUTH_HEADER_NAME = 'Authorization';

function replaceCredential(payload: string, credential: string) {
  return payload.replace(
    new RegExp(credential, 'g'),
    HIDDEN_CREDENTIALS_PLACEHOLDER
  );
}

function removeCredentialInHeader(
  payload: RecordingDefinition,
  credential: string
): void {
  if (payload.reqheaders) {
    const headers = Object.entries(payload.reqheaders).filter(
      ([, value]) =>
        value === credential || value.toString().includes(credential)
    );
    for (const [headerName] of headers) {
      payload.reqheaders[headerName] = HIDDEN_CREDENTIALS_PLACEHOLDER;
    }
  }
}

function removeCredentialInBody(
  payload: RecordingDefinition,
  credential: string
): void {
  if (payload.body !== undefined) {
    let body = JSON.stringify(payload.body);

    body = replaceCredential(body, credential);

    payload.body = JSON.parse(body) as RequestBodyMatcher;
  }
}

function removeCredentialInQuery(
  definition: RecordingDefinition,
  baseUrl: string,
  credential: string
): void {
  const definitionURL = new URL(baseUrl + definition.path);

  for (const [key, queryValue] of definitionURL.searchParams.entries()) {
    if (queryValue === credential || queryValue.includes(credential)) {
      definitionURL.searchParams.set(
        key,
        replaceCredential(queryValue, credential)
      );
    }
  }

  definition.path =
    definitionURL.pathname + definitionURL.search + definitionURL.hash;
}

function removeCredentialInPath(
  payload: RecordingDefinition,
  baseUrl: string,
  credential: string
): void {
  const payloadURL = new URL(baseUrl + payload.path);

  if (
    payloadURL.pathname === credential ||
    payloadURL.pathname.includes(credential)
  ) {
    payloadURL.pathname = replaceCredential(payloadURL.pathname, credential);
  }

  payload.path = payloadURL.pathname + payloadURL.search + payloadURL.hash;
}

function removeApiKeyInHeader(
  definition: RecordingDefinition,
  scheme: ApiKeySecurityScheme,
  loadedCredential: string | undefined
): void {
  if (scheme.name !== undefined) {
    if (definition.reqheaders?.[scheme.name] !== undefined) {
      definition.reqheaders[scheme.name] = HIDDEN_CREDENTIALS_PLACEHOLDER;
    }
  }

  if (loadedCredential) {
    removeCredentialInHeader(definition, loadedCredential);
  }
}

function removeApiKeyInBody(
  definition: RecordingDefinition,
  loadedCredential: string | undefined
): void {
  if (loadedCredential !== undefined) {
    removeCredentialInBody(definition, loadedCredential);
  }
}

function removeApiKeyInPath(
  definition: RecordingDefinition,
  baseUrl: string,
  loadedCredential: string | undefined
): void {
  if (loadedCredential !== undefined) {
    removeCredentialInPath(definition, baseUrl, loadedCredential);
  }
}

function removeApiKeyInQuery(
  definition: RecordingDefinition,
  scheme: ApiKeySecurityScheme,
  baseUrl: string,
  loadedCredential: string | undefined
): void {
  const definitionURL = new URL(baseUrl + definition.path);

  if (
    scheme.name !== undefined &&
    definitionURL.searchParams.has(scheme.name)
  ) {
    definitionURL.searchParams.set(scheme.name, HIDDEN_CREDENTIALS_PLACEHOLDER);
  } else if (loadedCredential !== undefined) {
    removeCredentialInQuery(definition, baseUrl, loadedCredential);
  }

  definition.path =
    definitionURL.pathname + definitionURL.search + definitionURL.hash;
}

function removeApiKey(
  definition: RecordingDefinition,
  scheme: ApiKeySecurityScheme,
  baseUrl: string,
  securityValue?: SecurityValues
): void {
  let loadedCredential: string | undefined;

  if (isApiKeySecurityValues(securityValue)) {
    if (securityValue.apikey.startsWith('$')) {
      loadedCredential = process.env[securityValue.apikey.substr(1)];
    } else {
      loadedCredential = securityValue.apikey;
    }
  }

  if (scheme.in === ApiKeyPlacement.HEADER) {
    removeApiKeyInHeader(definition, scheme, loadedCredential);
  } else if (scheme.in === ApiKeyPlacement.BODY) {
    removeApiKeyInBody(definition, loadedCredential);
  } else if (scheme.in === ApiKeyPlacement.PATH) {
    removeApiKeyInPath(definition, baseUrl, loadedCredential);
  } else if (scheme.in === ApiKeyPlacement.QUERY) {
    removeApiKeyInQuery(definition, scheme, baseUrl, loadedCredential);
  }
}

function removeBasicAuth(definition: RecordingDefinition): void {
  if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
    definition.reqheaders[
      AUTH_HEADER_NAME
    ] = `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
  }
}

function removeBearerAuth(definition: RecordingDefinition): void {
  if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
    definition.reqheaders[
      AUTH_HEADER_NAME
    ] = `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
  }
}

function removeIntegrationParameters(
  definition: RecordingDefinition,
  parameters: Record<string, string>,
  baseUrl: string,
): void {
  for (const parameterValue of Object.values(parameters)) {
    removeCredentialInHeader(definition, parameterValue);
    removeCredentialInBody(definition, parameterValue);
    removeCredentialInPath(definition, baseUrl, parameterValue);
    removeCredentialInQuery(definition, baseUrl, parameterValue);
  }
}

export function removeCredentialsFromDefinition({
  definition,
  scheme,
  baseUrl,
  securityValue,
}: {
  definition: RecordingDefinition;
  scheme: SecurityScheme;
  baseUrl: string;
  securityValue?: SecurityValues;
}): void {
  if (scheme.type === SecurityType.APIKEY) {
    removeApiKey(definition, scheme, baseUrl, securityValue);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.BASIC
  ) {
    removeBasicAuth(definition);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.BEARER
  ) {
    removeBearerAuth(definition);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.DIGEST
  ) {
    throw new UnexpectedError('Digest auth not implemented');
  }
}

export function removeParamsFromDefinition(
  definition: RecordingDefinition,
  integrationParameters: Record<string, string> | undefined,
  baseUrl: string
): void {
  if (integrationParameters !== undefined) {
    removeIntegrationParameters(definition, integrationParameters, baseUrl);
  }
}

export function loadCredentialsToScope({
  scope,
  scheme,
  securityValue,
}: {
  scope: RecordingScope;
  scheme: SecurityScheme;
  securityValue?: SecurityValues;
}): void {
  if (scheme.type === SecurityType.APIKEY) {
    const schemeName = scheme.name ?? AUTH_HEADER_NAME;
    let loadedCredential: string | undefined;

    if (isApiKeySecurityValues(securityValue)) {
      if (securityValue.apikey.startsWith('$')) {
        loadedCredential = process.env[securityValue.apikey.substr(1)];
      } else {
        loadedCredential = securityValue.apikey;
      }
    }

    if (scheme.in === ApiKeyPlacement.BODY) {
      if (loadedCredential !== undefined) {
        scope.filteringRequestBody(
          new RegExp(loadedCredential, 'g'),
          HIDDEN_CREDENTIALS_PLACEHOLDER
        );
      }
    } else if (scheme.in === ApiKeyPlacement.QUERY) {
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
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.DIGEST
  ) {
    throw new UnexpectedError('Digest auth not implemented');
  }
}

export function loadParamsToScope(
  scope: RecordingScope,
  integrationParameters: Record<string, string> | undefined
): void {
  if (integrationParameters !== undefined) {
    const values = Object.values(integrationParameters);

    scope.filteringPath(
      new RegExp(values.join('|'), 'g'),
      HIDDEN_CREDENTIALS_PLACEHOLDER
    );

    scope.filteringRequestBody(
      new RegExp(values.join('|'), 'g'),
      HIDDEN_CREDENTIALS_PLACEHOLDER
    );
  }
}
