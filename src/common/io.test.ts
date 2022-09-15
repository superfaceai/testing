import { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import { join as joinPath, resolve as resolvePath } from 'path';
import { Writable } from 'stream';

import { mockSuperJson } from '../superface/mock/super-json';
import {
  exists,
  mkdirQuiet,
  readFilesInDir,
  rimraf,
  streamEnd,
  streamWrite,
} from './io';
import { OutputStream } from './output-stream';

describe('IO functions', () => {
  const WORKING_DIR = joinPath('fixtures', 'io');

  const FIXTURE = {
    superJson: joinPath('superface', 'super.json'),
  };

  let INITIAL_CWD: string;
  let INITIAL_SUPER_JSON: NormalizedSuperJsonDocument;

  //Mock writable stream for testing backpressure
  class MockWritable extends Writable {
    constructor(private writeMore: boolean) {
      super();
    }

    override write(_chunk: any): boolean {
      return this.writeMore;
    }
  }

  beforeAll(async () => {
    INITIAL_CWD = process.cwd();
    process.chdir(WORKING_DIR);

    INITIAL_SUPER_JSON = mockSuperJson().document;
  });

  afterAll(async () => {
    await resetSuperJson();

    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await OutputStream.writeOnce(
      FIXTURE.superJson,
      JSON.stringify(INITIAL_SUPER_JSON, undefined, 2)
    );
  }

  beforeEach(async () => {
    await resetSuperJson();
  });

  afterEach(async () => {
    await rimraf('test');
  });

  describe('when checking if file exists', () => {
    it('checks file existence correctly', async () => {
      await expect(exists(FIXTURE.superJson)).resolves.toEqual(true);
      await expect(exists('superface')).resolves.toEqual(true);
      await expect(exists('some/made/up/file.json')).resolves.toEqual(false);
    }, 10000);
  });

  describe('when writing to stream', () => {
    it('rejects if a stream error occurs', async () => {
      const mockWriteable = new MockWritable(false);
      const actualPromise = streamWrite(mockWriteable, 'test/mockFile.json');
      setTimeout(() => {
        mockWriteable.emit('error');
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).rejects.toBeUndefined();
    }, 10000);

    it('resolves if drain occurs', async () => {
      const mockWriteable = new MockWritable(false);
      const actualPromise = streamWrite(mockWriteable, 'test/mockFile.json');
      setTimeout(() => {
        mockWriteable.emit('drain');
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);

    it('resolves if stream is not backpressured', async () => {
      const mockWriteable = new MockWritable(true);
      const actualPromise = streamWrite(mockWriteable, 'test/mockFile.json');
      setTimeout(() => {
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('when calling stream end', () => {
    it('resolves if close occurs', async () => {
      const mockWriteable = new MockWritable(false);
      const actualPromise = streamEnd(mockWriteable);
      setTimeout(() => {
        mockWriteable.emit('close');
        mockWriteable.emit('end');
      }, 100);
      await expect(actualPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('when reading files in directory', () => {
    it('fails when directory does not exist', async () => {
      const dirname = 'not-existing-directory';

      await expect(readFilesInDir(dirname)).rejects.toThrow();
    });

    it('returns empty array when directory has no files', async () => {
      const dirname = 'test';
      await mkdirQuiet(dirname);

      await expect(readFilesInDir(dirname)).resolves.toEqual([]);
    });

    it('returns list of files in directory', async () => {
      const dirname = 'test';
      const expectedFileName = joinPath(dirname, 'test.json');

      // prepare
      await mkdirQuiet(dirname);
      await OutputStream.writeIfAbsent(expectedFileName, 'test');

      await expect(readFilesInDir(dirname)).resolves.toEqual(
        expect.arrayContaining([resolvePath(expectedFileName)])
      );
    });

    it('returns list of files, even nested in directories', async () => {
      const dirname = 'test';
      const expectedFileName1 = joinPath(dirname, 'test.json');
      const expectedFileName2 = joinPath(dirname, 'nested', 'test.json');
      const expectedFileName3 = joinPath(
        dirname,
        'nested',
        'nested',
        'test.json'
      );

      // prepare
      const options = { dirs: true };
      await OutputStream.writeIfAbsent(expectedFileName1, 'test', options);
      await OutputStream.writeIfAbsent(expectedFileName2, 'test', options);
      await OutputStream.writeIfAbsent(expectedFileName3, 'test', options);

      await expect(readFilesInDir(dirname)).resolves.toEqual(
        expect.arrayContaining([
          resolvePath(expectedFileName1),
          resolvePath(expectedFileName2),
          resolvePath(expectedFileName3),
        ])
      );
    });
  });
});
