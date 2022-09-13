import { NormalizedProfileProviderSettings } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  IServiceSelector,
  MapInterpreterError,
  ProfileParameterError,
  Result,
  SecurityConfiguration,
  ServiceSelector,
} from '@superfaceai/one-sdk';

/* eslint-disable @typescript-eslint/no-unsafe-return */
export const mockBoundProfileProvider = jest.fn<
  BoundProfileProvider,
  Parameters<
    (
      performResult: Result<
        unknown,
        ProfileParameterError | MapInterpreterError
      >,

      configuration?: {
        services?: IServiceSelector;
        profileProviderSettings?: NormalizedProfileProviderSettings;
        security?: SecurityConfiguration[];
        parameters?: Record<string, string>;
      }
    ) => BoundProfileProvider
  >
>(
  (
    performResult: Result<unknown, ProfileParameterError | MapInterpreterError>,
    configuration?: {
      services?: IServiceSelector;
      profileProviderSettings?: NormalizedProfileProviderSettings;
      security?: SecurityConfiguration[];
      parameters?: Record<string, string>;
    }
  ) => ({
    ...Object.create(BoundProfileProvider.prototype),
    configuration: {
      services: configuration?.services ?? new ServiceSelector([]),
      profileProviderSettings: configuration?.profileProviderSettings,
      security: configuration?.security ?? [],
      parameters: configuration?.parameters,
    },
    perform: jest.fn().mockResolvedValue(performResult),
  })
);
