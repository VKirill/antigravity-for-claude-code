import { mock, test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { join } from "path";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

// Mock mutable states
let mockSpawnOutput = { stdout: "Hello from mock agy", stderr: "", code: 0 };
let mockFiles: { name: string; mtime: number }[] = [];
let lastSpawnArgs: string[] = [];
let lastSpawnStdin = "";
let mockReaddirShouldThrow = false;

// Register Mocks for child_process
mock.module("child_process", () => {
  return {
    spawn: (cmd: string, args: string[], options: any) => {
      lastSpawnArgs = args;
      const listeners: Record<string, Function[]> = {};
      const stdoutListeners: Function[] = [];
      const stderrListeners: Function[] = [];

      const stdin = {
        write: mock((data: string) => {
          lastSpawnStdin = data;
        }),
        end: mock(() => {}),
      };

      const stdout = {
        on: (event: string, callback: Function) => {
          if (event === "data") stdoutListeners.push(callback);
        }
      };

      const stderr = {
        on: (event: string, callback: Function) => {
          if (event === "data") stderrListeners.push(callback);
        }
      };

      const proc: any = {
        stdin,
        stdout,
        stderr,
        on: (event: string, callback: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(callback);
        }
      };

      // Fire events asynchronously to simulate the process running
      setTimeout(() => {
        if (mockSpawnOutput.stdout) {
          stdoutListeners.forEach(cb => cb(Buffer.from(mockSpawnOutput.stdout)));
        }
        if (mockSpawnOutput.stderr) {
          stderrListeners.forEach(cb => cb(Buffer.from(mockSpawnOutput.stderr)));
        }
        const closeListeners = listeners["close"] || [];
        closeListeners.forEach(cb => cb(mockSpawnOutput.code));
      }, 5);

      return proc;
    }
  };
});

// Register Mocks for fs
mock.module("fs", () => {
  return {
    readdirSync: (dir: string) => {
      if (mockReaddirShouldThrow) {
        throw new Error("Disk read error");
      }
      return mockFiles.map(f => f.name);
    },
    statSync: (filePath: string) => {
      const basename = filePath.split("/").pop() || "";
      const matched = mockFiles.find(f => f.name === basename);
      return {
        mtime: {
          getTime: () => matched ? matched.mtime : 0
        }
      };
    }
  };
});

// Register Mocks for @modelcontextprotocol/sdk/server/stdio.js
mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => {
  return {
    StdioServerTransport: class {
      start = mock(() => Promise.resolve());
      send = mock(() => Promise.resolve());
      close = mock(() => Promise.resolve());
      set onmessage(cb: any) {}
      set onclose(cb: any) {}
      set onerror(cb: any) {}
    }
  };
});

// Import the server and states
import {
  server,
  activeConversationId,
  pendingSystemPrompt,
  pendingRole,
  resetTestState,
  getNewestConversationId,
  startServer
} from "./server.ts";

// Custom Mock Transport for testing JSON-RPC exchanges
class MockTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sentMessages: JSONRPCMessage[] = [];

  async start() {}
  async send(message: JSONRPCMessage) {
    this.sentMessages.push(message);
  }
  async close() {
    if (this.onclose) this.onclose();
  }
  simulateReceive(message: JSONRPCMessage) {
    if (this.onmessage) this.onmessage(message);
  }
}

describe("Antigravity MCP Server Tests", () => {
  let transport: MockTransport;

  beforeAll(async () => {
    transport = new MockTransport();
    // @ts-ignore
    await server.connect(transport);
  });

  beforeEach(() => {
    resetTestState();
    mockSpawnOutput = { stdout: "Hello from mock agy", stderr: "", code: 0 };
    mockFiles = [];
    lastSpawnArgs = [];
    lastSpawnStdin = "";
    mockReaddirShouldThrow = false;
    transport.sentMessages = [];
  });

  test("List Tools (tools/list) returns correct tool specs", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(1);
    expect(response.result.tools).toBeArray();
    expect(response.result.tools.length).toBe(6);

    const discussTool = response.result.tools.find((t: any) => t.name === "discuss_with_antigravity");
    expect(discussTool).toBeDefined();
    expect(discussTool.inputSchema.required).toEqual(["prompt"]);

    const resetTool = response.result.tools.find((t: any) => t.name === "reset_antigravity_session");
    expect(resetTool).toBeDefined();

    const interactiveDebateTool = response.result.tools.find((t: any) => t.name === "run_interactive_debate");
    expect(interactiveDebateTool).toBeDefined();
  });

  test("discuss_with_antigravity - starts a new session when no ID exists", async () => {
    // Mock the files returned to extract the conversation ID
    mockFiles = [
      { name: "file1.pb", mtime: 1000 },
      { name: "new-uuid-123.pb", mtime: 5000 },
      { name: "file2.pb", mtime: 2000 }
    ];
    mockSpawnOutput = { stdout: "Architect analysis complete.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "Verify the architecture."
        }
      },
      id: 2
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toBe("Verify the architecture.");

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(2);
    expect(response.result.content.length).toBe(1);
    expect(response.result.content[0].text).toContain("Architect analysis complete.");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: new-uuid-123 -->");
  });

  test("discuss_with_antigravity - continues existing session using in-memory ID", async () => {
    // 1. First turn to set the session ID in memory
    mockFiles = [{ name: "session-456.pb", mtime: 1000 }];
    mockSpawnOutput = { stdout: "First reply", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "First message" }
      },
      id: 3
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    // 2. Second turn should automatically reuse the conversation ID
    mockSpawnOutput = { stdout: "Second reply", stderr: "", code: 0 };
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Second message" }
      },
      id: 4
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("session-456");
    expect(lastSpawnStdin).toBe("Second message");

    const response: any = transport.sentMessages[1];
    expect(response.result.content.length).toBe(1);
    expect(response.result.content[0].text).toContain("Second reply");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: session-456 -->");
  });

  test("discuss_with_antigravity - force switches conversation if conversationId is passed", async () => {
    mockSpawnOutput = { stdout: "Switched reply", stderr: "", code: 0 };

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
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("custom-id-789");

    const response: any = transport.sentMessages[0];
    expect(response.result.content.length).toBe(1);
    expect(response.result.content[0].text).toContain("Switched reply");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: custom-id-789 -->");
  });

  test("discuss_with_antigravity - auto-detects task ID from prompt", async () => {
    mockSpawnOutput = { stdout: "Task response complete.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: {
          prompt: "id: TASK-456\nscope: Fix issues"
        }
      },
      id: 60
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("TASK-456");

    const response: any = transport.sentMessages[0];
    expect(response.result.content[0].text).toContain("<!-- active_session_id: TASK-456 -->");
  });

  test("discuss_with_antigravity - prepends system prompt for preset roles", async () => {
    mockFiles = [{ name: "session-role.pb", mtime: 1000 }];
    mockSpawnOutput = { stdout: "Designer response", stderr: "", code: 0 };

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
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnStdin).toContain("[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: Ты — опытный UI/UX дизайнер");
    expect(lastSpawnStdin).toContain("Redesign the button.");
  });

  test("discuss_with_antigravity - prepends custom systemPrompt", async () => {
    mockFiles = [{ name: "session-custom.pb", mtime: 1000 }];
    mockSpawnOutput = { stdout: "Custom response", stderr: "", code: 0 };

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
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnStdin).toContain("[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: Be extremely concise and rude.]");
    expect(lastSpawnStdin).toContain("Say hello");
  });

  test("discuss_with_antigravity - handles combination of preset role and custom systemPrompt", async () => {
    mockFiles = [{ name: "session-combo.pb", mtime: 1000 }];
    mockSpawnOutput = { stdout: "Combo response", stderr: "", code: 0 };

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
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnStdin).toContain("Ты — Senior Software Engineer.");
    expect(lastSpawnStdin).toContain("Additionally, answer in English.");
    expect(lastSpawnStdin).toContain("Explain");
  });

  test("discuss_with_antigravity - returns error response when process fails", async () => {
    mockSpawnOutput = { stdout: "", stderr: "Fatal API error", code: 1 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Fail me" }
      },
      id: 9
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Fatal API error");
  });

  test("reset_antigravity_session - clears session ID and sets pending parameters", async () => {
    // 1. Establish session
    mockFiles = [{ name: "session-999.pb", mtime: 1000 }];
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Setup" }
      },
      id: 10
    });
    await new Promise(resolve => setTimeout(resolve, 20));

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
    await new Promise(resolve => setTimeout(resolve, 20));

    const resetResponse: any = transport.sentMessages[1];
    expect(resetResponse.result.content[0].text).toContain("session has been reset");
    expect(resetResponse.result.content[0].text).toContain("architect");

    // 3. Next message should use the pending role and new session
    mockFiles = [{ name: "session-new.pb", mtime: 2000 }];
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "Design a bridge" }
      },
      id: 12
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toContain("Ты — Software Architect.");
    expect(lastSpawnStdin).toContain("Design systems only.");
  });

  test("getNewestConversationId - handles filesystem error gracefully", () => {
    mockReaddirShouldThrow = true;
    const id = getNewestConversationId();
    expect(id).toBeNull();
  });

  test("getNewestConversationId - handles empty conversations directory", () => {
    mockFiles = [];
    const id = getNewestConversationId();
    expect(id).toBeNull();
  });

  test("Unknown tool call triggers error response", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "invalid_tool_name",
        arguments: {}
      },
      id: 13
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0];
    expect(response.error).toBeDefined();
    expect(response.error.message).toContain("Unknown tool");
  });

  test("Direct execution starts the server and handles stdio transport connection", async () => {
    const serverPath = join(import.meta.dir, "server.ts");
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

  test("discuss_with_antigravity - falls back to unknown session ID if conversations folder is empty", async () => {
    mockFiles = [];
    mockSpawnOutput = { stdout: "Reply with no files", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity",
        arguments: { prompt: "No files check" }
      },
      id: 15
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0];
    expect(response.result.content.length).toBe(1);
    expect(response.result.content[0].text).toContain("Reply with no files");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: unknown -->");
  });

  test("run_debate_deliberation - successfully runs a multi-agent debate and returns consensus ADR", async () => {
    mockFiles = [{ name: "debate-session.pb", mtime: 1000 }];
    mockSpawnOutput = { stdout: "Deliberation output chunk.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_debate_deliberation",
        arguments: {
          topic: "Implement microfrontends",
          rounds: 4
        }
      },
      id: 20
    });

    await new Promise(resolve => setTimeout(resolve, 80));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(20);
    expect(response.result.content[0].text).toContain("Результаты дебатов: Implement microfrontends");
    expect(response.result.content[0].text).toContain("Стенограмма дебатов");
    expect(response.result.content[0].text).toContain("Раунд 1: [OPTIMIST]");
    expect(response.result.content[0].text).toContain("Раунд 2: [SKEPTIC]");
    expect(response.result.content[0].text).toContain("Раунд 3: [AGREER]");
    expect(response.result.content[0].text).toContain("Раунд 4: [SYNTHESIZER]");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: debate-session -->");
  });

  test("run_debate_deliberation - clamps rounds between 3 and 10", async () => {
    mockFiles = [{ name: "clamped-session.pb", mtime: 2000 }];
    mockSpawnOutput = { stdout: "Turn response", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_debate_deliberation",
        arguments: {
          topic: "Clamping test",
          rounds: 15 // Should be clamped to 10
        }
      },
      id: 21
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const response: any = transport.sentMessages[0];
    expect(response.result.content[0].text).toContain("Раунд 10: [SYNTHESIZER]");
  });

  test("run_debate_deliberation - handles subprocess failures and returns error response", async () => {
    mockFiles = [{ name: "failed-debate.pb", mtime: 1000 }];
    // Fail on first spawn
    mockSpawnOutput = { stdout: "", stderr: "Spawn execution failed", code: 2 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_debate_deliberation",
        arguments: {
          topic: "Failure test",
          rounds: 3
        }
      },
      id: 22
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка во время дебатов");
    expect(response.result.content[0].text).toContain("Spawn execution failed");
  });

  test("run_debate_deliberation - throws error when failing to obtain conversation ID", async () => {
    mockFiles = []; // Empty files so getNewestConversationId returns null
    mockSpawnOutput = { stdout: "Initial debate start.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_debate_deliberation",
        arguments: {
          topic: "Fail to get ID topic",
          rounds: 3
        }
      },
      id: 23
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка во время дебатов: Failed to initialize debate conversation ID");
  });

  test("review_code_changes - successfully runs code review", async () => {
    mockSpawnOutput = { stdout: "Code review: No issues found.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "review_code_changes",
        arguments: {
          diff: "diff --git a/file.ts b/file.ts\n+console.log('test');",
          context: "Rules: use semicolons."
        }
      },
      id: 30
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toContain("Senior Code Reviewer");
    expect(lastSpawnStdin).toContain("Rules: use semicolons.");
    expect(lastSpawnStdin).toContain("console.log('test')");

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(30);
    expect(response.result.content[0].text).toContain("Code review: No issues found.");
  });

  test("review_code_changes - handles execution failure", async () => {
    mockSpawnOutput = { stdout: "", stderr: "Review process crash", code: 5 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "review_code_changes",
        arguments: {
          diff: "some diff"
        }
      },
      id: 31
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка при проведении код-ревью");
    expect(response.result.content[0].text).toContain("Review process crash");
  });

  test("get_programming_advice - successfully retrieves technical advice", async () => {
    mockSpawnOutput = { stdout: "Use Map for O(1) lookups.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_programming_advice",
        arguments: {
          question: "How to optimize lookup?",
          codeSnippet: "const arr = [1, 2, 3];",
          language: "typescript"
        }
      },
      id: 40
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toContain("Senior Software Engineer");
    expect(lastSpawnStdin).toContain("Язык/Технология/Стек: typescript");
    expect(lastSpawnStdin).toContain("const arr = [1, 2, 3];");
    expect(lastSpawnStdin).toContain("How to optimize lookup?");

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(40);
    expect(response.result.content[0].text).toContain("Use Map for O(1) lookups.");
  });

  test("get_programming_advice - handles execution failure", async () => {
    mockSpawnOutput = { stdout: "", stderr: "Advice API down", code: 6 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_programming_advice",
        arguments: {
          question: "How to exit Vim?"
        }
      },
      id: 41
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка при получении совета по программированию");
    expect(response.result.content[0].text).toContain("Advice API down");
  });

  test("run_interactive_debate - successfully starts a new debate session", async () => {
    mockFiles = [{ name: "interactive-debate-1.pb", mtime: 1000 }];
    mockSpawnOutput = { stdout: "Debate round output.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          topic: "Interactive architecture",
          action: "next"
        }
      },
      id: 50
    });

    await new Promise(resolve => setTimeout(resolve, 80));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(50);
    expect(response.result.content[0].text).toContain("Интерактивные дебаты: Interactive architecture");
    expect(response.result.content[0].text).toContain("## Раунд 1: [OPTIMIST]");
    expect(response.result.content[0].text).toContain("## Раунд 2: [SKEPTIC]");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: interactive-debate-1 -->");
  });

  test("run_interactive_debate - continues existing debate round", async () => {
    mockSpawnOutput = { stdout: "Continuing round output.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          userComment: "Let's stick to monolith.",
          action: "next"
        }
      },
      id: 51
    });

    await new Promise(resolve => setTimeout(resolve, 80));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(51);
    expect(response.result.content[0].text).toContain("Интерактивные дебаты (Сессия: interactive-debate-1)");
    expect(response.result.content[0].text).toContain("### Ваш комментарий как Судьи:\n> Let's stick to monolith.");
    expect(response.result.content[0].text).toContain("## Раунд 3: [AGREER]");
    expect(response.result.content[0].text).toContain("## Раунд 4: [HATER]");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: interactive-debate-1 -->");
  });

  test("run_interactive_debate - finalizes debate session with userComment", async () => {
    mockSpawnOutput = { stdout: "Final synthesis ADR output.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          userComment: "Final decision is monolith.",
          action: "finalize"
        }
      },
      id: 52
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(52);
    expect(response.result.content[0].text).toContain("Финализация дебатов (Сессия: interactive-debate-1)");
    expect(response.result.content[0].text).toContain("Final synthesis ADR output.");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: interactive-debate-1 -->");
  });

  test("run_interactive_debate - finalizes debate session without userComment", async () => {
    mockSpawnOutput = { stdout: "Final synthesis ADR output no comment.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          action: "finalize"
        }
      },
      id: 53
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(53);
    expect(response.result.content[0].text).toContain("Финализация дебатов (Сессия: interactive-debate-1)");
    expect(response.result.content[0].text).toContain("Final synthesis ADR output no comment.");
  });

  test("run_interactive_debate - throws error when finalizing without session ID", async () => {
    resetTestState();

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          action: "finalize"
        }
      },
      id: 54
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("No active debate session found");
  });

  test("run_interactive_debate - throws error when continuing without userComment", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          action: "next"
        }
      },
      id: 55
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Missing 'userComment' to continue the debate");
  });

  test("run_interactive_debate - throws error when neither topic nor debateId is provided", async () => {
    resetTestState();

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          action: "next"
        }
      },
      id: 56
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("No active debate session");
  });

  test("run_interactive_debate - handles initialization failure when getNewestConversationId returns null", async () => {
    mockFiles = [];
    mockSpawnOutput = { stdout: "Debate round output.", stderr: "", code: 0 };

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          topic: "Interactive architecture",
          action: "next"
        }
      },
      id: 57
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Failed to initialize debate conversation ID");
  });

  test("startServer connects to mocked StdioServerTransport", async () => {
    // Disconnect first to allow reconnecting
    await server.close();
    await expect(startServer()).resolves.toBeUndefined();
  });
});
