import { join as joinPath } from 'path';

const ISO_DATE_REGEX =
  /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)/gm;

export const removeTimestamp = (payload: string): string =>
  payload.replace(ISO_DATE_REGEX, '');

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
  // sfConfig: Pick<
  //   CompleteSuperfaceTestConfig,
  //   'profile' | 'provider' | 'useCase'
  // >,
  superfaceEnv: string | undefined
): boolean {
  if (superfaceEnv === undefined || superfaceEnv === '') {
    return false;
  }

  // const { profile, provider, useCase } = sfConfig;
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
