import {
  detectSuperJson,
  err,
  loadSuperJson,
  SDKExecutionError,
} from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import {
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
} from '../../common/errors';
import { getSuperJson } from './prepare-super-json';

jest.mock('@superfaceai/one-sdk', () => ({
  ...jest.requireActual('@superfaceai/one-sdk'),
  detectSuperJson: jest.fn(),
  loadSuperJson: jest.fn(),
}));

describe('prepare-super-json', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getSuperJson', () => {
    it('throws when detecting superJson fails', async () => {
      const detectSpy = mocked(detectSuperJson).mockResolvedValue(undefined);

      await expect(getSuperJson()).rejects.toThrowError(
        new SuperJsonNotFoundError()
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSuperJson).not.toHaveBeenCalled();
    });

    it('throws when superJson loading fails', async () => {
      const loadingError = new SDKExecutionError('super.json error', [], []);

      const detectSpy = mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = mocked(loadSuperJson).mockResolvedValue(
        err(loadingError)
      );

      await expect(getSuperJson()).rejects.toThrowError(
        new SuperJsonLoadingFailedError(loadingError)
      );

      expect(detectSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
