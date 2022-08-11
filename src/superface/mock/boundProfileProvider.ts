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
      parameters: configuration?.parameters,
      security: configuration?.security ?? [],
      profileProviderSettings: configuration?.profileProviderSettings,
      services: configuration?.services ?? new ServiceSelector([]),
    },
    perform: jest.fn().mockResolvedValue(performResult),
  })
);
