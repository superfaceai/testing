import { CompleteSuperfaceTestConfig } from '../superface-test.interfaces';
import {
  IErrorCollector,
  MatchError,
  MatchErrorKind,
} from './error-collector.interfaces';

export type MatchImpact = 'major' | 'minor' | 'patch';
export interface AnalysisResult {
  profile: string;
  provider: string;
  useCase: string;

  recordingPath: string;

  impact: MatchImpact;

  errors: string[];
}

export class Analyzer {
  private static formattedErrors: string[] = [];

  static run(
    sfConfig: CompleteSuperfaceTestConfig,
    collector: IErrorCollector
  ): AnalysisResult {
    return {
      profile: sfConfig.profile.configuration.id,
      provider: sfConfig.provider.configuration.name,
      useCase: sfConfig.useCase.name,
      recordingPath: collector.recordingPath,
      impact: this.resolveImpact(collector.get()),
      errors: this.formattedErrors,
    };
  }

  // implement rules for determining impact of change
  // consider different situations where request or/and response changes

  private static resolveImpact(
    errors: (MatchError & { message: string })[]
  ): MatchImpact {
    let impact: MatchImpact = 'patch';

    for (const error of errors) {
      this.formattedErrors.push(error.message);
    }

    if (
      (errors.find(error => error.kind === MatchErrorKind.LENGTH) ||
      errors.find(error => error.kind === MatchErrorKind.METHOD) || 
      errors.find(error => error.kind === MatchErrorKind.STATUS) || 
      errors.find(error => error.kind === MatchErrorKind.BASE_URL) || 
      errors.find(error => error.kind === MatchErrorKind.PATH) || 
      errors.find(error => error.kind === MatchErrorKind.RESPONSE_HEADERS) ||
      errors.find(error => error.kind === MatchErrorKind.REQUEST_HEADERS) || 
      errors.find(error => error.kind === MatchErrorKind.REQUEST_BODY)) &&
      errors.find(error => error.kind === MatchErrorKind.RESPONSE)
    ) {
      impact = 'major';
    } else {
      impact = 'minor';
    }

    return impact;
  }
}
