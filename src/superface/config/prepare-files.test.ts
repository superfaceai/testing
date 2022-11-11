import { mocked } from 'ts-jest/utils';

import { SuperfaceTestConfig } from '../../client';
import { ComponentUndefinedError } from '../../common/errors';
import { mockMapAST, mockProfileAST } from '../mock/ast';
import { mockProviderJson } from '../mock/provider';
import { mockSuperJson } from '../mock/super-json';
import { getMapAst, getProfileAst } from './prepare-ast';
import { prepareFiles } from './prepare-files';
import { getProviderJson } from './prepare-provider-json';
import { getSuperJson } from './prepare-super-json';

const testPayload: SuperfaceTestConfig = {
  profile: 'profile',
  provider: 'provider',
  useCase: 'test',
};

jest.mock('./prepare-super-json', () => ({
  getSuperJson: jest.fn(),
}));

jest.mock('./prepare-ast', () => ({
  getMapAst: jest.fn(),
  getProfileAst: jest.fn(),
}));

jest.mock('./prepare-provider-json', () => ({
  getProviderJson: jest.fn(),
}));

describe('Prepare files module', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('prepareFiles', () => {
    it('fails when no profile is specified', async () => {
      mocked(getSuperJson).mockResolvedValue(mockSuperJson());

      await expect(
        prepareFiles({
          provider: 'provider',
          useCase: 'test',
        })
      ).rejects.toThrowError(new ComponentUndefinedError('Profile'));
    });

    it('fails when no provider is specified', async () => {
      mocked(getSuperJson).mockResolvedValue(mockSuperJson());
      mocked(getProfileAst).mockResolvedValue(mockProfileAST);

      await expect(
        prepareFiles({
          profile: 'profile',
          useCase: 'test',
        })
      ).rejects.toThrowError(new ComponentUndefinedError('Provider'));
    });

    it('returns files', async () => {
      mocked(getSuperJson).mockResolvedValue(mockSuperJson());
      mocked(getProfileAst).mockResolvedValue(mockProfileAST);
      mocked(getMapAst).mockResolvedValue(mockMapAST);
      mocked(getProviderJson).mockResolvedValue(mockProviderJson());

      await expect(prepareFiles(testPayload)).resolves.toEqual({
        superJson: mockSuperJson().document,
        profileAst: mockProfileAST,
        mapAst: mockMapAST,
        providerJson: mockProviderJson(),
      });
    });
  });
});
