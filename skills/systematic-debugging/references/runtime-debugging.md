# Runtime debugging — breakpoints, watch, post-mortem

For bugs you can reproduce while attached to a running process.

## Node.js

### `--inspect` flag

```bash
node --inspect-brk dist/server.js
# Open chrome://inspect → click "inspect" on the listed target
# Or VS Code: "Attach to Node Process"
```

`--inspect` starts debugger immediately; `--inspect-brk` pauses at first line so you can set breakpoints before code runs.

### Conditional breakpoints

Right-click in DevTools / VS Code at a line → "Edit Breakpoint" → expression:

```js
user.id === 42 && action === 'delete'
```

Pauses only when condition is true. Much better than spamming logs.

### Logpoints (DevTools / VS Code)

Add a "logpoint" — a breakpoint that prints to console without pausing:

```
balance={balance}, txId={tx.id}
```

Equivalent to inserting `console.log` but doesn't require code changes.

### Post-mortem (heapdump)

When Node crashes with OOM or you want to inspect heap at a specific moment:

```js
import v8 from 'node:v8';
import fs from 'node:fs';

process.on('SIGUSR2', () => {
  const file = `/tmp/heap-${Date.now()}.heapsnapshot`;
  v8.writeHeapSnapshot(file);
  console.log('Wrote', file);
});
```

Send signal: `kill -USR2 <pid>`. Open the file in Chrome DevTools → Memory tab.

### Memory leak hunting

1. Capture heap snapshot when memory looks normal
2. Drive load (run the suspected scenario N times)
3. Capture again
4. Open both in DevTools, use "Comparison" view
5. Look for object types that grew unexpectedly → trace retainers backward

### Async stack traces

Node `--async-stack-traces` (now default in modern Node) gives you stack traces through await boundaries:

```
Error: ...
  at fetchUser (src/users.ts:42)
  at async getDashboard (src/dashboard.ts:18)
  at async router (src/router.ts:9)
```

Without it you only see `fetchUser`; with it you see the calling chain.

## Python

### `pdb` / `breakpoint()`

```python
def buggy_function(x):
    breakpoint()  # Python 3.7+; equivalent to import pdb; pdb.set_trace()
    return x * 2
```

When hit, drops to interactive prompt:
- `n` next line
- `s` step into function
- `c` continue
- `l` list source around current
- `p <expr>` print
- `pp <expr>` pretty-print
- `w` where (stack trace)
- `u` / `d` move up/down stack frames

### `python -m pdb script.py` — start with pdb

### `pytest --pdb`

Drops to pdb at the point of test failure. Inspect variables in scope at the moment of assertion error.

```bash
pytest tests/test_foo.py::test_bar --pdb
```

### IPython / ipdb

```python
import ipdb; ipdb.set_trace()
```

Better tab completion, syntax highlighting. Install: `pip install ipdb`.

### Coredumps

Python with `faulthandler`:

```python
import faulthandler
faulthandler.enable()
```

On segfault, prints stack to stderr.

For OS-level coredumps (Linux):

```bash
ulimit -c unlimited
# Run the crashing process; coredump in cwd
gdb python core.<pid>
(gdb) bt   # backtrace
```

## Browser (frontend)

### DevTools

- **Sources tab** — set breakpoints in your code
- **Conditional breakpoints** — same as Node
- **DOM breakpoints** — break when a specific element is modified
- **Event listener breakpoints** — break on every `click` / `submit`
- **XHR/Fetch breakpoints** — break when a specific URL is hit
- **Performance recording** — record then replay to find slow renders, jank, memory growth

### `debugger;` statement

```js
function buggyHandler(event) {
  debugger;  // pauses if DevTools open; ignored otherwise
  return doSomething(event);
}
```

### Live edit while paused

In Sources tab, edit code while paused, save, resume → executes with the edit. Useful for quick "what if" without redeploying.

### React DevTools

- **Components tab** — inspect prop / state values at any depth
- **Profiler tab** — measure render times; find expensive re-renders
- **Hook inspection** — see useState / useReducer values
- Set breakpoints on state setters / effects

### Vue DevTools

- **Components panel** — same as React DevTools
- **Pinia / Vuex panel** — inspect store state, replay actions
- **Timeline** — see emits, watchers, lifecycle events

## Database

### EXPLAIN ANALYZE (Postgres)

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM orders WHERE user_id = 42;
```

Output shows actual row counts vs planned, time per node, buffer hits/misses.

### pg_stat_statements

Enable in `postgresql.conf`:
```
shared_preload_libraries = 'pg_stat_statements'
```

Query slow / frequent queries:
```sql
SELECT query, calls, mean_exec_time, rows, total_exec_time / 1000 as total_sec
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### auto_explain

Auto-log query plans for queries slower than threshold:
```
auto_explain.log_min_duration = '500ms'
auto_explain.log_analyze = on
```

Then check Postgres log when a slow query fires.

## Distributed

### Tracing UIs

Jaeger, Tempo, Honeycomb, Datadog APM: visualise traces, find slow spans, see which service errored.

### Trace by example

```
[gateway: 2ms]
└─ [auth.verify: 8ms]
└─ [orders.create: 320ms]
    ├─ [db.insert: 45ms]
    ├─ [payments.charge: 250ms ❌ error: card declined]
    └─ [audit.log: 25ms]
```

In the UI, click the failing span → see request body, response, exception. Often complete diagnosis from one screen.

### Correlation across logs + traces

Modern stack: traces and logs share a `trace_id`. Find slow trace in Tempo → use trace_id to pull all logs in Loki for that request → full context.

## Anti-patterns

| Bad | Better |
|---|---|
| `console.log(everything)` scattered, never removed | Logpoints (no code change); structured logs at boundaries only |
| Stepping through every line with `n` | Set a breakpoint at the failure point + back up only as needed |
| Adding logs without removing → next bug, more noise | Remove debug logs after fixing; keep only the structured ones that add value |
| Debugging in production | Reproduce in staging; add observability for next time |
| Trusting the first thing you see | Verify the hypothesis end-to-end; one symptom can have multiple causes |

## When to stop using runtime debugging

- The bug is in a path you can't run interactively (production-only, distributed, third-party callback) → switch to [log-driven-debugging.md](log-driven-debugging.md)
- You've stepped through and can't find the cause → step back; the bug is likely upstream from where you're looking. See [methodology.md](methodology.md#5-iterate).
- Variables look correct at every checkpoint but the result is still wrong → check at finer granularity (single expressions) OR the bug is in a different code path than you think (graph-aware-debugging.md to find other callers)
