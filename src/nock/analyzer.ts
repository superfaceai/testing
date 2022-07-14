import { CompleteSuperfaceTestConfig } from '../superface-test.interfaces';
import { IErrorCollector } from './error-collector';

export interface AnalysisResult {
  profile: string;
  provider: string;
  useCase: string;

  recordingPath: string;

  // TODO: better naming - major/minor/patch
  impact: string;

  errors: string[];
}

export class Analyzer {
  static run(
    sfConfig: CompleteSuperfaceTestConfig,
    errors: IErrorCollector
  ): AnalysisResult {
    const formattedErrors: string[] = [];

    for (const error of errors.get()) {
      formattedErrors.push(error.message);
    }

    return {
      profile: sfConfig.profile.configuration.id,
      provider: sfConfig.provider.configuration.name,
      useCase: sfConfig.useCase.name,
      recordingPath: errors.recordingPath,

      impact: 'major',

      errors: formattedErrors,
    };
  }

  // implement rules for determining impact of change
  // consider different situations where request or/and response changes
}
