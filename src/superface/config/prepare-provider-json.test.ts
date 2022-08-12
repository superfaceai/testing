import { ok } from '@superfaceai/one-sdk';

import { ProviderJsonUndefinedError } from '../../common/errors';
import { mockFileSystem } from '../mock/file-system';
import { createProvider, mockProviderJson } from '../mock/provider';
import { mockSuperJson } from '../mock/super-json';
import { getProviderJson } from './prepare-provider-json';

describe('Prepare Provider JSON module', () => {
  describe('getProviderJson', () => {
    describe('when specified provider is instance of Provider', () => {
      it('fails when specified provider is not in superJson', async () => {
        await expect(
          getProviderJson(
            createProvider({ name: 'not-existing-provider' }),
            mockSuperJson(),
            mockFileSystem()
          )
        ).rejects.toThrowError(
          new ProviderJsonUndefinedError('not-existing-provider')
        );
      });

      it('fails when specified provider is not local in superJson', async () => {
        await expect(
          getProviderJson(
            createProvider(),
            mockSuperJson({ localProvider: false }),
            mockFileSystem()
          )
        ).rejects.toThrowError(new ProviderJsonUndefinedError('provider'));
      });

      it('returns providerJson instance', async () => {
        await expect(
          getProviderJson(
            createProvider(),
            mockSuperJson({ localProvider: true }),
            mockFileSystem({
              readFile: async () => ok(JSON.stringify(mockProviderJson())),
            })
          )
        ).resolves.toEqual(mockProviderJson());
      });
    });

    describe('when specified provider is string', () => {
      it('fails when specified provider is not in superJson', async () => {
        await expect(
          getProviderJson(
            'not-existing-provider',
            mockSuperJson(),
            mockFileSystem()
          )
        ).rejects.toThrowError(
          new ProviderJsonUndefinedError('not-existing-provider')
        );
      });

      it('fails when specified provider is not local in superJson', async () => {
        await expect(
          getProviderJson(
            'provider',
            mockSuperJson({ localProvider: false }),
            mockFileSystem()
          )
        ).rejects.toThrowError(new ProviderJsonUndefinedError('provider'));
      });

      it('returns providerJson instance', async () => {
        await expect(
          getProviderJson(
            'provider',
            mockSuperJson({ localProvider: true }),
            mockFileSystem({
              readFile: async () => ok(JSON.stringify(mockProviderJson())),
            })
          )
        ).resolves.toEqual(mockProviderJson());
      });
    });
  });
});
