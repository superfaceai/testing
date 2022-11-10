import { RecordingDefinition } from './recording';

export interface ReplaceOptions {
  definition: RecordingDefinition;
  credential: string;
  placeholder: string;
}
