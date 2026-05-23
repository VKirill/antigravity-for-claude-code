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

      const child = spawn("/home/ubuntu/.local/bin/agy", args, {
        cwd: projectCwd,
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        }
      });
      
      let stdout = "";
      let stderr = "";
      let isTimedOut = false;

      // Timeout handler: 90 seconds (90000 ms)
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        child.kill("SIGKILL");
      }, 90000);

      // Write prompt to stdin and close it
      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          const trimmedOutput = stdout.trim();
          if (trimmedOutput === "") {
            const err = new Error("Received empty response from agy");
            (err as any).retryable = true;
            reject(err);
          } else {
            resolve(trimmedOutput);
          }
        } else {
          const errMessage = isTimedOut
            ? "Process timed out after 90 seconds"
            : `agy process exited with code ${code}. Stderr: ${stderr.trim()}`;
          const err = new Error(errMessage);
          if (isTimedOut) {
            (err as any).retryable = true;
          } else {
            (err as any).retryable = false; // Do not retry critical process crashes
          }
          reject(err);
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
