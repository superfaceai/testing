import { NormalizedSuperJsonDocument } from '@superfaceai/ast';
import {
  ApiKeyPlacement,
  isApiKeySecurityScheme,
  isBasicAuthSecurityScheme,
  isBearerTokenSecurityScheme,
  isDigestSecurityScheme,
  Profile,
  Provider,
  SecurityScheme,
  SuperfaceClient,
  SuperJson,
  UnexpectedError,
  UseCase,
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
  'credentials-removed-to-keep-them-secure';
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

export async function removeSensitiveInformation(
  sfConfig: CompleteSuperfaceTestConfig,
  recordings: RecordingDefinition[]
): Promise<void> {
  const {
    configuration: { security, baseUrl },
  } = await sfConfig.client.cacheBoundProfileProvider(
    sfConfig.profile.configuration,
    sfConfig.provider.configuration
  );

  for (const recording of recordings) {
    for (const scheme of security) {
      removeCredentialsBasedOnScheme(recording, scheme, baseUrl);
    }
  }
}

export function removeCredentialsBasedOnScheme(
  recording: RecordingDefinition,
  scheme: SecurityScheme,
  baseUrl: string
): void {
  if (isApiKeySecurityScheme(scheme)) {
    if (scheme.in === ApiKeyPlacement.HEADER) {
      if (recording.reqheaders?.[scheme.name] !== undefined) {
        recording.reqheaders[scheme.name] = HIDDEN_CREDENTIALS_PLACEHOLDER;
      }
    } else if (scheme.in === ApiKeyPlacement.BODY) {
      if (
        typeof recording.body === 'object' &&
        !(recording.body instanceof RegExp) &&
        !(recording.body instanceof Buffer) &&
        !Array.isArray(recording.body) &&
        !('includes' in recording.body) &&
        recording.body[scheme.name] !== undefined
      ) {
        recording.body[scheme.name] = HIDDEN_CREDENTIALS_PLACEHOLDER;
      }

      // TODO: implement hiding credentials from different types of body
    } else {
      const recordingPath = new URL(baseUrl + recording.path);

      if (scheme.in === ApiKeyPlacement.PATH) {
        const regex = new RegExp(`/${scheme.name}=(.*(?=/))/g`);

        recordingPath.pathname.replace(
          regex,
          `${scheme.name}=${HIDDEN_CREDENTIALS_PLACEHOLDER}`
        );
      } else if (scheme.in === ApiKeyPlacement.QUERY) {
        if (recordingPath.searchParams.has(scheme.name)) {
          recordingPath.searchParams.set(
            scheme.name,
            HIDDEN_CREDENTIALS_PLACEHOLDER
          );
        }
      }

      recording.path =
        recordingPath.pathname + recordingPath.search + recordingPath.hash;
    }
  } else if (isBasicAuthSecurityScheme(scheme)) {
    if (recording.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      recording.reqheaders[
        AUTH_HEADER_NAME
      ] = `Basic ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
    }
  } else if (isBearerTokenSecurityScheme(scheme)) {
    if (recording.reqheaders?.[AUTH_HEADER_NAME] !== undefined) {
      recording.reqheaders[
        AUTH_HEADER_NAME
      ] = `Bearer ${HIDDEN_CREDENTIALS_PLACEHOLDER}`;
    }
  } else if (isDigestSecurityScheme(scheme)) {
    throw new UnexpectedError('not implemented');
  }
}
