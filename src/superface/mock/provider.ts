import {
  ProviderJson,
  ProviderService,
  SecurityValues,
} from '@superfaceai/ast';
import { Provider, ProviderConfiguration } from '@superfaceai/one-sdk';

export function createProvider(options?: {
  name?: string;
  security?: SecurityValues[];
  parameters?: Record<string, string>;
}): Provider {
  return new Provider(
    new ProviderConfiguration(
      options?.name ?? 'provider',
      options?.security ?? [],
      options?.parameters
    )
  );
}

export const mockProviderJson = (options?: {
  services: ProviderService[];
  name?: string;
  baseUrl?: string;
}): ProviderJson => ({
  name: options?.name ?? 'provider',
  services: options?.services ?? [
    { id: 'test-service', baseUrl: options?.baseUrl ?? 'service/base/url' },
  ],
  defaultService: 'test-service',
});
