import * as fs from 'fs';
import rimrafCallback from 'rimraf';
import { Writable } from 'stream';
import { promisify } from 'util';

import { assertIsIOError } from './errors';

export const mkdir = promisify(fs.mkdir);
export const access = promisify(fs.access);
export const rimraf = promisify(rimrafCallback);

export interface WritingOptions {
  append?: boolean;
  force?: boolean;
  dirs?: boolean;
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
  } catch (err: unknown) {
    assertIsIOError(err);

    // Allow `ENOENT` because it answers the question.
    if (err.code === 'ENOENT') {
      return false;
    }

    // Rethrow other errors.
    throw err;
  }

  // No error, no problem.
  return true;
}

export function streamWrite(stream: Writable, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeMore = stream.write(data, 'utf-8');

    if (!writeMore) {
      stream.once('error', reject);
      stream.once('drain', resolve);
    } else {
      resolve();
    }
  });
}

export function streamEnd(stream: Writable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.once('close', resolve);
    stream.end();
  });
}
