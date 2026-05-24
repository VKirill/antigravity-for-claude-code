import { spawn } from "child_process";
import { readdirSync, statSync } from "fs";
import { join } from "path";

// Helper to run agy CLI command, passing prompt via stdin and inheriting environment
export function runAgy(args: string[], prompt: string, maxRetries = 2): Promise<string> {
  let attempts = 0;

  const execute = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const homeDir = process.env.HOME || "/home/ubuntu/.gemini_mcp";
      const projectCwd = process.env.PWD || process.cwd();
      const timeoutMs = Number(process.env.AGY_TIMEOUT_MS) || 1200000;
      const fallbackMs = process.env.AGY_EXIT_FALLBACK_MS
        ? Number(process.env.AGY_EXIT_FALLBACK_MS)
        : 1500;

      let isFinished = false;
      let timeoutId: any = undefined;
      let fallbackId: any = undefined;

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
        resolve(value);
      };

      const safeReject = (err: any) => {
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
        reject(err);
      };

      const printTimeoutSec = Math.max(30, Math.floor(timeoutMs / 1000) - 20);  // 20s buffer below wrapper
      let spawnArgs = args;
      if (args.includes("--print") && !args.some(a => String(a).startsWith("--print-timeout"))) {
        spawnArgs = [...args, "--print-timeout", `${printTimeoutSec}s`];
      }

      const child = spawn("/home/ubuntu/.local/bin/agy", spawnArgs, {
        cwd: projectCwd,
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        },
        detached: true
      });
      
      let stdout = "";
      let stderr = "";
      let isTimedOut = false;

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
        const err = new Error(`Process timed out after ${timeoutMs / 1000} seconds`);
        (err as any).retryable = false;
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

      child.on("error", (err) => {
        (err as any).retryable = false;
        safeReject(err);
      });

      child.on("exit", (code, signal) => {
        if (isFinished) return;
        fallbackId = setTimeout(() => {
          if (!isFinished) {
            if (child.stdout && typeof child.stdout.destroy === "function") {
              try {
                child.stdout.destroy();
              } catch (e) {}
            }
            if (child.stderr && typeof child.stderr.destroy === "function") {
              try {
                child.stderr.destroy();
              } catch (e) {}
            }
            if (code === 0) {
              const trimmedOutput = stdout.trim();
              if (trimmedOutput === "") {
                const err = new Error("Received empty response from agy");
                (err as any).retryable = true;
                safeReject(err);
              } else {
                safeResolve(trimmedOutput);
              }
            } else {
              const errMessage = isTimedOut
                ? `Process timed out after ${timeoutMs / 1000} seconds`
                : `agy process exited with code ${code}. Stderr: ${stderr.trim()}`;
              const err = new Error(errMessage);
              (err as any).retryable = false;
              safeReject(err);
            }
          }
        }, fallbackMs);
      });

      child.on("close", (code) => {
        if (code === 0) {
          const trimmedOutput = stdout.trim();
          if (trimmedOutput === "") {
            const err = new Error("Received empty response from agy");
            (err as any).retryable = true;
            safeReject(err);
          } else {
            safeResolve(trimmedOutput);
          }
        } else {
          const errMessage = isTimedOut
            ? `Process timed out after ${timeoutMs / 1000} seconds`
            : `agy process exited with code ${code}. Stderr: ${stderr.trim()}`;
          const err = new Error(errMessage);
          (err as any).retryable = false;
          safeReject(err);
        }
      });
    });
  };

  const attemptRun = async (): Promise<string> => {
    try {
      return await execute();
    } catch (err: any) {
      if (err.retryable && attempts < maxRetries) {
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
  const homeDir = process.env.HOME || "/home/ubuntu/.gemini_mcp";
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
