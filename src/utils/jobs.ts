import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync, readdirSync, openSync, readSync, closeSync } from "fs";
import { join } from "path";
import { execSync, spawn } from "child_process";
import { homedir } from "os";
import { logLifecycleEvent, captureGitFiles, buildFooter } from "./observability.ts";
import { getNewestConversationId } from "./agy.ts";
import { sessionState } from "../state.ts";

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
    execSync(`tmux has-session -t "${jobId}"`, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to kill tmux session
export function killTmuxJobSession(jobId: string): void {
  try {
    execSync(`tmux kill-session -t "${jobId}"`, { stdio: "ignore" });
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

  // Create redirect bash command
  const bashCommand = `${envPrefix}cd '${projectCwd}' && ${binPath} ${escapedArgs} < '${promptFile}' > '${outputFile}' 2>&1; echo $? > '${exitCodeFile}'`;

  // Start tmux session in background
  try {
    execSync(`tmux new-session -d -s "${jobId}" -c "${projectCwd}" "${bashCommand}"`, { stdio: "ignore" });
  } catch (err: any) {
    const errorMsg = `Failed to start tmux session: ${err.message || String(err)}`;
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

      // If success, attempt to extract and persist the new conversation ID
      if (isSuccess) {
        const newConvId = getNewestConversationId();
        if (newConvId) {
          sessionState.activeConversationId = newConvId;
        }
      }

      saveJobMeta(meta);

      logLifecycleEvent(isSuccess ? "agy.async.success" : "agy.async.failed", {
        jobId,
        exitCode,
        durationMs: meta.durationMs,
      });

    } catch (e: any) {
      // Soft fail parsing code, treat as failed
      meta.status = "failed";
      meta.error = `Error reading exit code: ${e.message}`;
      saveJobMeta(meta);
    }
  } else {
    // Not finished yet. Let's see if tmux session is still active
    if (!isTmuxSessionActive(jobId)) {
      // Unexpected death of session
      meta.status = "failed";
      meta.error = "Tmux session exited prematurely without writing exit code.";
      meta.durationMs = Date.now() - meta.startTime;
      saveJobMeta(meta);

      logLifecycleEvent("agy.async.died", {
        jobId,
        durationMs: meta.durationMs,
      });
    }
  }

  return meta;
}

// Background log/crash monitor
export function startCrashMonitor(): void {
  if (monitorIntervalId) return;

  const pollMs = Number(process.env.AGY_CRASH_POLL_MS) || 3000;

  monitorIntervalId = setInterval(() => {
    let activeCount = 0;

    for (const [jobId, meta] of activeJobs.entries()) {
      if (meta.status !== "running") continue;

      activeCount++;
      const jobDir = getJobDir(jobId);
      const outputFile = join(jobDir, "output.txt");

      try {
        // Also check newest agy CLI log file for fatal markers
        const homeDir = process.env.HOME || homedir();
        const logDir = join(homeDir, ".gemini/antigravity-cli/log");
        if (existsSync(logDir)) {
          let newestName: string | null = null;
          let newestTime = -1;
          for (const f of readdirSync(logDir)) {
            if (!f.startsWith("cli-") || !f.endsWith(".log")) continue;
            const t = statSync(join(logDir, f)).mtimeMs;
            if (t > newestTime) {
              newestTime = t;
              newestName = f;
            }
          }

          if (newestName) {
            const logFile = join(logDir, newestName);
            const size = statSync(logFile).size;

            // Check fatal markers in tail
            const tailScanBytes = 32 * 1024;
            const start = Math.max(0, size - tailScanBytes);
            const len = size - start;
            if (len > 0) {
              const buf = Buffer.alloc(len);
              const fd = openSync(logFile, "r");
              try {
                readSync(fd, buf, 0, len, start);
              } finally {
                closeSync(fd);
              }
              const chunk = buf.toString("utf-8");
              const markers = (process.env.AGY_FATAL_MARKERS ||
                "trajectory converted to zero chat messages,agent executor error")
                .split(",").map((s) => s.trim()).filter((s) => s.length > 0);

              for (const m of markers) {
                if (chunk.includes(m)) {
                  fireEarlyKill(jobId, `Fatal marker in CLI log: "${m}"`);
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        // ignore soft-fail
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

  logLifecycleEvent("agy.async.killed", {
    jobId,
    reason,
    durationMs: meta.durationMs,
  });
}
