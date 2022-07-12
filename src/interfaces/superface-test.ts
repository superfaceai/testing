import { Profile, Provider, Result, UseCase } from '@superfaceai/one-sdk';
import { Primitive } from '@superfaceai/one-sdk/dist/internal/interpreter/variables';

export type InputVariables = Record<string, Primitive>;
export type TestingReturn = Result<unknown, string>;

export interface TestPayload {
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
}

export type SuperfaceTestRun = TestPayload & {
  testName?: string;
};
