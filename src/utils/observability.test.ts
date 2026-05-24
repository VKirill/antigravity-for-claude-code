import { describe, it, expect, beforeEach } from "bun:test";
import { resetMockState, setMockSpawnSyncOutput, lastSpawnSyncArgs, lastAppendFileSyncPath, lastAppendFileSyncData } from "../test-setup.ts";
import { captureGitFiles, buildFooter, logLifecycleEvent } from "./observability.ts";
import { join } from "path";

describe("observability utilities", () => {
  beforeEach(() => {
    resetMockState();
  });

  describe("logLifecycleEvent", () => {
    const testLogFile = join(process.cwd(), "test-lifecycle.log");

    it("should not write to file if AGY_LIFECYCLE_LOG is not set", () => {
      const origEnv = process.env.AGY_LIFECYCLE_LOG;
      delete process.env.AGY_LIFECYCLE_LOG;
      try {
        logLifecycleEvent("test.event", { foo: "bar" });
        expect(lastAppendFileSyncPath).toBe("");
      } finally {
        process.env.AGY_LIFECYCLE_LOG = origEnv;
      }
    });

    it("should write event to file when AGY_LIFECYCLE_LOG is set", () => {
      const origEnv = process.env.AGY_LIFECYCLE_LOG;
      process.env.AGY_LIFECYCLE_LOG = testLogFile;
      try {
        logLifecycleEvent("test.event", { foo: "bar" });
        expect(lastAppendFileSyncPath).toBe(testLogFile);
        const parsed = JSON.parse(lastAppendFileSyncData.trim());
        expect(parsed.event).toBe("test.event");
        expect(parsed.foo).toBe("bar");
        expect(parsed.timestamp).toBeDefined();
      } finally {
        process.env.AGY_LIFECYCLE_LOG = origEnv;
      }
    });
  });

  describe("captureGitFiles", () => {
    it("should return [] if git command fails with non-zero exit status", () => {
      setMockSpawnSyncOutput({
        stdout: "",
        stderr: "fatal: not a git repository",
        status: 128
      });

      const files = captureGitFiles("/some/path");
      expect(files).toEqual([]);
      expect(lastSpawnSyncArgs).toEqual(["-c", "core.quotepath=false", "-C", "/some/path", "status", "--porcelain"]);
    });

    it("should return [] if git command throws an error", () => {
      setMockSpawnSyncOutput({
        stdout: "",
        stderr: "",
        status: -1,
        error: new Error("spawn ENOENT")
      });

      const files = captureGitFiles("/some/path");
      expect(files).toEqual([]);
    });

    it("should parse porcelain output correctly into a file list", () => {
      setMockSpawnSyncOutput({
        stdout: " M src/a.ts\n?? src/b.ts\n R  src/old.ts -> src/new.ts\n",
        stderr: "",
        status: 0
      });

      const files = captureGitFiles("/some/path");
      expect(files).toEqual(["src/a.ts", "src/b.ts", "src/new.ts"]);
    });

    it("should strip quotes from filenames in porcelain output", () => {
      setMockSpawnSyncOutput({
        stdout: ' M "src/spaced file.ts"\n?? "src/another.ts"\n',
        stderr: "",
        status: 0
      });

      const files = captureGitFiles("/some/path");
      expect(files).toEqual(["src/spaced file.ts", "src/another.ts"]);
    });

    it("should return [] for empty porcelain output", () => {
      setMockSpawnSyncOutput({
        stdout: "",
        stderr: "",
        status: 0
      });

      const files = captureGitFiles("/some/path");
      expect(files).toEqual([]);
    });
  });

  describe("buildFooter", () => {
    it("should format footer without files when changed files are empty", () => {
      const footer = buildFooter([], [], 12300);
      expect(footer).toBe("<!-- agy: 12.3s -->");
    });

    it("should format footer with added/modified files (delta only)", () => {
      const footer = buildFooter(["a.ts"], ["a.ts", "b.ts"], 5400);
      expect(footer).toBe("<!-- agy: 5.4s | files_changed: b.ts -->");
    });

    it("should format footer with deleted files (delta only)", () => {
      const footer = buildFooter(["x.ts"], [], 5400);
      expect(footer).toBe("<!-- agy: 5.4s | files_changed: x.ts -->");
    });

    it("should format footer without files segment when before and after are identical", () => {
      const footer = buildFooter(["a.ts"], ["a.ts"], 5400);
      expect(footer).toBe("<!-- agy: 5.4s -->");
    });

    it("should format footer with 0.0s when duration is 0", () => {
      const footer = buildFooter([], [], 0);
      expect(footer).toBe("<!-- agy: 0.0s -->");
    });
  });
});
