import {
  MapInterpreterError,
  Primitive,
  Profile,
  ProfileParameterError,
  Provider,
  Result,
  UnexpectedError,
  UseCase,
} from '@superfaceai/one-sdk';

import { HashOptions } from './hash';

export type InputVariables = Record<string, Primitive>;
export type PerformError =
  | ProfileParameterError
  | MapInterpreterError
  | UnexpectedError;

export type TestingReturn = Result<unknown, PerformError | string>;

export interface SuperfaceTestConfig {
  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;
}

export type SuperfaceTestRun = SuperfaceTestConfig & HashOptions;
