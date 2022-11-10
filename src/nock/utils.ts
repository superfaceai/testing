import {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  ApiKeySecurityValues,
  DigestSecurityScheme,
  DigestSecurityValues,
  HttpScheme,
  SecurityType,
} from '@superfaceai/ast';
import { SecurityConfiguration } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { ReplyBody, RequestBodyMatcher } from 'nock/types';
import { URL } from 'url';

import { RecordingDefinition } from '..';
import { getResponseHeaderValue } from './recorder.utils';

interface ReplaceOptions {
  definition: RecordingDefinition;
  credential: string;
  placeholder: string;
}

const debug = createDebug('superface:testing:recordings');
const debugSensitive = createDebug('superface:testing:recordings:sensitive');
debugSensitive(
  `
WARNING: YOU HAVE ALLOWED LOGGING SENSITIVE INFORMATION.
THIS LOGGING LEVEL DOES NOT PREVENT LEAKING SECRETS AND SHOULD NOT BE USED IF THE LOGS ARE GOING TO BE SHARED.
CONSIDER DISABLING SENSITIVE INFORMATION LOGGING BY APPENDING THE DEBUG ENVIRONMENT VARIABLE WITH ",-*:sensitive".
`
);

const AUTH_HEADER_NAME = 'Authorization';
const WWW_AUTH_HEADER_NAME = 'WWW-Authenticate';

const replace = (
  payload: string,
  credential: string,
  placeholder: string
): string =>
  payload.replace(
    new RegExp(`${credential}|${encodeURIComponent(credential)}`, 'g'),
    placeholder
  );

const includes = (payload: string, credential: string): boolean =>
  payload.includes(credential) ||
  payload.includes(encodeURIComponent(credential));

function replaceCredential({
  payload,
  credential,
  placeholder,
}: {
  payload: string;
  credential: string;
  placeholder: string;
}): string {
  if (credential !== '') {
    debugSensitive(
      `Replacing credential: '${credential}' for placeholder: '${placeholder}'`
    );

    return replace(payload, credential, placeholder);
  }

  return payload;
}

function replaceCredentialInHeaders({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  if (definition.reqheaders) {
    const headers = Object.entries(definition.reqheaders).filter(([, value]) =>
      includes(value.toString(), credential)
    );

    for (const [headerName, headerValue] of headers) {
      debug('Replacing credentials in request header');
      debugSensitive('Request header name:', headerName);
      debugSensitive('Request header value:', headerValue);

      definition.reqheaders[headerName] = replaceCredential({
        payload: headerValue.toString(),
        credential,
        placeholder,
      });
    }
  }
}

function replaceCredentialInRawHeaders({
  definition,
  credential,
  placeholder,
  security,
}: ReplaceOptions & {
  security?: SecurityConfiguration;
}): void {
  if (definition.rawHeaders) {
    if (
      security?.type === SecurityType.HTTP &&
      security.scheme === HttpScheme.DIGEST
    ) {
      const { authorizationHeader, challengeHeader } = security;

      const supportedHeaders = new Set([
        AUTH_HEADER_NAME,
        WWW_AUTH_HEADER_NAME,
        authorizationHeader,
        challengeHeader,
      ]);

      for (const header of supportedHeaders) {
        const index = definition.rawHeaders.findIndex(
          rawHeader => rawHeader.toLowerCase() === header?.toLowerCase()
        );

        if (index !== -1) {
          definition.rawHeaders[index + 1] = `Digest ${placeholder}`;
        }
      }

      return;
    }

    definition.rawHeaders = definition.rawHeaders.map(header => {
      if (includes(header, credential)) {
        debug('Replacing credentials in raw header');
        debugSensitive('Header name/value:', header);

        return replaceCredential({
          payload: header,
          credential,
          placeholder,
        });
      }

      return header;
    });
  }
}

function replaceCredentialInBody({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  if (definition.body !== undefined && definition.body !== '') {
    let body = JSON.stringify(definition.body);

    if (includes(body, credential)) {
      debug('Replacing credentials in request body');
      debugSensitive('Request body:', body);

      body = replaceCredential({
        payload: body,
        credential,
        placeholder,
      });

      definition.body = JSON.parse(body) as RequestBodyMatcher;
    }
  }
}

enum TargetResponse {
  default = 'response',
  decoded = 'decodedResponse',
}

function replaceCredentialInResponse({
  definition,
  credential,
  placeholder,
  contentEncoding,
}: ReplaceOptions & { contentEncoding?: string }): void {
  let response: string | undefined,
    targetResponse: TargetResponse = TargetResponse.default;

  if (contentEncoding === undefined) {
    if (definition.response) {
      response = JSON.stringify(definition.response);
    }
  } else {
    if (definition.decodedResponse) {
      response = JSON.stringify(definition.decodedResponse);
      targetResponse = TargetResponse.decoded;
    }
  }

  if (response) {
    if (includes(response, credential)) {
      debug('Replacing credentials in response');
      debugSensitive('Response:', response);

      response = replaceCredential({
        payload: response,
        credential,
        placeholder,
      });

      definition[targetResponse] = JSON.parse(response) as ReplyBody;
    }
  }
}

function replaceCredentialInScope({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  if (includes(definition.scope, credential)) {
    debug('Replacing credentials in scope');
    debugSensitive('Scope:', definition.scope);

    definition.scope = replaceCredential({
      payload: definition.scope,
      credential,
      placeholder,
    });
  }
}

function replaceCredentialInQuery({
  definition,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & { baseUrl: string }): void {
  const baseUrlOrigin = new URL(baseUrl).origin;
  const definitionURL = new URL(baseUrlOrigin + definition.path);

  for (const [key, queryValue] of definitionURL.searchParams.entries()) {
    if (includes(queryValue, credential)) {
      debug('Replacing credentials in query');
      debugSensitive('Query name:', key);
      debugSensitive('Query value:', queryValue);

      definitionURL.searchParams.set(
        key,
        replaceCredential({
          payload: queryValue,
          credential,
          placeholder,
        })
      );
    }
  }

  definition.path =
    definitionURL.pathname + definitionURL.search + definitionURL.hash;
}

function replaceCredentialInPath({
  definition,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & { baseUrl: string }): void {
  const baseUrlOrigin = new URL(baseUrl).origin;
  const definitionURL = new URL(baseUrlOrigin + definition.path);

  if (includes(definitionURL.pathname, credential)) {
    debug('Replacing credentials in path');
    debugSensitive('Request path:', definitionURL.pathname);

    definitionURL.pathname = replaceCredential({
      payload: definitionURL.pathname,
      credential,
      placeholder,
    });
  }

  definition.path =
    definitionURL.pathname + definitionURL.search + definitionURL.hash;
}

function replaceApiKeyInHeader({
  definition,
  security,
  credential,
  placeholder,
}: ReplaceOptions & {
  security: ApiKeySecurityScheme & ApiKeySecurityValues;
}): void {
  if (security.name !== undefined) {
    if (definition.reqheaders?.[security.name] !== undefined) {
      debug('Replacing api-key in request header');
      debugSensitive('Request header name:', security.name);
      debugSensitive(
        'Request header value:',
        definition.reqheaders[security.name]
      );

      definition.reqheaders[security.name] = replaceCredential({
        payload: definition.reqheaders[security.name].toString(),
        credential,
        placeholder,
      });
    }
  }

  replaceCredentialInHeaders({
    definition,
    credential,
    placeholder,
  });
}

function replaceApiKeyInBody({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  replaceCredentialInBody({
    definition,
    credential,
    placeholder,
  });
}

function replaceApiKeyInPath({
  definition,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & { baseUrl: string }): void {
  replaceCredentialInPath({
    definition,
    baseUrl,
    credential,
    placeholder,
  });
}

function replaceApiKeyInQuery({
  definition,
  security,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & {
  baseUrl: string;
  security: ApiKeySecurityScheme & ApiKeySecurityValues;
}): void {
  const baseUrlOrigin = new URL(baseUrl).origin;
  const definitionURL = new URL(baseUrlOrigin + definition.path);

  if (
    security.name !== undefined &&
    definitionURL.searchParams.has(security.name)
  ) {
    const param = definitionURL.searchParams.get(security.name);

    if (param && includes(param, credential)) {
      debug('Replacing api-key in query');
      debugSensitive('Query name:', security.name);
      debugSensitive('Query value:', param);

      definitionURL.searchParams.set(security.name, placeholder);

      definition.path =
        definitionURL.pathname + definitionURL.search + definitionURL.hash;
    }
  }

  replaceCredentialInQuery({
    definition,
    baseUrl,
    credential,
    placeholder,
  });
}

function replaceApiKey({
  definition,
  security,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & {
  baseUrl: string;
  security: ApiKeySecurityScheme & ApiKeySecurityValues;
}): void {
  debug('Replacing api-key');
  const options = {
    definition,
    credential,
    placeholder,
  };

  if (security.in === ApiKeyPlacement.HEADER) {
    replaceApiKeyInHeader({ ...options, security });
    replaceCredentialInRawHeaders(options);
  } else if (security.in === ApiKeyPlacement.BODY) {
    replaceApiKeyInBody(options);
  } else if (security.in === ApiKeyPlacement.PATH) {
    replaceApiKeyInPath({ ...options, baseUrl });
  } else if (security.in === ApiKeyPlacement.QUERY) {
    replaceApiKeyInQuery({ ...options, security, baseUrl });
  }
}

function replaceBasicAuth(
  definition: RecordingDefinition,
  placeholder: string
): void {
  if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
    debug('Replacing Basic token');

    definition.reqheaders[AUTH_HEADER_NAME] = `Basic ${placeholder}`;
  }
}

function replaceBearerAuth(
  definition: RecordingDefinition,
  placeholder: string
): void {
  if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
    debug('Replacing Bearer token');

    definition.reqheaders[AUTH_HEADER_NAME] = `Bearer ${placeholder}`;
  }
}

function replaceDigestAuth(
  definition: RecordingDefinition,
  placeholder: string,
  security: DigestSecurityScheme & DigestSecurityValues
): void {
  const { authorizationHeader, challengeHeader } = security;

  // Challenge digest header
  if (
    challengeHeader &&
    definition.reqheaders?.[challengeHeader] !== undefined
  ) {
    debug(`Replacing Digest token from challenge header: ${challengeHeader}`);

    definition.reqheaders[challengeHeader] = `Digest ${placeholder}`;
  }

  // Authorization digest header
  if (
    authorizationHeader &&
    definition.reqheaders?.[authorizationHeader] !== undefined
  ) {
    debug(
      `Replacing Digest token from authorization header: ${authorizationHeader}`
    );

    definition.reqheaders[authorizationHeader] = `Digest ${placeholder}`;
  }

  // Authorization or www-authenticate header
  if (challengeHeader === undefined || authorizationHeader === undefined) {
    if (definition.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      debug(`Replacing Digest token from default header: ${AUTH_HEADER_NAME}`);

      definition.reqheaders[AUTH_HEADER_NAME] = `Digest ${placeholder}`;
    }

    if (definition.reqheaders?.[WWW_AUTH_HEADER_NAME] !== undefined) {
      debug(
        `Replacing Digest token from default header: ${WWW_AUTH_HEADER_NAME}`
      );

      definition.reqheaders[WWW_AUTH_HEADER_NAME] = `Digest ${placeholder}`;
    }
  }
}

/**
 * Replaces occurences of credentials from security schemes in recorded HTTP calls
 *
 * These credentials are configured to be located at specific location
 * based on security scheme.
 *
 * It can look in following places of HTTP recording definition:
 * - headers and rawHeaders (bearer, basic & digest)
 * - body (apiKey)
 * - path (apiKey)
 * - query (apiKey)
 * - response (all security schemes)
 */
export function replaceCredentialInDefinition({
  definition,
  security,
  baseUrl,
  credential,
  placeholder,
}: {
  definition: RecordingDefinition;
  security: SecurityConfiguration;
  baseUrl: string;
  credential: string;
  placeholder: string;
}): void {
  debug('Replacing credentials based on security schemes');
  const options = {
    definition,
    credential,
    placeholder,
  };
  const contentEncoding = getResponseHeaderValue(
    'Content-Encoding',
    definition.rawHeaders ?? []
  );

  if (security.type === SecurityType.APIKEY) {
    replaceApiKey({ ...options, security, baseUrl });
  } else if (
    security.type === SecurityType.HTTP &&
    security.scheme === HttpScheme.BASIC
  ) {
    replaceBasicAuth(definition, placeholder);
    replaceCredentialInRawHeaders(options);
  } else if (
    security.type === SecurityType.HTTP &&
    security.scheme === HttpScheme.BEARER
  ) {
    replaceBearerAuth(definition, placeholder);
    replaceCredentialInRawHeaders(options);
  } else if (
    security.type === SecurityType.HTTP &&
    security.scheme === HttpScheme.DIGEST
  ) {
    replaceDigestAuth(definition, placeholder, security);
    replaceCredentialInRawHeaders({ ...options, security });
  }

  replaceCredentialInResponse({ ...options, contentEncoding });
}

/**
 * Replaces occurences of integration parameters in recorded HTTP calls
 *
 * Since integration parameters can be used in multiple places of HTTP call in map,
 * it look for occurences in following places of HTTP recording definitions:
 * - headers and rawHeaders
 * - body
 * - response
 * - scope (baseUrl from provider.json)
 * - path
 * - query
 */
export function replaceParameterInDefinition({
  definition,
  baseUrl,
  credential,
  placeholder,
}: {
  definition: RecordingDefinition;
  baseUrl: string;
  credential: string;
  placeholder: string;
}): void {
  debug('Replacing integration parameters');
  const options = {
    definition,
    credential,
    placeholder,
  };
  const contentEncoding = getResponseHeaderValue(
    'Content-Encoding',
    definition.rawHeaders ?? []
  );

  replaceCredentialInHeaders(options);
  replaceCredentialInRawHeaders(options);
  replaceCredentialInBody(options);
  replaceCredentialInResponse({ ...options, contentEncoding });
  replaceCredentialInScope(options);
  replaceCredentialInPath({ ...options, baseUrl });
  replaceCredentialInQuery({ ...options, baseUrl });
}

/**
 * Replaces occurences of input values in recorded HTTP calls
 *
 * Since input can be used in multiple places of HTTP call in map,
 * it look for occurences in following places of HTTP recording definitions:
 * - headers and rawHeaders
 * - body
 * - response
 * - path
 * - query
 */
export function replaceInputInDefinition({
  definition,
  baseUrl,
  credential,
  placeholder,
}: {
  definition: RecordingDefinition;
  baseUrl: string;
  credential: string;
  placeholder: string;
}): void {
  debug('Replacing input values');
  const options = {
    definition,
    credential,
    placeholder,
  };
  const contentEncoding = getResponseHeaderValue(
    'Content-Encoding',
    definition.rawHeaders ?? []
  );

  replaceCredentialInHeaders(options);
  replaceCredentialInRawHeaders(options);
  replaceCredentialInBody(options);
  replaceCredentialInResponse({ ...options, contentEncoding });
  replaceCredentialInPath({ ...options, baseUrl });
  replaceCredentialInQuery({ ...options, baseUrl });
}
