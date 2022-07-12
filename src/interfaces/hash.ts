import { NonPrimitive } from "@superfaceai/one-sdk/dist/internal/interpreter/variables";

export interface HashOptions {
  input: NonPrimitive;
  testName?: string;
}

export interface IGenerator {
  hash: (options: HashOptions) => string;
}
