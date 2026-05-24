import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, setMockSpawnOutput, setMockFiles, setMockExistsSyncResult, setMockAuditLogContent } from "../test-setup.ts";
import { server } from "../index.ts";
import { sessionState, resetTestState } from "../state.ts";
import path from "path";

describe("receipt.ts tool tests", () => {
  let transport: MockTransport;

  beforeAll(async () => {
    process.env.ANTIGRAVITY_PROMPTS_DIR = path.resolve(import.meta.dir, "../../prompts");
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

  test("get_debate_receipt - returns receipt for specified debateId including audit logs", async () => {
    setMockSpawnOutput({ stdout: "# Чек дебатов (Debate Receipt)\n\nMocked debate summary.", stderr: "", code: 0 });
    setMockExistsSyncResult(true);
    setMockAuditLogContent([
      JSON.stringify({ timestamp: "2026-05-23T06:10:00Z", conversationId: "test-debate-123", tool: "write_to_file", file: "/src/main.ts", decision: "allow" }),
      JSON.stringify({ timestamp: "2026-05-23T06:11:00Z", conversationId: "test-debate-123", tool: "replace_file_content", file: "/src/App.vue", decision: "block", reason: "Hex colors are prohibited" }),
      JSON.stringify({ timestamp: "2026-05-23T06:12:00Z", conversationId: "other-debate", tool: "write_to_file", file: "/src/ignored.ts", decision: "allow" })
    ].join("\n"));

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_debate_receipt",
        arguments: {
          debateId: "test-debate-123"
        }
      },
      id: 40
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(40);
    expect(response.result.isError).toBeUndefined();
    
    const text = response.result.content[0].text;
    expect(text).toContain("# Чек дебатов (Debate Receipt)");
    expect(text).toContain("Mocked debate summary.");
    expect(text).toContain("Hooks Audit");
    expect(text).toContain("/src/main.ts");
    expect(text).toContain("replace_file_content");
    expect(text).toContain("Hex colors are prohibited");
    expect(text).not.toContain("/src/ignored.ts");
  });

  test("get_debate_receipt - uses activeConversationId when debateId is omitted", async () => {
    setMockSpawnOutput({ stdout: "Debate summary using activeConversationId.", stderr: "", code: 0 });
    setMockExistsSyncResult(false);
    
    // Set active conversation ID in memory
    sessionState.activeConversationId = "active-session-111";

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_debate_receipt",
        arguments: {}
      },
      id: 41
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(41);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Debate summary using activeConversationId.");
  });

  test("get_debate_receipt - falls back to newest conversation ID when activeConversationId is null", async () => {
    resetTestState();
    setMockFiles([{ name: "newest-session-222.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Debate summary using newest session.", stderr: "", code: 0 });
    setMockExistsSyncResult(false);

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_debate_receipt",
        arguments: {}
      },
      id: 42
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(42);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Debate summary using newest session.");
  });

  test("get_debate_receipt - returns error when no session ID can be resolved", async () => {
    resetTestState();
    setMockFiles([]);
    setMockExistsSyncResult(false);

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_debate_receipt",
        arguments: {}
      },
      id: 43
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(43);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("не найдено активной сессии дебатов");
  });

  test("get_debate_receipt - handles runAgy failure gracefully", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "Timeout or process crash", code: 1 });
    setMockExistsSyncResult(true);
    setMockAuditLogContent(JSON.stringify({ timestamp: "2026-05-23T06:10:00Z", conversationId: "crash-session-999", tool: "write_to_file", file: "/src/main.ts", decision: "allow" }));

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_debate_receipt",
        arguments: {
          debateId: "crash-session-999"
        }
      },
      id: 44
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(44);
    expect(response.result.isError).toBeUndefined(); // Returns partial report instead of total failure
    expect(response.result.content[0].text).toContain("Не удалось автоматически проанализировать сессию с помощью AI");
    expect(response.result.content[0].text).toContain("/src/main.ts");
  });
});
