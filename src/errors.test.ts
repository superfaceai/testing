import {
  CapabilitiesNotLocalError,
  ComponentUndefinedError,
  InstanceMissingError,
  NockConfigUndefinedError,
  RecordingNotStartedError,
  SuperJsonNotFoundError,
  UnexpectedError,
} from './errors';

describe('errors', () => {
  describe('UnexpectedError', () => {
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

  describe('CapabilitiesNotLocalError', () => {
    const error = new CapabilitiesNotLocalError();

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow(
        'Some capabilities are not local, do not forget to set up file paths in super.json.'
      );
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'CapabilitiesNotLocalError: Some capabilities are not local, do not forget to set up file paths in super.json.'
      );
    });
  });

  describe('ComponentUndefinedError', () => {
    const errorProfile = new ComponentUndefinedError('Profile');
    const errorProvider = new ComponentUndefinedError('Provider');
    const errorUseCase = new ComponentUndefinedError('UseCase');

    it('throws in correct format', () => {
      expect(() => {
        throw errorProfile;
      }).toThrow('Undefined Profile');

      expect(() => {
        throw errorProvider;
      }).toThrow('Undefined Provider');

      expect(() => {
        throw errorUseCase;
      }).toThrow('Undefined UseCase');
    });

    it('returns correct format', () => {
      expect(errorProfile.toString()).toEqual(
        'ComponentUndefinedError: Undefined Profile'
      );

      expect(errorProvider.toString()).toEqual(
        'ComponentUndefinedError: Undefined Provider'
      );

      expect(errorUseCase.toString()).toEqual(
        'ComponentUndefinedError: Undefined UseCase'
      );
    });
  });

  describe('NockConfigUndefinedError', () => {
    const error = new NockConfigUndefinedError();

    it('throws in correct format', () => {
      expect(() => {
        throw error;
      }).toThrow('Nock configuration missing.');
    });

    it('returns correct format', () => {
      expect(error.toString()).toEqual(
        'NockConfigUndefinedError: Nock configuration missing.'
      );
    });
  });

  describe('RecordingNotStartedError', () => {
    const errorRecord = new RecordingNotStartedError('record');
    const errorNockBackRecord = new RecordingNotStartedError('nockBackRecord');

    it('throws in correct format', () => {
      expect(() => {
        throw errorRecord;
      }).toThrow(
        'Recording failed, make sure to run `record()` before ending recording.'
      );

      expect(() => {
        throw errorNockBackRecord;
      }).toThrow(
        'Recording failed, make sure to run `nockBackRecord()` before ending recording.'
      );
    });

    it('returns correct format', () => {
      expect(errorRecord.toString()).toEqual(
        'RecordingNotStartedError: Recording failed, make sure to run `record()` before ending recording.'
      );

      expect(errorNockBackRecord.toString()).toEqual(
        'RecordingNotStartedError: Recording failed, make sure to run `nockBackRecord()` before ending recording.'
      );
    });
  });

  describe('InstanceMissingError', () => {
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

  describe('SuperJsonNotFoundError', () => {
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
});
