import {
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import { BoundProfileProvider } from '@superfaceai/one-sdk';

export interface SuperfaceConfiguration {
  boundProfileProvider: BoundProfileProvider;
  profileId: string;
  providerName: string;
  useCaseName: string;
  files: {
    superJson: NormalizedSuperJsonDocument;
    profileAst: ProfileDocumentNode;
    mapAst: MapDocumentNode;
    providerJson: ProviderJson;
  };
}
