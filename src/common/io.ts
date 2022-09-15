import * as fs from 'fs';
import { join as joinPath, resolve as resolvePath } from 'path';
import rimrafCallback from 'rimraf';
import { Writable } from 'stream';
import { promisify } from 'util';

import { assertIsIOError } from './errors';

export const access = promisify(fs.access);
export const mkdir = promisify(fs.mkdir);
export const readFile = promisify(fs.readFile);
export const rimraf = promisify(rimrafCallback);
export const rename = promisify(fs.rename);
export const readdir = promisify(fs.readdir);

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

/**
 * Creates a directory without erroring if it already exists.
 * Returns `true` if the directory was created.
 */
export async function mkdirQuiet(path: string): Promise<void> {
  try {
    await mkdir(path);
  } catch (err: unknown) {
    assertIsIOError(err);

    // Allow `EEXIST` because scope directory already exists.
    if (err.code === 'EEXIST') {
      return;
    }

    // Rethrow other errors.
    throw err;
  }
}

/**
 * Reads a file and converts to string.
 * Returns `undefined` if reading fails for any reason.
 */
export async function readFileQuiet(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, { encoding: 'utf8' });
  } catch (_) {
    return undefined;
  }
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

export async function readFilesInDir(path: string): Promise<string[]> {
  const resolvedPath = resolvePath(path);
  const dirents = await readdir(path, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      files.push(
        ...(await readFilesInDir(joinPath(resolvedPath, dirent.name)))
      );
    } else {
      files.push(joinPath(resolvedPath, dirent.name));
    }
  }

  return files;
}
