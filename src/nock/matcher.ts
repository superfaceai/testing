import Ajv from 'ajv';
import createDebug from 'debug';
import { createSchema } from 'genson-js/dist';
import { inspect } from 'util';

import {
  RecordingDefinition,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import { ErrorCollector } from './error-collector';
import { IErrorCollector, MatchErrorKind } from './error-collector.interfaces';
import {
  decodeResponse,
  errorMessages,
  getHeaderValue,
  parseBody,
} from './matcher.utils';

export interface MatchHeaders {
  old?: string;
  new?: string;
}

interface RequestHeaderMatch {
  accept?: MatchHeaders;
}

interface ResponseHeaderMatch {
  contentEncoding?: MatchHeaders;
  contentType?: MatchHeaders;
  contentLength?: MatchHeaders;
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
      const message = errorMessages.incorrectRecordingsCount(
        oldTrafficDefs.length,
        newTrafficDefs.length
      );
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
      `Matching HTTP calls ${
        oldTraffic.method + oldTraffic.scope + oldTraffic.path
      } : ${oldTraffic.method + newTraffic.scope + newTraffic.path}`
    );

    // method
    debugMatching('\trequest method');
    if (oldTraffic.method !== newTraffic.method) {
      const message = errorMessages.incorrectMethod(
        oldTraffic.method,
        newTraffic.method
      );
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
      const message = errorMessages.incorrectStatusCode(
        oldTraffic.status,
        newTraffic.status
      );
      debugMatching(message);

      this.errorCollector.add({
        kind: MatchErrorKind.STATUS,
        old: oldTraffic.status,
        new: newTraffic.status,
        message,
      });
    }

    // base URL
    debugMatching('\trequest base URL');
    if (oldTraffic.scope !== newTraffic.scope) {
      const message = errorMessages.incorrectBaseUrl(
        oldTraffic.scope,
        newTraffic.scope
      );
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
      const message = errorMessages.incorrectPath(
        oldTraffic.path,
        newTraffic.path
      );
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.PATH,
        old: oldTraffic.path,
        new: newTraffic.path,
        message,
      });
    }

    // TODO: research nock types of request headers and parse them correctly
    // request headers
    const { accept } = this.matchRequestHeaders(
      (oldTraffic.reqheaders as Record<string, string | string[]>) ?? {},
      (newTraffic.reqheaders as Record<string, string | string[]>) ?? {}
    );

    // response headers
    const { contentEncoding } = this.matchResponseHeaders(
      oldTraffic.rawHeaders ?? [],
      newTraffic.rawHeaders ?? []
    );

    // request body
    if (oldTraffic.body !== undefined) {
      this.matchRequestBody(oldTraffic.body, newTraffic.body, accept);
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

  private static matchRequestHeaders(
    oldHeaders: Record<string, string | string[]>,
    newHeaders: Record<string, string | string[]>
  ): RequestHeaderMatch {
    debugMatching('\trequest headers');

    const accept = getHeaderValue(oldHeaders, newHeaders, 'accept');

    if (accept.old !== accept.new) {
      const message = errorMessages.incorrectRequestHeader(
        'accept',
        accept.old,
        accept.new
      );
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.REQUEST_HEADERS,
        old: accept.old,
        new: accept.new,
        message,
      });
    }

    // list of other headers to add support for:
    // ...

    return {
      accept,
    };
  }

  private static matchResponseHeaders(
    oldHeaders: string[],
    newHeaders: string[]
  ): ResponseHeaderMatch {
    debugMatching('\tresponse headers');

    // match content type
    const contentType = getHeaderValue(oldHeaders, newHeaders, 'content-type');

    if (contentType.old !== contentType.new) {
      const message = errorMessages.incorrectResponseHeader(
        'content-type',
        contentType.old
      );
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
      const message = errorMessages.incorrectResponseHeader(
        'content-type',
        contentEncoding.old,
        contentEncoding.new
      );
      debugMatchingSensitive(message);

      this.errorCollector.add({
        kind: MatchErrorKind.RESPONSE_HEADERS,
        old: contentEncoding.old,
        new: contentEncoding.new,
        message,
      });
    }

    const contentLength = getHeaderValue(
      oldHeaders,
      newHeaders,
      'content-length'
    );

    // list of other headers to add support for:
    // Access-Control-Allow-Origin, access-control-allow-headers, access-control-allow-methods
    // Cache-Control, Vary, Transfer-Encoding,
    // Pragma, Server, Connection, referrer-policy?

    return {
      contentType,
      contentEncoding,
      contentLength,
    };
  }

  private static matchRequestBody(
    oldRequestBody: unknown,
    newRequestBody: unknown,
    accept?: MatchHeaders
  ): void {
    debugMatching('\trequest body');

    // TODO: try to parse string body or rather compare it plainly?
    // if body is not string and is defined - expect valid JSON
    let oldBody = oldRequestBody,
      newBody = newRequestBody;

    if (typeof oldRequestBody === 'string') {
      oldBody = parseBody(oldRequestBody, accept?.old);
    }

    if (typeof newRequestBody === 'string') {
      newBody = parseBody(newRequestBody, accept?.new);
    }

    // if old body is empty string or undefined - we dont create JSON scheme
    let message = errorMessages.incorrectRequestBody(oldBody, newBody);
    if (oldBody === undefined) {
      if (newBody !== undefined) {
        debugMatchingSensitive(message);
        this.errorCollector.add({
          kind: MatchErrorKind.REQUEST_BODY,
          old: oldBody,
          new: newBody,
          message,
        });
      }

      return;
    }

    const valid = this.createAndValidateSchema(oldBody, newBody);

    if (!valid) {
      message = `Request body does not match: ${schemaValidator.errorsText()}`;

      debugMatchingSensitive(message);
      debugMatchingSensitive(schemaValidator.errors);

      this.errorCollector.add({
        kind: MatchErrorKind.REQUEST_BODY,
        old: oldBody,
        new: newBody,
        message,
      });
    }

    return;
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
    const valid = this.createAndValidateSchema(oldRes, newRes);

    if (!valid) {
      const message = errorMessages.incorrectResponse(
        schemaValidator.errorsText()
      );

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

  private static createAndValidateSchema(base: unknown, payload: unknown) {
    const bodyJsonSchema = createSchema(base);

    debugMatchingSensitive(
      'Generated JSON Schema:',
      inspect(bodyJsonSchema, true, 25)
    );

    return schemaValidator.validate(bodyJsonSchema, payload);
  }
}
