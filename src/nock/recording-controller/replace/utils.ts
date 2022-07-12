import createDebug from 'debug';

const debugSensitive = createDebug('superface:testing:recordings:sensitive');

export const replace = (
  payload: string,
  credential: string,
  placeholder: string
): string =>
  payload.replace(
    new RegExp(`${credential}|${encodeURIComponent(credential)}`, 'g'),
    placeholder
  );

export const includes = (payload: string, credential: string): boolean =>
  payload.includes(credential) ||
  payload.includes(encodeURIComponent(credential));

export const replaceCredential = ({
  payload,
  credential,
  placeholder,
}: {
  payload: string;
  credential: string;
  placeholder: string;
}): string => {
  if (credential !== '') {
    debugSensitive(
      `Replacing credential: '${credential}' for placeholder: '${placeholder}'`
    );

    return replace(payload, credential, placeholder);
  }

  return payload;
};
