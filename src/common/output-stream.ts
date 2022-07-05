import * as fs from 'fs';
import { dirname } from 'path';
import { Writable } from 'stream';

import { RecordingDefinition } from '..';
import { exists, streamEnd, streamWrite, WritingOptions } from './io';

export class OutputStream {
  readonly stream: Writable;

  constructor(path: string, options?: WritingOptions) {
    if (options?.dirs === true) {
      const dir = dirname(path);
      fs.mkdirSync(dir, { recursive: true });
    }

    this.stream = fs.createWriteStream(path, {
      flags: options?.append ? 'a' : 'w',
      mode: 0o644,
      encoding: 'utf-8',
    });
  }

  write(data: string): Promise<void> {
    return streamWrite(this.stream, data);
  }

  cleanup(): Promise<void> {
    return streamEnd(this.stream);
  }

  static async writeOnce(
    path: string,
    data: string,
    options?: WritingOptions
  ): Promise<void> {
    const stream = new OutputStream(path, options);

    await stream.write(data);

    return stream.cleanup();
  }

  static async writeIfAbsent(
    path: string,
    data: string | (() => string),
    options?: WritingOptions
  ): Promise<boolean> {
    if (options?.force === true || !(await exists(path))) {
      const dat = typeof data === 'string' ? data : data();

      await OutputStream.writeOnce(path, dat, options);

      return true;
    }

    return false;
  }
}

export async function writeRecordings(
  path: string,
  recordings: string[] | RecordingDefinition[]
): Promise<void> {
  await OutputStream.writeIfAbsent(path, JSON.stringify(recordings, null, 2), {
    dirs: true,
    force: true,
  });
}
