import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';

export const mockProfileRaw = `name = "profile"
version = "1.0.0"

usecase test {}`;

export const mockMapRaw = `profile = "profile@1.0"
provider = "provider"

map test {}`;

export const mockProfileAST: ProfileDocumentNode = {
  kind: 'ProfileDocument',
  header: {
    kind: 'ProfileHeader',
    name: 'profile',
    version: {
      major: 1,
      minor: 0,
      patch: 0,
    },
  },
  definitions: [
    {
      kind: 'UseCaseDefinition',
      useCaseName: 'test',
    },
  ],
  astMetadata: {
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    sourceChecksum: 'checksum',
  },
};

export const mockMapAST: MapDocumentNode = {
  kind: 'MapDocument',
  header: {
    kind: 'MapHeader',
    profile: {
      name: 'profile',
      version: {
        major: 1,
        minor: 0,
      },
    },
    provider: 'provider',
  },
  definitions: [
    {
      kind: 'MapDefinition',
      name: 'test',
      usecaseName: 'test',
      statements: [],
    },
  ],
  astMetadata: {
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    sourceChecksum: 'checksum',
  },
};
