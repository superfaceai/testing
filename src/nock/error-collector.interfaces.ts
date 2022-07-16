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
}

interface MatchErrorStringBase extends MatchErrorBase {
  kind: MatchErrorKind;
  old?: string;
  new?: string;
}

interface MatchErrorLength extends MatchErrorBase {
  kind: MatchErrorKind.LENGTH;
  old: number;
  new: number;
}

interface MatchErrorMethod extends MatchErrorStringBase {
  kind: MatchErrorKind.METHOD;
}

interface MatchErrorStatus extends MatchErrorBase {
  kind: MatchErrorKind.STATUS;
  old?: number;
  new?: number;
}

interface MatchErrorBaseURL extends Required<MatchErrorStringBase> {
  kind: MatchErrorKind.BASE_URL;
}

interface MatchErrorPath extends Required<MatchErrorStringBase> {
  kind: MatchErrorKind.PATH;
}

interface MatchErrorResponseHeaders extends MatchErrorStringBase {
  kind: MatchErrorKind.RESPONSE_HEADERS;
  headerName: string;
}

interface MatchErrorRequestHeaders extends MatchErrorStringBase {
  kind: MatchErrorKind.REQUEST_HEADERS;
  headerName: string;
}

interface MatchErrorRequestBody extends MatchErrorBase {
  kind: MatchErrorKind.REQUEST_BODY;
  old?: unknown;
  new?: unknown;
  schemeValidation?: string;
}

interface MatchErrorResponse extends MatchErrorBase {
  kind: MatchErrorKind.RESPONSE;
  old: unknown;
  new: unknown;
  schemeValidation?: string;
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

export interface IErrorCollector {
  readonly recordingPath: string;

  add: (error: MatchError) => void;
  get: (kind?: MatchErrorKind) => MatchError[];
}
