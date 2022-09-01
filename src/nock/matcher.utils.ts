import { decodeBuffer } from 'http-encoding';
import { ReplyBody } from 'nock/types';
import { URLSearchParams } from 'url';

import { UnexpectedError } from '../common/errors';
import { MatchHeaders } from './matcher';

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

export function getResponseHeaderValue(
  headerName: string,
  payload: string[]
): string | undefined {
  for (let i = 0; i < payload.length; i += 2) {
    if (payload[i].toLowerCase() === headerName.toLowerCase()) {
      return payload[i + 1];
    }
  }

  return undefined;
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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function composeBuffer(response: any[]): Buffer {
  return Buffer.concat(response.map(res => Buffer.from(res, 'hex')));
}

export async function decodeResponse(
  response: unknown,
  contentEncoding = 'gzip'
): Promise<ReplyBody> {
  if (!Array.isArray(response)) {
    throw new UnexpectedError(
      `Response is encoded by "${contentEncoding}" and is not an array`
    );
  }

  const buffer = composeBuffer(response);

  if (contentEncoding.toLowerCase() === 'gzip') {
    return JSON.parse(
      (await decodeBuffer(buffer, contentEncoding)).toString()
    ) as ReplyBody;
  } else {
    throw new UnexpectedError(
      `Content encoding ${contentEncoding} is not supported`
    );
  }
}

/**
 * Expect something like `To=%2Bxxx&From=%2Bxxx&Body=Hello+World%21`
 * and want back: `{ To: "+xxx", From: "+xxx", Body: "Hello World!" }`
 *
 * Limitation:
 *  since URLSearchParams always transform params to string we can't
 *  generate correct schema for this if it contains numbers or booleans
 */
export function parseBody(
  body: string,
  _accept?: string
): Record<string, unknown> | undefined {
  if (body === '') {
    return undefined;
  }

  const parsedBody = decodeURIComponent(body);
  const result: Record<string, unknown> = {};
  const params = new URLSearchParams(parsedBody);

  for (const [key, value] of params.entries()) {
    // parse value
    let parsedValue: unknown;
    if (value.startsWith('{') || value.startsWith('[')) {
      parsedValue = JSON.parse(value);
    } else {
      parsedValue = value;
    }

    result[key] = parsedValue;
  }

  return result;
}
