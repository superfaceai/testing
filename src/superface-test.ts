import { err, ok, PerformError, Result } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { enableNetConnect, recorder, restore as restoreRecordings } from 'nock';
import { join as joinPath } from 'path';

import { RecordingProcessOptions } from '.';
import { UnexpectedError } from './common/errors';
import {
  getFixtureName,
  matchWildCard,
  removeTimestamp,
} from './common/format';
import { IGenerator } from './generate-hash';
import { endRecording, loadRecording, startRecording } from './nock/recorder';
import { prepareSuperface } from './superface/config';
import {
  NockConfig,
  SuperfaceTestConfigPayload,
  SuperfaceTestRun,
  TestingReturn,
} from './superface-test.interfaces';
import { getGenerator, searchValues } from './superface-test.utils';

const debug = createDebug('superface:testing');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hash');

export class SuperfaceTest {
  private nockConfig?: NockConfig;
  private generator: IGenerator;
  public configuration: SuperfaceTestConfigPayload | undefined;

  constructor(payload?: SuperfaceTestConfigPayload, nockConfig?: NockConfig) {
    this.configuration = payload;
    this.nockConfig = nockConfig;
    this.generator = getGenerator(nockConfig?.testInstance);
  }

  /**
   * Tests current configuration whether all necessary components
   * are defined and ready to use and tries to perform entered usecase.
   */
  async run(
    testCase: SuperfaceTestRun,
    options?: RecordingProcessOptions
  ): Promise<TestingReturn> {
    const { profile, provider, useCase } = testCase;
    const testCaseConfig: SuperfaceTestConfigPayload = {
      profile: profile ?? this.configuration?.profile,
      provider: provider ?? this.configuration?.provider,
      useCase: useCase ?? this.configuration?.useCase,
    };

    // Sets everything connected to SDK
    const sf = await prepareSuperface(testCaseConfig);

    // Create a hash for access to recording files
    const { input, testName } = testCase;
    const hash = this.generator.hash({ input, testName });

    debugHashing('Created hash:', hash);

    const recordingPath = this.setupRecordingPath(
      getFixtureName(sf.profileId, sf.providerName, sf.usecaseName),
      hash
    );

    debugSetup('Prepared path to recording:', recordingPath);

    // Parse env variable and check if test should be recorded
    const record = matchWildCard(
      sf.profileId,
      sf.providerName,
      sf.usecaseName,
      process.env.SUPERFACE_LIVE_API
    );
    const processRecordings = options?.processRecordings ?? true;
    const inputVariables = searchValues(testCase.input, options?.hideInput);

    if (record) {
      await startRecording(this.nockConfig?.enableReqheadersRecording);
    } else {
      await loadRecording({
        recordingPath,
        inputVariables,
        config: {
          boundProfileProvider: sf.boundProfileProvider,
          providerName: sf.providerName,
        },
        options: {
          processRecordings,
          beforeRecordingLoad: options?.beforeRecordingLoad,
        },
      });
    }

    let result: Result<unknown, PerformError>;
    try {
      // Run perform method on specified configuration
      result = await sf.boundProfileProvider.perform(sf.usecaseName, input);

      if (record) {
        await endRecording({
          recordingPath,
          processRecordings,
          inputVariables,
          config: {
            boundProfileProvider: sf.boundProfileProvider,
            providerName: sf.providerName,
          },
          beforeRecordingSave: options?.beforeRecordingSave,
        });
      } else {
        restoreRecordings();
        enableNetConnect();

        debug('Restored HTTP requests and enabled outgoing requests');
      }
    } catch (error: unknown) {
      restoreRecordings();
      recorder.clear();
      enableNetConnect();

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

  /**
   * Sets up path to recording, depends on current Superface configuration and test case input.
   */
  private setupRecordingPath(fixtureName: string, inputHash: string): string {
    const { path, fixture } = this.nockConfig ?? {};

    return joinPath(
      path ?? joinPath(process.cwd(), 'nock'),
      fixtureName,
      `${fixture ?? 'recording'}-${inputHash}.json`
    );
  }
}
