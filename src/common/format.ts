import { join as joinPath } from 'path';

import { CompleteSuperfaceTestConfig } from '..';

const ISO_DATE_REGEX =
  /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)/gm;

export const removeTimestamp = (payload: string): string =>
  payload.replace(ISO_DATE_REGEX, '');

export function getFixtureName(sfConfig: CompleteSuperfaceTestConfig): string {
  const { profile, provider, useCase } = sfConfig;

  return joinPath(
    profile.configuration.id,
    provider?.configuration.name,
    useCase?.name
  );
}

function testPayload(payload: string, match: string): boolean {
  if (payload.startsWith('*') && payload.endsWith('*')) {
    const regex = RegExp(`^.*${payload.substr(1, payload.length - 1)}.*$`);

    if (!regex.test(match)) {
      return false;
    }
  } else if (payload.startsWith('*')) {
    const regex = RegExp(`.*${payload.substr(1, payload.length)}$`);

    if (!regex.test(match)) {
      return false;
    }
  } else if (payload.endsWith('*')) {
    const regex = RegExp(`^${payload.substr(0, payload.length - 1)}.*`);

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
  sfConfig: CompleteSuperfaceTestConfig,
  superfaceEnv?: string
): boolean {
  if (superfaceEnv === undefined) {
    return false;
  }

  const { profile, provider, useCase } = sfConfig;
  const [profilePayload, providerPayload, usecasePayload] =
    superfaceEnv.split(':');

  if (profilePayload) {
    testPayload(profilePayload, profile.configuration.id);
  }

  if (providerPayload) {
    testPayload(providerPayload, provider.configuration.name);
  }

  if (usecasePayload) {
    testPayload(usecasePayload, useCase.name);
  }

  return true;
}
