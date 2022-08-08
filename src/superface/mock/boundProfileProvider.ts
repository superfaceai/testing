import { NormalizedProfileProviderSettings } from '@superfaceai/ast';
import {
  BoundProfileProvider,
  IServiceSelector,
  MapInterpreterError,
  ProfileParameterError,
  Result,
  SecurityConfiguration,
} from '@superfaceai/one-sdk';

export const mockBoundProfileProvider = jest.fn<
  BoundProfileProvider,
  Parameters<
    (
      configuration: {
        services: IServiceSelector;
        profileProviderSettings?: NormalizedProfileProviderSettings;
        security: SecurityConfiguration[];
        parameters?: Record<string, string>;
      },

      performResult: Result<
        unknown,
        ProfileParameterError | MapInterpreterError
      >
    ) => BoundProfileProvider
  >
>(
  (
    configuration: {
      services: IServiceSelector;
      profileProviderSettings?: NormalizedProfileProviderSettings;
      security: SecurityConfiguration[];
      parameters?: Record<string, string>;
    },
    performResult: Result<unknown, ProfileParameterError | MapInterpreterError>
  ) => ({
    ...Object.create(BoundProfileProvider.prototype),
    configuration,
    perform: jest.fn().mockResolvedValue(performResult),
  })
);
