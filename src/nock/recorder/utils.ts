import { UnexpectedError } from "../../common/errors";
import { RecordingDefinitions } from "../../interfaces";

export function assertsDefinitionsAreNotStrings(
    definitions: string[] | RecordingDefinitions
  ): asserts definitions is RecordingDefinitions {
    for (const def of definitions) {
      if (typeof def === 'string') {
        throw new UnexpectedError('definition is a string, not object');
      }
    }
  }