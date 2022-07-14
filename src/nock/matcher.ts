import Ajv from 'ajv';
import createDebug from 'debug';
import { createSchema } from 'genson-js/dist';
import { inspect } from 'util';

import {
  RecordingDefinition,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import {
  ErrorCollector,
  IErrorCollector,
  MatchErrorKind,
} from './error-collector';
import { decodeResponse, getHeaderValue } from './matcher.utils';

interface MatchHeaders {
  old?: string;
  new?: string;
}

interface ResponseHeaderMatch {
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

export type MatchResult =
  | { valid: true }
  | { valid: false; errors: IErrorCollector };

export class Matcher {
  private static errorCollector: IErrorCollector;

  /**
   * Matches old recording file to new recorded traffic.
   * Assumes we always have correct order of HTTP calls.
   *
   * @param recordingPath - path to old recording
   * @param oldTrafficDefs - old traffic loaded from recording file
   * @param newTrafficDefs - new recorded traffic
   * @returns boolean representing whether recordings match or not
   */
  static async match(
    recordingPath: string,
    oldTrafficDefs: RecordingDefinitions,
    newTrafficDefs: RecordingDefinitions
  ): Promise<MatchResult> {
    this.errorCollector = new ErrorCollector(recordingPath);

    if (oldTrafficDefs.length !== newTrafficDefs.length) {
      const message = 'Number of recorded HTTP calls do not match';
      debugMatching(message);

      this.errorCollector.add({ kind: MatchErrorKind.LENGTH, message });
    }

    for (let i = 0; i < oldTrafficDefs.length; i++) {
      // access old recording and new recording
      const oldTraffic = oldTrafficDefs[i];
      const newTraffic = newTrafficDefs[i];

      await this.matchTraffic(oldTraffic, newTraffic);
    }

    const errorsCount = this.errorCollector.get().length;
    if (errorsCount === 0) {
      debugMatching('No changes found');

      return { valid: true };
    } else {
      debugMatching(`Found ${errorsCount} errors`);

      return { valid: false, errors: this.errorCollector };
    }
  }

  private static async matchTraffic(
    oldTraffic: RecordingDefinition,
    newTraffic: RecordingDefinition
  ): Promise<void> {
    debugMatching(
      `Matching HTTP calls  ${oldTraffic.scope + oldTraffic.path} : ${
        newTraffic.scope + newTraffic.path
      }`
    );

    // method
    debugMatching('\trequest method');
    if (oldTraffic.method !== newTraffic.method) {
      const message = `Request method does not match: "${
        oldTraffic.method ?? 'not-existing'
      }" - "${newTraffic.method ?? 'not-existing'}"`;
      debugMatching(message);

      this.errorCollector.add({
        kind: MatchErrorKind.METHOD,
        old: oldTraffic.method,
        new: newTraffic.method,
        message,
      });
    }

    // status
    debugMatching('\tresponse status');
    if (oldTraffic.status !== newTraffic.status) {
      const message = `Status codes do not match: "${
        oldTraffic.status ?? 'not-existing'
      }" - "${newTraffic.status ?? 'not-existing'}"`;
      debugMatching(message);

      this.errorCollector.add({
        kind: MatchErrorKind.STATUS,
        old: oldTraffic.status,
        new: newTraffic.status,
        message,
      });
    }

    // scope
    debugMatching('\trequest scope');
    if (oldTraffic.scope !== newTraffic.scope) {
      const message = `Scopes do not match: "${oldTraffic.scope}" - "${newTraffic.scope}"`;
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.BASE_URL,
        old: oldTraffic.scope,
        new: newTraffic.scope,
        message,
      });
    }

    // path
    debugMatching('\trequest path');
    if (oldTraffic.path !== newTraffic.path) {
      const message = `Paths do not match: "${oldTraffic.path}" - "${newTraffic.path}"`;
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.PATH,
        old: oldTraffic.path,
        new: newTraffic.path,
        message,
      });
    }

    // response headers
    const { contentEncoding } = this.matchResponseHeaders(
      oldTraffic.rawHeaders,
      newTraffic.rawHeaders
    );

    // request body
    if (oldTraffic.body !== undefined) {
      this.matchRequestBody(oldTraffic.body, newTraffic.body);
    }

    // response
    if (oldTraffic.response !== undefined) {
      await this.matchResponse(
        oldTraffic.response,
        newTraffic.response,
        contentEncoding
      );
    }
  }

  private static matchResponseHeaders(
    oldHeaders?: string[],
    newHeaders?: string[]
  ): ResponseHeaderMatch {
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
      const message = `Response header "Content-Type" does not match: "${
        contentType.old ?? 'not-existing'
      }" - "${contentType.new ?? 'not-existing'}"`;
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.RESPONSE_HEADERS,
        old: contentType.old,
        new: contentType.new,
        message,
      });
    }

    // match content Encoding
    const contentEncoding = getHeaderValue(
      oldHeaders,
      newHeaders,
      'content-encoding'
    );

    if (contentEncoding.old !== contentEncoding.new) {
      const message = `Response header "Content-Encoding" does not match: "${
        contentEncoding.old ?? 'not-existing'
      }" - "${contentEncoding.new ?? 'not-existing'}"`;
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.RESPONSE_HEADERS,
        old: contentEncoding.old,
        new: contentEncoding.new,
        message,
      });
    }

    return {
      contentType,
      contentEncoding,
    };
  }

  // TODO - check if body is also encoded
  private static matchRequestBody(oldBody: unknown, newBody: unknown): boolean {
    debugMatching('\trequest body');

    const bodyJsonSchema = createSchema(oldBody);
    debugMatchingSensitive(
      'generated json schema for body:',
      inspect(bodyJsonSchema, true, 25)
    );
    const valid = schemaValidator.validate(bodyJsonSchema, newBody);

    if (!valid) {
      const message = `Request body does not match: ${schemaValidator.errorsText()}`;

      debugMatchingSensitive(message);
      debugMatchingSensitive(schemaValidator.errors);

      this.errorCollector.add({
        kind: MatchErrorKind.REQUEST_BODY,
        old: oldBody,
        new: newBody,
        message,
      });
    }

    return true;
  }

  private static async matchResponse(
    oldResponse: unknown,
    newResponse: unknown,
    contentEncoding?: MatchHeaders
  ): Promise<void> {
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
      const message = `Recordings does not match: ${schemaValidator.errorsText()}`;

      debugMatchingSensitive(message);
      debugMatching(schemaValidator.errors);

      this.errorCollector.add({
        kind: MatchErrorKind.RESPONSE,
        old: oldResponse,
        new: newResponse,
        message,
      });
    }
  }
}
