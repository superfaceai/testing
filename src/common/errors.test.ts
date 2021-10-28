import {
  assertIsIOError,
  ComponentUndefinedError,
  InstanceMissingError,
  MapUndefinedError,
  RecordingPathUndefinedError,
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

  describe('when throwing ComponentUndefinedError', () => {
    const errorClient = new ComponentUndefinedError('Client');
    const errorProfile = new ComponentUndefinedError('Profile');
    const errorProvider = new ComponentUndefinedError('Provider');
    const errorUseCase = new ComponentUndefinedError('UseCase');
    const errorBoundProfileProvider = new ComponentUndefinedError(
      'BoundProfileProvider'
    );

    it('throws in correct format', () => {
      expect(() => {
        throw errorClient;
      }).toThrow('Undefined Client');

      expect(() => {
        throw errorProfile;
      }).toThrow('Undefined Profile');

      expect(() => {
        throw errorProvider;
      }).toThrow('Undefined Provider');

      expect(() => {
        throw errorUseCase;
      }).toThrow('Undefined UseCase');

      expect(() => {
        throw errorBoundProfileProvider;
      }).toThrow('Undefined BoundProfileProvider');
    });

    it('returns correct format', () => {
      expect(errorClient.toString()).toEqual(
        'ComponentUndefinedError: Undefined Client'
      );

      expect(errorProfile.toString()).toEqual(
        'ComponentUndefinedError: Undefined Profile'
      );

      expect(errorProvider.toString()).toEqual(
        'ComponentUndefinedError: Undefined Provider'
      );

      expect(errorUseCase.toString()).toEqual(
        'ComponentUndefinedError: Undefined UseCase'
      );

      expect(errorBoundProfileProvider.toString()).toEqual(
        'ComponentUndefinedError: Undefined BoundProfileProvider'
      );
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

    it('throws in correct format', () => {
      expect(() => {
        throw missingProfile;
      }).toThrow('Should be Profile instance.');

      expect(() => {
        throw missingProvider;
      }).toThrow('Should be Provider instance.');

      expect(() => {
        throw missingUseCase;
      }).toThrow('Should be UseCase instance.');
    });

    it('returns correct format', () => {
      expect(missingProfile.toString()).toEqual(
        'InstanceMissingError: Should be Profile instance.'
      );

      expect(missingProvider.toString()).toEqual(
        'InstanceMissingError: Should be Provider instance.'
      );

      expect(missingUseCase.toString()).toEqual(
        'InstanceMissingError: Should be UseCase instance.'
      );
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
