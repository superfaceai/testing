import { NonPrimitive } from '@superfaceai/one-sdk';

export interface HashOptions {
  input: NonPrimitive;
  testName?: string;
}

export interface IGenerator {
  hash: (options: HashOptions) => string;
}
