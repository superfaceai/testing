import { err, ok, Result } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { enableNetConnect, recorder, restore as restoreRecordings } from 'nock';
import { dirname, join as joinPath } from 'path';

import { AnalysisResult, MatchImpact } from '../analyzer/analyzer.interfaces';
import { UnexpectedError } from '../common/errors';
import { getFixtureName, matchWildCard } from '../common/format';
import { IGenerator, parseTestInstance } from '../hash-generator';
import {
  canUpdateTraffic,
  endAndProcessRecording,
  processAndLoadRecordings,
  startRecording,
  updateTraffic,
} from '../recording';
import {
  NockConfig,
  RecordingProcessOptions,
  RecordingType,
} from '../recording/recording.interfaces';
import { saveReport } from '../reporter';
import { prepareSuperface } from '../superface/config';
import {
  PerformError,
  SuperfaceTestConfig,
  SuperfaceTestRun,
  TestingReturn,
} from './superface-test.interfaces';
import { mapError, parseBooleanEnv, searchValues } from './utils';

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
      sf.profileId,
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
    const recordingsType = options?.recordingType ?? RecordingType.MAIN;

    if (record) {
      startRecording(this.nockConfig);
    } else {
      await processAndLoadRecordings({
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
        this.analysis = await endAndProcessRecording({
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
            beforeRecordingSave: options?.beforeRecordingSave,
          },
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

  /**
   * Sets up path to recording, depends on current Superface configuration and test case input.
   * It also tries to look for current test file from test instance to save recordings
   * next to test files.
   */
  private setupRecordingPath(profileId: string, providerName: string): string {
    const { path, fixture } = this.nockConfig ?? {};
    const fixtureName = `${providerName}.${fixture ?? 'recording'}`;
    const testFilePath = this.getTestFilePath();

    if (testFilePath === undefined) {
      return joinPath(
        path ?? joinPath(process.cwd(), 'recordings'),
        profileId,
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
