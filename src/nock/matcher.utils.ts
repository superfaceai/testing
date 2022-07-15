import { URLSearchParams } from 'url';
import { decodeBuffer } from 'http-encoding';
import { ReplyBody } from 'nock/types';
import { MatchHeaders } from './matcher';

export function getHeaderValue(
  oldHeaders: string[] | Record<string, string | string[]>,
  newHeaders: string[] | Record<string, string | string[]>,
  headerName: string
): MatchHeaders {
  let oldHeader = Array.isArray(oldHeaders)
    ? oldHeaders.find(
        (_, i, headers) =>
          headers[i === 0 ? i : i - 1].toLowerCase() ===
          headerName.toLowerCase()
      )
    : oldHeaders[headerName.toLowerCase()];
  let newHeader = Array.isArray(newHeaders)
    ? newHeaders.find(
        (_, i, headers) =>
          headers[i === 0 ? i : i - 1].toLowerCase() ===
          headerName.toLowerCase()
      )
    : newHeaders[headerName.toLowerCase()];

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

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
export async function decodeResponse(
  response: unknown,
  contentEncoding: string
): Promise<ReplyBody> {
  let buffer: Buffer;
  if (Array.isArray(response)) {
    buffer = Buffer.concat(response.map(res => Buffer.from(res, 'hex')));
  } else {
    throw new Error(
      `Response is encoded by "${contentEncoding}" and is not an array`
    );
  }

  return JSON.parse(
    (await decodeBuffer(buffer, contentEncoding)).toString()
  ) as ReplyBody;
}

/**
 * Expect something like `To=%2Bxxx&From=%2Bxxx&Body=Hello+World%21`
 * and want back: `{ To: "+xxx", From: "+xxx", Body: "Hello World!" }`
 *
 * Limitation:
 *  since URLSearchParams always transform params to string we can't
 *  generate correct schema for this if it contains numbers or booleans
 */
export function parseBody(body: string, _accept?: string): unknown {
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
