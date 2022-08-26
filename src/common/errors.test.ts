import {
  assertIsIOError,
  BaseURLNotFoundError,
  ComponentUndefinedError,
  CoverageFileNotFoundError,
  InstanceMissingError,
  MapUndefinedError,
  ProfileUndefinedError,
  RecordingPathUndefinedError,
  RecordingsNotFoundError,
  SuperJsonNotFoundError,
  UnexpectedError,
} from './errors';

describe('errors', () => {
  describe('when throwing UnexpectedError', () => {
    const error = new UnexpectedError('out of nowhere');

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow('out of nowhere');
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual('UnexpectedError: out of nowhere');
    });
  });

  describe('when throwing MapUndefinedError', () => {
    const error = new MapUndefinedError('profile', 'provider');

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow(
        'Map for profile and provider does not exist.\nUse `superface create --map --profileId profile --providerName provider` to create it.'
      );
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'MapUndefinedError: Map for profile and provider does not exist.\nUse `superface create --map --profileId profile --providerName provider` to create it.'
      );
    });
  });

  describe('when throwing ProfileUndefinedError', () => {
    const error = new ProfileUndefinedError('profile');

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow(
        'Profile profile does not exist.\nUse `superface create --profile --profileId profile` to create it.'
      );
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'ProfileUndefinedError: Profile profile does not exist.\nUse `superface create --profile --profileId profile` to create it.'
      );
    });
  });

  describe('when throwing ComponentUndefinedError', () => {
    const errorClient = new ComponentUndefinedError('Client');
    const errorProfile = new ComponentUndefinedError('Profile');
    const errorProvider = new ComponentUndefinedError('Provider');
    const errorUseCase = new ComponentUndefinedError('UseCase');
    const errorBoundProfileProvider = new ComponentUndefinedError(
      'BoundProfileProvider'
    );

    describe('throws in correct format', () => {
      it('for Client', () => {
        expect(() => {
          throw errorClient;
        }).toThrow('Undefined Client');
      });

      it('for Profile', () => {
        expect(() => {
          throw errorProfile;
        }).toThrow('Undefined Profile');
      });

      it('for Provider', () => {
        expect(() => {
          throw errorProvider;
        }).toThrow('Undefined Provider');
      });

      it('for UseCase', () => {
        expect(() => {
          throw errorUseCase;
        }).toThrow('Undefined UseCase');
      });

      it('for BoundProfileProvider', () => {
        expect(() => {
          throw errorBoundProfileProvider;
        }).toThrow('Undefined BoundProfileProvider');
      });
    });

    describe('returns correct format', () => {
      it('for Client', () => {
        expect(errorClient.toString()).toEqual(
          'ComponentUndefinedError: Undefined Client'
        );
      });
      it('for Profile', () => {
        expect(errorProfile.toString()).toEqual(
          'ComponentUndefinedError: Undefined Profile'
        );
      });
      it('for Provider', () => {
        expect(errorProvider.toString()).toEqual(
          'ComponentUndefinedError: Undefined Provider'
        );
      });
      it('for UseCase', () => {
        expect(errorUseCase.toString()).toEqual(
          'ComponentUndefinedError: Undefined UseCase'
        );
      });
      it('for BoundProfileProvider', () => {
        expect(errorBoundProfileProvider.toString()).toEqual(
          'ComponentUndefinedError: Undefined BoundProfileProvider'
        );
      });
    });
  });

  describe('when throwing RecordingPathUndefinedError', () => {
    const errorRecord = new RecordingPathUndefinedError();

    it('throws in correct format', () => {
      expect(() => {
        throw errorRecord;
      }).toThrow('Recording path missing.');
    });

    it('returns correct format', () => {
      expect(errorRecord.toString()).toEqual(
        'RecordingPathUndefinedError: Recording path missing.'
      );
    });
  });

  describe('when throwing InstanceMissingError', () => {
    const missingProfile = new InstanceMissingError('Profile');
    const missingProvider = new InstanceMissingError('Provider');
    const missingUseCase = new InstanceMissingError('UseCase');

    describe('throws in correct format', () => {
      it('for Profile', () => {
        expect(() => {
          throw missingProfile;
        }).toThrow('Should be Profile instance.');
      });

      it('for Provider', () => {
        expect(() => {
          throw missingProvider;
        }).toThrow('Should be Provider instance.');
      });

      it('for UseCase', () => {
        expect(() => {
          throw missingUseCase;
        }).toThrow('Should be UseCase instance.');
      });
    });

    describe('returns correct format', () => {
      it('for profile', () => {
        expect(missingProfile.toString()).toEqual(
          'InstanceMissingError: Should be Profile instance.'
        );
      });

      it('for Provider', () => {
        expect(missingProvider.toString()).toEqual(
          'InstanceMissingError: Should be Provider instance.'
        );
      });

      it('for UseCase', () => {
        expect(missingUseCase.toString()).toEqual(
          'InstanceMissingError: Should be UseCase instance.'
        );
      });
    });
  });

  describe('when throwing SuperJsonNotFoundError', () => {
    const error = new SuperJsonNotFoundError();

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow('No super.json found.');
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'SuperJsonNotFoundError: No super.json found.'
      );
    });
  });

  describe('when throwing RecordingsNotFoundError', () => {
    const error = new RecordingsNotFoundError('path/to/recording.json');

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow(
        'Recordings could not be found for running mocked tests at "path/to/recording.json".\nYou must call the live API first to record API traffic.\nUse the environment variable SUPERFACE_LIVE_API to call the API and record traffic.\nSee https://github.com/superfaceai/testing#recording to learn more.'
      );
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'RecordingsNotFoundError: Recordings could not be found for running mocked tests at "path/to/recording.json".\nYou must call the live API first to record API traffic.\nUse the environment variable SUPERFACE_LIVE_API to call the API and record traffic.\nSee https://github.com/superfaceai/testing#recording to learn more.'
      );
    });
  });

  describe('when throwing BaseURLNotFoundError', () => {
    const error = new BaseURLNotFoundError('provider');

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow(
        'No base URL was found for provider provider, configure a service in provider.json.'
      );
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'BaseURLNotFoundError: No base URL was found for provider provider, configure a service in provider.json.'
      );
    });
  });

  describe('when throwing CoverageFileNotFoundError', () => {
    const samplePath = 'path/to/coverage.json';
    const error = new CoverageFileNotFoundError(samplePath);

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow(`No coverage file at path "${samplePath}" found.`);
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        `CoverageFileNotFoundError: No coverage file at path "${samplePath}" found.`
      );
    });
  });

  describe('when asserting error is IO error', () => {
    it('throws developer error correctly', async () => {
      expect(() => assertIsIOError(null)).toThrow(new UnexpectedError('null'));
      expect(() => assertIsIOError(undefined)).toThrow(
        new UnexpectedError('undefined')
      );
      expect(() => assertIsIOError({})).toThrow(new UnexpectedError('{}'));
      expect(() => assertIsIOError({ code: 2 })).toThrow(
        new UnexpectedError('{ code: 2 }')
      );
      expect(() => assertIsIOError({ message: 2 })).toThrow(
        new UnexpectedError('{ message: 2 }')
      );
    });

    it('does not throw developer error', async () => {
      expect(() => assertIsIOError({ code: 'test' })).not.toThrow();
    });
  });
});
