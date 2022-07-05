import Ajv from 'ajv';
import createDebug from 'debug';
import { createSchema } from 'genson-js/dist';
import { inspect } from 'util';

import { RecordingDefinitions } from '../superface-test.interfaces';
import { decodeResponse, getHeaderValue } from './matcher.utils';

interface MatchHeaders {
  old?: string;
  new?: string;
}

interface ResponseHeaderMatch {
  valid: boolean;
  contentEncoding?: MatchHeaders;
  contentType?: MatchHeaders;
}

const schemaValidator = new Ajv();
const debugMatching = createDebug('superface:testing:matching');
const debugMatchingSensitive = createDebug(
  'superface:testing:matching:sensitive'
);
debugMatchingSensitive(
  `
WARNING: YOU HAVE ALLOWED LOGGING SENSITIVE INFORMATION.
THIS LOGGING LEVEL DOES NOT PREVENT LEAKING SECRETS AND SHOULD NOT BE USED IF THE LOGS ARE GOING TO BE SHARED.
CONSIDER DISABLING SENSITIVE INFORMATION LOGGING BY APPENDING THE DEBUG ENVIRONMENT VARIABLE WITH ",-*:sensitive".
`
);

/**
 * Matches old recording file to new recorded traffic.
 * Assumes we always have correct order of HTTP calls.
 *
 * @param oldTrafficDefs - old traffic loaded from recording file
 * @param newTrafficDefs - new recorded traffic
 * @returns boolean representing whether recordings match or not
 */
export async function matchTraffic(
  oldTrafficDefs: RecordingDefinitions,
  newTrafficDefs: RecordingDefinitions
): Promise<boolean> {
  if (oldTrafficDefs.length != newTrafficDefs.length) {
    debugMatching('Number of recorded HTTP calls do not match');

    return false;
  }

  for (let i = 0; i < oldTrafficDefs.length; i++) {
    // access old recording and new recording
    const oldTraffic = oldTrafficDefs[i];
    const newTraffic = newTrafficDefs[i];

    debugMatching(
      `Matching HTTP calls  ${oldTraffic.scope + oldTraffic.path} : ${
        newTraffic.scope + newTraffic.path
      }`
    );

    // method
    debugMatching('\trequest method');
    if (oldTraffic.method !== newTraffic.method) {
      debugMatching(
        `Request method does not match: "${
          oldTraffic.method ?? 'not-existing'
        }" - "${newTraffic.method ?? 'not-existing'}"`
      );

      return false;
    }

    // status
    debugMatching('\tresponse status');
    if (oldTraffic.status !== newTraffic.status) {
      debugMatching(
        `Status codes do not match: "${
          oldTraffic.status ?? 'not-existing'
        }" - "${newTraffic.status ?? 'not-existing'}"`
      );

      return false;
    }

    // scope
    debugMatching('\trequest scope');
    if (oldTraffic.scope !== newTraffic.scope) {
      debugMatchingSensitive(
        `Scopes do not match: "${oldTraffic.scope}" - "${newTraffic.scope}"`
      );

      return false;
    }

    // path
    debugMatching('\trequest path');
    if (oldTraffic.path !== newTraffic.path) {
      debugMatchingSensitive(
        `Paths do not match: "${oldTraffic.path}" - "${newTraffic.path}"`
      );

      return false;
    }

    // response headers
    const { valid, contentEncoding } = matchResponseHeaders(
      oldTraffic.rawHeaders,
      newTraffic.rawHeaders
    );

    if (!valid) {
      return false;
    }

    // request body
    if (oldTraffic.body !== undefined) {
      if (!matchRequestBody(oldTraffic.body, newTraffic.body)) {
        return false;
      }
    }

    // response
    if (oldTraffic.response !== undefined) {
      if (
        !(await matchResponse(
          oldTraffic.response,
          newTraffic.response,
          contentEncoding
        ))
      ) {
        return false;
      }
    }
  }

  debugMatching('No changes found');

  return true;
}

function matchResponseHeaders(
  oldHeaders?: string[],
  newHeaders?: string[]
): ResponseHeaderMatch {
  let valid = true;
  debugMatching('\tresponse headers');

  if (oldHeaders === undefined) {
    throw new Error('Old traffic does not contain rawHeaders');
  }

  if (newHeaders === undefined) {
    throw new Error('New traffic does not contain rawHeaders');
  }

  // match content type
  const contentType = getHeaderValue(oldHeaders, newHeaders, 'content-type');

  if (contentType.old !== contentType.new) {
    debugMatchingSensitive(
      `Response header "Content-Type" does not match: "${
        contentType.old ?? 'not-existing'
      }" - "${contentType.new ?? 'not-existing'}"`
    );

    valid = false;
  }

  // match content Encoding
  const contentEncoding = getHeaderValue(
    oldHeaders,
    newHeaders,
    'content-encoding'
  );

  if (contentEncoding.old !== contentEncoding.new) {
    debugMatchingSensitive(
      `Response header "Content-Encoding" does not match: "${
        contentEncoding.old ?? 'not-existing'
      }" - "${contentEncoding.new ?? 'not-existing'}"`
    );

    valid = false;
  }

  // do we want to check the order of headers or just some?
  // for (let i = 0; i <= oldTraffic.rawHeaders.length; i += 2) {
  //   const headerName = oldTraffic.rawHeaders[i];
  //   const headerValue = oldTraffic.rawHeaders[i + 1];
  // }

  return {
    valid,
    contentEncoding,
  };
}

// TODO - check if body is also encoded
function matchRequestBody(oldBody: unknown, newBody: unknown): boolean {
  debugMatching('\trequest body');

  const bodyJsonSchema = createSchema(oldBody);
  debugMatchingSensitive(
    'generated json schema for body:',
    inspect(bodyJsonSchema, true, 25)
  );
  const valid = schemaValidator.validate(bodyJsonSchema, newBody);

  if (!valid) {
    debugMatchingSensitive(
      'Request body does not match:',
      schemaValidator.errorsText()
    );
    debugMatchingSensitive(schemaValidator.errors);

    console.warn(`Recordings does not match: ${schemaValidator.errorsText()}`);

    return false;
  }

  return true;
}

async function matchResponse(
  oldResponse: unknown,
  newResponse: unknown,
  contentEncoding?: MatchHeaders
): Promise<boolean> {
  debugMatching('\tresponse');
  let oldRes = oldResponse,
    newRes = newResponse;

  // if responses are encoded - decode them
  if (contentEncoding?.old !== undefined) {
    debugMatching(
      `Decoding old response based on ${contentEncoding.old} encoding`
    );

    oldRes = await decodeResponse(oldResponse, contentEncoding.old);
  }

  if (contentEncoding?.new !== undefined) {
    debugMatching(
      `Decoding new response based on ${contentEncoding.new} encoding`
    );

    newRes = await decodeResponse(newResponse, contentEncoding.new);
  }

  // validate responses
  const responseJsonSchema = createSchema(oldRes);
  debugMatchingSensitive(
    'Generated json schema for response:',
    inspect(responseJsonSchema, true, 25)
  );

  const valid = schemaValidator.validate(responseJsonSchema, newRes);

  if (!valid) {
    debugMatching(schemaValidator.errors);
    console.warn(`Recordings does not match: ${schemaValidator.errorsText()}`);

    return false;
  }

  return true;
}
