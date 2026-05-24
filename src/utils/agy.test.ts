import { test, expect, describe, beforeEach } from "bun:test";
import {
  mockSpawnOutput,
  mockFiles,
  mockReaddirShouldThrow,
  resetMockState,
  setMockSpawnOutput,
  setMockFiles,
  setMockReaddirShouldThrow,
  lastSpawnArgs
} from "../test-setup.ts";
import { runAgy, getNewestConversationId } from "./agy.ts";

describe("agy.ts utility tests", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("runAgy runs process and returns trimmed stdout", async () => {
    setMockSpawnOutput({ stdout: "  Some output  \n", stderr: "", code: 0 });
    const result = await runAgy(["-p"], "hello");
    expect(result).toBe("Some output");
  });

  test("runAgy retries on empty response and succeeds", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "", code: 0 });
    
    const promise = runAgy(["-p"], "hello");

    // Wait and switch mock output for second attempt
    await new Promise(r => setTimeout(r, 50));
    setMockSpawnOutput({ stdout: "Retry success", stderr: "", code: 0 });

    const result = await promise;
    expect(result).toBe("Retry success");
  });

  test("runAgy throws error on process failure", async () => {
    setMockSpawnOutput({ stdout: "", stderr: "Crash", code: 1 });
    await expect(runAgy(["-p"], "hello")).rejects.toThrow("agy process exited with code 1");
  });

  test("runAgy exit-fallback resolves with buffered stdout when close does not fire", async () => {
    process.env.AGY_EXIT_FALLBACK_MS = "50";
    setMockSpawnOutput({
      stdout: "Fallback output",
      stderr: "",
      code: 0,
      dontFireClose: true,
      fireExit: true,
      exitDelayMs: 5,
    });
    const result = await runAgy(["-p"], "hello");
    expect(result).toBe("Fallback output");
    delete process.env.AGY_EXIT_FALLBACK_MS;
  });

  test("runAgy exit-fallback rejects retryable empty response when buffered stdout is empty", async () => {
    process.env.AGY_EXIT_FALLBACK_MS = "50";
    setMockSpawnOutput({
      stdout: "",
      stderr: "",
      code: 0,
      dontFireClose: true,
      fireExit: true,
      exitDelayMs: 5,
    });
    await expect(runAgy(["-p"], "hello", 0)).rejects.toThrow("Received empty response from agy");
    delete process.env.AGY_EXIT_FALLBACK_MS;
  });

  test("runAgy exit-fallback rejects non-retryable on a non-zero exit code", async () => {
    process.env.AGY_EXIT_FALLBACK_MS = "50";
    setMockSpawnOutput({
      stdout: "partial",
      stderr: "",
      code: 1,
      dontFireClose: true,
      fireExit: true,
      exitCode: 1,
      exitDelayMs: 5,
    });
    let error: any;
    try {
      await runAgy(["-p"], "hello", 0);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toContain("agy process exited with code 1");
    expect(error.retryable).toBe(false);
    delete process.env.AGY_EXIT_FALLBACK_MS;
  });

  test("runAgy timeout rejects promptly and is non-retryable", async () => {
    process.env.AGY_TIMEOUT_MS = "50";
    setMockSpawnOutput({
      stdout: "delayed output",
      stderr: "",
      code: 0,
      closeDelayMs: 500,
    });

    const startTime = Date.now();
    let error: any;
    try {
      await runAgy(["-p"], "hello", 2);
    } catch (e) {
      error = e;
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(400);
    expect(error).toBeDefined();
    expect(error.message).toBe("Process timed out after 0.05 seconds");
    expect(error.retryable).toBe(false);

    delete process.env.AGY_TIMEOUT_MS;
  });

  test("getNewestConversationId returns newest ID from files", () => {
    setMockFiles([
      { name: "conv-1.pb", mtime: 1000 },
      { name: "conv-2.pb", mtime: 5000 },
      { name: "conv-3.pb", mtime: 3000 },
    ]);
    expect(getNewestConversationId()).toBe("conv-2");
  });

  test("getNewestConversationId returns null if no files", () => {
    setMockFiles([]);
    expect(getNewestConversationId()).toBeNull();
  });

  test("getNewestConversationId handles read error gracefully", () => {
    setMockReaddirShouldThrow(true);
    expect(getNewestConversationId()).toBeNull();
  });

  test("runAgy appends --print-timeout aligned with default AGY_TIMEOUT_MS when --print is present", async () => {
    setMockSpawnOutput({ stdout: "success", stderr: "", code: 0 });
    const originalArgs = ["--print", "some-other-arg"];
    const result = await runAgy(originalArgs, "hello");
    expect(result).toBe("success");
    
    // Check that --print-timeout and "480s" (500000 / 1000 - 20 = 480) were appended
    expect(lastSpawnArgs).toContain("--print-timeout");
    const timeoutIndex = lastSpawnArgs.indexOf("--print-timeout");
    expect(lastSpawnArgs[timeoutIndex + 1]).toBe("480s");
    
    // Check that the caller's original array was not mutated
    expect(originalArgs).toEqual(["--print", "some-other-arg"]);
  });

  test("runAgy appends --print-timeout aligned with custom AGY_TIMEOUT_MS when --print is present", async () => {
    process.env.AGY_TIMEOUT_MS = "120000"; // 120s -> expect 100s timeout
    setMockSpawnOutput({ stdout: "success", stderr: "", code: 0 });
    const result = await runAgy(["--print"], "hello");
    expect(result).toBe("success");
    
    expect(lastSpawnArgs).toContain("--print-timeout");
    const timeoutIndex = lastSpawnArgs.indexOf("--print-timeout");
    expect(lastSpawnArgs[timeoutIndex + 1]).toBe("100s");
    
    delete process.env.AGY_TIMEOUT_MS;
  });

  test("runAgy clamps print timeout to a minimum of 30s", async () => {
    process.env.AGY_TIMEOUT_MS = "40000"; // 40s -> 40 - 20 = 20, should clamp to 30s
    setMockSpawnOutput({ stdout: "success", stderr: "", code: 0 });
    await runAgy(["--print"], "hello");
    
    expect(lastSpawnArgs).toContain("--print-timeout");
    const timeoutIndex = lastSpawnArgs.indexOf("--print-timeout");
    expect(lastSpawnArgs[timeoutIndex + 1]).toBe("30s");
    
    delete process.env.AGY_TIMEOUT_MS;
  });

  test("runAgy does not append --print-timeout if it is already provided by caller", async () => {
    setMockSpawnOutput({ stdout: "success", stderr: "", code: 0 });
    const originalArgs = ["--print", "--print-timeout", "999s"];
    await runAgy(originalArgs, "hello");
    
    expect(lastSpawnArgs).toEqual(["--print", "--print-timeout", "999s"]);
    expect(originalArgs).toEqual(["--print", "--print-timeout", "999s"]);
  });
});
