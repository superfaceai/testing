import { ok } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { ComponentUndefinedError } from '../../common/errors';
import { mockMapAST, mockProfileAST } from '../mock/ast';
import { mockBoundProfileProvider } from '../mock/boundProfileProvider';
import { mockProviderJson } from '../mock/provider';
import { mockSuperJson } from '../mock/super-json';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareFiles } from './prepare-files';
import { prepareSuperface } from './prepare-superface';

jest.mock('./prepare-files', () => ({
  prepareFiles: jest.fn(),
}));

jest.mock('./create-bound-profile-provider', () => ({
  createBoundProfileProvider: jest.fn(),
}));

describe('prepare superface module', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('prepareSuperface', () => {
    it('fails when no useCase is specified', async () => {
      await expect(prepareSuperface({})).rejects.toThrowError(
        new ComponentUndefinedError('UseCase')
      );
    });

    it('returns superface configuration when files get prepared successfuly', async () => {
      const expectedFiles = {
        superJson: mockSuperJson().document,
        profileAst: mockProfileAST,
        mapAst: mockMapAST,
        providerJson: mockProviderJson(),
      };
      const expectedBoundProfileProvider = mockBoundProfileProvider(ok(''));

      mocked(prepareFiles).mockResolvedValue(expectedFiles);
      mocked(createBoundProfileProvider).mockReturnValue(
        expectedBoundProfileProvider
      );

      await expect(
        prepareSuperface({
          profile: 'profile',
          provider: 'provider',
          useCase: 'test',
        })
      ).resolves.toEqual({
        profileId: 'profile',
        providerName: 'provider',
        useCaseName: 'test',
        files: expectedFiles,
        boundProfileProvider: expectedBoundProfileProvider,
      });
    });
  });
});
