import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Sweep orphan tmux sessions that were left behind after job completion.
 * A session is considered an orphan if it is an agy job session (containing "-job-" or starting with "task-")
 * and its job directory contains an `exit_code.txt` file.
 */
export function sweepOrphanJobSessions(): { killed: string[] } {
  const killed: string[] = [];
  let stdout = "";

  try {
    stdout = execSync('tmux list-sessions -F "#{session_name}"', {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err: unknown) {
    // If tmux is not running / not installed, returns an empty killed list and throws nothing.
    return { killed };
  }

  const lines = stdout.split(/\r?\n/);
  const projectCwd = process.env.PWD || process.cwd();

  for (const rawLine of lines) {
    const sessionName = rawLine.trim();
    if (!sessionName) {
      continue;
    }

    const isAgyJobSession = sessionName.includes("-job-") || sessionName.startsWith("task-");
    if (!isAgyJobSession) {
      continue;
    }

    const markerPath = join(projectCwd, ".claude", "jobs", sessionName, "exit_code.txt");
    try {
      if (existsSync(markerPath)) {
        try {
          execSync(`tmux kill-session -t "${sessionName}"`, { stdio: "ignore" });
          killed.push(sessionName);
        } catch (killErr: unknown) {
          // kill failures are swallowed
        }
      }
    } catch (fsErr: unknown) {
      // everything soft-fails
    }
  }

  return { killed };
}

/**
 * Kill a list of session IDs individually, swallowing any errors.
 */
export function killSessions(jobIds: string[]): void {
  for (const id of jobIds) {
    try {
      execSync(`tmux kill-session -t "${id}"`, { stdio: "ignore" });
    } catch (err: unknown) {
      // Kill failures are swallowed
    }
  }
}
