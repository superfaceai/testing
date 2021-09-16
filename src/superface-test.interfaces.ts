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

export type Client = SuperfaceClient | TypedSuperfaceClient<any>;
export type ProfilePayload = Profile | TypedProfile<any> | string;
export type UseCasePayload = UseCase | TypedUseCase<any, unknown> | string;

export interface SuperfaceTestConfigPayload {
  client?: Client;
  profile?: ProfilePayload;
  provider?: Provider | string;
  useCase?: UseCasePayload;
}

export type SuperfaceTestRun = SuperfaceTestConfigPayload & {
  input: unknown;
};

export interface SuperfaceTestConfig {
  client?: Client;
  profile?: Profile | TypedProfile<any>;
  provider?: Provider;
  useCase?: UseCase | TypedUseCase<any, unknown>;
}

export type CompleteSuperfaceTestConfig = Required<SuperfaceTestConfig>;

export type TestingReturn =
  | {
      value: unknown;
    }
  | {
      error: string;
    };

export interface NockConfig {
  path?: string;
  fixture?: string;
  hideHeaders?: boolean;
}
