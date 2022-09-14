import Ajv from 'ajv';
import createDebug from 'debug';
import { createSchema } from 'genson-js/dist';
import { inspect } from 'util';

import { UnexpectedError } from '../common/errors';
import { readFileQuiet } from '../common/io';
import { writeRecordings } from '../common/output-stream';
import {
  AnalysisResult,
  RecordingDefinition,
  RecordingDefinitions,
} from '../superface-test.interfaces';
import { analyzeChangeImpact, MatchImpact } from './analyzer';
import { ErrorCollector } from './error-collector';
import {
  ErrorCollection,
  ErrorType,
  MatchError,
  MatchErrorBaseURL,
  MatchErrorLength,
  MatchErrorMethod,
  MatchErrorPath,
  MatchErrorRequestBody,
  MatchErrorRequestHeaders,
  MatchErrorResponse,
  MatchErrorResponseHeaders,
  MatchErrorStatus,
} from './matcher.errors';
import {
  decodeResponse,
  getRequestHeader,
  getResponseHeader,
  parseBody,
} from './matcher.utils';
import { composeRecordingPath } from './recorder';

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

const schemaValidator = new Ajv({
  allErrors: true,
});

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
  | { valid: false; errors: ErrorCollection<MatchError> };

export class Matcher {
  private static errorCollector: ErrorCollector;

  /**
   * Matches old recording file to new recorded traffic.
   * Assumes we always have correct order of HTTP calls.
   *
   * @param oldTrafficDefs - old traffic loaded from recording file
   * @param newTrafficDefs - new recorded traffic
   * @returns object representing whether recordings match or not
   */
  static async match(
    oldTrafficDefs: RecordingDefinitions,
    newTrafficDefs: RecordingDefinitions
  ): Promise<MatchResult> {
    this.errorCollector = new ErrorCollector();

    if (oldTrafficDefs.length < newTrafficDefs.length) {
      this.errorCollector.add(
        ErrorType.ADD,
        new MatchErrorLength(oldTrafficDefs.length, newTrafficDefs.length)
      );
    } else if (oldTrafficDefs.length > newTrafficDefs.length) {
      this.errorCollector.add(
        ErrorType.REMOVE,
        new MatchErrorLength(oldTrafficDefs.length, newTrafficDefs.length)
      );
    }

    for (let i = 0; i < oldTrafficDefs.length; i++) {
      // access old recording and new recording
      const oldTraffic = oldTrafficDefs[i];
      const newTraffic = newTrafficDefs[i];

      await this.matchTraffic(oldTraffic, newTraffic);
    }

    const { errors, count } = this.errorCollector;

    if (count === 0) {
      debugMatching('No changes found');

      return { valid: true };
    } else {
      debugMatching(`Found ${count} ${count > 1 ? 'errors' : 'error'}`);

      return { valid: false, errors };
    }
  }

  private static async matchTraffic(
    oldTraffic?: RecordingDefinition,
    newTraffic?: RecordingDefinition
  ): Promise<void> {
    if (!oldTraffic || !newTraffic) {
      return;
    }

    debugMatching(
      `Matching HTTP calls ${oldTraffic.scope + oldTraffic.path} : ${
        newTraffic.scope + newTraffic.path
      }`
    );

    // method
    debugMatching('\trequest method');
    if (oldTraffic.method !== newTraffic.method) {
      this.errorCollector.add(
        ErrorType.CHANGE,
        new MatchErrorMethod(oldTraffic.method, newTraffic.method)
      );
    }

    // status
    debugMatching('\tresponse status');
    if (oldTraffic.status !== newTraffic.status) {
      this.errorCollector.add(
        ErrorType.CHANGE,
        new MatchErrorStatus(oldTraffic.status, newTraffic.status)
      );
    }

    // base URL
    debugMatching('\trequest base URL');
    if (oldTraffic.scope !== newTraffic.scope) {
      this.errorCollector.add(
        ErrorType.CHANGE,
        new MatchErrorBaseURL(oldTraffic.scope, newTraffic.scope)
      );
    }

    // path
    debugMatching('\trequest path');
    if (oldTraffic.path !== newTraffic.path) {
      this.errorCollector.add(
        ErrorType.CHANGE,
        new MatchErrorPath(oldTraffic.path, newTraffic.path)
      );
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
    this.matchRequestBody(oldTraffic.body, newTraffic.body, accept);

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

    const accept = getRequestHeader(oldHeaders, newHeaders, 'accept');

    this.addError(
      accept.old,
      accept.new,
      new MatchErrorRequestHeaders('Accept', accept.old, accept.new)
    );

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
    const contentType = getResponseHeader(
      oldHeaders,
      newHeaders,
      'content-type'
    );

    if (contentType.old !== contentType.new) {
      this.addError(
        contentType.old,
        contentType.new,
        new MatchErrorResponseHeaders(
          'Content-Type',
          contentType.old,
          contentType.new
        )
      );
    }

    // match content Encoding
    const contentEncoding = getResponseHeader(
      oldHeaders,
      newHeaders,
      'content-encoding'
    );

    if (contentEncoding.old !== contentEncoding.new) {
      this.addError(
        contentEncoding.old,
        contentEncoding.new,
        new MatchErrorResponseHeaders(
          'Content-Encoding',
          contentEncoding.old,
          contentEncoding.new
        )
      );
    }

    const contentLength = getResponseHeader(
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
    oldBody: unknown,
    newBody: unknown,
    accept?: MatchHeaders
  ): void {
    debugMatching('\trequest body');

    // TODO: try to parse string body or rather compare it plainly?
    // if body is not string and is defined - expect valid JSON
    let oldRequestBody = oldBody,
      newRequestBody = newBody;

    if (typeof oldBody === 'string') {
      oldRequestBody = parseBody(oldBody, accept?.old);
    }

    if (typeof newBody === 'string') {
      newRequestBody = parseBody(newBody, accept?.new);
    }

    if (oldRequestBody === undefined && newRequestBody === undefined) {
      return;
    }

    // if old body is empty string or undefined - we dont create JSON scheme
    if (oldRequestBody === undefined && newRequestBody !== undefined) {
      this.errorCollector.add(
        ErrorType.ADD,
        new MatchErrorRequestBody({ oldRequestBody, newRequestBody })
      );

      return;
    }

    if (oldRequestBody !== undefined && newRequestBody === undefined) {
      this.errorCollector.add(
        ErrorType.REMOVE,
        new MatchErrorRequestBody({ oldRequestBody, newRequestBody })
      );

      return;
    }

    // TODO: create own algorithm for parsing this
    const valid = this.createAndValidateSchema(oldRequestBody, newRequestBody);

    if (!valid) {
      debugMatchingSensitive(schemaValidator.errors);

      this.errorCollector.add(
        ErrorType.CHANGE,
        new MatchErrorRequestBody(schemaValidator.errorsText())
      );
    }
  }

  private static async matchResponse(
    oldRes: unknown,
    newRes: unknown,
    contentEncoding?: MatchHeaders
  ): Promise<void> {
    debugMatching('\tresponse');
    let oldResponse = oldRes,
      newResponse = newRes;

    // if responses are encoded - decode them
    if (contentEncoding?.old !== undefined) {
      debugMatching(
        `Decoding old response based on ${contentEncoding.old} encoding`
      );

      oldResponse = await decodeResponse(oldRes, contentEncoding.old);
    }

    if (contentEncoding?.new !== undefined) {
      debugMatching(
        `Decoding new response based on ${contentEncoding.new} encoding`
      );

      newResponse = await decodeResponse(newRes, contentEncoding.new);
    }

    // validate responses
    const valid = this.createAndValidateSchema(oldResponse, newResponse);

    if (!valid) {
      debugMatching(schemaValidator.errors);

      this.errorCollector.add(
        ErrorType.CHANGE,
        new MatchErrorResponse(
          { oldResponse, newResponse },
          schemaValidator.errorsText()
        )
      );
    }
  }

  private static createAndValidateSchema(
    base: unknown,
    payload: unknown
  ): boolean {
    const oldJsonSchema = createSchema(base);

    debugMatchingSensitive(
      'Generated JSON Schema from old recording:',
      inspect(oldJsonSchema, true, 25)
    );

    return schemaValidator.validate(oldJsonSchema, payload);
  }

  private static addError(
    oldPayload: undefined | unknown,
    newPayload: undefined | unknown,
    error: MatchError
  ) {
    if (oldPayload === undefined && newPayload !== undefined) {
      this.errorCollector.add(ErrorType.ADD, error);
    } else if (oldPayload !== undefined && newPayload === undefined) {
      this.errorCollector.add(ErrorType.REMOVE, error);
    } else if (oldPayload !== newPayload) {
      this.errorCollector.add(ErrorType.CHANGE, error);
    }
  }
}

export async function matchTraffic(
  oldRecordingPath: string,
  newTraffic: RecordingDefinitions
): Promise<AnalysisResult> {
  // recording file exist -> record and compare new traffic
  const oldRecording = await readFileQuiet(
    composeRecordingPath(oldRecordingPath)
  );

  if (oldRecording === undefined) {
    throw new UnexpectedError('Reading old recording file failed');
  }

  const oldRecordingDefs = JSON.parse(oldRecording) as RecordingDefinitions;

  // Match new HTTP traffic to saved for breaking changes
  const match = await Matcher.match(oldRecordingDefs, newTraffic);

  if (match.valid) {
    // do not save new recording as there were no breaking changes found
    return { impact: MatchImpact.NONE };
  } else {
    const impact = analyzeChangeImpact(match.errors);

    // Save new traffic
    await writeRecordings(
      composeRecordingPath(oldRecordingPath, 'new'),
      newTraffic
    );

    return { impact, errors: match.errors };
  }
}
