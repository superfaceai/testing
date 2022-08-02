import { SecurityValues } from '@superfaceai/ast';
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
