import { SecurityValues } from '@superfaceai/ast';
import {
  getValue,
  isPrimitive,
  NonPrimitive,
  Primitive,
  SecurityConfiguration,
  UnexpectedError,
  Variables,
} from '@superfaceai/one-sdk';
import createDebug from 'debug';

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
  InputVariables,
  PerformError,
  RecordingDefinition,
  RecordingDefinitions,
} from './superface-test.interfaces';

const debugRecording = createDebug('superface:testing:recordings');

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

  if ('apikey' in securityValue) {
    if (securityValue.apikey.startsWith('$')) {
      return process.env[securityValue.apikey.substr(1)] ?? '';
    } else {
      return securityValue.apikey;
    }
  }

  if ('username' in securityValue) {
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

  if ('token' in securityValue) {
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
  security,
  integrationParameters,
  inputVariables,
  beforeSave,
  baseUrl,
}: {
  definitions: RecordingDefinition[];
  security: SecurityConfiguration[];
  integrationParameters: Record<string, string>;
  inputVariables?: Record<string, Primitive>;
  beforeSave: boolean;
  baseUrl: string;
}): void {
  debugRecording('Replacing credentials from recording definitions');

  for (const definition of definitions) {
    for (const securityConfig of security) {
      debugRecording(
        `Going through scheme with id: '${securityConfig.id}' and type: '${securityConfig.type}'`
      );

      replaceCredentialInDefinition({
        definition,
        security: securityConfig,
        baseUrl,
        ...resolvePlaceholder({
          kind: 'credential',
          name: securityConfig.id,
          value: resolveCredential(securityConfig),
          beforeSave,
        }),
      });
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
  security: SecurityConfiguration[],
  params: Record<string, string>
): void {
  for (const definition of definitions) {
    const stringifiedDef = JSON.stringify(definition);

    for (const securityConfig of security) {
      if (stringifiedDef.includes(resolveCredential(securityConfig))) {
        console.warn(
          `Value for security scheme '${securityConfig.id}' of type '${securityConfig.type}' was found in recorded HTTP traffic.`
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
