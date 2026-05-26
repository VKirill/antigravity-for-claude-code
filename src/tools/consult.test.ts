import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, setMockSpawnOutput, lastSpawnArgs, lastSpawnStdin, lastSpawnCwd, setMockSpawnSyncOutput } from "../test-setup.ts";
import { server } from "../index.ts";
import { resetTestState } from "../state.ts";
import path from "path";

type RpcResponse = { id?: number; result: { isError?: boolean; content: Array<{ text: string }> } };
const asResponse = (m: unknown): RpcResponse => m as RpcResponse;

describe("consult.ts tool tests", () => {
  let transport: MockTransport;

  beforeAll(async () => {
    process.env.ANTIGRAVITY_PROMPTS_DIR = path.resolve(import.meta.dir, "../../prompts");
    transport = new MockTransport();
    try {
      await server.close();
    } catch { /* guardian: allow — server may be unconnected on first run */ }
    await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
  });

  beforeEach(() => {
    resetTestState();
    resetMockState();
    transport.sentMessages = [];
  });

  test("consult_antigravity - returns prose, loads consultant persona, fresh session", async () => {
    setMockSpawnOutput({ stdout: "Рекомендую вынести визуальную стадию между 00f и 01.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: {
          prompt: "Оцени интеграцию визуальной стадии в конвейер.",
          context: "Конвейер: 01-scaffolding → 05-qa."
        }
      },
      id: 60
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Fresh session (no conversationId) → non-continuing
    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnArgs).not.toContain("--conversation");
    // Consultant persona + context + request all reach agy
    expect(lastSpawnStdin).toContain("консультант-эксперт широкого профиля");
    expect(lastSpawnStdin).toContain("Конвейер: 01-scaffolding");
    expect(lastSpawnStdin).toContain("Оцени интеграцию визуальной стадии");

    expect(transport.sentMessages.length).toBe(1);
    const response = asResponse(transport.sentMessages[0]);
    expect(response.id).toBe(60);
    expect(response.result.isError).toBeUndefined();
    // Prose passes through verbatim and the session id is surfaced for follow-ups
    expect(response.result.content[0].text).toContain("Рекомендую вынести визуальную стадию");
    expect(response.result.content[0].text).toContain("<!-- consult_session_id:");
  });

  test("consult_antigravity - NEVER forces a YAML result envelope (the planning-mode regression)", async () => {
    // The bug being fixed: prose consultations were dragged into a `result:` YAML envelope and,
    // when it didn't parse, synthesized as `status: failed`. The consultant must do neither.
    setMockSpawnOutput({ stdout: "1. integration_phases: вставить после 00f.\n2. designs_vs_personas: развязать.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: { prompt: "Ответь по 7 пунктам." }
      },
      id: 61
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response = asResponse(transport.sentMessages[0]);
    const text = response.result.content[0].text;
    expect(response.result.isError).toBeUndefined();
    expect(text).toContain("integration_phases: вставить после 00f");
    // No envelope wrapping, no synthesized failure
    expect(text).not.toContain("status: failed");
    expect(text).not.toContain("```yaml");
  });

  test("consult_antigravity - ALWAYS injects consultant-craft as the default methodology skill", async () => {
    // The whole "external neutral advisor" architecture depends on consultant-craft being loaded
    // every call, even when the caller passes no skills. Without it, the consultant degrades to
    // bare agy + persona — losing Block/Minto/research-protocol.
    setMockSpawnOutput({ stdout: "Внешний разбор без проектных скиллов.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: { prompt: "Дай нейтральный взгляд на эту идею." }
      },
      id: 67
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // consultant-craft must appear in stdin even with NO user-supplied skills
    expect(lastSpawnStdin).toContain("consultant-craft");
    expect(lastSpawnStdin).toContain("SKILL.md");

    const response = asResponse(transport.sentMessages[0]);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Внешний разбор без проектных скиллов.");
  });

  test("consult_antigravity - prepends consultant-craft when caller passes topical skills (no duplicate)", async () => {
    setMockSpawnOutput({ stdout: "Применяю принципы DDIA + методологию консультанта.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: {
          prompt: "Какую изоляцию транзакций?",
          skills: ["consultant-craft", "data-systems-craft"]  // caller explicitly includes consultant-craft
        }
      },
      id: 68
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should NOT duplicate consultant-craft in the injected skills list when caller already included it.
    // (Counting raw occurrences would be confused by persona text that names the skill several times,
    // so check the specific dedup pattern + the clean joined-skills line.)
    expect(lastSpawnStdin).not.toContain("consultant-craft, consultant-craft");
    expect(lastSpawnStdin).toContain("consultant-craft, data-systems-craft");
  });

  test("consult_antigravity - injects methodology skills to load before answering", async () => {
    setMockSpawnOutput({ stdout: "Применяю принципы DDIA: выбираю snapshot isolation.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: {
          prompt: "Какую изоляцию транзакций выбрать?",
          skills: ["data-systems-craft", "architecture-craft"]
        }
      },
      id: 66
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // The consultant is told to read each skill's SKILL.md before answering
    expect(lastSpawnStdin).toContain("SKILL.md");
    expect(lastSpawnStdin).toContain("data-systems-craft, architecture-craft");

    const response = asResponse(transport.sentMessages[0]);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Применяю принципы DDIA");
  });

  test("consult_antigravity - continues a thread and runs in the target cwd", async () => {
    setMockSpawnOutput({ stdout: "Продолжаю консультацию.", stderr: "", code: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: {
          prompt: "А что с gpt-image-2 через прокси?",
          conversationId: "consult-thread-123",
          cwd: "/home/ubuntu/tools/site-factory"
        }
      },
      id: 62
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // conversationId → resume that thread
    expect(lastSpawnArgs).toContain("--conversation");
    expect(lastSpawnArgs).toContain("consult-thread-123");
    expect(lastSpawnArgs).not.toContain("--continue=false");
    // cwd → agy runs inside the consulted project
    expect(lastSpawnCwd).toBe("/home/ubuntu/tools/site-factory");

    const response = asResponse(transport.sentMessages[0]);
    // The supplied conversationId is echoed back so the caller can keep the thread going
    expect(response.result.content[0].text).toContain("<!-- consult_session_id: consult-thread-123 -->");
  });

  test("consult_antigravity - requires a prompt", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "consult_antigravity", arguments: {} },
      id: 63
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response = asResponse(transport.sentMessages[0]);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("prompt is required");
  });

  test("consult_antigravity - handles execution failure", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "agy consult crash", code: 7 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: { prompt: "Разбери дизайн." }
      },
      id: 64
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response = asResponse(transport.sentMessages[0]);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка при консультации с Antigravity");
    expect(response.result.content[0].text).toContain("agy consult crash");
  });

  test("consult_antigravity - appends footer with duration", async () => {
    setMockSpawnOutput({ stdout: "Вердикт: развязать дизайны и персоны.", stderr: "", code: 0 });
    setMockSpawnSyncOutput({ stdout: "", stderr: "", status: 0 });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "consult_antigravity",
        arguments: { prompt: "Дай вердикт." }
      },
      id: 65
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const response = asResponse(transport.sentMessages[0]);
    const text = response.result.content[0].text;
    expect(text).toContain("Вердикт: развязать");
    expect(text).toMatch(/<!-- agy: \d+\.\ds -->/);
  });
});
