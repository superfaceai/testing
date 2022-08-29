import { ApiKeyPlacement, HttpScheme, SecurityType } from '@superfaceai/ast';
import { ok } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { ComponentUndefinedError } from '../../common/errors';
import { mockMapAST, mockProfileAST } from '../mock/ast';
import { mockBoundProfileProvider } from '../mock/boundProfileProvider';
import { MockEnvironment } from '../mock/environment';
import { mockProviderJson } from '../mock/provider';
import { mockSuperJson } from '../mock/super-json';
import { createBoundProfileProvider } from './create-bound-profile-provider';
import { prepareFiles } from './prepare-files';
import { prepareSuperface, resolveSecurityValues } from './prepare-superface';

jest.mock('./prepare-files', () => ({
  prepareFiles: jest.fn(),
}));

jest.mock('./create-bound-profile-provider', () => ({
  createBoundProfileProvider: jest.fn(),
}));

describe('prepare superface module', () => {
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
        usecaseName: 'test',
        files: expectedFiles,
        boundProfileProvider: expectedBoundProfileProvider,
      });
    });
  });

  describe('resolveSecurityValues', () => {
    const secret = 'resolved-secret';
    const mockEnvironment = new MockEnvironment();

    afterEach(() => {
      mockEnvironment.clear();
    });

    it('returns env variable when using $ as prefix', () => {
      mockEnvironment.addValue('SECRET', secret);

      expect(
        resolveSecurityValues(
          [
            {
              id: 'key',
              type: SecurityType.APIKEY,
              apikey: '$SECRET',
              in: ApiKeyPlacement.HEADER,
            },
            {
              id: 'key',
              type: SecurityType.APIKEY,
              apikey: '$SECRET',
              in: ApiKeyPlacement.PATH,
            },
            {
              id: 'key',
              type: SecurityType.HTTP,
              scheme: HttpScheme.BASIC,
              username: '$SECRET',
              password: '$SECRET',
            },
            {
              id: 'key',
              type: SecurityType.HTTP,
              scheme: HttpScheme.DIGEST,
              username: '$SECRET',
              password: '$SECRET',
            },
            {
              id: 'key',
              type: SecurityType.HTTP,
              scheme: HttpScheme.BEARER,
              token: '$SECRET',
            },
          ],
          { environment: mockEnvironment }
        )
      ).toEqual([
        {
          id: 'key',
          type: SecurityType.APIKEY,
          apikey: 'resolved-secret',
          in: ApiKeyPlacement.HEADER,
        },
        {
          id: 'key',
          type: SecurityType.APIKEY,
          apikey: 'resolved-secret',
          in: ApiKeyPlacement.PATH,
        },
        {
          id: 'key',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BASIC,
          username: 'resolved-secret',
          password: 'resolved-secret',
        },
        {
          id: 'key',
          type: SecurityType.HTTP,
          scheme: HttpScheme.DIGEST,
          username: 'resolved-secret',
          password: 'resolved-secret',
        },
        {
          id: 'key',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
          token: 'resolved-secret',
        },
      ]);
    });
  });
});
