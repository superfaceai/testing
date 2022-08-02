import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';

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
  definitions: [],
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
  definitions: [],
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
