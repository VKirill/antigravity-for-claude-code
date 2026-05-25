import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState } from "../test-setup.ts";
import { server } from "../index.ts";
import { resetTestState } from "../state.ts";

describe("usage_stats.ts tool tests", () => {
  let transport: MockTransport;

  beforeAll(async () => {
    transport = new MockTransport();
    try {
      await server.close();
    } catch (e) {}
    // @ts-ignore
    await server.connect(transport);
  });

  beforeEach(() => {
    resetTestState();
    resetMockState();
    transport.sentMessages = [];
  });

  test("get_usage_stats - returns usage statistics report text", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_usage_stats",
        arguments: {}
      },
      id: 60
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(60);
    expect(response.result.isError).toBeUndefined();

    const text = response.result.content[0].text;
    expect(text).toContain("agy usage (all-time)");
    expect(text).toContain("Jobs Started");
  });
});
