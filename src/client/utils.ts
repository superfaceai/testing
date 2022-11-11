import {
  getValue,
  isPrimitive,
  NonPrimitive,
  Primitive,
  Variables,
} from '@superfaceai/one-sdk';

import { InputVariables, PerformError } from './superface-test.interfaces';

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
