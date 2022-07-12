import { RecordingDefinitions } from './nock';

export interface IMatcher {
  match: (
    oldRecordings: RecordingDefinitions,
    newRecordings: RecordingDefinitions
  ) => Promise<boolean>;
}
