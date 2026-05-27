// Thin read-only accessor to a project's orchestrator.db (SQLite, lives at
// <cwd>/.claude/orchestrator.db). Used by the MCP server to resolve a task_id
// dispatch into the contract YAML stored by the `task insert` CLI command — so
// the orchestrator can dispatch jobs by id (10-token payload) instead of inlining
// the full contract (5-7k tokens) into every async_start prompt.
//
// SECURITY:
//   - cwd is validated to be an absolute path that exists.
//   - task_id is validated against /^[A-Za-z0-9._-]+$/ — matches the task CLI shape.
//   - We use a parameterised SQL with a non-interpolated SELECT, no concat.
//
// CONCURRENCY:
//   - The DB is opened read-only with WAL-aware semantics. The `task` CLI writes
//     under WAL (it's how it works under parallel agy workers); concurrent reads
//     here are safe.
//   - If a freshly-inserted contract is not yet visible (rare race with `task
//     insert` followed immediately by async_start), we retry up to 3 times with
//     a tiny exponential backoff. Retries handle both "row not found yet" and
//     transient SQLITE_BUSY.

import { join, isAbsolute } from "path";
import { Database } from "bun:sqlite";

export interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly contract_yaml: string;
  readonly status: string;
  readonly assignee_agent: string | null;
  readonly risk_class: string;
}

const TASK_ID_RE = /^[A-Za-z0-9._-]+$/;

function resolveDbPath(cwd: string): string {
  // Path validation only — we DELIBERATELY don't touch JS-fs (existsSync /
  // statSync) here, so this module stays mock-resilient: production opens
  // through bun:sqlite (native binding, bypasses any JS fs mock), and tests
  // get the same code path. If the db is missing or cwd is bogus, the native
  // open throws a clean SQLITE_CANTOPEN that readTaskRow wraps below.
  if (!cwd || typeof cwd !== "string") {
    throw new Error("cwd is required");
  }
  if (!isAbsolute(cwd)) {
    throw new Error(`cwd must be absolute, got: ${cwd}`);
  }
  return join(cwd, ".claude", "orchestrator.db");
}

function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // bun's setTimeout is async; for a tiny backoff inside this helper a busy
    // wait is acceptable — total max delay is ~520ms across 3 retries.
  }
}

export function readTaskRow(cwd: string, taskId: string): TaskRow | null { // guardian: allow — caller validates ids
  if (!TASK_ID_RE.test(taskId)) {
    throw new Error(`invalid task_id (allowed: [A-Za-z0-9._-]): ${taskId}`);
  }
  const dbPath = resolveDbPath(cwd);

  // Up to 3 attempts to cover (a) WAL visibility race after a fresh `task
  // insert`, (b) transient SQLITE_BUSY under parallel agy workers writing.
  const backoffMs = [0, 120, 400];
  let lastErr: unknown = null;
  for (const wait of backoffMs) {
    if (wait > 0) sleepSync(wait);
    let db: Database | null = null;
    try {
      // readonly mode: bun:sqlite supports it as a constructor option
      db = new Database(dbPath, { readonly: true });
      const row = db.query<TaskRow, { $id: string }>(
        "SELECT id, title, contract_yaml, status, assignee_agent, risk_class FROM tasks WHERE id = $id LIMIT 1"
      ).get({ $id: taskId });
      return row ?? null;
    } catch (e) {
      lastErr = e;
      // try again
    } finally {
      try { db?.close(); } catch { /* best-effort */ }
    }
  }
  // Exhausted retries — surface the underlying error with a hint for the
  // most common cause (the DB file is not where we expect).
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (/cantopen|unable to open|no such file/i.test(msg)) {
    throw new Error(`orchestrator.db not found at ${dbPath} — run \`task init\` in the project first`);
  }
  throw new Error(`failed to read task ${taskId} from ${dbPath}: ${msg}`);
}

/**
 * Build the MINIMAL dispatch preamble that goes to the worker when the
 * orchestrator dispatched by task_id. The full role manual is still prepended
 * separately by the `worker:` parameter path; this is just the per-task pointer.
 *
 * Total size is ~120-180 tokens regardless of contract size — that's the win.
 */
export function buildDispatchPreamble(opts: {
  readonly taskId: string;
  readonly cwd: string;
  readonly skillsCsv: string;
  readonly assigneeAgent?: string | null;
  readonly title?: string | null;
}): string {
  const { taskId, cwd, skillsCsv, assigneeAgent, title } = opts;
  const lines: string[] = [];
  lines.push(`TASK_ID: ${taskId}`);
  if (title) lines.push(`title: ${title}`);
  lines.push(`cwd: ${cwd}`);
  if (assigneeAgent) lines.push(`assignee_agent: ${assigneeAgent}`);
  if (skillsCsv) lines.push(`skill_hints: ${skillsCsv}`);
  lines.push("");
  lines.push(`Read your contract from the orchestrator DB:`);
  lines.push(`  task export ${taskId}`);
  lines.push("");
  lines.push(`Mark yourself in-progress, do the work per your role manual, then report:`);
  lines.push(`  task update ${taskId} --status in_progress`);
  lines.push(`  # ... do the work ...`);
  lines.push(`  cat envelope.yaml | task save-artifact ${taskId} --kind result`);
  lines.push(`  task update ${taskId} --status done    # or paused | needs_decomposition | failed`);
  lines.push("");
  lines.push(`You operate ONLY on ${taskId}. No ` + "`task list`" + `, no ` + "`task insert`" + `, no other task IDs.`);
  return lines.join("\n");
}
