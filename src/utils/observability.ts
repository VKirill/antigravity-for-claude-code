import { spawnSync } from "child_process";
import { appendFileSync } from "fs";

/**
 * Appends a JSONL lifecycle event to the file specified in AGY_LIFECYCLE_LOG env.
 * Soft-fails on any write/io error.
 */
export function logLifecycleEvent(event: string, data: Record<string, any>): void {
  const logPath = process.env.AGY_LIFECYCLE_LOG;
  if (!logPath) {
    return;
  }
  const payload = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  try {
    appendFileSync(logPath, JSON.stringify(payload) + "\n", "utf-8");
  } catch (err) {
    // Soft-fail
  }
}

/**
 * Runs `git -C <cwd> status --porcelain` and returns the list of changed file paths.
 * Returns [] on ANY error or if not a git repo (soft-fail, never throw).
 */
export function captureGitFiles(cwd: string): string[] {
  try {
    const res = spawnSync("git", ["-c", "core.quotepath=false", "-C", cwd, "status", "--porcelain"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    if (res.error || res.status !== 0) {
      return [];
    }
    const stdout = res.stdout;
    if (!stdout) {
      return [];
    }

    const lines = stdout.split(/\r?\n/);
    const files: string[] = [];
    for (const line of lines) {
      if (line.length < 4) {
        continue;
      }
      // Status is at index 0 and 1, index 2 is space, path starts at index 3
      let filePath = line.substring(3).trim();
      if (filePath.includes(" -> ")) {
        filePath = filePath.split(" -> ").pop()!.trim();
      }
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
      }
      if (filePath) {
        files.push(filePath);
      }
    }
    return files;
  } catch (err) {
    return [];
  }
}

/**
 * Returns a compact HTML-comment footer string.
 * Reports the DELTA between `before` and `after`: files added/modified (in after,
 * not in before) plus files deleted (in before, not in after). If the delta is
 * empty, omits the files_changed segment and emits just `<!-- agy: X.Ys -->`.
 */
export function buildFooter(before: string[], after: string[], durationMs: number): string {
  const durationSec = (durationMs / 1000).toFixed(1);
  const beforeSet = new Set(before);
  const addedOrModified = after.filter(f => !beforeSet.has(f));
  const deleted = before.filter(f => !after.includes(f));
  const changed = [...addedOrModified, ...deleted];
  if (changed.length === 0) {
    return `<!-- agy: ${durationSec}s -->`;
  }
  return `<!-- agy: ${durationSec}s | files_changed: ${changed.join(", ")} -->`;
}

