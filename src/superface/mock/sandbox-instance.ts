import { NodeSandbox } from "@superfaceai/one-sdk";

export const mockEvalScript = jest.fn();

export const mockNodeSandbox = jest.fn<
  NodeSandbox,
  Parameters<() => NodeSandbox>
>(
  () => ({
    evalScript: mockEvalScript
  } as unknown as NodeSandbox));

