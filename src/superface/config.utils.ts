import {
  BoundProfileProvider,
  Profile,
  Provider,
  SuperfaceClient,
  UseCase,
} from '@superfaceai/one-sdk';

import {
  ComponentUndefinedError,
} from '../common/errors';
import { CompleteSuperfaceTestConfig, SuperfaceTestConfig } from './config';

export function assertsPreparedConfig(
  sfConfig: SuperfaceTestConfig
): asserts sfConfig is CompleteSuperfaceTestConfig {
  assertsPreparedClient(sfConfig.client);
  assertsPreparedProfile(sfConfig.profile);
  assertsPreparedProvider(sfConfig.provider);
  assertsPreparedUseCase(sfConfig.useCase);
  assertBoundProfileProvider(sfConfig.boundProfileProvider)
}

export function assertsPreparedClient(
  client: SuperfaceClient | undefined
): asserts client is SuperfaceClient {
  if (client === undefined) {
    throw new ComponentUndefinedError('Client');
  }
}

export function assertsPreparedProfile(
  profile: Profile | undefined
): asserts profile is Profile {
  if (profile === undefined) {
    throw new ComponentUndefinedError('Profile');
  }
}

export function assertsPreparedProvider(
  provider: Provider | undefined
): asserts provider is Provider {
  if (provider === undefined) {
    throw new ComponentUndefinedError('Provider');
  }
}

export function assertsPreparedUseCase(
  useCase: UseCase | undefined
): asserts useCase is UseCase {
  if (useCase === undefined) {
    throw new ComponentUndefinedError('UseCase');
  }
}

export function assertBoundProfileProvider(
  boundProfileProvider: BoundProfileProvider | undefined
): asserts boundProfileProvider is BoundProfileProvider {
  if (boundProfileProvider === undefined) {
    throw new ComponentUndefinedError('BoundProfileProvider');
  }
}
