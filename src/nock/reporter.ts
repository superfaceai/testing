import createDebug from 'debug';
import { join as joinPath } from 'path';
import { exists, readFileQuiet, readFilesInDir, rimraf } from '../common/io';
import { OutputStream } from '../common/output-stream';

import {
  TestAnalysis,
  TestCoverageBase,
  TestingReturn,
} from '../superface-test.interfaces';
import { AnalysisResult } from './analyzer';

const DEFAULT_COVERAGE_PATH = 'coverage';

const debug = createDebug('superface:testing:reporter');

export class Reporter {
  // TODO: hash this or collect this, so that `collect` function can add information about test result
  static async save({
    result,
    path,
    hash,
    analysis,
  }: {
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
    const { profile, provider, useCase, impact, errors } = analysis;
    const data: TestCoverageBase = {
      recordingErrors: errors.join('\n'),
      profile,
      provider,
      useCase,
      impact,
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

  // TODO: collect coverage for completed test, put them into batch and add info about test result
  static async collect(): Promise<void> {
    // TODO: find a way to get to correct path without concurrency problems
    
    // const basePath = joinPath('./coverage');
    // const write = await OutputStream.writeIfAbsent(path, data, { dirs: true });
    // if (!write) {
    //   console.warn('Writing coverage data failed');
    // }
  }

  static async report(
    alert: (analysis: TestAnalysis) => unknown | Promise<unknown>,
    _options?: { onlyFailedTests?: boolean }
  ): Promise<void> {
    debug('Collecting reports from superface runs');
    if (!(await exists(DEFAULT_COVERAGE_PATH))) {
      debug('Directory with reports is not created yet');

      return;
    }

    const paths = await readFilesInDir(DEFAULT_COVERAGE_PATH);
    debug('Available paths:', paths.join('\n'));

    const analysis: TestAnalysis = [];
    for (const path of paths) {
      const data = await readFileQuiet(path);

      if (!data) {
        throw new Error('Loading coverage failed');
      }

      const coverage = JSON.parse(data) as TestCoverageBase;

      analysis.push(coverage);

      // TODO:
      // filter data based on parameters
    }

    // remove coverage as it is no longer needed
    await rimraf(DEFAULT_COVERAGE_PATH);

    debug(`Alerting coverage analysis. Analysis Count: ${analysis.length}`);
    await alert(analysis);
  }
}
