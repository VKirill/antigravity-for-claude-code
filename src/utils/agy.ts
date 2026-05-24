import { spawn } from "child_process";
import { readdirSync, statSync, openSync, readSync, closeSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { logLifecycleEvent } from "./observability.ts";

// Error shape used across runAgy: a standard Error carrying control flags the
// caller inspects (retry policy, child exit code, fatal-crash marker).
interface AgyError extends Error {
  retryable?: boolean;
  exitCode?: number | null;
  fatalCrash?: boolean;
}

// Helper to run agy CLI command, passing prompt via stdin and inheriting environment
export function runAgy(args: string[], prompt: string, maxRetries = 2): Promise<string> {
  let attempts = 0;

  logLifecycleEvent("dispatch", {
    args,
    promptSize: Buffer.byteLength(prompt, "utf-8"),
  });

  const execute = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const homeDir = process.env.HOME || homedir();
      const projectCwd = process.env.PWD || process.cwd();
      const timeoutMs = Number(process.env.AGY_TIMEOUT_MS) || 1200000;
      const fallbackMs = process.env.AGY_EXIT_FALLBACK_MS
        ? Number(process.env.AGY_EXIT_FALLBACK_MS)
        : 1500;

      let isFinished = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
      let fallbackId: ReturnType<typeof setTimeout> | undefined = undefined;
      let monitorId: ReturnType<typeof setInterval> | undefined = undefined;
      const attempt = attempts + 1;
      const startTime = Date.now();

      const safeResolve = (value: string) => {
        if (isFinished) return;
        isFinished = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        if (fallbackId) {
          clearTimeout(fallbackId);
          fallbackId = undefined;
        }
        if (monitorId) {
          clearInterval(monitorId);
          monitorId = undefined;
        }
        logLifecycleEvent("agy.done", {
          attempt,
          durationMs: Date.now() - startTime,
          stdoutSize: Buffer.byteLength(value, "utf-8"),
          stderrSize: Buffer.byteLength(stderr, "utf-8"),
        });
        resolve(value);
      };

      const safeReject = (err: AgyError) => {
        if (isFinished) return;
        isFinished = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        if (fallbackId) {
          clearTimeout(fallbackId);
          fallbackId = undefined;
        }
        if (monitorId) {
          clearInterval(monitorId);
          monitorId = undefined;
        }
        if (isTimedOut) {
          logLifecycleEvent("agy.timeout", {
            attempt,
            durationMs: Date.now() - startTime,
          });
        } else {
          logLifecycleEvent("agy.error", {
            attempt,
            durationMs: Date.now() - startTime,
            message: err.message || String(err),
            exitCode: err.exitCode !== undefined ? err.exitCode : null,
            stderrSize: Buffer.byteLength(stderr, "utf-8"),
          });
        }
        reject(err);
      };

      const printTimeoutSec = Math.max(30, Math.floor(timeoutMs / 1000) - 20);  // 20s buffer below wrapper
      let spawnArgs = args;
      if (args.includes("--print") && !args.some(a => String(a).startsWith("--print-timeout"))) {
        spawnArgs = [...args, "--print-timeout", `${printTimeoutSec}s`];
      }

      const binPath = process.env.AGY_BIN || "agy";
      const child = spawn(binPath, spawnArgs, {
        cwd: projectCwd,
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        },
        detached: true
      });

      logLifecycleEvent("agy.spawn", {
        attempt,
        args: spawnArgs,
        pid: child.pid,
      });
      
      let stdout = "";
      let stderr = "";
      let isTimedOut = false;

      // Crash monitor: agy can balloon its own log with oversized tool output
      // (a tool result too large to convert into model messages -> HTTP 413 ->
      // "trajectory converted to zero chat messages"). The executor then idles
      // uselessly until --print-timeout. Detect that early via the agy CLI log
      // (runaway size OR a fatal marker) and abort so recovery re-dispatches fast.
      if (process.env.AGY_CRASH_MONITOR !== "0" && spawnArgs.includes("--print")) {
        const pollMs = Number(process.env.AGY_CRASH_POLL_MS) || 3000;
        const markers = (process.env.AGY_FATAL_MARKERS ||
          "trajectory converted to zero chat messages,agent executor error")
          .split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        const logDir = join(homeDir, ".gemini/antigravity-cli/log");
        const tailScanBytes = 32 * 1024;
        let logFile: string | null = null;
        let lastPos = 0;

        const fireFatal = (reason: string) => {
          logLifecycleEvent("agy.fatal", {
            attempt,
            durationMs: Date.now() - startTime,
            reason,
          });
          if (child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch (e) {
              // process group already gone — nothing to kill
            }
          }
          const err: AgyError = new Error(`agy executor crashed early: ${reason}. Aborted to avoid hanging until timeout.`);
          err.retryable = false;
          err.fatalCrash = true;
          safeReject(err);
        };

        monitorId = setInterval(() => {
          if (isFinished) return;
          try {
            if (!logFile) {
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
              if (!newestName) return;
              logFile = join(logDir, newestName);
              lastPos = 0;
            }
            const size = statSync(logFile).size;
            if (size > lastPos) {
              const start = Math.max(lastPos, size - tailScanBytes);
              const len = size - start;
              const buf = Buffer.alloc(len);
              const fd = openSync(logFile, "r");
              try {
                readSync(fd, buf, 0, len, start);
              } finally {
                closeSync(fd);
              }
              lastPos = size;
              const chunk = buf.toString("utf-8");
              for (const m of markers) {
                if (chunk.includes(m)) {
                  fireFatal(`fatal marker in agy log: "${m}"`);
                  return;
                }
              }
            }
          } catch (e) {
            // soft-fail: the crash monitor must never break a healthy run
          }
        }, pollMs);
      }

      // Timeout handler
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        if (child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (e) {
            // ignore errors if the group is already gone
          }
        }
        const err: AgyError = new Error(`Process timed out after ${timeoutMs / 1000} seconds`);
        err.retryable = false;
        safeReject(err);
      }, timeoutMs);

      // Write prompt to stdin and close it
      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.setEncoding("utf-8");
      child.stderr.setEncoding("utf-8");

      child.stdout.on("data", (data) => {
        stdout += data;
      });

      child.stderr.on("data", (data) => {
        stderr += data;
      });

      child.on("error", (err: Error) => {
        const e = err as AgyError;
        e.retryable = false;
        safeReject(e);
      });

      child.on("exit", (code) => {
        if (isFinished) return;
        fallbackId = setTimeout(() => {
          if (!isFinished) {
            if (child.stdout && typeof child.stdout.destroy === "function") {
              try {
                child.stdout.destroy();
              } catch {
                // stdout already torn down — nothing to clean up
              }
            }
            if (child.stderr && typeof child.stderr.destroy === "function") {
              try {
                child.stderr.destroy();
              } catch {
                // stderr already torn down — nothing to clean up
              }
            }
            if (code === 0) {
              const trimmedOutput = stdout.trim();
              if (trimmedOutput === "") {
                const err: AgyError = new Error("Received empty response from agy" + (stderr.trim() ? `. Stderr: ${stderr.trim()}` : ""));
                err.retryable = true;
                safeReject(err);
              } else {
                safeResolve(trimmedOutput);
              }
            } else {
              const errMessage = isTimedOut
                ? `Process timed out after ${timeoutMs / 1000} seconds`
                : `agy process exited with code ${code}. Stderr: ${stderr.trim()}`;
              const err: AgyError = new Error(errMessage);
              err.exitCode = code;
              err.retryable = false;
              safeReject(err);
            }
          }
        }, fallbackMs);
      });

      child.on("close", (code) => {
        if (code === 0) {
          const trimmedOutput = stdout.trim();
          if (trimmedOutput === "") {
            const err: AgyError = new Error("Received empty response from agy" + (stderr.trim() ? `. Stderr: ${stderr.trim()}` : ""));
            err.retryable = true;
            safeReject(err);
          } else {
            safeResolve(trimmedOutput);
          }
        } else {
          const errMessage = isTimedOut
            ? `Process timed out after ${timeoutMs / 1000} seconds`
            : `agy process exited with code ${code}. Stderr: ${stderr.trim()}`;
          const err: AgyError = new Error(errMessage);
          err.exitCode = code;
          err.retryable = false;
          safeReject(err);
        }
      });
    });
  };

  const attemptRun = async (): Promise<string> => {
    try {
      return await execute();
    } catch (err) {
      if ((err as AgyError).retryable && attempts < maxRetries) {
        attempts++;
        // Wait 2 seconds before retry
        await new Promise(r => setTimeout(r, 2000));
        return attemptRun();
      }
      throw err;
    }
  };

  return attemptRun();
}

export function getNewestConversationId(): string | null {
  const homeDir = process.env.HOME || homedir();
  const dir = join(homeDir, ".gemini/antigravity-cli/conversations");
  try {
    const files = readdirSync(dir)
      .filter(file => file.endsWith(".pb"))
      .map(file => ({
        name: file,
        time: statSync(join(dir, file)).mtime.getTime(),
      }));

    if (files.length === 0) return null;

    files.sort((a, b) => b.time - a.time);
    return files[0].name.replace(/\.pb$/, "");
  } catch (err) {
    return null;
  }
}
