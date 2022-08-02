import { FileSystemError, IFileSystem, ok, Result } from '@superfaceai/one-sdk';

export const mockFileSystem = (
  fileSystem?: Partial<IFileSystem>
): IFileSystem => ({
  sync: {
    exists: fileSystem?.sync?.exists ?? jest.fn(() => true),
    isAccessible: fileSystem?.sync?.isAccessible ?? jest.fn(() => true),
    isDirectory: fileSystem?.sync?.isDirectory ?? jest.fn(() => false),
    isFile: fileSystem?.sync?.isFile ?? jest.fn(() => true),
    mkdir: fileSystem?.sync?.mkdir ?? jest.fn(() => ok(undefined)),
    readFile: fileSystem?.sync?.readFile ?? jest.fn(() => ok('')),
    readdir: fileSystem?.sync?.readdir ?? jest.fn(() => ok([])),
    rm: fileSystem?.sync?.rm ?? jest.fn(() => ok(undefined)),
    writeFile: fileSystem?.sync?.writeFile ?? jest.fn(() => ok(undefined)),
  },
  path: {
    cwd: jest.fn(() => '.'),
    dirname: fileSystem?.path?.dirname ?? jest.fn(() => ''),
    join:
      fileSystem?.path?.join ??
      jest.fn((...strings: string[]) => strings.join('/')),
    normalize: fileSystem?.path?.normalize ?? jest.fn((path: string) => path),
    resolve: fileSystem?.path?.resolve ?? jest.fn(() => ''),
    relative: fileSystem?.path?.relative ?? jest.fn(() => ''),
  },
  exists: fileSystem?.exists ?? jest.fn(async () => true),
  isAccessible: fileSystem?.isAccessible ?? jest.fn(async () => true),
  isDirectory: fileSystem?.isDirectory ?? jest.fn(async () => true),
  isFile: fileSystem?.isFile ?? jest.fn(async () => true),
  mkdir:
    fileSystem?.mkdir ??
    jest.fn(async (): Promise<Result<void, FileSystemError>> => ok(undefined)),
  readFile:
    fileSystem?.readFile ??
    jest.fn(async (): Promise<Result<string, FileSystemError>> => ok('')),
  readdir:
    fileSystem?.readdir ??
    jest.fn(async (): Promise<Result<string[], FileSystemError>> => ok([])),
  rm:
    fileSystem?.rm ??
    jest.fn(async (): Promise<Result<void, FileSystemError>> => ok(undefined)),
  writeFile:
    fileSystem?.writeFile ??
    jest.fn(async (): Promise<Result<void, FileSystemError>> => ok(undefined)),
});
