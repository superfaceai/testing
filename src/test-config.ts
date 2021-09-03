import {
  ProfileEntry,
  ProfileProviderEntry,
  ProviderEntry,
  SuperfaceClient,
  SuperJson,
} from '@superfaceai/one-sdk';
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
      this.setup(testCase);
    }

    if (!(await this.areCapabilitiesLocal())) {
      throw new Error(
        'Some capabilities are not local, do not forget to set up file paths in super.json.'
      );
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
    if (!(await this.areCapabilitiesLocal())) {
      throw new Error(
        'Some capabilities are not local, do not forget to set up file paths in super.json.'
      );
    }

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
        enable_reqheaders_recording:
          this.nockConfig?.hideHeaders ?? nockConfig?.hideHeaders ?? true,
      });
    }
  }

  // possible to update recordings through force flag
  async endRecording(nockConfig?: NockConfig): Promise<void> {
    if (!nockConfig && !this.nockConfig) {
      throw new Error('nock configuration missing');
    }

    if (!this.fixturePath) {
      throw new Error('Fixture path is not defined, make sure to run `record()` before ending recording.');
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
      throw new Error('Nock recording failed, make sure to run `nockBackRecord()` before ending recording.');
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

  private async areCapabilitiesLocal(): Promise<boolean> {
    let superJson = this.sfConfig.client?.superJson;

    if (!superJson) {
      const superPath = await SuperJson.detectSuperJson(process.cwd(), 3);

      if (superPath === undefined) {
        throw new Error('no super.json found');
      }

      superJson = (
        await SuperJson.load(joinPath(superPath, 'super.json'))
      ).unwrap();
    }

    const superJsonNormalized = superJson.normalized;
    const superJsonProfiles = superJsonNormalized.profiles;
    let profileId: string | undefined;

    // check whether profile is local and contain some file path
    if (this.sfConfig.profile !== undefined) {
      let targettedProfile: ProfileEntry;
      if (typeof this.sfConfig.profile === 'string') {
        targettedProfile = superJsonProfiles[this.sfConfig.profile];

        if (!('file' in targettedProfile)) {
          return false;
        }

        profileId = this.sfConfig.profile;
      } else {
        targettedProfile =
          superJsonProfiles[this.sfConfig.profile.configuration.id];

        if (!('file' in targettedProfile)) {
          return false;
        }

        profileId = this.sfConfig.profile.configuration.id;
      }
    }

    // check whether provider is local and contain some file path
    if (this.sfConfig.provider !== undefined) {
      if (profileId === undefined) {
        throw new Error('profile not found');
      }

      const superJsonProviders = superJsonNormalized.providers;
      const superJsonProfileProviders = superJsonProfiles[profileId].providers;

      let targetedProvider: ProviderEntry,
        targetedProfileProvider: ProfileProviderEntry;

      if (typeof this.sfConfig.provider === 'string') {
        targetedProvider = superJsonProviders[this.sfConfig.provider];
        targetedProfileProvider =
          superJsonProfileProviders[this.sfConfig.provider];

        if (
          !('file' in targetedProfileProvider) ||
          !('file' in targetedProvider) ||
          targetedProvider.file === undefined
        ) {
          return false;
        }
      } else {
        targetedProvider =
          superJsonProviders[this.sfConfig.provider.configuration.name];
        targetedProfileProvider =
          superJsonProfileProviders[this.sfConfig.provider.configuration.name];

        if (
          !('file' in targetedProfileProvider) ||
          !('file' in targetedProvider) ||
          targetedProvider.file === undefined
        ) {
          return false;
        }
      }
    }

    return true;
  }
}
