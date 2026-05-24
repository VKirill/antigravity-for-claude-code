import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, lastAppendFileSyncPath, appendFileSyncCalls } from "./test-setup.ts";
import { server, startServer } from "./index.ts";
import { resetTestState } from "./state.ts";
import { join } from "path";

describe("index.ts entrypoint tests", () => {
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

  test("List Tools (tools/list) returns correct tool specs", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 50
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(50);
    expect(response.result.tools).toBeArray();
    expect(response.result.tools.length).toBe(10);

    const discussTool = response.result.tools.find((t: any) => t.name === "discuss_with_antigravity");
    expect(discussTool).toBeDefined();

    const resetTool = response.result.tools.find((t: any) => t.name === "reset_antigravity_session");
    expect(resetTool).toBeDefined();
  });

  test("Unknown tool call triggers error response", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "non_existent_tool",
        arguments: {}
      },
      id: 51
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(51);
    expect(response.error).toBeDefined();
    expect(response.error.message).toContain("Unknown tool: non_existent_tool");
  });

  test("startServer connects to mocked StdioServerTransport", async () => {
    // Disconnect first to allow reconnecting
    await server.close();
    await expect(startServer()).resolves.toBeUndefined();
  });

  test("Direct execution starts the server and handles stdio transport connection", async () => {
    const serverPath = join(import.meta.dir, "index.ts");
    const proc = Bun.spawn(["bun", "run", serverPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    const request = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 999
    }) + "\n";

    proc.stdin.write(request);
    proc.stdin.end();

    const responseText = await new Response(proc.stdout).text();
    expect(responseText).toContain('"id":999');
    expect(responseText).toContain("discuss_with_antigravity");

    // Clean up
    proc.kill();
  });

  test("tool calls write dispatch event to AGY_LIFECYCLE_LOG", async () => {
    const logPath = "/path/to/mcp-dispatch.log";
    process.env.AGY_LIFECYCLE_LOG = logPath;
    try {
      transport.simulateReceive({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "discuss_with_antigravity",
          arguments: {
            prompt: "Test prompt content",
            conversationId: "TASK-101",
          }
        },
        id: 55
      });

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(lastAppendFileSyncPath).toBe(logPath);
      expect(appendFileSyncCalls.length).toBeGreaterThan(0);
      const parsed = JSON.parse(appendFileSyncCalls[0].data.trim());
      expect(parsed.event).toBe("dispatch");
      expect(parsed.tool).toBe("discuss_with_antigravity");
      expect(parsed.conversationId).toBe("TASK-101");
      expect(parsed.promptChars).toBe(19); // "Test prompt content".length
    } finally {
      delete process.env.AGY_LIFECYCLE_LOG;
    }
  });
});
