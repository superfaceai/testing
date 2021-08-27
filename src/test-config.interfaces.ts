import {
  Profile,
  Provider,
  SuperfaceClient,
  TypedProfile,
  UseCase,
} from '@superfaceai/one-sdk';
import { TypedSuperfaceClient } from '@superfaceai/one-sdk/dist/client/client';
import { TypedUseCase } from '@superfaceai/one-sdk/dist/client/usecase';

/* eslint-disable  @typescript-eslint/no-explicit-any */

export interface TestConfigPayload {
  client?: SuperfaceClient | TypedSuperfaceClient<any>;
  profile?: Profile | TypedProfile<any> | string;
  provider?: Provider | string;
  useCase?: UseCase | TypedUseCase<any, unknown> | string;
}

export interface TestConfiguration {
  client?: SuperfaceClient | TypedSuperfaceClient<any>;
  profile?: Profile | TypedProfile<any>;
  provider?: Provider;
  useCase?: UseCase | TypedUseCase<any, unknown>;
}

export type TestingReturn =
  | {
      value: unknown;
    }
  | {
      error: string;
    };

export type NockBackMode = 'wild' | 'dryrun' | 'record' | 'lockdown';

export interface NockConfig {
  path: string;
  dir?: string;
  mode?: NockBackMode;
  fixture?: string;
  update?: boolean;
}
