import {
  MapDocumentNode,
  NormalizedProfileProviderSettings,
  ProfileDocumentNode,
  ProviderService,
} from '@superfaceai/ast';
import {
  IServiceSelector,
  MapInterpreterError,
  ok,
  ProfileParameterError,
  Result,
  SecurityConfiguration,
  ServiceSelector,
} from '@superfaceai/one-sdk';

import { SuperfaceConfiguration } from '../../interfaces';
import { mockMapAST, mockProfileAST } from './ast';
import { mockBoundProfileProvider } from './boundProfileProvider';
import { mockProviderJson } from './provider';
import { mockSuperJson } from './super-json';

export const mockSuperface = (options?: {
  superJson?: {
    localProfile?: boolean;
    localMap?: boolean;
    localProvider?: boolean;
    pointsToAst?: boolean;
  };
  profile?: {
    name?: string;
    ast?: ProfileDocumentNode;
  };
  provider?: {
    name?: string;
    baseUrl?: string;
    mapAst?: MapDocumentNode;
    services?: ProviderService[];
  };
  useCaseName?: string;
  boundProfileProvider?: {
    result?: Result<unknown, ProfileParameterError | MapInterpreterError>;
    services?: IServiceSelector;
    profileProviderSettings?: NormalizedProfileProviderSettings;
    security?: SecurityConfiguration[];
    parameters?: Record<string, string>;
  };
}): SuperfaceConfiguration => {
  const providerJson = mockProviderJson({
    name: options?.provider?.name,
    baseUrl: options?.provider?.baseUrl,
    services: options?.provider?.services,
  });

  const boundProfileProvider = mockBoundProfileProvider(
    options?.boundProfileProvider?.result ?? ok('value'),
    {
      services:
        options?.boundProfileProvider?.services ??
        new ServiceSelector(providerJson.services, providerJson.defaultService),
      profileProviderSettings:
        options?.boundProfileProvider?.profileProviderSettings,
      security: options?.boundProfileProvider?.security,
      parameters: options?.boundProfileProvider?.parameters,
    }
  );

  return {
    files: {
      superJson: mockSuperJson({
        localProfile: options?.superJson?.localProfile ?? true,
        localMap: options?.superJson?.localMap ?? true,
        localProvider: options?.superJson?.localProvider ?? true,
      }).document,
      profileAst: options?.profile?.ast ?? mockProfileAST,
      mapAst: options?.provider?.mapAst ?? mockMapAST,
      providerJson,
    },
    profileId: options?.profile?.name ?? 'profile',
    providerName: options?.provider?.name ?? 'provider',
    useCaseName: options?.useCaseName ?? 'test',
    boundProfileProvider,
  };
};
