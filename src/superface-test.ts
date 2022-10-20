import { err, ok, Result } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { enableNetConnect, recorder, restore as restoreRecordings } from 'nock';
import { dirname, join as joinPath } from 'path';

import { UnexpectedError } from './common/errors';
import { getFixtureName, matchWildCard } from './common/format';
import { IGenerator } from './generate-hash';
import { MatchImpact } from './nock/analyzer';
import {
  canUpdateTraffic,
  endRecording,
  loadRecording,
  startRecording,
  updateTraffic,
} from './nock/recorder';
import { RecordingType } from './nock/recording.interfaces';
import { report, saveReport } from './reporter';
import { prepareSuperface } from './superface/config';
import {
  AlertFunction,
  AnalysisResult,
  NockConfig,
  PerformError,
  RecordingProcessOptions,
  SuperfaceTestConfig,
  SuperfaceTestRun,
  TestingReturn,
} from './superface-test.interfaces';
import {
  mapError,
  parseBooleanEnv,
  parseTestInstance,
  searchValues,
} from './superface-test.utils';

const debug = createDebug('superface:testing');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hash');

export class SuperfaceTest {
  private nockConfig?: NockConfig;
  private analysis?: AnalysisResult;
  private generator: IGenerator;
  private getTestFilePath: () => string | undefined;
  public configuration: SuperfaceTestConfig | undefined;

  constructor(payload?: SuperfaceTestConfig, nockConfig?: NockConfig) {
    this.configuration = payload;
    this.nockConfig = nockConfig;

    ({ generator: this.generator, getTestFilePath: this.getTestFilePath } =
      parseTestInstance(nockConfig?.testInstance));
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
    const testCaseConfig: SuperfaceTestConfig = {
      profile: profile ?? this.configuration?.profile,
      provider: provider ?? this.configuration?.provider,
      useCase: useCase ?? this.configuration?.useCase,
    };

    // Sets everything connected to SDK
    const sf = await prepareSuperface(testCaseConfig);

    // Create a hash for access to recording files
    const { input, testName } = testCase;
    const recordingsHash = this.generator.hash({ input, testName });

    debugHashing('Created hash:', recordingsHash);

    const recordingsKey = getFixtureName(
      sf.profileId,
      sf.providerName,
      sf.useCaseName
    );
    const recordingsPath = this.setupRecordingPath(
      recordingsKey,
      sf.providerName
    );

    debugSetup('Prepared path to recording:', recordingsPath);
    debugSetup(
      'Current recordings located at:',
      `${recordingsKey}.${recordingsHash}`
    );

    // Merge currently supported traffic with new (with changes)
    if (await canUpdateTraffic(recordingsPath)) {
      debug('Updating current recordings file with new recordings file.');

      await updateTraffic(recordingsPath);
    }

    // Parse env variable and check if test should be recorded
    const record = matchWildCard(
      sf.profileId,
      sf.providerName,
      sf.useCaseName,
      process.env.SUPERFACE_LIVE_API
    );
    const processRecordings = options?.processRecordings ?? true;
    const inputVariables = searchValues(testCase.input, options?.hideInput);
    let recordingsType: RecordingType;

    if (options?.prepare && options?.teardown) {
      throw new UnexpectedError(
        'Use just one of following parameters, either `prepare` or `teardown`'
      );
    }

    if (options?.prepare) {
      recordingsType = RecordingType.PREPARE;
    } else if (options?.teardown) {
      recordingsType = RecordingType.TEARDOWN;
    } else {
      recordingsType = RecordingType.MAIN;
    }

    if (record) {
      await startRecording(this.nockConfig?.enableReqheadersRecording);
    } else {
      await loadRecording({
        recordingsPath,
        recordingsType,
        recordingsHash,
        recordingsKey,
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
      result = await sf.boundProfileProvider.perform(sf.useCaseName, input);

      if (record) {
        this.analysis = await endRecording({
          recordingsPath,
          recordingsType,
          recordingsHash,
          recordingsKey,
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

    if (
      this.analysis &&
      this.analysis.impact !== MatchImpact.NONE &&
      !parseBooleanEnv(process.env.DISABLE_PROVIDER_CHANGES_COVERAGE)
    ) {
      await saveReport({
        input,
        result,
        recordingsHash,
        recordingsPath,
        profileId: sf.profileId,
        providerName: sf.providerName,
        useCaseName: sf.useCaseName,
        analysis: this.analysis,
      });
    }

    this.analysis = undefined;

    if (result.isErr()) {
      debug('Perform failed with error:', result.error.toString());

      if (options?.fullError) {
        return err(mapError(result.error));
      }

      return err(result.error.toString());
    }

    if (result.isOk()) {
      debug('Perform succeeded with result:', result.value);

      return ok(result.value);
    }

    throw new UnexpectedError('Unexpected result object');
  }

  // static async collectData(): Promise<void> {
  //   await collect();
  // }

  static async report(
    alert: AlertFunction,
    options?: {
      onlyFailedTests?: boolean;
    }
  ): Promise<void> {
    await report(alert, options);
  }

  /**
   * Sets up path to recording, depends on current Superface configuration and test case input.
   * It also tries to look for current test file from test instance to save recordings
   * next to test files.
   */
  private setupRecordingPath(
    recordingsKey: string,
    providerName: string
  ): string {
    const { path, fixture } = this.nockConfig ?? {};
    const fixtureName = `${providerName}.${fixture ?? 'recording'}`;
    const testFilePath = this.getTestFilePath();

    if (testFilePath === undefined) {
      return joinPath(
        path ?? joinPath(process.cwd(), 'recordings'),
        recordingsKey,
        fixtureName
      );
    } else {
      return joinPath(
        path ?? joinPath(dirname(testFilePath), 'recordings'),
        fixtureName
      );
    }
  }
}
