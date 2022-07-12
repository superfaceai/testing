import {
  err,
  ok,
  PerformError,
  Provider,
  Result,
  UseCase,
} from '@superfaceai/one-sdk';
import { NonPrimitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import { RecordingsNotFoundError, UnexpectedError } from '../common/errors';
import { matchWildCard, removeTimestamp } from '../common/format';
import {
  ITestConfig,
  NockConfig,
  RecordingDefinitions,
  RecordingProcessOptions,
  SuperfaceTestRun,
  TestingReturn,
  TestPayload,
} from '../interfaces';
import { IMatcher } from '../interfaces/matcher';
import { getGenerator } from '../nock/hash-generator';
import { match } from '../nock/matcher';
import {
  IRecordingController,
  RecordingController,
} from '../nock/recording-controller';
import { TestConfig } from '../superface/config';
import { searchValues } from './utils';

const debug = createDebug('superface:testing');

export class SuperfaceTest {
  private config: ITestConfig;
  private recordingController: IRecordingController;
  private matcher?: IMatcher;

  constructor(payload?: TestPayload, nockConfig?: NockConfig) {
    this.config = new TestConfig(payload ?? {});
    this.recordingController = new RecordingController(
      getGenerator(nockConfig?.testInstance),
      nockConfig
    );

    // this.matcher = new Matcher();
  }

  /**
   * Tests current configuration whether all necessary components
   * are defined and ready to use and tries to perform entered usecase.
   */
  async run(
    input: NonPrimitive,
    testCase: SuperfaceTestRun,
    options?: RecordingProcessOptions
  ): Promise<TestingReturn> {
    const config = await this.config.get(testCase);
    const { profile, provider, boundProfileProvider, useCase } = config;
    const fixtureName = joinPath(
      profile.configuration.id,
      provider.configuration.name,
      useCase.name
    );

    // Parse env variable and check if test should be recorded
    const record = matchWildCard(config, process.env.SUPERFACE_LIVE_API);

    // TODO: think about this config and what can be removed
    // TODO: rething public API or document more
    const processRecordings = options?.processRecordings ?? true;
    const inputVariables = searchValues(input, options?.hideInput);

    this.recordingController.setup(input, fixtureName, testCase.testName);
    const existingRecordings = await this.recordingController.getRecordings();

    if (!record && !existingRecordings) {
      throw new RecordingsNotFoundError();
    }

    if (record) {
      this.recordingController.start();
    } else {
      await this.recordingController.loadRecordings(
        existingRecordings,
        boundProfileProvider,
        provider,
        inputVariables,
        {
          processRecordings,
          beforeRecordingLoad: options?.beforeRecordingLoad,
        }
      );
    }

    const result = await this.perform(useCase, provider, input);

    let newRecordings: RecordingDefinitions | undefined;
    if (record) {
      newRecordings = await this.recordingController.end(
        boundProfileProvider,
        provider,
        inputVariables,
        {
          processRecordings,
          beforeRecordingSave: options?.beforeRecordingSave,
        }
      );
    } else {
      this.recordingController.restore();

      debug('Restored HTTP requests and enabled outgoing requests');
    }

    // match existing and new recordings
    if (existingRecordings !== undefined) {
      match(existingRecordings, newRecordings ?? []);
    }

    // analyze errors from matching
    // ...

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

  private async perform(
    useCase: UseCase,
    provider: Provider,
    input: NonPrimitive
  ): Promise<Result<unknown, PerformError>> {
    let result;

    try {
      // Run perform method on specified configuration
      result = await useCase.perform(input, { provider });
    } catch (error: unknown) {
      this.recordingController.restore();

      throw error;
    }

    return result;
  }
}
