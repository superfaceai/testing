import {
  IBoundProfileProvider,
  Profile,
  Provider,
  UseCase,
} from '@superfaceai/one-sdk';

import { ISuperfaceClient } from '../client';

export interface ISuperfaceConfig {
  client: ISuperfaceClient;

  profile?: Profile | string;
  provider?: Provider | string;
  useCase?: UseCase | string;

  boundProfileProvider: IBoundProfileProvider;
}

// TODO: complete
export class SuperfaceConfig {
  // implements ISuperfaceConfig
  // constructor(
  //     readonly client: ISuperfaceClient,
  // )
}
