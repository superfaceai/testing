import {
  NormalizedSuperJsonDocument,
  Profile,
  Provider,
  SecurityValues,
  SuperfaceClient,
  SuperJson,
  UnexpectedError,
  UseCase,
  UsecaseDefaults,
} from '@superfaceai/one-sdk';
import { Definition as RecordingDefinition } from 'nock/types';
import { join as joinPath } from 'path';
import { URL } from 'url';

import { CompleteSuperfaceTestConfig, SuperfaceTestConfigPayload } from '.';
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
  assertsPreparedClient(sfConfig.client);
  assertsPreparedProfile(sfConfig.profile);
  assertsPreparedProvider(sfConfig.provider);
  assertsPreparedUseCase(sfConfig.useCase);
}

export function assertsPreparedClient(
  client: SuperfaceClient | undefined
): asserts client is SuperfaceClient {
  if (client === undefined) {
    throw new ComponentUndefinedError('Client');
  }
}

export function assertsPreparedProfile(
  profile: Profile | string | undefined
): asserts profile is Profile {
  if (profile === undefined) {
    throw new ComponentUndefinedError('Profile');
  }

  if (typeof profile === 'string') {
    throw new InstanceMissingError('Profile');
  }
}

export function assertsPreparedProvider(
  provider: Provider | string | undefined
): asserts provider is Provider {
  if (provider === undefined) {
    throw new ComponentUndefinedError('Provider');
  }

  if (typeof provider === 'string') {
    throw new InstanceMissingError('Provider');
  }
}

export function assertsPreparedUseCase(
  useCase: UseCase | string | undefined
): asserts useCase is UseCase {
  if (useCase === undefined) {
    throw new ComponentUndefinedError('UseCase');
  }

  if (typeof useCase === 'string') {
    throw new InstanceMissingError('UseCase');
  }
}

/**
 * Checks whether provider is local and contains some file path.
 */
export function isProviderLocal(
  provider: Provider | string,
  profileId: string | undefined,
  superJsonNormalized: NormalizedSuperJsonDocument
): boolean {
  const providerId = getProviderName(provider);

  if (profileId !== undefined) {
    const targetedProfileProvider =
      superJsonNormalized.profiles[profileId].providers[providerId];

    if (!('file' in targetedProfileProvider)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns profile id if entered profile is either instance of Profile or string
 */
export function getProfileId(profile: Profile | string): string {
  if (profile instanceof Profile) {
    return profile.configuration.id;
  }

  return profile;
}

/**
 * Returns provider id if entered provider is either instance of Provider or string
 */
export function getProviderName(provider: Provider | string): string {
  if (provider instanceof Provider) {
    return provider.configuration.name;
  }

  return provider;
}

/**
 * Returns usecase name if entered usecase is either instance of UseCase or string
 */
export function getUseCaseName(useCase: UseCase | string): string {
  if (useCase instanceof UseCase) {
    return useCase.name;
  }

  return useCase;
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

const HIDDEN_CREDENTIALS_PLACEHOLDER =
  '{credentials removed to keep them secure}';
const AUTH_HEADER_NAME = 'Authorization';

export function assertsRecordingsAreNotStrings(
  recordings: string[] | RecordingDefinition[]
): asserts recordings is RecordingDefinition[] {
  for (const recording of recordings) {
    if (typeof recording === 'string') {
      throw new UnexpectedError('recording is a string, not object');
    }
  }
}

export function removeSensitiveInformation(
  sfConfig: CompleteSuperfaceTestConfig,
  recordings: RecordingDefinition[]
): void {
  for (const recording of recordings) {
    for (const scheme of sfConfig.provider.configuration.security) {
      removeCredentialsBasedOnScheme(recording, scheme);
    }

    // TODO: implement this or wait for integration parameters
    // removeCredentialsBasedOnDefaults(
    //   recording,
    //   sfConfig.client.superJson.normalized.profiles[
    //     getProfileId(sfConfig.profile)
    //   ].providers[getProviderName(sfConfig.provider)].defaults,
    //   getUseCaseName(sfConfig.useCase)
    // );
  }
}

export function removeCredentialsBasedOnScheme(
  recording: RecordingDefinition,
  scheme: SecurityValues
): void {
  if ('apikey' in scheme) {
    // TODO: use boolean bellow when typescript update to 4.4
    // const isRecordingBodyRecord =
    //   typeof recording.body === 'object' && !Array.isArray(recording.body);

    // check api key in header, body, path or query
    if (recording.reqheaders?.[scheme.id] !== undefined) {
      recording.reqheaders[scheme.id] = HIDDEN_CREDENTIALS_PLACEHOLDER;
    } else if (
      typeof recording.body === 'object' &&
      !(recording.body instanceof RegExp) &&
      !(recording.body instanceof Buffer) &&
      !Array.isArray(recording.body) &&
      !('includes' in recording.body) &&
      recording.body[scheme.id] !== undefined
    ) {
      recording.body[scheme.id] = HIDDEN_CREDENTIALS_PLACEHOLDER;
    }

    // check in query
    const recordingPath = new URL(recording.path);
    if (recordingPath.searchParams.has(scheme.id)) {
      recordingPath.searchParams.set(scheme.id, HIDDEN_CREDENTIALS_PLACEHOLDER);
    }

    // omit pathname as well?
    // recordingPath.pathname

    recording.path = recordingPath.toString();
  } else if ('username' in scheme) {
    if (recording.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      recording.reqheaders[
        AUTH_HEADER_NAME
      ] = `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
    }
  } else if ('token' in scheme) {
    if (recording.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      recording.reqheaders[
        AUTH_HEADER_NAME
      ] = `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
    }
  } else {
    // check scheme digest
    throw new UnexpectedError('not implemented');
  }
}

export function removeCredentialsBasedOnDefaults(
  _recording: RecordingDefinition,
  defaults: UsecaseDefaults,
  useCaseName: string
): void {
  const targetedDefaults = defaults[useCaseName];
  if (defaults.input !== undefined) {
    defaults.input;
  }

  if (targetedDefaults.input !== undefined) {
    targetedDefaults.input;
  }
}
