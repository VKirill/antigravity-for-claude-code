import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, setMockSpawnOutput, setMockFiles, lastSpawnArgs, lastSpawnStdin, setMockSpawnSyncOutput } from "../test-setup.ts";
import { server } from "../index.ts";
import { sessionState, resetTestState } from "../state.ts";
import path from "path";

describe("discuss.ts tool tests", () => {
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

  test("discuss_with_antigravity - starts a new session when no ID exists", async () => {
    setMockFiles([
      { name: "file1.pb", mtime: 1000 },
      { name: "new-uuid-123.pb", mtime: 5000 },
      { name: "file2.pb", mtime: 2000 }
    ]);
    setMockSpawnOutput({ stdout: "Architect analysis complete.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Verify the architecture." }
      },
      id: 2
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toBe("Verify the architecture.");

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(2);
    expect(response.result.content[0].text).toContain("Architect analysis complete.");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: new-uuid-123 -->");
    expect(sessionState.activeConversationId).toBe("new-uuid-123");
  });

  test("discuss_with_antigravity - continues existing session using in-memory ID", async () => {
    // 1. First turn to set the session ID in memory
    setMockFiles([{ name: "session-456.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "First reply", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "First message" }
      },
      id: 3
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    // 2. Second turn should automatically reuse the conversation ID
    setMockSpawnOutput({ stdout: "Second reply", stderr: "", code: 0 });
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Second message" }
      },
      id: 4
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("session-456");
    expect(lastSpawnStdin).toBe("Second message");

    expect(transport.sentMessages.length).toBe(2);
    const response: any = transport.sentMessages[1];
    expect(response.result.content[0].text).toContain("Second reply");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: session-456 -->");
  });

  test("discuss_with_antigravity - force switches conversation if conversationId is passed", async () => {
    setMockSpawnOutput({ stdout: "Switched reply", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Resume this",
          conversationId: "custom-id-789"
        }
      },
      id: 5
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("custom-id-789");

    const response: any = transport.sentMessages[0];
    expect(response.result.content[0].text).toContain("Switched reply");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: custom-id-789 -->");
  });

  test("discuss_with_antigravity - auto-detects task ID from prompt", async () => {
    setMockSpawnOutput({ stdout: "Task response complete.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "id: TASK-456\nscope: Fix issues" }
      },
      id: 60
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("TASK-456");

    const response: any = transport.sentMessages[0];
    expect(response.result.content[0].text).toContain("<!-- active_session_id: TASK-456 -->");
    expect(sessionState.activeConversationId).toBe("TASK-456");
  });

  test("discuss_with_antigravity - prepends system prompt for preset roles", async () => {
    setMockSpawnOutput({ stdout: "Designer response", stderr: "", code: 0 });
    setMockFiles([{ name: "session-role.pb", mtime: 1000 }]);

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Redesign the button.",
          role: "designer"
        }
      },
      id: 6
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnStdin).toContain("[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: Ты — опытный UI/UX дизайнер");
    expect(lastSpawnStdin).toContain("Redesign the button.");
  });

  test("discuss_with_antigravity - prepends custom systemPrompt", async () => {
    setMockFiles([{ name: "session-custom.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Custom response", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Say hello",
          systemPrompt: "Be extremely concise and rude."
        }
      },
      id: 7
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnStdin).toContain("[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: Be extremely concise and rude.]");
    expect(lastSpawnStdin).toContain("Say hello");
  });

  test("discuss_with_antigravity - handles combination of preset role and custom systemPrompt", async () => {
    setMockFiles([{ name: "session-combo.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Combo response", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Explain",
          role: "programmer",
          systemPrompt: "Additionally, answer in English."
        }
      },
      id: 8
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnStdin).toContain("Ты — Senior Software Engineer.");
    expect(lastSpawnStdin).toContain("Additionally, answer in English.");
    expect(lastSpawnStdin).toContain("Explain");
  });

  test("discuss_with_antigravity - returns error response when process fails", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "Fatal API error", code: 1 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Fail me" }
      },
      id: 9
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Fatal API error");
  });

  test("discuss_with_antigravity - retries on empty response and succeeds", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "", code: 0 });
    
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Test retry empty"
        }
      },
      id: 100
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    setMockSpawnOutput({ stdout: "Success after retry", stderr: "", code: 0 });
    await new Promise(resolve => setTimeout(resolve, 2100));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(100);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Success after retry");
  });

  test("discuss_with_antigravity - falls back to unknown session ID if conversations folder is empty", async () => {
    setMockFiles([]);
    setMockSpawnOutput({ stdout: "Reply with no files", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "No files check" }
      },
      id: 15
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.content[0].text).toContain("Reply with no files");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: unknown -->");
  });

  test("reset_antigravity_session - clears session ID and sets pending parameters", async () => {
    // 1. Establish session
    setMockFiles([{ name: "session-999.pb", mtime: 1000 }]);
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Setup" }
      },
      id: 10
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    // 2. Reset session and pre-configure role
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "reset_antigravity_session",
        arguments: {
          role: "architect",
          systemPrompt: "Design systems only."
        }
      },
      id: 11
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sessionState.activeConversationId).toBeNull();
    expect(sessionState.pendingRole).toBe("architect");
    expect(sessionState.pendingSystemPrompt).toBe("Design systems only.");

    const resetResponse: any = transport.sentMessages[1];
    expect(resetResponse.result.content[0].text).toContain("session has been reset");
    expect(resetResponse.result.content[0].text).toContain("architect");

    // 3. Next message should use the pending role and new session
    setMockFiles([{ name: "session-new.pb", mtime: 2000 }]);
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Design a bridge" }
      },
      id: 12
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toContain("Ты — Software Architect.");
    expect(lastSpawnStdin).toContain("Design systems only.");
  });

  test("discuss_with_antigravity - appends observability footer with changed files", async () => {
    setMockFiles([{ name: "session-obs.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Done", stderr: "", code: 0 });
    
    setMockSpawnSyncOutput({
      stdout: "",
      stderr: "",
      status: 0,
      stdoutQueue: ["", " M src/tools/discuss.ts\n?? src/utils/observability.ts\n"]
    });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Test footer" }
      },
      id: 88
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    const text = response.result.content[0].text;
    expect(text).toContain("<!-- active_session_id: session-obs -->");
    expect(text).toMatch(/<!-- agy: \d+\.\ds \| files_changed: src\/tools\/discuss\.ts, src\/utils\/observability\.ts -->/);
  });

  test("discuss_with_antigravity - worker: 'worker-coder' + skills: ['coder-craft', 'typescript']", async () => {
    setMockFiles([{ name: "session-worker.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Worker response", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Write some code",
          worker: "worker-coder",
          skills: ["coder-craft", "typescript"]
        }
      },
      id: 20
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnStdin).toContain("coder-worker");
    expect(lastSpawnStdin).toContain("coder-craft, typescript");
    expect(lastSpawnStdin).not.toContain("{{skills}}");
    expect(lastSpawnStdin).toContain("---\n\nWrite some code");
  });

  test("discuss_with_antigravity - worker: 'does-not-exist'", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Write some code",
          worker: "does-not-exist"
        }
      },
      id: 21
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("worker prompt not found");
  });

  test("discuss_with_antigravity - skills: ['zod'] + role: 'programmer' (no worker)", async () => {
    setMockFiles([{ name: "session-role-skills.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Programmer response", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Implement schema validation",
          role: "programmer",
          skills: ["zod"]
        }
      },
      id: 22
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnStdin).toContain("Загрузи эти скиллы");
    expect(lastSpawnStdin).toContain("zod");
  });
});
