import { FetchResponse, NodeFetch } from '@superfaceai/one-sdk';

export interface MockFetchOptions {
  response: FetchResponse;
}

/* eslint-disable @typescript-eslint/no-unsafe-return */
export const mockNodeFetch = jest.fn<
  NodeFetch,
  Parameters<(options?: MockFetchOptions) => NodeFetch>
>((options?: MockFetchOptions) => ({
  ...Object.create(NodeFetch.prototype),
  fetch: jest.fn().mockResolvedValue(options?.response),
}));
