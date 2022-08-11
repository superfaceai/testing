import { SuperJson } from '@superfaceai/one-sdk';

export const mockSuperJson = (options?: {
  localProfile?: boolean;
  localMap?: boolean;
  localProvider?: boolean;
  pointsToAst?: boolean;
}) =>
  new SuperJson({
    profiles: {
      profile: options?.localProfile
        ? {
            file: options?.pointsToAst
              ? 'path/to/profile.ast.json'
              : 'path/to/profile.supr',
            providers: {
              provider: options?.localMap
                ? {
                    file: options?.pointsToAst
                      ? 'path/to/map.ast.json'
                      : 'path/to/map.suma',
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
                      ? 'path/to/map.ast.json'
                      : 'path/to/map.suma',
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
  });
