# SPEC — agy process lifecycle fix + wrapper observability

## Problem

All MCP tools (discuss / programming / debate / receipt) run the `agy` CLI through
`runAgy()` in `src/utils/agy.ts` using `agy --print` (prompt via stdin, response via stdout).

On heavy coding tasks the call hangs until Claude Code's own ~600s client timeout, even
though `agy` **does** complete the work (files are edited). Root cause confirmed by code
review + maintainer (Antigravity) consultation:

1. The Promise resolves/rejects **only** inside `child.on("close")`. The 90s timeout handler
   sends `SIGKILL` but never rejects directly.
2. `close` waits for EOF on all stdio streams. `agy` spawns an internal engine as a child
   that **inherits the stdout pipe**. `SIGKILL` on the direct `agy` process leaves the
   grandchild holding the pipe write-end → no EOF → `close` never fires → Promise hangs.
3. 90s is too short for real coding tasks (agy's own `--print-timeout` default is 5m).
4. Retry on timeout re-runs the same prompt over partially-edited files → corruption risk.

## Empirical finding — hooks do NOT fire in `--print` mode

We probed `agy` hook lifecycle (`PreToolUse/PostToolUse/Stop/SessionStart`) on the real
install. **None fired in `--print` mode.** The existing `code-guidelines-gate` PreToolUse
hook did not block a `.vue` hardcoded hex write through `agy --print`; the audit log did not
grow. Conclusion: hook-based enhancements are **not viable** for the MCP path (which always
uses `--print`). Observability/completion signalling must live in the wrapper, not in hooks.

## Scope

### TASK-001 (P0) — Fix `runAgy` lifecycle (`src/utils/agy.ts`)
- Guard with `isFinished` flag + `safeResolve`/`safeReject` (no double settle).
- Resolve on `close` (fast path, full buffer). Add an `exit` fallback: if `close` does not
  fire within ~1500ms after `exit`, destroy stdio streams and resolve with buffered stdout.
- Spawn with `detached: true`; on timeout kill the whole process group via
  `process.kill(-child.pid, "SIGKILL")` (try/catch), then `safeReject`.
- Raise wrapper timeout to 500s (below the 600s client cap), keep it configurable via env
  `AGY_TIMEOUT_MS` (default 500000).
- Timeout errors are **non-retryable** (`retryable=false`) to avoid double-editing.
  Empty-response stays retryable.
- Update `src/utils/agy.test.ts` to cover: exit-fallback resolve, timeout rejects directly
  (not hanging), timeout is non-retryable, empty-response still retried.

### TASK-002 (P2′) — Wrapper-level observability (no hooks)
- In `runAgy` (or a thin wrapper used by tool handlers), measure call duration.
- In the `discuss` / `programming` tool handlers, capture `git diff --name-only HEAD` before
  and after the agy call (when cwd is a git repo) and append a compact
  `files_changed` + `duration_s` footer to the returned text. Soft-fail if not a git repo.
- Do NOT change tool return contract shape beyond appending to the text block.
- Add tests for the diff/duration footer helper (mock git / fs).

## Out of scope (dropped, with reason)
- **P1 Stop-sentinel** — hook-based, hooks don't fire in `--print`; superseded by P0 `exit` fix.
- **Hook-based safety gate** (rm -rf / DROP / @ts-ignore / hex per-tool-call) — not achievable
  in `--print` + `--dangerously-skip-permissions`; requires interactive mode or upstream agy
  support. Documented as a known limitation.

## Acceptance criteria
- `bun test` fully green (baseline was 42 pass / 0 fail).
- A simulated timeout in `runAgy` rejects promptly (does not hang past the timeout).
- Timeout path does not retry; empty-response path still retries.
- `discuss`/`programming` responses include a `files_changed` + duration footer when run in a
  git repo.
- No regression in existing tool behavior.

## Sources / best-practices 2026
- Node.js `child_process`: `exit` fires on process termination independent of stdio EOF;
  `close` waits for all stdio streams — pipes held by grandchildren block `close`. Process-group
  kill requires `detached: true` + `process.kill(-pid)`.
- `agy --help`: `--print-timeout` default 5m; `--print` is single-shot non-interactive.
- Empirical probe (this repo, 2026-05-24): agy hooks do not fire in `--print` mode.
- Maintainer (Antigravity) consultation: confirmed root cause + `exit`/process-group approach.
