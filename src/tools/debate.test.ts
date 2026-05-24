import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, setMockSpawnOutput, setMockFiles } from "../test-setup.ts";
import { server } from "../index.ts";
import { sessionState, resetTestState } from "../state.ts";
import path from "path";

describe("debate.ts tool tests", () => {
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

  test("run_debate_deliberation - successfully runs a multi-agent debate and returns consensus ADR", async () => {
    setMockFiles([{ name: "debate-session.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Deliberation output chunk.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_debate_deliberation",
        arguments: {
          topic: "Implement microfrontends",
          rounds: 4,
          language: "ru"
        }
      },
      id: 20
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(20);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Результаты дебатов: Implement microfrontends");
    expect(response.result.content[0].text).toContain("Стенограмма дебатов (Transcript)");
    expect(response.result.content[0].text).toContain("Round 1: [OPTIMIST]");
    expect(response.result.content[0].text).toContain("Round 2: [SKEPTIC]");
    expect(response.result.content[0].text).toContain("Round 3: [AGREER]");
    expect(response.result.content[0].text).toContain("Round 4: [SYNTHESIZER]");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: debate-session -->");
    expect(sessionState.activeConversationId).toBe("debate-session");
  });

  test("run_debate_deliberation - clamps rounds between 3 and 10", async () => {
    setMockFiles([{ name: "clamped-session.pb", mtime: 2000 }]);
    setMockSpawnOutput({ stdout: "Turn response", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_debate_deliberation",
        arguments: {
          topic: "Clamping test",
          rounds: 15, // Should be clamped to 10
          language: "ru"
        }
      },
      id: 21
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const response: any = transport.sentMessages[0];
    expect(response.result.content[0].text).toContain("Round 10: [SYNTHESIZER]");
  });

  test("run_debate_deliberation - handles subprocess failures and returns error response", async () => {
    setMockFiles([{ name: "failed-debate.pb", mtime: 1000 }]);
    // Fail on first spawn
    setMockSpawnOutput({ stdout: "", stderr: "Spawn execution failed", code: 2 });

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

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка во время дебатов");
    expect(response.result.content[0].text).toContain("Spawn execution failed");
  });

  test("run_debate_deliberation - throws error when failing to obtain conversation ID", async () => {
    setMockFiles([]); // Empty files so getNewestConversationId returns null
    setMockSpawnOutput({ stdout: "Initial debate start.", stderr: "", code: 0 });

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

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка во время дебатов: Failed to initialize debate conversation ID");
  });

  test("run_interactive_debate - successfully starts a new debate session", async () => {
    setMockFiles([{ name: "interactive-debate-1.pb", mtime: 1000 }]);
    setMockSpawnOutput({ stdout: "Debate round output.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          topic: "Interactive architecture",
          action: "next",
          language: "ru"
        }
      },
      id: 50
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(50);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Интерактивные дебаты: Interactive architecture");
    expect(response.result.content[0].text).toContain("## Round 1: [OPTIMIST]");
    expect(response.result.content[0].text).toContain("## Round 2: [SKEPTIC]");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: interactive-debate-1 -->");
    expect(sessionState.activeConversationId).toBe("interactive-debate-1");
  });

  test("run_interactive_debate - continues existing debate round", async () => {
    setMockSpawnOutput({ stdout: "Continuing round output.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          userComment: "Let's stick to monolith.",
          action: "next",
          language: "ru"
        }
      },
      id: 51
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(51);
    expect(response.result.content[0].text).toContain("Финализация дебатов (Сессия: interactive-debate-1)");
    expect(response.result.content[0].text).toContain("### Ваш комментарий как Судьи:\n> Let's stick to monolith.");
    expect(response.result.content[0].text).toContain("## Round 3: [AGREER]");
    expect(response.result.content[0].text).toContain("## Round 4: [HATER]");
    expect(response.result.content[0].text).toContain("<!-- active_session_id: interactive-debate-1 -->");
  });

  test("run_interactive_debate - finalizes debate session with userComment", async () => {
    setMockSpawnOutput({ stdout: "Final synthesis ADR output.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          userComment: "Final decision is monolith.",
          action: "finalize",
          language: "ru"
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
    setMockSpawnOutput({ stdout: "Final synthesis ADR output no comment.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "run_interactive_debate",
        arguments: {
          debateId: "interactive-debate-1",
          action: "finalize",
          language: "ru"
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
    setMockFiles([]);
    setMockSpawnOutput({ stdout: "Debate round output.", stderr: "", code: 0 });

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
});
