import { SuperfaceClient } from '@superfaceai/one-sdk';
import {
  back as nockBack,
  load as loadRecording,
  recorder,
  restore as endRec,
} from 'nock';
import { basename, join as joinPath } from 'path';

import { removeTimestamp } from './common/format';
import { exists } from './common/io';
import { OutputStream } from './common/output-stream';
import {
  NockConfig,
  TestConfigPayload,
  TestConfiguration,
  TestingReturn,
} from './test-config.interfaces';

// TODO: add comments

function assertsPreparedConfig(
  sfConfig: TestConfigPayload
): asserts sfConfig is TestConfiguration {
  if (typeof sfConfig.profile === 'string') {
    throw new Error('Should be Profile instance');
  }

  if (typeof sfConfig.provider === 'string') {
    throw new Error('Should be Provider instance');
  }

  if (typeof sfConfig.useCase === 'string') {
    throw new Error('Should be UseCase instance');
  }
}

export class TestConfig {
  private fixturePath?: string;
  private nockDone?: () => void;

  constructor(
    public sfConfig: TestConfigPayload,
    public nockConfig?: NockConfig
  ) {}

  async test(testCase?: TestConfigPayload): Promise<void> {
    if (testCase !== undefined) {
      await this.setup(testCase);
    }

    await this.prepareConfig();

    if (this.sfConfig.profile === undefined) {
      throw new Error('Undefined Profile');
    }

    if (this.sfConfig.provider === undefined) {
      throw new Error('Undefined Provider');
    }

    if (this.sfConfig.useCase === undefined) {
      throw new Error('Undefined UseCase');
    }
  }

  async run(input: unknown): Promise<TestingReturn> {
    await this.prepareConfig();

    assertsPreparedConfig(this.sfConfig);

    const result = await this.sfConfig?.useCase?.perform(input, {
      provider: this.sfConfig.provider,
    });

    if (!result) {
      throw new Error('perform failed');
    }

    if (result.isErr()) {
      return { error: removeTimestamp(result.error.toString()) };
    }

    if (result.isOk()) {
      return { value: result.value };
    }

    throw new Error('unreachable');
  }

  async setup(payload: TestConfigPayload): Promise<void> {
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

  async record(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new Error('nock configuration missing');
    }

    this.setupNockConfig(nockConfig);

    if (!this.fixturePath) {
      throw new Error('unreachable');
    }

    if (await exists(this.fixturePath)) {
      loadRecording(this.fixturePath);
    } else {
      recorder.rec({
        dont_print: true,
        output_objects: true,
        use_separator: false,
        enable_reqheaders_recording: this.nockConfig?.hideHeaders ?? nockConfig?.hideHeaders ?? true,
      });
    }
  }

  // possible to update recordings through force flag
  async endRecording(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new Error('nock configuration missing');
    }

    if (!this.fixturePath) {
      throw new Error('unreachable');
    }

    if (await exists(this.fixturePath)) {
      return;
    }

    const { path, dir, fixture, update } = nockConfig ?? this.nockConfig ?? {};
    const fixturePath = joinPath(
      path ?? process.cwd(),
      dir ?? '.',
      `${fixture ?? 'recording'}.json`
    );

    await OutputStream.writeIfAbsent(
      fixturePath,
      JSON.stringify(recorder.play(), null, 2),
      { dirs: true, force: update }
    );

    endRec();
  }

  setupNockBack(nockConfig?: NockConfig): void {
    if (!nockConfig && !this.nockConfig) {
      throw new Error('nock configuration missing');
    }

    this.setupNockConfig(nockConfig);

    const { path, dir, mode } = nockConfig ?? this.nockConfig ?? {};

    nockBack.fixtures = joinPath(path ?? process.cwd(), dir ?? '.');
    nockBack.setMode(mode ?? 'record');
  }

  async nockBackRecord(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new Error('nock configuration missing');
    }

    this.setupNockConfig(nockConfig);

    if (!this.fixturePath) {
      throw new Error('unreachable');
    }

    const { nockDone } = await nockBack(basename(this.fixturePath));
    this.nockDone = nockDone;

    // TODO: implement headers filtering in preprocessing function: https://github.com/nock/nock#example
  }

  endNockBackRecording(): void {
    if (this.nockDone === undefined) {
      throw new Error('nock recording failed');
    }

    this.nockDone();

    endRec();
  }

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
        throw new Error(
          'To setup usecase, you need to specify profile as well.'
        );
      }

      this.sfConfig.useCase = this.sfConfig.profile.getUseCase(
        this.sfConfig.useCase
      );
    }
  }

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
}
