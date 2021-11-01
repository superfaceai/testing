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

function removeApiKeyInHeader(
  definition: RecordingDefinition,
  scheme: ApiKeySecurityScheme,
  loadedCredential: string | undefined
) {
  if (scheme.name !== undefined) {
    if (definition.reqheaders?.[scheme.name] !== undefined) {
      definition.reqheaders[scheme.name] = HIDDEN_CREDENTIALS_PLACEHOLDER;
    }
  }

  if (loadedCredential) {
    if (definition.reqheaders) {
      const headers = Object.entries(definition.reqheaders).filter(
        ([, value]) =>
          value === loadedCredential ||
          value.toString().includes(loadedCredential)
      );
      for (const [headerName] of headers) {
        definition.reqheaders[headerName] = HIDDEN_CREDENTIALS_PLACEHOLDER;
      }
    }
  }
}

function removeApiKeyInBody(
  definition: RecordingDefinition,
  loadedCredential: string | undefined
) {
  if (definition.body !== undefined) {
    let body = JSON.stringify(definition.body, null, 2);

    if (loadedCredential !== undefined) {
      body = replaceCredential(body, loadedCredential);
    }

    definition.body = JSON.parse(body) as RequestBodyMatcher;
  }
}

function removeApiKeyInPath(
  definitionURL: URL,
  loadedCredential: string | undefined
) {
  if (loadedCredential !== undefined) {
    definitionURL.pathname = replaceCredential(
      definitionURL.pathname,
      loadedCredential
    );
  }
}

function removeApiKeyInQuery(
  definitionURL: URL,
  scheme: ApiKeySecurityScheme,
  loadedCredential: string | undefined
) {
  if (
    scheme.name !== undefined &&
    definitionURL.searchParams.has(scheme.name)
  ) {
    definitionURL.searchParams.set(scheme.name, HIDDEN_CREDENTIALS_PLACEHOLDER);
  } else if (loadedCredential !== undefined) {
    for (const [key, queryValue] of definitionURL.searchParams.entries()) {
      if (queryValue.includes(loadedCredential)) {
        definitionURL.searchParams.set(
          key,
          replaceCredential(queryValue, loadedCredential)
        );
      }
    }
  }
}

function removeApiKey(
  definition: RecordingDefinition,
  scheme: ApiKeySecurityScheme,
  baseUrl: string,
  securityValue?: SecurityValues
) {
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
  } else {
    const definitionURL = new URL(baseUrl + definition.path);

    if (scheme.in === ApiKeyPlacement.PATH) {
      removeApiKeyInPath(definitionURL, loadedCredential);
    } else if (scheme.in === ApiKeyPlacement.QUERY) {
      removeApiKeyInQuery(definitionURL, scheme, loadedCredential);
    }

    definition.path =
      definitionURL.pathname + definitionURL.search + definitionURL.hash;
  }
}

function removeBasicAuth(definition: RecordingDefinition) {
  if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
    definition.reqheaders[
      AUTH_HEADER_NAME
    ] = `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
  }
}

function removeBearerAuth(definition: RecordingDefinition) {
  if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
    definition.reqheaders[
      AUTH_HEADER_NAME
    ] = `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
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

export function loadCredentials({
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
