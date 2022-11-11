import { SecurityValues } from '@superfaceai/ast';
import { SecurityConfiguration } from '@superfaceai/one-sdk';
import createDebug from 'debug';

import { InputVariables } from '../../client';
import { UnexpectedError } from '../../common/errors';
import {
  RecordingDefinition,
  RecordingDefinitions,
} from '../../recording/recording.interfaces';
import {
  replaceCredentialInDefinition,
  replaceInputInDefinition,
  replaceParameterInDefinition,
} from './replace';

const debugSensitive = createDebug('superface:testing:recordings:sensitive');

export const replace = (
  payload: string,
  credential: string,
  placeholder: string
): string =>
  payload.replace(
    new RegExp(`${credential}|${encodeURIComponent(credential)}`, 'g'),
    placeholder
  );

export const includes = (payload: string, credential: string): boolean =>
  payload.includes(credential) ||
  payload.includes(encodeURIComponent(credential));

export const replaceCredential = ({
  payload,
  credential,
  placeholder,
}: {
  payload: string;
  credential: string;
  placeholder: string;
}): string => {
  if (credential !== '') {
    debugSensitive(
      `Replacing credential: '${credential}' for placeholder: '${placeholder}'`
    );

    return replace(payload, credential, placeholder);
  }

  return payload;
};

const debugRecording = createDebug('superface:testing:recordings');

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
  beforeSave: boolean;
  baseUrl: string;
  inputVariables?: InputVariables;
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
  params: Record<string, string>,
  inputVariables?: InputVariables
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

    if (inputVariables) {
      for (const [name, value] of Object.entries(inputVariables)) {
        if (stringifiedDef.includes(value.toString())) {
          console.warn(
            `Value for input variable '${name}' was found in recorded HTTP traffic.`
          );
        }
      }
    }
  }
}
