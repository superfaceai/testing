import {
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  isDigestSecurityValues,
  NormalizedSuperJsonDocument,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import {
  BoundProfileProvider,
  PerformError,
  Profile,
  Provider,
  SuperfaceClient,
  SuperJson,
  UnexpectedError,
  UseCase,
} from '@superfaceai/one-sdk';
import {
  getValue,
  isPrimitive,
  NonPrimitive,
  Primitive,
  Variables,
} from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';
import { join as joinPath } from 'path';

import {
  ComponentUndefinedError,
  InstanceMissingError,
  MapUndefinedError,
  ProfileUndefinedError,
  ProviderUndefinedError,
  SuperJsonLoadingFailedError,
  SuperJsonNotFoundError,
} from './common/errors';
import {
  IGenerator,
  InputGenerateHash,
  JestGenerateHash,
  MochaGenerateHash,
} from './generate-hash';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './nock';
import {
  CompleteSuperfaceTestConfig,
  InputVariables,
  RecordingDefinition,
  RecordingDefinitions,
  SuperfaceTestConfigPayload,
} from './superface-test.interfaces';

const debugSetup = createDebug('superface:testing:setup');
const debugRecording = createDebug('superface:testing:recordings');

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
): void {
  debugSetup(
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

  debugSetup('Found profile provider:', targetedProfileProvider);

  if (!('file' in targetedProfileProvider)) {
    throw new MapUndefinedError(profileId, providerId);
  }
}

/**
 * Return Security values from super.json file for specified provider
 * @param provider name of provider
 * @param superJsonNormalized normalized super.json document
 * @returns array of SecurityValue
 */
export function getSecurityValues(
  provider: string,
  superJsonNormalized: NormalizedSuperJsonDocument
): SecurityValues[] {
  const providerSettings = superJsonNormalized.providers[provider];
  if (providerSettings === undefined) {
    throw new ProviderUndefinedError(provider);
  }

  return providerSettings.security;
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

  debugSetup('Loading super.json from path:', superPath);

  if (superPath === undefined) {
    throw new SuperJsonNotFoundError();
  }

  const superJsonResult = await SuperJson.load(
    joinPath(superPath, 'super.json')
  );

  debugSetup('Found super.json:', superJsonResult);

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

export function resolveCredential(securityValue: SecurityValues): string {
  debugRecording('Resolving security value:', securityValue.id);

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

  if (isDigestSecurityValues(securityValue)) {
    return 'Unknown';
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

export const HIDDEN_CREDENTIALS_PLACEHOLDER = 'SECURITY_';
export const HIDDEN_PARAMETERS_PLACEHOLDER = 'PARAMS_';
export const HIDDEN_INPUT_PLACEHOLDER = 'INPUT_';

/**
 * Resolves placeholder and credential properties later passed to nock utils.
 * It composes placeholder based on given name of security scheme or parameter
 */
export function resolvePlaceholder({
  name,
  value,
  beforeSave,
  kind,
}: {
  name: string;
  value: string;
  beforeSave: boolean;
  kind: 'credential' | 'parameter' | 'input';
}): {
  credential: string;
  placeholder: string;
} {
  let placeholderFormat: string;
  switch (kind) {
    case 'credential':
      placeholderFormat = HIDDEN_CREDENTIALS_PLACEHOLDER;
      break;
    case 'parameter':
      placeholderFormat = HIDDEN_PARAMETERS_PLACEHOLDER;
      break;
    case 'input':
      placeholderFormat = HIDDEN_INPUT_PLACEHOLDER;
      break;
    default:
      throw new Error('Invalid placeholder kind');
  }

  const placeholder = placeholderFormat + name;

  return {
    credential: beforeSave ? value : placeholder,
    placeholder: beforeSave ? placeholder : value,
  };
}

export function replaceCredentials({
  definitions,
  securitySchemes,
  securityValues,
  integrationParameters,
  inputVariables,
  beforeSave,
  baseUrl,
}: {
  definitions: RecordingDefinition[];
  securitySchemes: SecurityScheme[];
  securityValues: SecurityValues[];
  integrationParameters: Record<string, string>;
  inputVariables?: Record<string, Primitive>;
  beforeSave: boolean;
  baseUrl: string;
}): void {
  debugRecording('Replacing credentials from recording definitions');

  for (const definition of definitions) {
    for (const scheme of securitySchemes) {
      debugRecording(
        `Going through scheme with id: '${scheme.id}' and type: '${scheme.type}'`
      );

      const securityValue = securityValues.find(val => val.id === scheme.id);

      if (securityValue) {
        replaceCredentialInDefinition({
          definition,
          scheme,
          baseUrl,
          ...resolvePlaceholder({
            kind: 'credential',
            name: scheme.id,
            value: resolveCredential(securityValue),
            beforeSave,
          }),
        });
      }
    }

    for (const [name, value] of Object.entries(integrationParameters)) {
      debugRecording('Going through integration parameter:', name);

      replaceParameterInDefinition({
        definition,
        baseUrl,
        ...resolvePlaceholder({ kind: 'parameter', name, value, beforeSave }),
      });
    }

    if (inputVariables) {
      for (const [name, value] of Object.entries(inputVariables)) {
        debugRecording('Going through input property:', name);

        replaceInputInDefinition({
          definition,
          baseUrl,
          ...resolvePlaceholder({
            kind: 'input',
            name,
            value: value.toString(),
            beforeSave,
          }),
        });
      }
    }
  }
}

export function checkSensitiveInformation(
  definitions: RecordingDefinitions,
  schemes: SecurityScheme[],
  securityValues: SecurityValues[],
  params: Record<string, string>
): void {
  for (const definition of definitions) {
    const stringifiedDef = JSON.stringify(definition);

    for (const scheme of schemes) {
      const securityValue = securityValues.find(val => val.id === scheme.id);

      if (
        securityValue &&
        stringifiedDef.includes(resolveCredential(securityValue))
      ) {
        console.warn(
          `Value for security scheme '${scheme.id}' of type '${scheme.type}' was found in recorded HTTP traffic.`
        );
      }
    }

    for (const [paramName, paramValue] of Object.entries(params)) {
      if (stringifiedDef.includes(paramValue)) {
        console.warn(
          `Value for integration parameter '${paramName}' was found in recorded HTTP traffic.`
        );
      }
    }
  }
}

export function searchValues(
  input: NonPrimitive,
  accessors?: string[]
): InputVariables | undefined {
  if (accessors === undefined) {
    return undefined;
  }

  const result: InputVariables = {};

  for (const property of accessors) {
    const keys = property.split('.');

    if (keys.length > 1) {
      const value = getValue(input, keys);

      assertPrimitive(value, property);

      result[property] = value;
    } else {
      const value = input[property];

      assertPrimitive(value, property);

      result[property] = value;
    }
  }

  return result;
}

function assertPrimitive(
  value: Variables | undefined,
  property: string
): asserts value is Primitive {
  if (value == undefined) {
    throw new Error(`Input property: ${property} is not defined`);
  }

  if (!isPrimitive(value)) {
    throw new Error(`Input property: ${property} is not primitive value`);
  }
}

function hasProperty<K extends PropertyKey>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
  propKey: K
): obj is Record<K, unknown> {
  return !!obj && propKey in obj;
}

function isFunction<R extends unknown>(
  value: unknown,
  returnType?: R
): value is () => R {
  if (returnType) {
    return typeof value === 'function' && typeof value() === typeof returnType;
  }

  return typeof value === 'function';
}

/**
 * Checks for structural typing of specified `testInstance` and returns
 * corresponding instance of hash generator
 *
 * It checks for jest's `expect` instance and mocha's `this` instance,
 * otherwise it generates hash according to specified `testName` or `input` in test run
 */
export function getGenerator(testInstance: unknown): IGenerator {
  // jest instance of `expect` contains function `getState()` which should contain `currentTestName`
  if (testInstance && isFunction(testInstance)) {
    if (
      hasProperty(testInstance, 'getState') &&
      isFunction(testInstance.getState)
    ) {
      const state = testInstance.getState();

      if (state) {
        return new JestGenerateHash(state as { currentTestName?: unknown });
      }
    }
  }

  // mocha instance `this` contains information about tests in multiple contexts
  if (testInstance && typeof testInstance === 'object') {
    if (
      hasProperty(testInstance, 'test') &&
      hasProperty(testInstance.test, 'type')
    ) {
      // inside hook - using `this.currentTest.fullTitle()`
      if (testInstance.test.type === 'hook') {
        if (hasProperty(testInstance, 'currentTest')) {
          if (
            hasProperty(testInstance.currentTest, 'fullTitle') &&
            isFunction(testInstance.currentTest.fullTitle)
          ) {
            const value = testInstance.currentTest.fullTitle();

            if (typeof value === 'string') {
              return new MochaGenerateHash(value);
            }
          }
        }
      }

      // inside test - using `this.test.fullTitle()`
      if (testInstance.test.type === 'test') {
        if (
          hasProperty(testInstance.test, 'fullTitle') &&
          isFunction(testInstance.test.fullTitle)
        ) {
          const value = testInstance.test.fullTitle();

          if (typeof value === 'string') {
            return new MochaGenerateHash(value);
          }
        }
      }
    }
  }

  return new InputGenerateHash();
}

export function parseBooleanEnv(variable: string | undefined): boolean {
  if (variable === 'true') {
    return true;
  }

  if (variable === 'false') {
    return false;
  }

  return false;
}

/**
 * @param error - error returned from perform
 * @returns perform error without ast metadata
 */
export function mapError(error: PerformError): PerformError {
  const result = error;

  if ('metadata' in result) {
    delete result.metadata;
  }

  return result;
}
