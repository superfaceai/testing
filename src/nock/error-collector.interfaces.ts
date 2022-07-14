export enum MatchErrorKind {
  LENGTH,
  METHOD,
  STATUS,
  BASE_URL,
  PATH,
  RESPONSE_HEADERS,
  REQUEST_HEADERS,
  REQUEST_BODY,
  RESPONSE,
}

interface MatchErrorBase {
  kind: MatchErrorKind;
  message: string;
}

interface MatchErrorStringBase extends MatchErrorBase {
  kind: MatchErrorKind;
  old?: string;
  new?: string;
}

interface MatchErrorLength extends MatchErrorBase {
  kind: MatchErrorKind.LENGTH;
}

interface MatchErrorMethod extends MatchErrorStringBase {
  kind: MatchErrorKind.METHOD;
}

interface MatchErrorStatus extends MatchErrorBase {
  kind: MatchErrorKind.STATUS;
  old?: number;
  new?: number;
}

interface MatchErrorBaseURL extends MatchErrorStringBase {
  kind: MatchErrorKind.BASE_URL;
}

interface MatchErrorPath extends MatchErrorStringBase {
  kind: MatchErrorKind.PATH;
}

interface MatchErrorResponseHeaders extends MatchErrorStringBase {
  kind: MatchErrorKind.RESPONSE_HEADERS;
}

interface MatchErrorRequestHeaders extends MatchErrorStringBase {
  kind: MatchErrorKind.REQUEST_HEADERS;
}

interface MatchErrorRequestBody extends MatchErrorBase {
  kind: MatchErrorKind.REQUEST_BODY;
  old?: unknown;
  new?: unknown;
}

interface MatchErrorResponse extends MatchErrorBase {
  kind: MatchErrorKind.RESPONSE;
  old: unknown;
  new: unknown;
}

export type MatchError =
  | MatchErrorLength
  | MatchErrorMethod
  | MatchErrorStatus
  | MatchErrorBaseURL
  | MatchErrorPath
  | MatchErrorResponseHeaders
  | MatchErrorRequestHeaders
  | MatchErrorRequestBody
  | MatchErrorResponse;
