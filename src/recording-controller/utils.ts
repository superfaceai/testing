import {
  isApiKeySecurityValues,
  isBasicAuthSecurityValues,
  isBearerTokenSecurityValues,
  SecurityScheme,
  SecurityValues,
} from '@superfaceai/ast';
import { Primitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';
import createDebug from 'debug';

import { UnexpectedError } from '../common/errors';
import { RecordingDefinition, RecordingDefinitions } from '../interfaces';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './replace';

const debug = createDebug('superface:testing');

export function resolveCredential(securityValue: SecurityValues): string {
  debug('Resolving security value:', securityValue.id);

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
  debug('Replacing credentials from recording definitions');

  for (const definition of definitions) {
    for (const scheme of securitySchemes) {
      debug(
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
      debug('Going through integration parameter:', name);

      replaceParameterInDefinition({
        definition,
        baseUrl,
        ...resolvePlaceholder({ kind: 'parameter', name, value, beforeSave }),
      });
    }

    if (inputVariables) {
      for (const [name, value] of Object.entries(inputVariables)) {
        debug('Going through input property:', name);

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
