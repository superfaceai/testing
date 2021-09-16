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

/**
 * SUPERFACE_LIVE_API="*"
 * SUPERFACE_LIVE_API="profile*"
 * SUPERFACE_LIVE_API="scope/profile:provider:usecase*"
 */
export function matchWildCard(
  superfaceEnv: string | undefined,
  sfConfig: CompleteSuperfaceTestConfig
): boolean {
  if (superfaceEnv === undefined) {
    return false;
  }

  const { profile, provider, useCase } = sfConfig;
  const [profilePayload, providerPayload, usecasePayload] =
    superfaceEnv.split(':');

  // parse profile
  if (profilePayload) {
    if (profilePayload.endsWith('*')) {
      const regex = RegExp(
        `^${profilePayload.substr(0, profilePayload.length - 1)}.`
      );

      if (!regex.test(profile.configuration.id)) {
        return false;
      }
    } else {
      if (profile.configuration.id !== profilePayload) {
        return false;
      }
    }
  }

  // parse provider
  if (providerPayload) {
    if (providerPayload.endsWith('*')) {
      const regex = RegExp(
        `^${providerPayload.substr(0, providerPayload.length - 1)}.`
      );

      if (!regex.test(provider.configuration.name)) {
        return false;
      }
    } else {
      if (provider.configuration.name !== providerPayload) {
        return false;
      }
    }
  }

  // parse usecase
  if (usecasePayload) {
    if (usecasePayload.endsWith('*')) {
      const regex = RegExp(
        `^${usecasePayload.substr(0, usecasePayload.length - 1)}.`
      );

      if (!regex.test(useCase.name)) {
        return false;
      }
    } else {
      if (useCase.name !== usecasePayload) {
        return false;
      }
    }
  }

  return true;
}
