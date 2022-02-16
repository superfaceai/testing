import {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  HttpScheme,
  SecurityScheme,
  SecurityType,
} from '@superfaceai/ast';
import createDebug from 'debug';
import { ReplyBody, RequestBodyMatcher } from 'nock/types';
import { URL } from 'url';

import { RecordingDefinition } from '.';
import { UnexpectedError } from './common/errors';

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
}: ReplaceOptions): void {
  if (definition.rawHeaders) {
    debug('Replacing credentials in raw headers');

    definition.rawHeaders = definition.rawHeaders.map(header => {
      if (includes(header, credential)) {
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

function replaceCredentialInResponse({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  if (definition.response) {
    let response = JSON.stringify(definition.response);

    if (includes(response, credential)) {
      debug('Replacing credentials in response');
      debugSensitive('Response:', response);

      response = replaceCredential({
        payload: response,
        credential,
        placeholder,
      });

      definition.response = JSON.parse(response) as ReplyBody;
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
  scheme,
  credential,
  placeholder,
}: ReplaceOptions & { scheme: ApiKeySecurityScheme }): void {
  if (scheme.name !== undefined) {
    if (definition.reqheaders?.[scheme.name] !== undefined) {
      debug('Replacing api-key in request header');
      debugSensitive('Request header name:', scheme.name);
      debugSensitive(
        'Request header value:',
        definition.reqheaders[scheme.name]
      );

      definition.reqheaders[scheme.name] = replaceCredential({
        payload: definition.reqheaders[scheme.name].toString(),
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
  scheme,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & { baseUrl: string; scheme: ApiKeySecurityScheme }): void {
  const baseUrlOrigin = new URL(baseUrl).origin;
  const definitionURL = new URL(baseUrlOrigin + definition.path);

  if (
    scheme.name !== undefined &&
    definitionURL.searchParams.has(scheme.name)
  ) {
    const param = definitionURL.searchParams.get(scheme.name);

    if (param && includes(param, credential)) {
      debug('Replacing api-key in query');
      debugSensitive('Query name:', scheme.name);
      debugSensitive('Query value:', param);

      definitionURL.searchParams.set(scheme.name, placeholder);

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
  scheme,
  baseUrl,
  credential,
  placeholder,
}: ReplaceOptions & { baseUrl: string; scheme: ApiKeySecurityScheme }): void {
  debug('Replacing api-key');
  const options = {
    definition,
    credential,
    placeholder,
  };

  if (scheme.in === ApiKeyPlacement.HEADER) {
    replaceApiKeyInHeader({ ...options, scheme });
    replaceCredentialInRawHeaders(options);
  } else if (scheme.in === ApiKeyPlacement.BODY) {
    replaceApiKeyInBody(options);
  } else if (scheme.in === ApiKeyPlacement.PATH) {
    replaceApiKeyInPath({ ...options, baseUrl });
  } else if (scheme.in === ApiKeyPlacement.QUERY) {
    replaceApiKeyInQuery({ ...options, scheme, baseUrl });
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

/**
 * Replaces occurences of credentials from security schemes in recorded HTTP calls
 *
 * These credentials are configured to be located at specific location
 * based on security scheme.
 *
 * It can look in following places of HTTP recording definition:
 * - headers and rawHeaders (bearer & basic)
 * - body (apiKey)
 * - path (apiKey)
 * - query (apiKey)
 * - response (all security schemes)
 */
export function replaceCredentialInDefinition({
  definition,
  scheme,
  baseUrl,
  credential,
  placeholder,
}: {
  definition: RecordingDefinition;
  scheme: SecurityScheme;
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

  if (scheme.type === SecurityType.APIKEY) {
    replaceApiKey({ ...options, scheme, baseUrl });
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.BASIC
  ) {
    replaceBasicAuth(definition, placeholder);
    replaceCredentialInRawHeaders(options);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.BEARER
  ) {
    replaceBearerAuth(definition, placeholder);
    replaceCredentialInRawHeaders(options);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.DIGEST
  ) {
    throw new UnexpectedError('Digest auth not implemented');
  }

  replaceCredentialInResponse(options);
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

  replaceCredentialInHeaders(options);
  replaceCredentialInRawHeaders(options);
  replaceCredentialInBody(options);
  replaceCredentialInResponse(options);
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

  replaceCredentialInHeaders(options);
  replaceCredentialInRawHeaders(options);
  replaceCredentialInBody(options);
  replaceCredentialInResponse(options);
  replaceCredentialInPath({ ...options, baseUrl });
  replaceCredentialInQuery({ ...options, baseUrl });
}
