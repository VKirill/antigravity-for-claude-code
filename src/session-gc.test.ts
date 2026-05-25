import { test, expect, describe, beforeEach, mock } from "bun:test";

let mockExecSyncOutput = "";
let mockExecSyncError: Error | null = null;
const execSyncCalls: string[] = [];

const mockExistsSyncMap = new Map<string, boolean>();
const existsSyncCalls: string[] = [];

mock.module("child_process", () => {
  return {
    execSync: (cmd: string, options?: { encoding?: string; stdio?: unknown }): string | Buffer => {
      execSyncCalls.push(cmd);
      if (mockExecSyncError) {
        throw mockExecSyncError;
      }
      if (options?.encoding === "utf-8") {
        return mockExecSyncOutput;
      }
      return Buffer.from(mockExecSyncOutput, "utf-8");
    }
  };
});

mock.module("fs", () => {
  return {
    existsSync: (path: string): boolean => {
      existsSyncCalls.push(path);
      return mockExistsSyncMap.get(path) ?? false;
    }
  };
});

// Import the module AFTER mock.module is declared
import { sweepOrphanJobSessions, killSessions } from "./utils/session-gc.ts";

describe("session-gc tests", () => {
  beforeEach(() => {
    mockExecSyncOutput = "";
    mockExecSyncError = null;
    execSyncCalls.length = 0;
    mockExistsSyncMap.clear();
    existsSyncCalls.length = 0;
  });

  test("a finished candidate (exit_code.txt exists) gets killed and returned", () => {
    mockExecSyncOutput = "my-job-123\ntask-456\n";
    
    // Set existsSync to true for both candidate files
    const projectCwd = process.env.PWD || process.cwd();
    mockExistsSyncMap.set(`${projectCwd}/.claude/jobs/my-job-123/exit_code.txt`, true);
    mockExistsSyncMap.set(`${projectCwd}/.claude/jobs/task-456/exit_code.txt`, true);

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual(["my-job-123", "task-456"]);

    // Check that we retrieved sessions and ran kill-session on both
    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
    expect(execSyncCalls).toContain('tmux kill-session -t "my-job-123"');
    expect(execSyncCalls).toContain('tmux kill-session -t "task-456"');
  });

  test("a still-running candidate (no exit_code.txt) is NOT killed", () => {
    mockExecSyncOutput = "my-job-running\n";
    
    // exit_code.txt does not exist
    const projectCwd = process.env.PWD || process.cwd();
    mockExistsSyncMap.set(`${projectCwd}/.claude/jobs/my-job-running/exit_code.txt`, false);

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual([]);

    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "my-job-running"');
  });

  test("non-job session names are ignored", () => {
    mockExecSyncOutput = "random-tmux-session\n";
    
    // Even if exit_code.txt exists by some chance, it's not an agy session name
    const projectCwd = process.env.PWD || process.cwd();
    mockExistsSyncMap.set(`${projectCwd}/.claude/jobs/random-tmux-session/exit_code.txt`, true);

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual([]);

    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "random-tmux-session"');
    expect(existsSyncCalls.length).toBe(0);
  });

  test("tmux-not-running (execSync throws on list) returns an empty killed list without throwing", () => {
    mockExecSyncError = new Error("tmux: server not running");

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual([]);
    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
  });

  test("killSessions issues one kill per id and tolerates a failing kill", () => {
    // We want killSessions to invoke tmux kill-session for each ID
    // Even if the first one throws, the second one should still be invoked.
    
    let callCount = 0;
    mock.module("child_process", () => {
      return {
        execSync: (cmd: string): string => {
          execSyncCalls.push(cmd);
          callCount++;
          if (cmd.includes("fail-id")) {
            throw new Error("Simulated kill failure");
          }
          return "";
        }
      };
    });

    killSessions(["fail-id", "success-id"]);

    expect(execSyncCalls).toContain('tmux kill-session -t "fail-id"');
    expect(execSyncCalls).toContain('tmux kill-session -t "success-id"');
  });
});
