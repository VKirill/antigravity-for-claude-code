import { test, expect, describe, beforeEach } from "bun:test";
import { resetMockState, setMockFiles, setMockReadContent, mockFsFiles } from "./test-setup.ts";
import { scanFatalMarker, getJobStatus, getJobDir, saveJobMeta } from "./utils/jobs.ts";

// Regression coverage for the parallel-safety fix in startCrashMonitor.
// Previously the monitor scanned the SHARED newest ~/.gemini/.../cli-*.log and fired the
// kill on whichever job the loop was iterating — one crashed job could kill healthy
// siblings under parallel dispatch. scanFatalMarker now reads ONLY the file it is given
// (each job's own output.txt), so detection is isolated per job.
describe("scanFatalMarker — per-job crash detection (parallel-safe)", () => {
  beforeEach(() => {
    resetMockState();
    setMockFiles([{ name: "output.txt", mtime: 1, size: 200 }]);
  });

  test("detects a default fatal marker in the job's own output", () => {
    setMockReadContent("step 1 ok\nagent executor error\n");
    expect(scanFatalMarker("/cwd/.claude/jobs/task-1-job-x/output.txt")).toBe("agent executor error");
  });

  test("returns null for a clean output", () => {
    setMockReadContent("all steps completed, result: yaml block written");
    expect(scanFatalMarker("/cwd/.claude/jobs/task-2-job-y/output.txt")).toBeNull();
  });

  test("isolation: result tracks the file given, not a sticky global source", () => {
    // Sibling job B crashed:
    setMockReadContent("trajectory converted to zero chat messages");
    expect(scanFatalMarker("/cwd/.claude/jobs/job-B/output.txt"))
      .toBe("trajectory converted to zero chat messages");
    // Job A is clean — scanning A must be null, independent of B's crash:
    setMockReadContent("job A working fine");
    expect(scanFatalMarker("/cwd/.claude/jobs/job-A/output.txt")).toBeNull();
  });

  test("honors a custom AGY_FATAL_MARKERS list", () => {
    const prev = process.env.AGY_FATAL_MARKERS;
    process.env.AGY_FATAL_MARKERS = "BOOM,KAPUT";
    try {
      setMockReadContent("...KAPUT...");
      expect(scanFatalMarker("/cwd/.claude/jobs/job-c/output.txt")).toBe("KAPUT");
      // a default marker is NOT in the custom list -> no match
      setMockReadContent("agent executor error");
      expect(scanFatalMarker("/cwd/.claude/jobs/job-c/output.txt")).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.AGY_FATAL_MARKERS;
      else process.env.AGY_FATAL_MARKERS = prev;
    }
  });

  test("returns null when the output file does not exist", () => {
    // mock existsSync is false for a path outside /jobs/ and not ending in output.txt
    expect(scanFatalMarker("/tmp/nonexistent-elsewhere.log")).toBeNull();
  });
});

// Regression coverage for the false-death recovery. A job we previously declared dead via the
// premature-death path (tmux session gone before the trailing `echo $?` wrote exit_code.txt) must
// be upgraded to success on a later poll IF the worker's result.yaml sidecar landed afterwards —
// but ONLY for that exact case, never for a real failure. This is the belt to the root fix
// (running agy directly in the pane instead of detaching it with `setsid`).
describe("getJobStatus — late sidecar recovery of a premature-death failure", () => {
  const PREMATURE = "Tmux session exited prematurely without writing exit code.";
  const VALID_ENVELOPE = "result:\n  summary: done\n  status: success\n  errors: []\n";

  beforeEach(() => {
    resetMockState();
  });

  function seedFailed(jobId: string, error: string) {
    saveJobMeta({ jobId, conversationId: null, status: "failed", error, startTime: Date.now() - 1000, durationMs: 1000 });
  }

  test("upgrades failed→success when a valid sidecar exists for a premature death", () => {
    const jobId = "task-recover-job-ok";
    seedFailed(jobId, PREMATURE);
    mockFsFiles.set(`${getJobDir(jobId)}/result.yaml`, VALID_ENVELOPE);

    const meta = getJobStatus(jobId);
    expect(meta.status).toBe("success");
    expect(meta.exitCode).toBe(0);
    expect(meta.error).toBeUndefined();
  });

  test("stays failed when the sidecar is missing/invalid", () => {
    const jobId = "task-recover-job-nosidecar";
    seedFailed(jobId, PREMATURE);
    // no result.yaml seeded → mock readFileSync yields empty content → parseEnvelopeStrict fails
    const meta = getJobStatus(jobId);
    expect(meta.status).toBe("failed");
  });

  test("does NOT upgrade a non-premature failure even with a valid sidecar (scope guard)", () => {
    const jobId = "task-recover-job-realfail";
    seedFailed(jobId, "Error reading exit code: bad code");
    mockFsFiles.set(`${getJobDir(jobId)}/result.yaml`, VALID_ENVELOPE);

    const meta = getJobStatus(jobId);
    expect(meta.status).toBe("failed");
  });
});
