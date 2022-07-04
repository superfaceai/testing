import Ajv from 'ajv';
import createDebug from 'debug';
import { createSchema } from 'genson-js/dist';

import { RecordingDefinitions } from '../superface-test.interfaces';

const schemaValidator = new Ajv();
const debugMatching = createDebug('superface:testing:matching');
const debugMatchingSensitive = createDebug(
  'superface:testing:matching:sensitive'
);

/**
 * Matches old recording file to new recorded traffic.
 * Assumes we always have correct order of HTTP calls.
 *
 * @param oldTrafficDefs - old recording file
 * @param newTrafficDefs - new recorded traffic
 * @returns boolean representing whether recordings match or not
 */
export function matchTraffic(
  oldTrafficDefs: RecordingDefinitions,
  newTrafficDefs: RecordingDefinitions
): boolean {
  if (oldTrafficDefs.length != newTrafficDefs.length) {
    return false;
  }

  for (let i = 0; i < oldTrafficDefs.length; i++) {
    // access old recording and new recording
    const oldTraffic = oldTrafficDefs[i];
    const newTraffic = newTrafficDefs[i];

    debugMatching(
      `Found already existing recordings - Matching HTTP calls  ${
        oldTraffic.scope + oldTraffic.path
      } : ${newTraffic.scope + newTraffic.path}`
    );

    // method
    debugMatching('Matching request method');
    if (oldTraffic.method !== newTraffic.method) {
      debugMatchingSensitive(
        `Request method does not match: "${
          oldTraffic.method ?? 'not-existing'
        }" - "${newTraffic.method ?? 'not-existing'}"`
      );

      return false;
    }

    // status
    debugMatching('Matching response status');
    if (oldTraffic.status !== newTraffic.status) {
      debugMatchingSensitive(
        `Status codes do not match: "${
          oldTraffic.status ?? 'not-existing'
        }" - "${newTraffic.status ?? 'not-existing'}"`
      );

      return false;
    }

    // scope
    debugMatching('Matching request scope');
    if (oldTraffic.scope !== newTraffic.scope) {
      debugMatchingSensitive(
        `Scopes do not match: "${oldTraffic.scope}" - "${newTraffic.scope}"`
      );

      return false;
    }

    // path
    debugMatching('Matching request path');
    if (oldTraffic.path !== newTraffic.path) {
      debugMatchingSensitive(
        `Paths do not match: "${oldTraffic.path}" - "${newTraffic.path}"`
      );

      return false;
    }

    // response headers
    const matchResponseHeaders = compareResponseHeaders(
      oldTraffic.rawHeaders,
      newTraffic.rawHeaders
    );

    if (!matchResponseHeaders) {
      return false;
    }

    // body
    if (oldTraffic.body !== undefined) {
      debugMatching('Matching request body');

      const bodyJsonSchema = createSchema(oldTraffic.body);
      const valid = schemaValidator.validate(bodyJsonSchema, newTraffic.body);

      if (!valid) {
        debugMatchingSensitive(
          'Request body does not match:',
          schemaValidator.errors
        );
        console.warn(
          `Recordings does not match: ${schemaValidator.errorsText()}`
        );

        return false;
      }
    }

    // response
    if (oldTraffic.response !== undefined) {
      debugMatching('Matching response');

      const responseJsonSchema = createSchema(oldTraffic);
      const valid = schemaValidator.validate(responseJsonSchema, newTraffic);

      if (!valid) {
        debugMatching(schemaValidator.errors);
        console.warn(
          `Recordings does not match: ${schemaValidator.errorsText()}`
        );

        return false;
      }
    }
  }

  debugMatching('No changes found');

  return true;
}

const compareResponseHeaders = (
  oldHeaders?: string[],
  newHeaders?: string[]
): boolean => {
  debugMatching('Matching response headers');

  if (oldHeaders === undefined) {
    throw new Error('Old traffic does not contain rawHeaders');
  }

  if (newHeaders === undefined) {
    throw new Error('New traffic does not contain rawHeaders');
  }

  // check content type
  const oldHeaderContentType = oldHeaders.find(
    (_, i, headers) =>
      headers[i === 0 ? i : i - 1].toLowerCase() === 'content-type'
  );
  const newHeaderContentType = newHeaders.find(
    (_, i, headers) =>
      headers[i === 0 ? i : i - 1].toLowerCase() === 'content-type'
  );

  if (oldHeaderContentType !== newHeaderContentType) {
    debugMatchingSensitive(
      `Response header "Content-Type" does not match: "${
        oldHeaderContentType ?? 'not-existing'
      }" - "${newHeaderContentType ?? 'not-existing'}"`
    );

    return false;
  }

  // check other stuf
  // ...

  // do we want to check the order of headers or just some?
  // for (let i = 0; i <= oldTraffic.rawHeaders.length; i += 2) {
  //   const headerName = oldTraffic.rawHeaders[i];
  //   const headerValue = oldTraffic.rawHeaders[i + 1];
  // }

  return true;
};
