import {
  BoundProfileProvider,
  Profile,
  Provider,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';

import { ComponentUndefinedError } from '../../common/errors';
import {
  CompleteSuperfaceTestConfig,
  ITestConfig,
  TestPayload,
} from '../../interfaces';
import {
  assertsPreparedConfig,
  getProfileId,
  getSuperJson,
  isProfileProviderLocal,
} from './utils';

const debugSetup = createDebug('superface:testing:setup');

export class TestConfig implements ITestConfig {
  client?: SuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
  boundProfileProvider?: BoundProfileProvider;

  constructor(public readonly payload: TestPayload) {}

  public async get(
    testCase: TestPayload
  ): Promise<CompleteSuperfaceTestConfig> {
    this.updateConfig(testCase);
    await this.setup();

    const config = {
      client: this.client,
      profile: this.profile,
      provider: this.provider,
      useCase: this.useCase,
      boundProfileProvider: this.boundProfileProvider,
    };

    assertsPreparedConfig(config);

    return config;
  }

  private updateConfig(payload: TestPayload): void {
    if (payload.profile !== undefined) {
      this.payload.profile = payload.profile;
    }

    if (payload.provider !== undefined) {
      this.payload.provider = payload.provider;
    }

    if (payload.useCase !== undefined) {
      this.payload.useCase = payload.useCase;
    }

    debugSetup('Superface configuration prepared:', this.payload);
  }

  private async setup(): Promise<void> {
    await this.setupSuperfaceComponents();
    await this.checkForMapInSuperJson();
  }

  /**
   * Sets up current configuration - transforms every component
   * that is represented by string to instance of that corresponding component.
   */
  private async setupSuperfaceComponents(): Promise<void> {
    if (!this.client) {
      this.client = new SuperfaceClient();

      debugSetup('Superface client initialized:', this.client);
    }

    if (typeof this.payload.profile === 'string') {
      this.profile = await this.client.getProfile(this.payload.profile);

      debugSetup('Superface Profile transformed:', this.profile);
    } else if (this.payload.profile instanceof Profile) {
      this.profile = this.payload.profile;
    }

    if (typeof this.payload.provider === 'string') {
      this.provider = await this.client.getProvider(this.payload.provider);

      debugSetup('Superface Provider transformed:', this.provider);
    } else if (this.payload.provider instanceof Provider) {
      this.provider = this.payload.provider;
    }

    if (typeof this.payload.useCase === 'string') {
      if (this.profile === undefined) {
        throw new ComponentUndefinedError('Profile');
      }

      this.useCase = this.profile.getUseCase(this.payload.useCase);

      debugSetup('Superface UseCase transformed:', this.useCase);
    } else if (this.payload.useCase instanceof UseCase) {
      this.useCase = this.payload.useCase;
    }
  }

  /**
   * Checks whether current components in sfConfig
   * are locally linked in super.json.
   */
  private async checkForMapInSuperJson(): Promise<void> {
    if (this.profile === undefined || this.provider === undefined) {
      throw new Error('Undefined Profile or Provider');
    }

    const profileId = getProfileId(this.profile);
    const superJson = this.client?.superJson ?? (await getSuperJson());

    isProfileProviderLocal(this.provider, profileId, superJson.normalized);
  }
}
