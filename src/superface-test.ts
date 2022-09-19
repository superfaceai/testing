import { err, ok, Result } from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { enableNetConnect, recorder, restore as restoreRecordings } from 'nock';
import { join as joinPath } from 'path';
import { inspect } from 'util';

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
  getGenerator,
  mapError,
  parseBooleanEnv,
  searchValues,
} from './superface-test.utils';

const debug = createDebug('superface:testing');
const debugSetup = createDebug('superface:testing:setup');
const debugHashing = createDebug('superface:testing:hash');

export class SuperfaceTest {
  private nockConfig?: NockConfig;
  private analysis?: AnalysisResult;
  private generator: IGenerator;
  public configuration: SuperfaceTestConfig | undefined;

  constructor(payload?: SuperfaceTestConfig, nockConfig?: NockConfig) {
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
    const testCaseConfig: SuperfaceTestConfig = {
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
      getFixtureName(sf.profileId, sf.providerName, sf.useCaseName),
      hash
    );

    debugSetup('Prepared path to recording:', recordingPath);

    // Replace currently supported traffic with new (with changes)
    if (await canUpdateTraffic(recordingPath)) {
      await updateTraffic(recordingPath);
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

    const enforcePassingTests = parseBooleanEnv(
      process.env.ENFORCE_PASSING_TESTS
    );

    if (enforcePassingTests) {
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
    } else {
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
    }

    // FIRST PERFORM: return this result
    let result: Result<unknown, PerformError>;
    try {
      // Run perform method on specified configuration
      result = await sf.boundProfileProvider.perform(sf.useCaseName, input);

      if (!enforcePassingTests && record) {
        this.analysis = await endRecording({
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

    // SECOND PERFORM - record and compare new traffic
    if (enforcePassingTests) {
      await startRecording(this.nockConfig?.enableReqheadersRecording);

      try {
        // Run perform method on specified configuration
        const newResult = await sf.boundProfileProvider.perform(
          sf.useCaseName,
          input
        );

        this.analysis = await endRecording({
          recordingPath,
          processRecordings,
          inputVariables,
          config: {
            boundProfileProvider: sf.boundProfileProvider,
            providerName: sf.providerName,
          },
          beforeRecordingSave: options?.beforeRecordingSave,
        });

        if (newResult.isOk()) {
          console.warn(inspect(newResult.value, true, 10));
        }
      } catch (error: unknown) {
        restoreRecordings();
        recorder.clear();
        enableNetConnect();

        throw error;
      }
    }

    if (
      this.analysis &&
      this.analysis.impact !== MatchImpact.NONE &&
      !parseBooleanEnv(process.env.DISABLE_PROVIDER_CHANGES_COVERAGE)
    ) {
      await saveReport({
        input,
        result,
        hash: this.generator.hash({ input, testName }),
        recordingPath,
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
   */
  private setupRecordingPath(fixtureName: string, inputHash: string): string {
    const { path, fixture } = this.nockConfig ?? {};

    return joinPath(
      path ?? joinPath(process.cwd(), 'nock'),
      fixtureName,
      `${fixture ?? 'recording'}-${inputHash}`
    );
  }
}
