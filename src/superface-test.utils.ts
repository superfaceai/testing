import {
  NormalizedSuperJsonDocument,
  Profile,
  Provider,
  SuperJson,
  TypedProfile,
} from '@superfaceai/one-sdk';
import { join as joinPath } from 'path';

import {
  CompleteSuperfaceTestConfig,
  ProfilePayload,
  SuperfaceTestConfigPayload,
} from '.';
import {
  ComponentUndefinedError,
  InstanceMissingError,
  SuperJsonNotFoundError,
} from './common/errors';

/**
 * Asserts that entered sfConfig contains only instances of classes not strings.
 */
export function assertsPreparedConfig(
  sfConfig: SuperfaceTestConfigPayload
): asserts sfConfig is CompleteSuperfaceTestConfig {
  if (sfConfig.client === undefined) {
    throw new ComponentUndefinedError('Client')
  }
  
  if (sfConfig.profile === undefined) {
    throw new ComponentUndefinedError('Profile');
  }

  if (typeof sfConfig.profile === 'string') {
    throw new InstanceMissingError('Profile');
  }

  if (sfConfig.provider === undefined) {
    throw new ComponentUndefinedError('Provider');
  }

  if (typeof sfConfig.provider === 'string') {
    throw new InstanceMissingError('Provider');
  }

  if (sfConfig.useCase === undefined) {
    throw new ComponentUndefinedError('UseCase');
  }

  if (typeof sfConfig.useCase === 'string') {
    throw new InstanceMissingError('UseCase');
  }
}

/**
 * Checks whether profile is local and contains some file path.
 */
export function isProfileLocal(
  profile: ProfilePayload,
  superJsonNormalized: NormalizedSuperJsonDocument
): boolean {
  const profileId = getProfileId(profile);
  const targettedProfile = superJsonNormalized.profiles[profileId];

  if (!('file' in targettedProfile)) {
    return false;
  }

  return true;
}

/**
 * Checks whether provider is local and contains some file path.
 */
export function isProviderLocal(
  provider: Provider | string,
  profileId: string | undefined,
  superJsonNormalized: NormalizedSuperJsonDocument
): boolean {
  const providerId = getProviderId(provider);

  if (profileId !== undefined) {
    const targetedProfileProvider =
      superJsonNormalized.profiles[profileId].providers[providerId];

    if (!('file' in targetedProfileProvider)) {
      return false;
    }
  }

  const targetedProvider = superJsonNormalized.providers[providerId];
  if (!('file' in targetedProvider) || targetedProvider.file === undefined) {
    return false;
  }

  return true;
}

/**
 * Returns profile id if entered profile is either
 * typed instance of Profile or instance of Profile or string
 */
export function getProfileId(profile: ProfilePayload): string {
  if (profile instanceof TypedProfile || profile instanceof Profile) {
    return profile.configuration.id;
  }

  return profile;
}

/**
 * Returns provider id if entered provider is either
 * instance of Provider or string
 */
export function getProviderId(provider: Provider | string): string {
  if (provider instanceof Provider) {
    return provider.configuration.name;
  }

  return provider;
}

/**
 * Returns SuperJson based on path detected with its abstract method.
 */
export async function getSuperJson(): Promise<SuperJson> {
  const superPath = await SuperJson.detectSuperJson(process.cwd(), 3);

  if (superPath === undefined) {
    throw new SuperJsonNotFoundError();
  }

  return (await SuperJson.load(joinPath(superPath, 'super.json'))).unwrap();
}
