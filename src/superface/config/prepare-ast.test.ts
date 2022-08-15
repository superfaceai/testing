import { ok } from '@superfaceai/one-sdk';
import { parseMap, parseProfile } from '@superfaceai/parser';
import { mocked } from 'ts-jest/utils';

import { MapUndefinedError, ProfileUndefinedError } from '../../common/errors';
import {
  mockMapAST,
  mockMapRaw,
  mockProfileAST,
  mockProfileRaw,
} from '../mock/ast';
import { mockFileSystem } from '../mock/file-system';
import { createProfile } from '../mock/profile';
import { mockSuperJson } from '../mock/super-json';
import { getMapAst, getProfileAst } from './prepare-ast';

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual('@superfaceai/parser'),
  parseProfile: jest.fn(),
  parseMap: jest.fn(),
}));

describe('Prepare AST module', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

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

  describe('getMapAst', () => {
    it('fails when specified profile is not in superJson', async () => {
      await expect(
        getMapAst(
          'not-existing-profile',
          'not-existing-provider',
          mockSuperJson(),
          mockFileSystem()
        )
      ).rejects.toThrowError(
        new MapUndefinedError('not-existing-profile', 'not-existing-provider')
      );
    });

    it('fails when specified provider is not in superJson', async () => {
      await expect(
        getMapAst(
          'profile',
          'not-existing-provider',
          mockSuperJson(),
          mockFileSystem()
        )
      ).rejects.toThrowError(
        new MapUndefinedError('profile', 'not-existing-provider')
      );
    });

    it('fails when specified provider is not local in superJson', async () => {
      await expect(
        getMapAst('profile', 'provider', mockSuperJson(), mockFileSystem())
      ).rejects.toThrowError(new MapUndefinedError('profile', 'provider'));
    });

    describe('when superJson points to ast file', () => {
      it('returns map ast', async () => {
        await expect(
          getMapAst(
            'profile',
            'provider',
            mockSuperJson({ localMap: true, pointsToAst: true }),
            mockFileSystem({
              readFile: async () => ok(JSON.stringify(mockMapAST)),
            })
          )
        ).resolves.toEqual(mockMapAST);
      });
    });

    describe('when superJson points to parsed file', () => {
      it('returns map ast', async () => {
        mocked(parseMap).mockReturnValue(mockMapAST);

        await expect(
          getMapAst(
            'profile',
            'provider',
            mockSuperJson({ localMap: true }),
            mockFileSystem({
              readFile: async () => ok(mockMapRaw),
            })
          )
        ).resolves.toEqual(mockMapAST);
      });
    });
  });
});
