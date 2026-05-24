# SPEC — MCP server portability + observability

Produced by worker-planner (live run). Goal:
1. Eliminate hardcoded `/home/ubuntu` paths + HOME fallbacks from shipped code.
2. Concise JSONL lifecycle logger (env `AGY_LIFECYCLE_LOG`), no prompt/secret bodies.
3. On empty agy stdout, attach trimmed stderr to the error.

## Observable outcomes
- agy binary via `process.env.AGY_BIN || "agy"` (PATH); HOME fallback → `os.homedir()`.
- run-server.sh runs via `$SCRIPT_DIR` (no host path).
- JSONL events (dispatch / agy.spawn / agy.done / agy.timeout / agy.error) appended to AGY_LIFECYCLE_LOG if set; only sizes/metadata.
- Empty-stdout error includes child stderr.

## Verification
- `bun test` green (baseline 73); new tests for log helper + agy stderr/paths.
- Manual: set AGY_LIFECYCLE_LOG, invoke a tool, tail the file.

## Tasks: TASK-201..207 (see orchestrator.db). DAG:
201(log helper)→202(tests),203(dispatch log); 204(run-server),205(agy paths) independent;
206(agy log+stderr) dep 201,205; 207(agy tests) dep 206.

Note: install-hooks.cjs portability deferred (planner gap; minor — uses __dirname already).
