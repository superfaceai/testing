import { EXTENSIONS, NormalizedSuperJsonDocument } from '@superfaceai/ast';
import { normalizeSuperJsonDocument } from '@superfaceai/one-sdk';

export const mockSuperJson = (options?: {
  localProfile?: boolean;
  localMap?: boolean;
  localProvider?: boolean;
  pointsToAst?: boolean;
  path?: string;
}): { path: string; document: NormalizedSuperJsonDocument } => ({
  path: options?.path ?? 'path/to/super.json',
  document: normalizeSuperJsonDocument({
    profiles: {
      profile: options?.localProfile
        ? {
            file: options?.pointsToAst
              ? `path/to/profile${EXTENSIONS.profile.build}`
              : `path/to/profile${EXTENSIONS.profile.source}`,
            providers: {
              provider: options?.localMap
                ? {
                    file: options?.pointsToAst
                      ? `path/to/map${EXTENSIONS.map.build}`
                      : `path/to/map${EXTENSIONS.map.source}`,
                  }
                : {},
            },
          }
        : {
            version: '1.0.0',
            providers: {
              provider: options?.localMap
                ? {
                    file: options?.pointsToAst
                      ? `path/to/map${EXTENSIONS.map.build}`
                      : `path/to/map${EXTENSIONS.map.source}`,
                  }
                : {},
            },
          },
    },
    providers: {
      provider: options?.localProvider
        ? {
            file: 'path/to/provider.json',
            security: [],
          }
        : {
            security: [],
          },
    },
  }),
});
