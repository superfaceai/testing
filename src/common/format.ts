import { join as joinPath } from 'path';

export function getFixtureName(
  profileId: string,
  providerName: string,
  usecaseName: string
): string {
  return joinPath(profileId, providerName, usecaseName);
}

function isValidPayload(payload: string, match: string): boolean {
  if (payload === '*') {
    return true;
  }

  if (payload.startsWith('*') && payload.endsWith('*')) {
    const regex = RegExp(`^.*${payload.substring(1, payload.length - 1)}.*$`);

    if (!regex.test(match)) {
      return false;
    }
  } else if (payload.startsWith('*')) {
    const regex = RegExp(`.*${payload.substring(1, payload.length)}$`);

    if (!regex.test(match)) {
      return false;
    }
  } else if (payload.endsWith('*')) {
    const regex = RegExp(`^${payload.substring(0, payload.length - 1)}.*`);

    if (!regex.test(match)) {
      return false;
    }
  } else {
    if (match !== payload) {
      return false;
    }
  }

  return true;
}

/**
 * SUPERFACE_LIVE_API="*"
 * SUPERFACE_LIVE_API="profile*"
 * SUPERFACE_LIVE_API="scope/profile:provider:usecase*"
 */
export function matchWildCard(
  profileId: string,
  providerName: string,
  usecaseName: string,
  superfaceEnv: string | undefined
): boolean {
  if (superfaceEnv === undefined || superfaceEnv === '') {
    return false;
  }

  const [profilePayload, providerPayload, usecasePayload] =
    superfaceEnv.split(':');

  if (profilePayload && profilePayload !== '') {
    if (!isValidPayload(profilePayload, profileId)) {
      return false;
    }
  }

  if (providerPayload && providerPayload !== '') {
    if (!isValidPayload(providerPayload, providerName)) {
      return false;
    }
  }

  if (usecasePayload && usecasePayload !== '') {
    if (!isValidPayload(usecasePayload, usecaseName)) {
      return false;
    }
  }

  return true;
}
