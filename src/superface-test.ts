import { err, ok, PerformError, Result } from '@superfaceai/one-sdk';
import createDebug from 'debug';

import { RecordingProcessOptions } from '.';
import { UnexpectedError } from './common/errors';
import {
  getFixtureName,
  matchWildCard,
  removeTimestamp,
} from './common/format';
import { IRecorder, Recorder } from './nock/recorder';
import { ITestConfig, TestConfig } from './superface/config';
import {
  NockConfig,
  SuperfaceTestConfigPayload,
  SuperfaceTestRun,
  TestingReturn,
} from './superface-test.interfaces';
import { getGenerator, searchValues } from './superface-test.utils';

const debug = createDebug('superface:testing');

export class SuperfaceTest {
  private config: ITestConfig;
  private recorder: IRecorder;

  constructor(payload?: SuperfaceTestConfigPayload, nockConfig?: NockConfig) {
    this.config = new TestConfig(payload ?? {});
    this.recorder = new Recorder(
      getGenerator(nockConfig?.testInstance),
      nockConfig
    );
  }

  /**
   * Tests current configuration whether all necessary components
   * are defined and ready to use and tries to perform entered usecase.
   */
  async run(
    testCase: SuperfaceTestRun,
    options?: RecordingProcessOptions
  ): Promise<TestingReturn> {
    this.config.updateConfig(testCase);
    await this.config.setup();

    const config = this.config.get();

    // this.boundProfileProvider =
    //   await this.sfConfig.client.cacheBoundProfileProvider(
    //     config.profile.configuration,
    //     config.provider.configuration
    //   );

    this.recorder.setup(
      testCase.input,
      getFixtureName(config),
      testCase.testName
    );

    // Parse env variable and check if test should be recorded
    const record = matchWildCard(config, process.env.SUPERFACE_LIVE_API);
    const processRecordings = options?.processRecordings ?? true;
    const inputVariables = searchValues(testCase.input, options?.hideInput);

    await this.recorder.start(
      record,
      processRecordings,
      config.provider,
      config.boundProfileProvider,
      inputVariables,
      options?.beforeRecordingLoad
    );

    let result: Result<unknown, PerformError>;
    try {
      // Run perform method on specified configuration
      result = await config.useCase.perform(testCase.input, {
        provider: config.provider,
      });

      await this.recorder.end(
        record,
        processRecordings,
        config.provider,
        config.boundProfileProvider,
        inputVariables,
        options?.beforeRecordingSave
      );
    } catch (error: unknown) {
      this.recorder.restore();

      throw error;
    }

    if (result.isErr()) {
      debug('Perform failed with error:', result.error.toString());

      return err(removeTimestamp(result.error.toString()));
    }

    if (result.isOk()) {
      debug('Perform succeeded with result:', result.value);

      return ok(result.value);
    }

    throw new UnexpectedError('Unexpected result object');
  }
}
