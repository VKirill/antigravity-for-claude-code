import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, setMockSpawnOutput, lastSpawnArgs, lastSpawnStdin, setMockSpawnSyncOutput } from "../test-setup.ts";
import { server } from "../index.ts";
import { resetTestState } from "../state.ts";

describe("programming.ts tool tests", () => {
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

  test("review_code_changes - successfully runs code review", async () => {
    setMockSpawnOutput({ stdout: "Code review: No issues found.", stderr: "", code: 0 });

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

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toContain("Senior Code Reviewer");
    expect(lastSpawnStdin).toContain("Rules: use semicolons.");
    expect(lastSpawnStdin).toContain("console.log('test')");

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(30);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Code review: No issues found.");
  });

  test("review_code_changes - handles execution failure", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "Review process crash", code: 5 });

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

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка при проведении код-ревью");
    expect(response.result.content[0].text).toContain("Review process crash");
  });

  test("get_programming_advice - successfully retrieves technical advice", async () => {
    setMockSpawnOutput({ stdout: "Use Map for O(1) lookups.", stderr: "", code: 0 });

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

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(lastSpawnArgs).toContain("--continue=false");
    expect(lastSpawnStdin).toContain("Senior Software Engineer");
    expect(lastSpawnStdin).toContain("Язык/Технология/Стек: typescript");
    expect(lastSpawnStdin).toContain("const arr = [1, 2, 3];");
    expect(lastSpawnStdin).toContain("How to optimize lookup?");

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(40);
    expect(response.result.isError).toBeUndefined();
    expect(response.result.content[0].text).toContain("Use Map for O(1) lookups.");
  });

  test("get_programming_advice - handles execution failure", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "Advice API down", code: 6 });

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

    await new Promise(resolve => setTimeout(resolve, 50));

    const response: any = transport.sentMessages[0];
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Ошибка при получении совета по программированию");
    expect(response.result.content[0].text).toContain("Advice API down");
  });

  test("review_code_changes - appends footer with duration and changed files", async () => {
    setMockSpawnOutput({ stdout: "Done", stderr: "", code: 0 });
    setMockSpawnSyncOutput({
      stdout: "",
      stderr: "",
      status: 0,
      stdoutQueue: ["", " M src/tools/programming.ts\n?? src/utils/observability.ts\n"]
    });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "review_code_changes",
        arguments: {
          diff: "some diff"
        }
      },
      id: 50
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    const text = response.result.content[0].text;
    expect(text).toContain("Done");
    expect(text).toMatch(/<!-- agy: \d+\.\ds \| files_changed: src\/tools\/programming\.ts, src\/utils\/observability\.ts -->/);
  });

  test("get_programming_advice - appends footer with duration and no changed files", async () => {
    setMockSpawnOutput({ stdout: "Done advice", stderr: "", code: 0 });
    setMockSpawnSyncOutput({
      stdout: "",
      stderr: "",
      status: 0
    });

    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_programming_advice",
        arguments: {
          question: "How to exit Vim?"
        }
      },
      id: 51
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    const text = response.result.content[0].text;
    expect(text).toContain("Done advice");
    expect(text).toMatch(/<!-- agy: \d+\.\ds -->/);
    expect(text).not.toContain("files_changed");
  });
});
