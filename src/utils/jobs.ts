import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync, readdirSync, openSync, readSync, closeSync } from "fs";
import { join } from "path";
import { execFileSync, spawn } from "child_process";
import { logLifecycleEvent, captureGitFiles, buildFooter } from "./observability.ts";
import { recordJobStart, recordJobEnd } from "./usage-store.ts";
import { estimateTokens } from "./token-estimate.ts";
import { parseEnvelopeStrict } from "./result-envelope.ts";

export interface JobMeta {
  jobId: string;
  conversationId: string | null;
  status: "started" | "running" | "success" | "failed" | "killed";
  startTime: number;
  durationMs?: number;
  filesBefore?: string[];
  filesAfter?: string[];
  exitCode?: number | null;
  error?: string;
  commandArgs?: string[];
}

// In-memory map of active jobs
const activeJobs = new Map<string, JobMeta>();
let monitorIntervalId: ReturnType<typeof setInterval> | null = null;

const recordedEnds = new Set<string>();

export function getActiveRunningJobIds(): string[] {
  const ids: string[] = [];
  for (const job of activeJobs.values()) {
    if (job.status === "running") {
      ids.push(job.jobId);
    }
  }
  return ids;
}

// At server start, record usage for jobs that finished while the server was down
// (meta still says "running" but exit_code.txt exists), so their tokens/time are
// not lost. Dedup via recordedEnds prevents double counting.
export function harvestCompletedOrphans(): number {
  let harvested = 0;
  try {
    const jobsDir = getJobsDir();
    if (!existsSync(jobsDir)) return 0;
    for (const name of readdirSync(jobsDir)) {
      try {
        const meta = loadJobMeta(name);
        if (meta && meta.status === "running" &&
            existsSync(join(getJobDir(name), "exit_code.txt"))) {
          getJobStatus(name); // flips to terminal status + records usage (deduped)
          harvested++;
        }
      } catch {
        // skip an unreadable / invalid job dir
      }
    }
  } catch {
    // jobs dir unreadable — nothing to harvest
  }
  return harvested;
}

function recordJobEndSafely(jobId: string, success: boolean, durationMs: number): void {
  try {
    if (recordedEnds.has(jobId)) return;
    recordedEnds.add(jobId);
    let prompt = "";
    try {
      prompt = readFileSync(join(getJobDir(jobId), "prompt.txt"), "utf-8");
    } catch {
      // best-effort: unreadable prompt just counts as 0 chars
    }
    let output = "";
    try {
      output = readFileSync(join(getJobDir(jobId), "output.txt"), "utf-8");
    } catch {
      // best-effort: unreadable output just counts as 0 chars
    }
    recordJobEnd({
      success,
      outputChars: output.length,
      durationMs,
      estimatedTokens: estimateTokens(prompt + output),
    });
  } catch {
    // telemetry must never break the job lifecycle
  }
}

// Helpers to get paths
function getProjectCwd(): string {
  return process.env.PWD || process.cwd();
}

function getJobsDir(): string {
  const jobsDir = join(getProjectCwd(), ".claude", "jobs");
  if (!existsSync(jobsDir)) {
    mkdirSync(jobsDir, { recursive: true });
  }
  return jobsDir;
}

export function getJobDir(jobId: string): string {
  const jobDir = join(getJobsDir(), jobId);
  if (!existsSync(jobDir)) {
    mkdirSync(jobDir, { recursive: true });
  }
  return jobDir;
}

// Write or read job metadata
export function saveJobMeta(meta: JobMeta): void {
  const jobDir = getJobDir(meta.jobId);
  writeFileSync(join(jobDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  activeJobs.set(meta.jobId, meta);
}

export function loadJobMeta(jobId: string): JobMeta | null {
  // Try memory first
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId)!;
  }
  // Try disk
  try {
    const jobDir = getJobDir(jobId);
    const metaFile = join(jobDir, "meta.json");
    if (existsSync(metaFile)) {
      const meta = JSON.parse(readFileSync(metaFile, "utf-8")) as JobMeta;
      activeJobs.set(jobId, meta);
      return meta;
    }
  } catch (e) {
    // Soft-fail
  }
  return null;
}

// Helper to check if tmux session is active
export function isTmuxSessionActive(jobId: string): boolean {
  try {
    execFileSync("tmux", ["has-session", "-t", jobId], { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to kill tmux session
export function killTmuxJobSession(jobId: string): void {
  try {
    execFileSync("tmux", ["kill-session", "-t", jobId], { stdio: "ignore" });
  } catch (e) {
    // ignore
  }
}

// Start a job
export function startTmuxJob(
  jobId: string,
  prompt: string,
  conversationId: string | null,
  customCwd?: string
): JobMeta {
  const projectCwd = customCwd || getProjectCwd();
  const jobDir = getJobDir(jobId);
  const promptFile = join(jobDir, "prompt.txt");
  const outputFile = join(jobDir, "output.txt");
  const exitCodeFile = join(jobDir, "exit_code.txt");

  // Capture git files before run
  let filesBefore: string[] = [];
  try {
    filesBefore = captureGitFiles(projectCwd);
  } catch (e) {
    // ignore
  }

  // Save prompt to file
  writeFileSync(promptFile, prompt, "utf-8");

  // Configure CLI arguments
  const cmdArgs = ["--dangerously-skip-permissions", "--print"];
  if (conversationId) {
    cmdArgs.push("--conversation", conversationId);
  } else {
    cmdArgs.push("--continue=false");
  }

  // Timeout logic (1000s max to match typical agy limits)
  const timeoutMs = Number(process.env.AGY_TIMEOUT_MS) || 1200000;
  const printTimeoutSec = Math.max(30, Math.floor(timeoutMs / 1000) - 20);
  cmdArgs.push("--print-timeout", `${printTimeoutSec}s`);

  const binPath = process.env.AGY_BIN || "agy";
  const escapedArgs = cmdArgs.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(" ");

  // Selective environment exports
  const envVarsToPreserve = [
    "HOME", "PATH", "AGY_BIN", "AGY_TIMEOUT_MS", "AGY_CRASH_MONITOR",
    "AGY_MAX_LOG_BYTES", "AGY_CRASH_POLL_MS", "AGY_FATAL_MARKERS", "AGY_LIFECYCLE_LOG"
  ];
  let envPrefix = "";
  for (const key of envVarsToPreserve) {
    if (process.env[key] !== undefined) {
      const val = process.env[key]!.replace(/'/g, "'\\''");
      envPrefix += `export ${key}='${val}'; `;
    }
  }

  // Redirect command. cwd is set by tmux's -c flag below, so no `cd` here
  // (keeps a project path that contains a quote from breaking the shell string).
  // Run agy under `setsid -w` (when available) so it gets its OWN session/process-group: an
  // exit-time process-group signal from agy can no longer kill THIS shell before the trailing
  // `echo $?` writes exit_code.txt (the intermittent "tmux session died before echo" bug). `-w`
  // makes setsid WAIT and propagate agy's real exit code. Falls back to plain agy where setsid is
  // absent (e.g. macOS) — the result.yaml sidecar fallback in getJobStatus covers that case.
  const bashCommand = `${envPrefix}S=$(command -v setsid >/dev/null 2>&1 && echo 'setsid -w' || echo ''); $S ${binPath} ${escapedArgs} < '${promptFile}' > '${outputFile}' 2>&1; echo $? > '${exitCodeFile}'`;

  // Start tmux session in background. execFileSync (no outer shell) so jobId and
  // projectCwd cannot inject shell metacharacters into the tmux command line.
  try {
    execFileSync("tmux", ["new-session", "-d", "-s", jobId, "-c", projectCwd, bashCommand], { stdio: "ignore" });
  } catch (err) {
    const errorMsg = `Failed to start tmux session: ${err instanceof Error ? err.message : String(err)}`;
    const failedMeta: JobMeta = {
      jobId,
      conversationId,
      status: "failed",
      startTime: Date.now(),
      error: errorMsg,
    };
    saveJobMeta(failedMeta);
    return failedMeta;
  }

  const meta: JobMeta = {
    jobId,
    conversationId,
    status: "running",
    startTime: Date.now(),
    filesBefore,
    commandArgs: cmdArgs,
  };

  saveJobMeta(meta);
  try {
    recordJobStart({ promptChars: prompt.length });
  } catch {
    // telemetry best-effort
  }

  // Initialize/start the background crash monitor if not running
  startCrashMonitor();

  logLifecycleEvent("agy.async.start", {
    jobId,
    conversationId,
    promptSize: Buffer.byteLength(prompt, "utf-8"),
  });

  return meta;
}

// Poll job status
export function getJobStatus(jobId: string): JobMeta {
  const meta = loadJobMeta(jobId);
  if (!meta) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (meta.status !== "running") {
    return meta;
  }

  const jobDir = getJobDir(jobId);
  const exitCodeFile = join(jobDir, "exit_code.txt");

  if (existsSync(exitCodeFile)) {
    try {
      const codeStr = readFileSync(exitCodeFile, "utf-8").trim();
      const exitCode = parseInt(codeStr, 10);
      const isSuccess = exitCode === 0;

      meta.status = isSuccess ? "success" : "failed";
      meta.exitCode = exitCode;
      meta.durationMs = Date.now() - meta.startTime;

      // Update Git changes
      try {
        const filesAfter = captureGitFiles(process.env.PWD || process.cwd());
        meta.filesAfter = filesAfter;
      } catch (e) {
        // ignore
      }

      // Conversation identity stays per-job in meta.conversationId. We deliberately do
      // NOT write a global sessionState.activeConversationId here: under parallel job
      // completion getNewestConversationId() (newest .pb by mtime) could attribute one
      // job's conversation to another and leak context across tasks.
      saveJobMeta(meta);
      recordJobEndSafely(jobId, isSuccess, meta.durationMs ?? 0);

      logLifecycleEvent(isSuccess ? "agy.async.success" : "agy.async.failed", {
        jobId,
        exitCode,
        durationMs: meta.durationMs,
      });

    } catch (e) {
      // Soft fail parsing code, treat as failed
      meta.status = "failed";
      meta.durationMs = meta.durationMs ?? (Date.now() - meta.startTime);
      meta.error = `Error reading exit code: ${e instanceof Error ? e.message : String(e)}`;
      saveJobMeta(meta);
      recordJobEndSafely(jobId, false, meta.durationMs);
    }
  } else {
    // Not finished yet. Let's see if tmux session is still active
    if (!isTmuxSessionActive(jobId)) {
      // Session gone but no exit_code.txt. Before declaring a crash, TRUST the result.yaml
      // sidecar: the worker writes it as its LAST action, so a valid envelope means the job
      // actually completed — the trailing `echo $?` just lost the race to a process-group signal
      // at agy exit. This stops spurious "crash" + retry on jobs that genuinely succeeded.
      try {
        const sidecarFile = join(jobDir, "result.yaml");
        if (existsSync(sidecarFile) && parseEnvelopeStrict(readFileSync(sidecarFile, "utf-8")).ok) {
          meta.status = "success";
          meta.exitCode = 0;
          meta.durationMs = Date.now() - meta.startTime;
          try { meta.filesAfter = captureGitFiles(process.env.PWD || process.cwd()); } catch { /* best-effort */ }
          saveJobMeta(meta);
          recordJobEndSafely(jobId, true, meta.durationMs ?? 0);
          logLifecycleEvent("agy.async.success", { jobId, exitCode: 0, durationMs: meta.durationMs, via: "sidecar" });
          return meta;
        }
      } catch {
        // unreadable / invalid sidecar → fall through to the failure path below
      }
      // Unexpected death of session
      meta.status = "failed";
      meta.error = "Tmux session exited prematurely without writing exit code.";
      meta.durationMs = Date.now() - meta.startTime;
      saveJobMeta(meta);
      recordJobEndSafely(jobId, false, meta.durationMs ?? 0);

      logLifecycleEvent("agy.async.died", {
        jobId,
        durationMs: meta.durationMs,
      });
    }
  }

  return meta;
}

// Tail-scan a single file for any configured fatal marker.
// Returns the matched marker string, or null. Pure + job-scoped by design: the caller
// passes the job's OWN output file, so one job's crash can never implicate a sibling.
// (The previous monitor scanned the SHARED newest ~/.gemini/.../cli-*.log and fired the
//  kill on whichever job the loop happened to be iterating — under parallelism a single
//  crashed job killed healthy ones. Scanning per-job output.txt removes that coupling.)
export function scanFatalMarker(filePath: string): string | null {
  const markers = (process.env.AGY_FATAL_MARKERS ||
    "trajectory converted to zero chat messages,agent executor error")
    .split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (markers.length === 0) return null;

  try {
    if (!existsSync(filePath)) return null;
    const size = statSync(filePath).size;
    if (size <= 0) return null;

    const tailScanBytes = 32 * 1024;
    const start = Math.max(0, size - tailScanBytes);
    const len = size - start;
    if (len <= 0) return null;

    const buf = Buffer.alloc(len);
    const fd = openSync(filePath, "r");
    try {
      readSync(fd, buf, 0, len, start);
    } finally {
      closeSync(fd);
    }
    const chunk = buf.toString("utf-8");
    for (const m of markers) {
      if (chunk.includes(m)) return m;
    }
  } catch (e) {
    // soft-fail: monitoring must never throw
  }
  return null;
}

// Background crash monitor. Each running job is checked against ITS OWN output stream,
// so detection is fully isolated per job (safe under parallel dispatch).
export function startCrashMonitor(): void {
  if (monitorIntervalId) return;

  const pollMs = Number(process.env.AGY_CRASH_POLL_MS) || 3000;

  monitorIntervalId = setInterval(() => {
    let activeCount = 0;

    for (const [jobId, meta] of activeJobs.entries()) {
      if (meta.status !== "running") continue;

      activeCount++;
      // A job that already wrote its exit code has finished — it just hasn't been
      // polled yet. Never early-kill it: its own output may legitimately contain a
      // marker string (e.g. the markers literally appear in this repo's source/tests).
      if (existsSync(join(getJobDir(jobId), "exit_code.txt"))) continue;
      const outputFile = join(getJobDir(jobId), "output.txt");
      const marker = scanFatalMarker(outputFile);
      if (marker) {
        fireEarlyKill(jobId, `Fatal marker in job output: "${marker}"`);
      }
    }

    if (activeCount === 0 && monitorIntervalId) {
      clearInterval(monitorIntervalId);
      monitorIntervalId = null;
    }
  }, pollMs);
}

function fireEarlyKill(jobId: string, reason: string): void {
  const meta = activeJobs.get(jobId);
  if (!meta || meta.status !== "running") return;

  killTmuxJobSession(jobId);

  meta.status = "killed";
  meta.error = `Job aborted early: ${reason}`;
  meta.durationMs = Date.now() - meta.startTime;

  // Write exit code file with custom code 137 (SIGKILL)
  try {
    const jobDir = getJobDir(jobId);
    writeFileSync(join(jobDir, "exit_code.txt"), "137", "utf-8");
    meta.exitCode = 137;
  } catch (e) {
    // ignore
  }

  saveJobMeta(meta);
  recordJobEndSafely(jobId, false, meta.durationMs ?? 0);

  logLifecycleEvent("agy.async.killed", {
    jobId,
    reason,
    durationMs: meta.durationMs,
  });
}
