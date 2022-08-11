import { ok } from '@superfaceai/one-sdk';
import { parseProfile } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';
import { ProfileUndefinedError } from '../../common/errors';
import { mockProfileAST, mockProfileRaw } from '../mock/ast';
import { mockFileSystem } from '../mock/file-system';
import { createProfile } from '../mock/profile';
import { mockSuperJson } from '../mock/super-json';
import { getProfileAst } from './prepare-ast';

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual('@superfaceai/parser'),
  parseProfile: jest.fn(),
}));

describe('Prepare AST module', () => {
  describe('getProfileAst', () => {
    it('fails when specified profile is not in superJson', async () => {
      await expect(
        getProfileAst('not-existing-profile', mockSuperJson(), mockFileSystem())
      ).rejects.toThrowError(new ProfileUndefinedError('not-existing-profile'));
    });

    it('fails when specified profile is not local in superJson', async () => {
      await expect(
        getProfileAst('profile', mockSuperJson(), mockFileSystem())
      ).rejects.toThrowError(new ProfileUndefinedError('profile'));
    });

    describe('when superJson points to ast file', () => {
      it('returns profile ast', async () => {
        await expect(
          getProfileAst(
            'profile',
            mockSuperJson({ localProfile: true, pointsToAst: true }),
            mockFileSystem({
              readFile: async () => ok(JSON.stringify(mockProfileAST)),
            })
          )
        ).resolves.toEqual(mockProfileAST);
      });
    });

    describe('when superJson points to parsed file', () => {
      it('returns profile ast', async () => {
        mocked(parseProfile).mockReturnValue(mockProfileAST);

        await expect(
          getProfileAst(
            'profile',
            mockSuperJson({ localProfile: true }),
            mockFileSystem({
              readFile: async () => ok(mockProfileRaw),
            })
          )
        ).resolves.toEqual(mockProfileAST);
      });
    });

    it('returns profile ast when specified profile is an instance', async () => {
      await expect(
        getProfileAst(createProfile(), mockSuperJson(), mockFileSystem())
      ).resolves.toEqual(mockProfileAST);
    });
  });

  describe('getMapAst', () => {});
});
