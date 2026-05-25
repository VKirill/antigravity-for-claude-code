import { test, expect, describe, beforeEach } from "bun:test";
import {
  resetMockState,
  mockExitCodeSessions,
  execSyncCalls,
  existsSyncCalls,
  setMockTmuxSessions,
  setMockExecSyncShouldThrow
} from "./test-setup.ts";

// Import the module AFTER mocks are registered in test-setup
import { sweepOrphanJobSessions, killSessions } from "./utils/session-gc.ts";

describe("session-gc tests", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("a finished candidate (exit_code.txt exists) gets killed and returned", () => {
    setMockTmuxSessions(["my-job-123", "task-456"]);
    
    mockExitCodeSessions.add("my-job-123");
    mockExitCodeSessions.add("task-456");

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual(["my-job-123", "task-456"]);

    // Check that we retrieved sessions and ran kill-session on both
    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
    expect(execSyncCalls).toContain('tmux kill-session -t "my-job-123"');
    expect(execSyncCalls).toContain('tmux kill-session -t "task-456"');
  });

  test("a still-running candidate (no exit_code.txt) is NOT killed", () => {
    setMockTmuxSessions(["my-job-running"]);
    
    // exit_code.txt does not exist (not added to mockExitCodeSessions)

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual([]);

    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "my-job-running"');
  });

  test("non-job session names are ignored", () => {
    setMockTmuxSessions(["random-tmux-session"]);
    
    // Even if exit_code.txt exists, it's not an agy session name
    mockExitCodeSessions.add("random-tmux-session");

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual([]);

    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "random-tmux-session"');
    expect(existsSyncCalls.length).toBe(0);
  });

  test("tmux-not-running (execSync throws on list) returns an empty killed list without throwing", () => {
    setMockExecSyncShouldThrow(true);

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual([]);
    expect(execSyncCalls).toContain('tmux list-sessions -F "#{session_name}"');
  });

  test("killSessions issues one kill per id and tolerates a failing kill", () => {
    // We want killSessions to invoke tmux kill-session for each ID.
    // The central mock in test-setup.ts will throw on "fail-id".
    // Even if the first one throws, the second one should still be invoked.
    
    killSessions(["fail-id", "success-id"]);

    expect(execSyncCalls).toContain('tmux kill-session -t "fail-id"');
    expect(execSyncCalls).toContain('tmux kill-session -t "success-id"');
  });

  test("session name containing shell metacharacters is skipped in sweepOrphanJobSessions while a valid sibling is processed", () => {
    setMockTmuxSessions(["my-job-valid", "my-job-invalid; rm -rf", "task-valid", "task-$(invalid)"]);
    
    mockExitCodeSessions.add("my-job-valid");
    mockExitCodeSessions.add("my-job-invalid; rm -rf");
    mockExitCodeSessions.add("task-valid");
    mockExitCodeSessions.add("task-$(invalid)");

    const result = sweepOrphanJobSessions();
    expect(result.killed).toEqual(["my-job-valid", "task-valid"]);

    expect(execSyncCalls).toContain('tmux kill-session -t "my-job-valid"');
    expect(execSyncCalls).toContain('tmux kill-session -t "task-valid"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "my-job-invalid; rm -rf"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "task-$(invalid)"');
  });

  test("session name containing shell metacharacters is skipped in killSessions while a valid sibling is processed", () => {
    killSessions(["valid-id", "invalid; id", "task-valid-2", "invalid$()id"]);
    expect(execSyncCalls).toContain('tmux kill-session -t "valid-id"');
    expect(execSyncCalls).toContain('tmux kill-session -t "task-valid-2"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "invalid; id"');
    expect(execSyncCalls).not.toContain('tmux kill-session -t "invalid$()id"');
  });
});

