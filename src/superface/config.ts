import {
  BoundProfileProvider,
  Profile,
  Provider,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';

import { ComponentUndefinedError } from '../common/errors';
import {
  getProfileId,
  getSuperJson,
  isProfileProviderLocal,
} from '../superface-test.utils';
import { assertsPreparedConfig } from './config.utils';

interface TestPayload {
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
}

export interface SuperfaceTestConfig {
  client?: SuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
  boundProfileProvider?: BoundProfileProvider;
}
export type CompleteSuperfaceTestConfig = Required<SuperfaceTestConfig>;

export interface ITestConfig {
  readonly payload: TestPayload;

  client?: SuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
  boundProfileProvider?: BoundProfileProvider;

  updateConfig: (payload: TestPayload) => void;
  setup: () => Promise<void>;
  get: () => CompleteSuperfaceTestConfig;
}

const debugSetup = createDebug('superface:testing:setup');

export class TestConfig implements ITestConfig {
  client?: SuperfaceClient;
  profile?: Profile;
  provider?: Provider;
  useCase?: UseCase;
  boundProfileProvider?: BoundProfileProvider;

  constructor(public readonly payload: TestPayload) {}

  public updateConfig(payload: TestPayload): void {
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

  public async setup(): Promise<void> {
    await this.setupSuperfaceComponents();
    await this.checkForMapInSuperJson();
  }

  public get(): CompleteSuperfaceTestConfig {
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
    }

    if (typeof this.payload.provider === 'string') {
      this.provider = await this.client.getProvider(this.payload.provider);

      debugSetup('Superface Provider transformed:', this.provider);
    }

    if (typeof this.payload.useCase === 'string') {
      if (this.profile === undefined) {
        throw new ComponentUndefinedError('Profile');
      }

      this.useCase = this.profile.getUseCase(this.payload.useCase);

      debugSetup('Superface UseCase transformed:', this.useCase);
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
