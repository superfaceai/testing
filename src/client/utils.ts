import {
  getValue,
  isPrimitive,
  NonPrimitive,
  Primitive,
  Variables,
} from '@superfaceai/one-sdk/dist/internal/interpreter/variables';

// import createDebug from 'debug';
import { InputVariables } from '../interfaces';

// const debug = createDebug('superface:testing');

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
