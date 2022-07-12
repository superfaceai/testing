import { RecordingDefinition } from './nock';

export interface ReplaceOptions {
  definition: RecordingDefinition;
  credential: string;
  placeholder: string;
}
