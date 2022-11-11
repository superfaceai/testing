import { RecordingDefinitions } from '../recording/recording.interfaces';
import { MatchError } from './errors';

export interface IMatcher {
  match: (
    oldRecordings: RecordingDefinitions,
    newRecordings: RecordingDefinitions
  ) => Promise<boolean>;
}

export interface MatchHeaders {
  old?: string;
  new?: string;
}

export interface RequestHeaderMatch {
  accept?: MatchHeaders;
}

export interface ResponseHeaderMatch {
  contentEncoding?: MatchHeaders;
  contentType?: MatchHeaders;
  contentLength?: MatchHeaders;
}

export type ErrorCollection<T extends MatchError | string> = {
  added: T[];
  removed: T[];
  changed: T[];
};

export type MatchResult =
  | { valid: true }
  | { valid: false; errors: ErrorCollection<MatchError> };
