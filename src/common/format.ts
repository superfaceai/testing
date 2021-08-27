const ISO_DATE_REGEX =
  /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)/gm;

export const removeTimestamp = (payload: string): string =>
  payload.replace(ISO_DATE_REGEX, '');
