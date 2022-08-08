import { err, MapASTError, ok, ServiceSelector } from '@superfaceai/one-sdk';
import { mocked } from 'ts-jest/utils';

import { matchWildCard } from './common/format';
import { exists } from './common/io';
import { writeRecordings } from './common/output-stream';
import { prepareSuperface } from './superface/config';
import { mockMapAST, mockProfileAST } from './superface/mock/ast';
import { mockBoundProfileProvider } from './superface/mock/boundProfileProvider';
import { mockProviderJson } from './superface/mock/provider';
import {
  mockSuperJson,
} from './superface/mock/superface.mock';
import { SuperfaceTest } from './superface-test';

/* eslint-disable @typescript-eslint/unbound-method */

jest.mock('./superface/config');

jest.mock('./common/io', () => ({
  readFileQuiet: jest.fn(),
  exists: jest.fn(),
}));

jest.mock('./common/format', () => ({
  ...jest.requireActual('./common/format'),
  matchWildCard: jest.fn(),
}));

jest.mock('./common/output-stream', () => ({
  ...jest.requireActual('./common/output-stream'),
  writeRecordings: jest.fn(),
}));

// const DEFAULT_RECORDING_PATH = joinPath(process.cwd(), 'nock');

describe('SuperfaceTest', () => {
  let superfaceTest: SuperfaceTest;

  afterEach(() => {
    jest.restoreAllMocks();

    mocked(exists).mockReset();
    mocked(matchWildCard).mockReset();
    mocked(writeRecordings).mockReset();
  });

  // TODO:
  // describe('with superJson', () => {});
  // describe('without superJson', () => {});

  describe('run', () => {
    describe('when performing', () => {
      const providerJson = mockProviderJson();

      it('returns error from perform', async () => {
        // Mocks everything needed form SDK

        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({ localMap: true, localProvider: true }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(
            {
              parameters: {},
              security: [],
              services: new ServiceSelector(
                providerJson.services,
                providerJson.defaultService
              ),
            },

            err(new MapASTError('error'))
          ),
        });
        // Mock stuff around recording - moving start and end recorinf fns from SuperfaceTest would make this easy.
        mocked(matchWildCard).mockReturnValue(true);

        superfaceTest = new SuperfaceTest({
          profile: 'profile',
          provider: 'provider',
          useCase: 'tets',
        });

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
          error: new MapASTError('error').toString(),
        });
      });

      it('retuns value from perform', async () => {
        // Mocks everything needed form SDK
        mocked(prepareSuperface).mockResolvedValue({
          files: {
            superJson: mockSuperJson({ localMap: true, localProvider: true }),
            profileAst: mockProfileAST,
            mapAst: mockMapAST,
            providerJson,
          },
          profileId: 'profile',
          providerName: 'provider',
          usecaseName: 'test',
          boundProfileProvider: mockBoundProfileProvider(
            {
              parameters: {},
              security: [],
              services: new ServiceSelector(
                providerJson.services,
                providerJson.defaultService
              ),
            },

            ok('result')
          ),
        });
        mocked(matchWildCard).mockReturnValue(true);

        superfaceTest = new SuperfaceTest({
          profile: 'profile',
          provider: 'provider',
          useCase: 'tets',
        });

        await expect(superfaceTest.run({ input: {} })).resolves.toEqual({
          value: 'result',
        });
      });
    });
  });
});
