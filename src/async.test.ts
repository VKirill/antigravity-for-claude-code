import { test, expect, describe, beforeEach, beforeAll, mock } from "bun:test";
import { MockTransport, resetMockState } from "./test-setup.ts";
import { server } from "./index.ts";
import { resetTestState } from "./state.ts";

mock.module("./utils/jobs.ts", () => {
  return {
    startTmuxJob: (jobId: string, prompt: string, conversationId: string | null) => ({
      jobId,
      conversationId,
      status: "running",
      startTime: 123456789,
    }),
    getJobStatus: (jobId: string) => {
      if (jobId.includes("fail")) {
        return {
          jobId,
          status: "failed",
          startTime: 123456789,
          error: "Mocked job failure",
        };
      }
      return {
        jobId,
        status: "success",
        startTime: 123456789,
        durationMs: 1000,
        filesBefore: ["file1.txt"],
        filesAfter: ["file1.txt", "file2.txt"],
      };
    },
    getJobDir: (jobId: string) => `/mock/job/dir/${jobId}`,
    loadJobMeta: (jobId: string) => {
      if (jobId.includes("unknown")) {
        return null;
      }
      return {
        jobId,
        conversationId: null,
        status: "success",
        startTime: 123456789,
      };
    },
    tailLogLines: (jobId: string, n: number) => {
      return ["line A", "line B", "line C"].slice(-n);
    },
  };
});

describe("async tool tests", () => {
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

  test("discuss_with_antigravity_async_start launches job and returns jobId", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_start",
        arguments: {
          prompt: "Async task prompt text",
          conversationId: "TASK-777"
        }
      },
      id: 60
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(60);
    expect(response.result.content).toBeArray();
    const resultObj = JSON.parse(response.result.content[0].text);
    expect(resultObj.jobId).toContain("task-777-job-");
    expect(resultObj.status).toBe("running");
  });

  test("discuss_with_antigravity_async_status returns logTail and state", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_status",
        arguments: {
          jobId: "some-job-id"
        }
      },
      id: 61
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(61);
    expect(response.result.content).toBeArray();
    const resultObj = JSON.parse(response.result.content[0].text);
    expect(resultObj.jobId).toBe("some-job-id");
    expect(resultObj.status).toBe("success");
  });

  test("discuss_with_antigravity_async_result returns a result envelope, not the raw transcript", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_result",
        arguments: {
          jobId: "some-job-id"
        }
      },
      id: 62
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0]; // guardian: allow — matches existing transport-message access pattern in this file
    expect(response.id).toBe(62);
    expect(response.result.content).toBeArray();
    const text = response.result.content[0].text;
    // The mock transcript ("Final output from agy") has no `result:` envelope → the server
    // synthesizes a failed envelope so the orchestrator still gets a structured result.
    expect(text).toContain("result:");
    expect(text).toContain("status: failed");
    expect(text).toContain("Final output from agy"); // crash evidence kept inline
  });

  test("discuss_with_antigravity_async_result full:true returns the raw transcript", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_result",
        arguments: {
          jobId: "some-job-id",
          full: true
        }
      },
      id: 63
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0]; // guardian: allow — matches existing transport-message access pattern in this file
    expect(response.id).toBe(63);
    const text = response.result.content[0].text;
    expect(text).toContain("Final output from agy");
    expect(text).not.toContain("status: failed"); // full bypasses envelope synthesis
  });

  test("discuss_with_antigravity_async_wait returns settled jobs (no polling, no logs)", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_wait",
        arguments: { jobIds: ["some-job-id"], waitMode: "any" }
      },
      id: 64
    });

    await new Promise(resolve => setTimeout(resolve, 30));

    const response: any = transport.sentMessages[0]; // guardian: allow — matches existing transport-message access pattern in this file
    expect(response.id).toBe(64);
    const data = JSON.parse(response.result.content[0].text);
    expect(data.finished).toContain("some-job-id");
    expect(data.running).toEqual([]);
    expect(data.jobs["some-job-id"].status).toBe("success");
    // compact statuses only — the raw transcript must never leak into a wait/status payload
    expect(response.result.content[0].text).not.toContain("Final output from agy");
  });

  test("discuss_with_antigravity_async_wait requires a non-empty jobIds array", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "discuss_with_antigravity_async_wait", arguments: {} },
      id: 65
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    const response: any = transport.sentMessages[0]; // guardian: allow — matches existing transport-message access pattern in this file
    expect(response.id).toBe(65);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("jobIds");
  });

  test("discuss_with_antigravity_async_log - happy path with lines arg", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "job-1", lines: 2 }
      },
      id: 100
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(100);
    expect(response.result.isError).toBe(false);
    const data = JSON.parse(response.result.content[0].text);
    expect(data.jobId).toBe("job-1");
    expect(data.lines).toEqual(["line B", "line C"]);
  });

  test("discuss_with_antigravity_async_log - default lines=50 when lines is undefined", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "job-1" }
      },
      id: 101
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(101);
    expect(response.result.isError).toBe(false);
    const data = JSON.parse(response.result.content[0].text);
    expect(data.lines).toEqual(["line A", "line B", "line C"]);
  });

  test("discuss_with_antigravity_async_log - missing jobId", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: {}
      },
      id: 102
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(102);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: jobId is required");
  });

  test("discuss_with_antigravity_async_log - invalid jobId", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "../etc" }
      },
      id: 103
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(103);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: invalid jobId");
  });

  test("discuss_with_antigravity_async_log - unknown jobId", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "unknown-job" }
      },
      id: 104
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(104);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: Job not found: unknown-job");
  });

  test("discuss_with_antigravity_async_log - lines=0", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "job-1", lines: 0 }
      },
      id: 105
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(105);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: lines must be a positive integer");
  });

  test("discuss_with_antigravity_async_log - lines=-1", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "job-1", lines: -1 }
      },
      id: 106
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(106);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: lines must be a positive integer");
  });

  test("discuss_with_antigravity_async_log - lines=1.5", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "job-1", lines: 1.5 }
      },
      id: 107
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(107);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: lines must be a positive integer");
  });

  test("discuss_with_antigravity_async_log - lines=abc", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "discuss_with_antigravity_async_log",
        arguments: { jobId: "job-1", lines: "abc" }
      },
      id: 108
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(108);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Error: lines must be a positive integer");
  });
});
