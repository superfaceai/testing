import { RecordingDefinition } from '../recording.interfaces';

export interface ReplaceOptions {
  definition: RecordingDefinition;
  credential: string;
  placeholder: string;
}
