// import { RecordingDefinition } from './superface-test.interfaces';

export interface IOverview {
  run: (...params: any) => Promise<void> | void;
  display: () => string;
}

export interface IRecordingOverview extends IOverview {
  recordings?: Record<string, {}>;
  used?: number;
  skipped?: number;
  overall?: number;
}

export class RecordingOverview implements IRecordingOverview {
  recordings: Record<string, {}> = {};
  used?: number;
  skipped?: number;
  overall?: number;

  public run(recordingPath: string) {
    this.recordings[recordingPath] = {};
  }

  public display(): string {
    return Object.keys(this.recordings).join('\n');
  }
}

export function recordingOverviewFactory(): IRecordingOverview {
  return new RecordingOverview();
}
