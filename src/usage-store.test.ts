import { test, expect, describe, beforeEach, mock } from "bun:test";

let mockFilesData = new Map<string, string>();
let mockExistsDirs = new Set<string>();
let readError = false;
let writeError = false;

mock.module("fs", () => {
  return {
    existsSync: (path: string) => {
      return mockFilesData.has(path) || mockExistsDirs.has(path);
    },
    readFileSync: (path: string, encoding: string) => {
      if (readError) {
        throw new Error("Simulated read error");
      }
      if (!mockFilesData.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return mockFilesData.get(path) || "";
    },
    writeFileSync: (path: string, data: string, encoding: string) => {
      if (writeError) {
        throw new Error("Simulated write error");
      }
      mockFilesData.set(path, data);
    },
    mkdirSync: (path: string, options?: { recursive?: boolean }) => {
      mockExistsDirs.add(path);
    }
  };
});

// Import the module AFTER mock.module is declared
import {
  recordJobStart,
  recordJobEnd,
  getUsageSummary
} from "./utils/usage-store.ts";

describe("usage-store", () => {
  beforeEach(() => {
    mockFilesData.clear();
    mockExistsDirs.clear();
    readError = false;
    writeError = false;
  });

  test("getUsageSummary on a missing file yields all zeros", () => {
    const summary = getUsageSummary();
    expect(summary.since).toBe("");
    expect(summary.jobsStarted).toBe(0);
    expect(summary.jobsSucceeded).toBe(0);
    expect(summary.jobsFailed).toBe(0);
    expect(summary.totalPromptChars).toBe(0);
    expect(summary.totalOutputChars).toBe(0);
    expect(summary.totalAgySeconds).toBe(0);
    expect(summary.estimatedTokens).toBe(0);
  });

  test("getUsageSummary on malformed JSON yields zeros (soft-fail)", () => {
    // Write malformed JSON
    const filePath = `${process.env.PWD || process.cwd()}/.claude/agy-usage.json`;
    mockFilesData.set(filePath, "{invalid-json}");
    
    const summary = getUsageSummary();
    expect(summary.since).toBe("");
    expect(summary.jobsStarted).toBe(0);
    expect(summary.jobsSucceeded).toBe(0);
    expect(summary.jobsFailed).toBe(0);
    expect(summary.totalPromptChars).toBe(0);
    expect(summary.totalOutputChars).toBe(0);
    expect(summary.totalAgySeconds).toBe(0);
    expect(summary.estimatedTokens).toBe(0);
  });

  test("start then end accumulates totals", () => {
    // Record start
    recordJobStart({ promptChars: 100 });
    
    let summary = getUsageSummary();
    expect(summary.since).not.toBe("");
    expect(summary.jobsStarted).toBe(1);
    expect(summary.totalPromptChars).toBe(100);
    expect(summary.jobsSucceeded).toBe(0);
    expect(summary.jobsFailed).toBe(0);

    const initialSince = summary.since;

    // Record end
    recordJobEnd({
      success: true,
      outputChars: 200,
      durationMs: 1500,
      estimatedTokens: 50
    });

    summary = getUsageSummary();
    expect(summary.since).toBe(initialSince); // preserved
    expect(summary.jobsStarted).toBe(1);
    expect(summary.jobsSucceeded).toBe(1);
    expect(summary.jobsFailed).toBe(0);
    expect(summary.totalPromptChars).toBe(100);
    expect(summary.totalOutputChars).toBe(200);
    expect(summary.totalAgySeconds).toBe(1.5);
    expect(summary.estimatedTokens).toBe(50);
  });

  test("success vs failed counters", () => {
    // Record start 1
    recordJobStart({ promptChars: 50 });
    // Record end 1: success
    recordJobEnd({
      success: true,
      outputChars: 100,
      durationMs: 1000,
      estimatedTokens: 25
    });

    // Record start 2
    recordJobStart({ promptChars: 75 });
    // Record end 2: failure
    recordJobEnd({
      success: false,
      outputChars: 10,
      durationMs: 500,
      estimatedTokens: 5
    });

    const summary = getUsageSummary();
    expect(summary.jobsStarted).toBe(2);
    expect(summary.jobsSucceeded).toBe(1);
    expect(summary.jobsFailed).toBe(1);
    expect(summary.totalPromptChars).toBe(125);
    expect(summary.totalOutputChars).toBe(110);
    expect(summary.totalAgySeconds).toBe(1.5);
    expect(summary.estimatedTokens).toBe(30);
  });

  test("since is set once and preserved across subsequent writes", () => {
    recordJobStart({ promptChars: 10 });
    const firstSince = getUsageSummary().since;
    expect(firstSince).not.toBe("");

    // Simulate another write doesn't overwrite it
    recordJobStart({ promptChars: 20 });
    expect(getUsageSummary().since).toBe(firstSince);

    recordJobEnd({
      success: true,
      outputChars: 30,
      durationMs: 100,
      estimatedTokens: 10
    });
    expect(getUsageSummary().since).toBe(firstSince);
  });

  test("read/write errors soft-fail and swallow", () => {
    // 1. Write error soft-fail during job start
    writeError = true;
    expect(() => recordJobStart({ promptChars: 10 })).not.toThrow();
    
    // Reset write error, verify file wasn't written
    writeError = false;
    expect(getUsageSummary().jobsStarted).toBe(0);

    // 2. Read error soft-fail during getUsageSummary
    recordJobStart({ promptChars: 10 });
    expect(getUsageSummary().jobsStarted).toBe(1);
    
    readError = true;
    // getUsageSummary should return zeroed values
    const summary = getUsageSummary();
    expect(summary.jobsStarted).toBe(0);
    expect(summary.since).toBe("");

    readError = false;
  });
});
