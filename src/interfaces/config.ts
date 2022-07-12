import {
  BoundProfileProvider,
  Profile,
  Provider,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';

import { TestPayload } from './superface-test';

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

  get: (testCase: TestPayload) => Promise<CompleteSuperfaceTestConfig>;
}