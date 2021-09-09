import * as fs from 'fs';
import { dirname } from 'path';
import rimrafCallback from 'rimraf';
import { Writable } from 'stream';
import { inspect, promisify } from 'util';

export const mkdir = promisify(fs.mkdir);
export const access = promisify(fs.access);
export const rimraf = promisify(rimrafCallback);

export interface WritingOptions {
  append?: boolean;
  force?: boolean;
  dirs?: boolean;
}

export function assertIsIOError(
  error: unknown
): asserts error is { code: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: Record<string, any> = error;
    if (typeof err.code === 'string') {
      return;
    }
  }

  throw new Error(`unexpected error: ${inspect(error)}`);
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

export async function writeOnce(
  path: string,
  data: string,
  options?: WritingOptions
): Promise<void> {
  if (options?.dirs === true) {
    await mkdir(dirname(path), { recursive: true });
  }

  const stream = fs.createWriteStream(path, {
    flags: options?.append ? 'a' : 'w',
    mode: 0o644,
    encoding: 'utf-8',
  });

  await streamWrite(stream, data);

  return streamEnd(stream);
}

/**
 * Creates file with given contents if it doesn't exist.
 *
 * Returns whether the file was created.
 *
 * For convenience the `force` option can be provided
 * to force the creation.
 *
 * The `dirs` option additionally recursively creates
 * directories up until the file path.
 */
export async function writeIfAbsent(
  path: string,
  data: string | (() => string),
  options?: WritingOptions
): Promise<boolean> {
  if (options?.force === true || !(await exists(path))) {
    const dat = typeof data === 'string' ? data : data();

    await writeOnce(path, dat, options);

    return true;
  }

  return false;
}
