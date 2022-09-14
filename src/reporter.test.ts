import { ok } from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';
import { mocked } from 'ts-jest/utils';

import { CoverageFileNotFoundError } from './common/errors';
import { exists, readFileQuiet, readFilesInDir } from './common/io';
import { OutputStream } from './common/output-stream';
import { MatchImpact } from './nock/analyzer';
import { DEFAULT_COVERAGE_PATH, report, saveReport } from './reporter';
import { ImpactResult, TestReport } from './superface-test.interfaces';

jest.mock('./common/io');

const sampleHash = 'XXX';
const samplePath = joinPath('profile', 'provider', 'test');
const sampleAnalysisResult: ImpactResult = {
  errors: { added: [], changed: [], removed: [] },
  impact: MatchImpact.PATCH,
};
const sampleTestResult = {
  recordingPath: '',
  profileId: 'profile',
  providerName: 'provider',
  useCaseName: 'test',
};

describe('Reporter module', () => {
  describe('saveReport', () => {
    it('composes path to coverage report', async () => {
      const writeIfAbsentSpy = jest
        .spyOn(OutputStream, 'writeIfAbsent')
        .mockResolvedValue(true);

      const expectedPath = joinPath(
        DEFAULT_COVERAGE_PATH,
        samplePath,
        `coverage-XXX.json`
      );
      const expectedReport = {
        ...sampleAnalysisResult,
        ...sampleTestResult,
        input: {},
        result: ok(''),
      };

      await expect(
        saveReport({
          input: {},
          result: ok(''),
          hash: sampleHash,
          analysis: sampleAnalysisResult,
          ...sampleTestResult,
        })
      ).resolves.toBeUndefined();

      expect(writeIfAbsentSpy).toBeCalledTimes(1);
      expect(writeIfAbsentSpy).toBeCalledWith(
        expectedPath,
        JSON.stringify(expectedReport, null, 2),
        { dirs: true, force: true }
      );
    });

    it('warns that writing failed, when writeIfAbsent returns false', async () => {
      const consoleOutput: string[] = [];
      const originalWarn = console.warn;
      const mockedWarn = (output: string) => consoleOutput.push(output);
      console.warn = mockedWarn;

      jest.spyOn(OutputStream, 'writeIfAbsent').mockResolvedValue(false);

      await saveReport({
        input: {},
        result: ok(''),
        hash: sampleHash,
        analysis: sampleAnalysisResult,
        ...sampleTestResult,
      });

      expect(consoleOutput).toEqual(['Writing coverage data failed']);

      console.warn = originalWarn;
    });
  });

  describe('report', () => {
    it('does not look for files, if coverage directory was not found', async () => {
      const existsSpy = mocked(exists).mockResolvedValue(false);
      const readFilesInDirSpy = mocked(readFilesInDir);

      await report((_analysis: TestReport) => ({}));

      expect(existsSpy).toBeCalledTimes(1);
      expect(existsSpy).toBeCalledWith(DEFAULT_COVERAGE_PATH);

      expect(readFilesInDirSpy).not.toBeCalled();
    });

    it('fails when found file cannot be found', async () => {
      const samplePath = 'path/to/coverage.json';
      mocked(exists).mockResolvedValue(true);
      const readFilesInDirSpy = mocked(readFilesInDir).mockResolvedValue([
        samplePath,
      ]);
      const readFileQuietSpy =
        mocked(readFileQuiet).mockResolvedValue(undefined);

      await expect(
        report((_analysis: TestReport) => ({}))
      ).rejects.toThrowError(new CoverageFileNotFoundError(samplePath));

      expect(readFilesInDirSpy).toBeCalledTimes(1);
      expect(readFilesInDirSpy).toBeCalledWith(DEFAULT_COVERAGE_PATH);

      expect(readFileQuietSpy).toBeCalledTimes(1);
      expect(readFileQuietSpy).toBeCalledWith(samplePath);
    });

    it('calls injected alert function with parsed files', async () => {
      const sampleReport = {
        ...sampleAnalysisResult,
        input: {},
        result: ok(''),
      };
      const alertSpy = jest.fn();

      mocked(exists).mockResolvedValue(true);
      mocked(readFilesInDir).mockResolvedValue([samplePath]);
      mocked(readFileQuiet).mockResolvedValue(JSON.stringify(sampleReport));

      await expect(report(alertSpy)).resolves.toBeUndefined();

      expect(alertSpy).toBeCalledTimes(1);
      expect(alertSpy).toBeCalledWith([sampleReport]);
    });
  });
});
