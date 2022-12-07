import { analyzeChangeImpact, MatchImpact } from './analyzer';
import {
  MatchErrorRequestHeaders,
  MatchErrorResponse,
  MatchErrorResponseHeaders,
} from './matcher.errors';

describe('Analyze module', () => {
  describe('analyzeChangeImpact', () => {
    describe('when got no errors', () => {
      it('returns no impact', () => {
        expect(
          analyzeChangeImpact({
            added: [],
            removed: [],
            changed: [],
          })
        ).toBe(MatchImpact.NONE);
      });
    });

    describe('when got no breaking errors', () => {
      it('returns impact PATCH', () => {
        expect(
          analyzeChangeImpact({
            added: [
              new MatchErrorRequestHeaders(
                'Accept',
                undefined,
                'application/json'
              ),
            ],
            removed: [],
            changed: [],
          })
        ).toBe(MatchImpact.PATCH);
      });
    });

    describe('when got minor change errors', () => {
      it('returns impact MINOR', () => {
        expect(
          analyzeChangeImpact({
            added: [
              new MatchErrorResponseHeaders(
                'content-type',
                undefined,
                'application/json'
              ),
            ],
            removed: [],
            changed: [],
          })
        ).toBe(MatchImpact.MINOR);
      });
    });

    describe('when got breaking change errors', () => {
      it('returns impact MAJOR', () => {
        expect(
          analyzeChangeImpact({
            added: [
              new MatchErrorResponseHeaders(
                'content-type',
                undefined,
                'application/json'
              ),
            ],
            removed: [],
            changed: [
              new MatchErrorResponse(
                {
                  oldResponse: {
                    field1: 'value',
                  },
                  newResponse: {
                    field: 'value',
                  },
                },
                'Response format changed'
              ),
            ],
          })
        ).toBe(MatchImpact.MAJOR);
      });
    });
  });
});
