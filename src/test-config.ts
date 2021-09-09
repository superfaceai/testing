import { SuperfaceClient } from '@superfaceai/one-sdk';
import { UnexpectedError } from '@superfaceai/one-sdk/dist/internal/errors';
import {
  back as nockBack,
  load as loadRecording,
  recorder,
  restore as endRec,
} from 'nock';
import { basename, join as joinPath } from 'path';

import {
  CapabilitiesNotLocalError,
  ComponentUndefinedError,
  NockConfigUndefinedError,
  RecordingNotStartedError,
} from './common/errors';
import { removeTimestamp } from './common/format';
import { exists, writeIfAbsent } from './common/io';
import {
  NockConfig,
  TestConfigPayload,
  TestingReturn,
} from './test-config.interfaces';
import {
  assertsPreparedConfig,
  getProfileId,
  getSuperJson,
  isProfileLocal,
  isProviderLocal,
} from './test-config.utils';

export class TestConfig {
  private fixturePath?: string;
  private nockDone?: () => void;

  constructor(
    public sfConfig: TestConfigPayload,
    public nockConfig?: NockConfig
  ) {}

  /**
   * Tests current configuration whether all necessary components
   * are defined and ready to use.
   */
  async test(testCase?: TestConfigPayload): Promise<void> {
    if (testCase !== undefined) {
      this.setup(testCase);
    }

    if (!(await this.areCapabilitiesLocal())) {
      throw new CapabilitiesNotLocalError();
    }

    await this.prepareConfig();

    if (this.sfConfig.profile === undefined) {
      throw new ComponentUndefinedError('Profile');
    }

    if (this.sfConfig.provider === undefined) {
      throw new ComponentUndefinedError('Provider');
    }

    if (this.sfConfig.useCase === undefined) {
      throw new ComponentUndefinedError('UseCase');
    }
  }

  /**
   * Checks whether components are ready to use and tries to perform entered usecase.
   */
  async run(input: unknown): Promise<TestingReturn> {
    if (!(await this.areCapabilitiesLocal())) {
      throw new CapabilitiesNotLocalError();
    }

    await this.prepareConfig();

    assertsPreparedConfig(this.sfConfig);

    if (this.sfConfig.useCase === undefined) {
      throw new ComponentUndefinedError('UseCase');
    }

    const result = await this.sfConfig.useCase.perform(input, {
      provider: this.sfConfig.provider,
    });

    if (result.isErr()) {
      return { error: removeTimestamp(result.error.toString()) };
    }

    if (result.isOk()) {
      return { value: result.value };
    }

    throw new UnexpectedError('unreachable');
  }

  /**
   * Sets up entered payload to current Superface configuration
   */
  setup(payload: TestConfigPayload): void {
    if (payload.client !== undefined) {
      this.sfConfig.client = payload.client;
    }

    if (payload.profile !== undefined) {
      this.sfConfig.profile = payload.profile;
    }

    if (payload.provider !== undefined) {
      this.sfConfig.provider = payload.provider;
    }

    if (payload.useCase !== undefined) {
      this.sfConfig.useCase = payload.useCase;
    }
  }

  /**
   * Checks whether nock is configured and
   * starts recording or loads recording file if exists.
   */
  async record(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new NockConfigUndefinedError();
    }

    this.setupNockConfig(nockConfig);

    if (!this.fixturePath) {
      throw new UnexpectedError('unreachable');
    }

    const update = nockConfig?.update ?? this.nockConfig?.update ?? false;
    const hideReqHeaders =
      this.nockConfig?.hideHeaders ?? nockConfig?.hideHeaders ?? true;

    if ((await exists(this.fixturePath)) && !update) {
      loadRecording(this.fixturePath);
    } else {
      recorder.rec({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording: hideReqHeaders,
      });
    }
  }

  /**
   * Checks if recording started and if yes, it ends recording and
   * saves recording to file specified in nockConfig.
   * Possible to update recordings with property `update`.
   */
  async endRecording(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new NockConfigUndefinedError();
    }

    if (!this.fixturePath) {
      throw new RecordingNotStartedError('record');
    }

    const update = nockConfig?.update ?? this.nockConfig?.update ?? false;
    if ((await exists(this.fixturePath)) && !update) {
      return;
    }

    await writeIfAbsent(
      this.fixturePath,
      JSON.stringify(recorder.play(), null, 2),
      {
        dirs: true,
        force: update,
      }
    );

    endRec();
  }

  /**
   * Sets up nock.back path to fixtures and its mode before recording.
   */
  setupNockBack(nockConfig?: NockConfig): void {
    if (!nockConfig && !this.nockConfig) {
      throw new NockConfigUndefinedError();
    }

    this.setupNockConfig(nockConfig);

    const { path, dir, mode } = nockConfig ?? this.nockConfig ?? {};

    nockBack.fixtures = joinPath(path ?? process.cwd(), dir ?? '.');
    nockBack.setMode(mode ?? 'record');
  }

  /**
   * Checks whether nock is configured and
   * starts recording with nock.back support and playback system.
   */
  async nockBackRecord(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new NockConfigUndefinedError();
    }

    this.setupNockConfig(nockConfig);

    if (!this.fixturePath) {
      throw new UnexpectedError('unreachable');
    }

    const { nockDone } = await nockBack(basename(this.fixturePath));
    this.nockDone = nockDone;

    // TODO: implement headers filtering in preprocessing function: https://github.com/nock/nock#example
  }

  /**
   * Checks if recording started and if yes, it ends recording and
   * saves recording to file specified in nockConfig.
   */
  endNockBackRecording(): void {
    if (this.nockDone === undefined) {
      throw new RecordingNotStartedError('nockBackRecord');
    }

    this.nockDone();

    endRec();
  }

  /**
   * Prepares current configuration and transforms every component
   * that is represented by string to instance of that corresponding component.
   */
  private async prepareConfig(): Promise<void> {
    if (!this.sfConfig.client) {
      this.sfConfig.client = new SuperfaceClient();
    }

    if (typeof this.sfConfig.profile === 'string') {
      this.sfConfig.profile = await this.sfConfig.client.getProfile(
        this.sfConfig.profile
      );
    }

    if (typeof this.sfConfig.provider === 'string') {
      this.sfConfig.provider = await this.sfConfig.client.getProvider(
        this.sfConfig.provider
      );
    }

    if (typeof this.sfConfig.useCase === 'string') {
      if (this.sfConfig.profile === undefined) {
        throw new ComponentUndefinedError('Profile');
      }

      this.sfConfig.useCase = this.sfConfig.profile.getUseCase(
        this.sfConfig.useCase
      );
    }
  }

  /**
   * Sets up nock configuration and fixture path.
   */
  private setupNockConfig(nockConfig?: NockConfig): void {
    if (nockConfig) {
      this.nockConfig = {
        ...this.nockConfig,
        ...nockConfig,
      };
    }

    const { path, dir, fixture } = nockConfig ?? this.nockConfig ?? {};

    if (this.fixturePath === undefined) {
      this.fixturePath = joinPath(
        path ?? process.cwd(),
        dir ?? '.',
        `${fixture ?? 'recording'}.json`
      );
    }
  }

  /**
   * Checks whether current components in sfConfig
   * are locally linked in super.json.
   */
  private async areCapabilitiesLocal(): Promise<boolean> {
    const superJson = this.sfConfig.client?.superJson ?? (await getSuperJson());
    const superJsonNormalized = superJson.normalized;

    let profileId: string | undefined;

    if (this.sfConfig.profile !== undefined) {
      if (!isProfileLocal(this.sfConfig.profile, superJsonNormalized)) {
        return false;
      }

      profileId = getProfileId(this.sfConfig.profile);
    }

    if (this.sfConfig.provider !== undefined) {
      return isProviderLocal(
        this.sfConfig.provider,
        profileId,
        superJsonNormalized
      );
    }

    return true;
  }
}
