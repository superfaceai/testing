import { SuperJson } from '@superfaceai/one-sdk';
import { join } from 'path';
import { Writable } from 'stream';

import { exists, rimraf, streamEnd, streamWrite, writeOnce } from './io';

describe('IO functions', () => {
  const WORKING_DIR = join('fixtures', 'io');

  const FIXTURE = {
    superJson: join('superface', 'super.json'),
  };

  let INITIAL_CWD: string;
  let INITIAL_SUPER_JSON: SuperJson;

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

    INITIAL_SUPER_JSON = (await SuperJson.load(FIXTURE.superJson)).unwrap();
  });

  afterAll(async () => {
    await resetSuperJson();

    // change cwd back
    process.chdir(INITIAL_CWD);
  });

  /** Resets super.json to initial state stored in `INITIAL_SUPER_JSON` */
  async function resetSuperJson() {
    await writeOnce(
      FIXTURE.superJson,
      JSON.stringify(INITIAL_SUPER_JSON.document, undefined, 2)
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
});
