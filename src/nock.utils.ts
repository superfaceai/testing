import {
  ApiKeyPlacement,
  ApiKeySecurityScheme,
  HttpScheme,
  SecurityScheme,
  SecurityType,
} from '@superfaceai/ast';
import createDebug from 'debug';
import { RequestBodyMatcher } from 'nock/types';
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

function replaceCredential({
  payload,
  credential,
  placeholder,
}: {
  payload: string;
  credential: string;
  placeholder: string;
}) {
  if (credential !== '') {
    debugSensitive(
      `Replacing credential: '${credential}' for placeholder: '${placeholder}'`
    );

    return payload.replace(new RegExp(credential, 'g'), placeholder);
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
      value.toString().includes(credential)
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

function replaceCredentialInBody({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  if (definition.body !== undefined && definition.body !== '') {
    let body = JSON.stringify(definition.body);

    if (body.includes(credential)) {
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

function replaceCredentialInScope({
  definition,
  credential,
  placeholder,
}: ReplaceOptions): void {
  if (definition.scope.includes(credential)) {
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
    if (queryValue.includes(credential)) {
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

  if (definitionURL.pathname.includes(credential)) {
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
    definitionURL.searchParams.has(scheme.name) &&
    definitionURL.searchParams.get(scheme.name)?.includes(credential)
  ) {
    debug('Replacing api-key in query');
    debugSensitive('Query name:', scheme.name);
    debugSensitive('Query value:', definitionURL.searchParams.get(scheme.name));

    definitionURL.searchParams.set(scheme.name, placeholder);

    definition.path =
      definitionURL.pathname + definitionURL.search + definitionURL.hash;
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

  if (scheme.in === ApiKeyPlacement.HEADER) {
    replaceApiKeyInHeader({
      definition,
      scheme,
      credential,
      placeholder,
    });
  } else if (scheme.in === ApiKeyPlacement.BODY) {
    replaceApiKeyInBody({ definition, credential, placeholder });
  } else if (scheme.in === ApiKeyPlacement.PATH) {
    replaceApiKeyInPath({
      definition,
      baseUrl,
      credential,
      placeholder,
    });
  } else if (scheme.in === ApiKeyPlacement.QUERY) {
    replaceApiKeyInQuery({
      definition,
      scheme,
      baseUrl,
      credential,
      placeholder,
    });
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

  if (scheme.type === SecurityType.APIKEY) {
    replaceApiKey({
      definition,
      scheme,
      baseUrl,
      credential,
      placeholder,
    });
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.BASIC
  ) {
    replaceBasicAuth(definition, placeholder);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.BEARER
  ) {
    replaceBearerAuth(definition, placeholder);
  } else if (
    scheme.type === SecurityType.HTTP &&
    scheme.scheme === HttpScheme.DIGEST
  ) {
    throw new UnexpectedError('Digest auth not implemented');
  }
}

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

  replaceCredentialInHeaders({
    definition,
    credential,
    placeholder,
  });
  replaceCredentialInBody({
    definition,
    credential,
    placeholder,
  });
  replaceCredentialInScope({
    definition,
    credential,
    placeholder,
  });
  replaceCredentialInPath({
    definition,
    baseUrl,
    credential,
    placeholder,
  });
  replaceCredentialInQuery({
    definition,
    baseUrl,
    credential,
    placeholder,
  });
}
