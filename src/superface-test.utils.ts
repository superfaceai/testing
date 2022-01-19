import {
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  NormalizedSuperJsonDocument,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  BoundProfileProvider,
  Profile,
  Provider,
  SuperfaceClient,
  SuperJson,
  UnexpectedError,
  UseCase,
} from '@superfaceai/one-sdk';
import { IServiceSelector } from '@superfaceai/one-sdk/dist/lib/services';
import { join as joinPath } from 'path';

import {
  CompleteSuperfaceTestConfig,
  RecordingDefinition,
  SuperfaceTestConfigPayload,
} from '.';
import {
  ComponentUndefinedError,
  InstanceMissingError,
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
} from './common/errors';
import {
  HIDDEN_CREDENTIALS_PLACEHOLDER,
  HIDDEN_PARAMETERS_PLACEHOLDER,
  replaceCredentialInDefinition,
  replaceParameterInDefinition,
} from './nock.utils';

/**
 * Asserts that entered sfConfig contains every component and
 * that every component is instance of corresponding class not string.
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
): boolean {
  const providerId = getProviderName(provider);
  const targetedProfileProvider =
    superJsonNormalized.profiles[profileId].providers[providerId];

  if ('file' in targetedProfileProvider) {
    return true;
  }

  return false;
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

  if (superPath === undefined) {
    throw new SuperJsonNotFoundError();
  }

  const superJsonResult = await SuperJson.load(
    joinPath(superPath, 'super.json')
  );

  if (superJsonResult.isErr()) {
    throw new SuperJsonLoadingFailedError(superJsonResult.error);
  }

  return superJsonResult.value;
}

export function assertsDefinitionsAreNotStrings(
  definitions: string[] | RecordingDefinition[]
): asserts definitions is RecordingDefinition[] {
  for (const def of definitions) {
    if (typeof def === 'string') {
      throw new UnexpectedError('definition is a string, not object');
    }
  }
}

function resolveCredential(securityValue: SecurityValues): string {
  if (isApiKeySecurityValues(securityValue)) {
    if (securityValue.apikey.startsWith('$')) {
      return process.env[securityValue.apikey.substr(1)] ?? '';
    } else {
      return securityValue.apikey;
    }
  }

  if (isBasicAuthSecurityValues(securityValue)) {
    let user: string, password: string;

    if (securityValue.username.startsWith('$')) {
      user = process.env[securityValue.username.substr(1)] ?? '';
    } else {
      user = securityValue.username;
    }

    if (securityValue.password.startsWith('$')) {
      password = process.env[securityValue.password.substr(1)] ?? '';
    } else {
      password = securityValue.password;
    }

    return Buffer.from(user + ':' + password).toString('base64');
  }

  if (isBearerTokenSecurityValues(securityValue)) {
    if (securityValue.token.startsWith('$')) {
      return process.env[securityValue.token.substr(1)] ?? '';
    } else {
      return securityValue.token;
    }
  }

  throw new UnexpectedError('Unexpected security value');
}

export function replaceCredentials({
  definitions,
  securitySchemes,
  securityValues,
  integrationParameters,
  beforeSave,
  services,
}: {
  definitions: RecordingDefinition[];
  securitySchemes: SecurityScheme[];
  securityValues: SecurityValues[];
  integrationParameters: Record<string, string>;
  beforeSave: boolean;
  services: IServiceSelector;
}): void {
  for (const definition of definitions) {
    for (const scheme of securitySchemes) {
      let credential = '';
      let placeholder: string | undefined = undefined;

      const securityValue = securityValues.find(val => val.id === scheme.id);

      if (beforeSave) {
        if (securityValue) {
          credential = resolveCredential(securityValue);
        }
      } else {
        credential = HIDDEN_CREDENTIALS_PLACEHOLDER;

        if (securityValue) {
          placeholder = resolveCredential(securityValue);
        }
      }

      replaceCredentialInDefinition({
        definition,
        scheme,
        services,
        credential,
        placeholder,
      });
    }

    for (const parameterValue of Object.values(integrationParameters)) {
      let credential = '';
      let placeholder: string | undefined = undefined;

      if (beforeSave) {
        credential = parameterValue;
      } else {
        credential = HIDDEN_PARAMETERS_PLACEHOLDER;
        placeholder = parameterValue;
      }

      const baseUrl = services.getUrl() || ''; //get default service url

      replaceParameterInDefinition({
        definition,
        baseUrl,
        credential,
        placeholder,
      });
    }
  }
}
