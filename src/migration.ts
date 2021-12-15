import { exists, renameFile } from './common/io';

export const OLD_CREDENTIALS_PLACEHOLDER =
  'credentials-removed-to-keep-them-secure';
export const OLD_PARAMETERS_PLACEHOLDER =
  'parameters-removed-to-keep-them-secure';
export const OLD_INPUT_PLACEHOLDER = 'input-removed-to-keep-it-secure';

export class Migration {
  static async migrateRecording(
    oldPath: string,
    newPath: string
  ): Promise<void> {
    if (oldPath === newPath) {
      return;
    }

    if (await exists(oldPath)) {
      await renameFile(oldPath, newPath);
    }
  }

  static migratePlaceholder(
    kind: 'credential' | 'parameter' | 'input',
    newPlaceholder: string
  ): {
    credential: string;
    placeholder: string;
  } {
    let oldPlaceholder: string;

    switch (kind) {
      case 'credential':
        oldPlaceholder = OLD_CREDENTIALS_PLACEHOLDER;
        break;
      case 'parameter':
        oldPlaceholder = OLD_PARAMETERS_PLACEHOLDER;
        break;
      case 'input':
        oldPlaceholder = OLD_INPUT_PLACEHOLDER;
        break;
      default:
        throw new Error('Invalid placeholder kind');
    }

    return {
      credential: oldPlaceholder,
      placeholder: newPlaceholder,
    };
  }
}
