import { MatchHeaders } from './matcher';
import { getResponseHeaderValue } from './recorder';

export function getRequestHeaderValue(
  headerName: string,
  payload: Record<string, string | string[]>
): string | string[] | undefined {
  const headerKey = Object.keys(payload).find(
    key => key.toLowerCase() === headerName.toLowerCase()
  );

  return headerKey ? payload[headerKey] : undefined;
}

export function getRequestHeader(
  oldHeaders: Record<string, string | string[]>,
  newHeaders: Record<string, string | string[]>,
  headerName: string
): MatchHeaders {
  let oldHeader = getRequestHeaderValue(headerName, oldHeaders);
  let newHeader = getRequestHeaderValue(headerName, newHeaders);

  if (Array.isArray(oldHeader)) {
    oldHeader = oldHeader.join(', ');
  }

  if (Array.isArray(newHeader)) {
    newHeader = newHeader.join(', ');
  }

  return {
    old: oldHeader,
    new: newHeader,
  };
}

export function getResponseHeader(
  oldHeaders: string[],
  newHeaders: string[],
  headerName: string
): MatchHeaders {
  const oldHeader = getResponseHeaderValue(headerName, oldHeaders);
  const newHeader = getResponseHeaderValue(headerName, newHeaders);

  return {
    old: oldHeader,
    new: newHeader,
  };
}
