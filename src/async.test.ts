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
});
