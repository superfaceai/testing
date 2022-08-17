import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';
import { join as joinPath } from 'path';
import { CoverageFileNotFoundError } from './common/errors';

import { exists, readFileQuiet, readFilesInDir, rimraf } from './common/io';
import { OutputStream } from './common/output-stream';
import { AnalysisResult } from './nock/analyzer';
import {
  TestCoverageBase,
  TestingReturn,
  TestReport,
} from './superface-test.interfaces';

export const DEFAULT_COVERAGE_PATH = 'superface-test-coverage';

const debug = createDebug('superface:testing:reporter');

export async function saveReport({
  input,
  result,
  path,
  hash,
  analysis,
}: {
  input: NonPrimitive;
  result: TestingReturn;
  path: string;
  hash: string;
  analysis: AnalysisResult;
}): Promise<void> {
  debug('Saving coverage report');
  const coveragePath = joinPath(
    DEFAULT_COVERAGE_PATH,
    path,
    `coverage-${hash}.json`
  );
  const data: TestCoverageBase = {
    ...analysis,
    input,
    result,
  };

  debug(`Writing report on path "${coveragePath}"`);
  const write = await OutputStream.writeIfAbsent(
    coveragePath,
    JSON.stringify(data, null, 2),
    { dirs: true, force: true }
  );

  if (!write) {
    console.warn('Writing coverage data failed');
  }
}

export async function report(
  alert: (analysis: TestReport) => unknown | Promise<unknown>,
  _options?: { onlyFailedTests?: boolean }
): Promise<void> {
  debug('Collecting reports from superface runs');
  if (!(await exists(DEFAULT_COVERAGE_PATH))) {
    debug('Directory with reports is not created yet');

    return;
  }

  const paths = await readFilesInDir(DEFAULT_COVERAGE_PATH);
  debug('Available paths:', paths.join('\n'));

  const report: TestReport = [];
  for (const path of paths) {
    const data = await readFileQuiet(path);

    if (!data) {
      throw new CoverageFileNotFoundError(path);
    }

    const coverage = JSON.parse(data) as TestCoverageBase;

    report.push(coverage);

    // TODO:
    // filter data based on parameters
  }

  // remove coverage as it is no longer needed
  await rimraf(DEFAULT_COVERAGE_PATH);

  debug(`Alerting test analysis report. Analysis Count: ${report.length}`);
  await alert(report);
}

// TODO: collect coverage for completed test, put them into batch and add info about test result
// async function collect(): Promise<void> {
//   // TODO: find a way to get to correct path without concurrency problems
//   // const basePath = joinPath('./coverage');
//   // const write = await OutputStream.writeIfAbsent(path, data, { dirs: true });
//   // if (!write) {
//   //   console.warn('Writing coverage data failed');
//   // }
// }
