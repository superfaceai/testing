import { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  Profile,
  Provider,
  SuperfaceClient,
  SuperJson,
  UseCase,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import {
  ComponentUndefinedError,
  MapUndefinedError,
  ProfileUndefinedError,
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
} from '../../common/errors';
import {
  CompleteSuperfaceTestConfig,
  SuperfaceTestConfig,
} from '../../interfaces';

const debug = createDebug('superface:testing');

/**
 * Asserts that entered sfConfig contains every component and
 * that every component is instance of corresponding class not string.
 */
export function assertsPreparedConfig(
  sfConfig: SuperfaceTestConfig
): asserts sfConfig is CompleteSuperfaceTestConfig {
  assertsPreparedClient(sfConfig.client);
  assertsPreparedProfile(sfConfig.profile);
  assertsPreparedProvider(sfConfig.provider);
  assertsPreparedUseCase(sfConfig.useCase);
  assertBoundProfileProvider(sfConfig.boundProfileProvider);
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

/**
 * Checks whether provider is local and contains some file path.
 */
export function isProfileProviderLocal(
  provider: Provider | string,
  profileId: string,
  superJsonNormalized: NormalizedSuperJsonDocument
): void {
  debug(
    'Checking for local profile provider in super.json for given profile:',
    profileId
  );

  const providerId = getProviderName(provider);
  const targetedProfile = superJsonNormalized.profiles[profileId];

  if (targetedProfile === undefined) {
    throw new ProfileUndefinedError(profileId);
  }

  const targetedProfileProvider = targetedProfile.providers[providerId];

  if (targetedProfileProvider === undefined) {
    throw new MapUndefinedError(profileId, providerId);
  }

  debug('Found profile provider:', targetedProfileProvider);

  if (!('file' in targetedProfileProvider)) {
    throw new MapUndefinedError(profileId, providerId);
  }
}

/**
 * Returns profile id if entered profile is either instance of Profile or string
 */
export function getProfileId(profile: Profile | string): string {
  if (typeof profile === 'string') {
    return profile;
  } else {
    return profile.configuration.id;
  }
}

/**
 * Returns provider id if entered provider is either instance of Provider or string
 */
export function getProviderName(provider: Provider | string): string {
  if (typeof provider === 'string') {
    return provider;
  } else {
    return provider.configuration.name;
  }
}

/**
 * Returns usecase name if entered usecase is either instance of UseCase or string
 */
export function getUseCaseName(useCase: UseCase | string): string {
  if (typeof useCase === 'string') {
    return useCase;
  } else {
    return useCase.name;
  }
}

/**
 * Returns SuperJson based on path detected with its abstract method.
 */
export async function getSuperJson(): Promise<SuperJson> {
  const superPath = await SuperJson.detectSuperJson(process.cwd(), 3);

  debug('Loading super.json from path:', superPath);

  if (superPath === undefined) {
    throw new SuperJsonNotFoundError();
  }

  const superJsonResult = await SuperJson.load(
    joinPath(superPath, 'super.json')
  );

  debug('Found super.json:', superJsonResult);

  if (superJsonResult.isErr()) {
    throw new SuperJsonLoadingFailedError(superJsonResult.error);
  }

  return superJsonResult.value;
}
