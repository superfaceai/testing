import { mocked } from 'ts-jest/utils';

import {
  ComponentUndefinedError,
  SuperJsonNotFoundError,
} from '../../common/errors';
import { SuperfaceTestConfigPayload } from '../../superface-test.interfaces';
import { getSuperJson } from '../../superface-test.utils';
import { mockMapAST, mockProfileAST } from '../mock/ast';
import { mockProviderJson } from '../mock/provider';
import { mockSuperJson } from '../mock/super-json';
import { getMapAst, getProfileAst } from './prepare-ast';
import { prepareFiles } from './prepare-files';
import { getProviderJson } from './prepare-provider-json';

const testPayload: SuperfaceTestConfigPayload = {
  profile: 'profile',
  provider: 'provider',
  useCase: 'test',
};

jest.mock('../../superface-test.utils', () => ({
  ...jest.requireActual('../../superface-test.utils'),
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
  describe('prepareFiles', () => {
    it('fails when no super.json is found', async () => {
      mocked(getSuperJson).mockResolvedValue(undefined);

      await expect(prepareFiles(testPayload)).rejects.toThrowError(
        new SuperJsonNotFoundError()
      );
    });

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
        superJson: mockSuperJson(),
        profileAst: mockProfileAST,
        mapAst: mockMapAST,
        providerJson: mockProviderJson(),
      });
    });
  });
});
