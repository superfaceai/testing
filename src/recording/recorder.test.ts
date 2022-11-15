import { define, disableNetConnect, recorder, restore } from 'nock';
import { mocked } from 'ts-jest/utils';

import { endRecording, loadRecordings, startRecording } from './recorder';

jest.mock('nock');
jest.mock('./utils');

const sampleRecordings = {
  scope: 'https://localhost',
  path: '/',
  status: 200,
  response: {},
};

describe('Recorder', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('startRecording', () => {
    it('starts nock recording', () => {
      const recorderSpy = jest.spyOn(recorder, 'rec');

      startRecording();

      expect(recorderSpy).toBeCalledTimes(1);
      expect(recorderSpy).toBeCalledWith({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording: false,
      });
    });
  });

  describe('endRecording', () => {
    it('clears and restores recordings', () => {
      const clearSpy = jest.spyOn(recorder, 'clear');
      const restoreSpy = mocked(restore);

      endRecording();

      expect(clearSpy).toBeCalled();
      expect(restoreSpy).toBeCalled();
    });

    it('returns recorded traffic', () => {
      jest.spyOn(recorder, 'play').mockReturnValue([sampleRecordings]);

      expect(endRecording()).toEqual([sampleRecordings]);
    });
  });

  describe('loadRecording', () => {
    it('intercepts traffic', async () => {
      const defineSpy = mocked(define);

      await loadRecordings([sampleRecordings]);

      expect(defineSpy).toBeCalledTimes(1);
      expect(defineSpy).toBeCalledWith([sampleRecordings]);
    });

    it('Disables HTTP traffic', async () => {
      const disableNetConnectSpy = mocked(disableNetConnect);
      mocked(define);

      await loadRecordings([]);

      expect(disableNetConnectSpy).toBeCalledTimes(1);
    });
  });
});
