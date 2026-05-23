import { test, expect, describe, beforeEach } from "bun:test";
import {
  mockSpawnOutput,
  mockFiles,
  mockReaddirShouldThrow,
  resetMockState,
  setMockSpawnOutput,
  setMockFiles,
  setMockReaddirShouldThrow
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
});
