import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import { CoverageFileNotFoundError } from './common/errors';
import { exists, readFileQuiet, readFilesInDir, rimraf } from './common/io';
import { OutputStream } from './common/output-stream';
import { ErrorCollection, MatchError } from './nock/matcher.errors';
import {
  AnalysisResult,
  TestAnalysis,
  TestingReturn,
  TestReport,
} from './superface-test.interfaces';

export const DEFAULT_COVERAGE_PATH = 'superface-test-coverage';

const debug = createDebug('superface:testing:reporter');

/**
 * Saves provider change report along with input and result
 * on filesystem under /superface-test-coverage
 */
export async function saveReport({
  input,
  result,
  path,
  hash,
  analysis,
  recordingPath,
  profileId,
  providerName,
  useCaseName,
}: {
  input: NonPrimitive;
  result: TestingReturn;
  path: string;
  hash: string;
  recordingPath: string;
  analysis: AnalysisResult;
  profileId: string;
  providerName: string;
  useCaseName: string;
}): Promise<void> {
  debug('Saving coverage report');
  const coveragePath = joinPath(
    DEFAULT_COVERAGE_PATH,
    path,
    `coverage-${hash}.json`
  );

  const data: TestAnalysis = {
    ...analysis,
    errors: parseErrors(analysis.errors),
    recordingPath,
    profileId,
    providerName,
    useCaseName,
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

/**
 * Parses catched errors to strings.
 *
 * @param errors error collection with MatchError instances
 * @returns error collection with strings
 */
function parseErrors(
  errors: ErrorCollection<MatchError>
): ErrorCollection<string> {
  const result: ErrorCollection<string> = {
    added: [],
    changed: [],
    removed: [],
  };

  for (const error of errors.added) {
    result.added.push(error.toString());
  }

  for (const error of errors.removed) {
    result.removed.push(error.toString());
  }

  for (const error of errors.changed) {
    result.changed.push(error.toString());
  }

  return result;
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

    const coverage = JSON.parse(data) as TestAnalysis;

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
