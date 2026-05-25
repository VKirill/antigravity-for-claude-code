# Graph-aware debugging — gitnexus + serena MCPs

When you need to trace "who calls this", "where is this set", "what depends on this" — graph tools are O(1) per query; grep is O(N) and misses dynamic dispatches.

## Tools quick-ref

| Question | Tool |
|---|---|
| Who calls function X? | `mcp__gitnexus__impact({ target: "X", direction: "upstream" })` |
| What does function X call? | `mcp__gitnexus__impact({ target: "X", direction: "downstream" })` |
| Where is symbol X defined? | `mcp__serena__find_symbol` or `mcp__gitnexus__context` |
| Where is symbol X referenced? | `mcp__serena__find_referencing_symbols` |
| Show me request flow for URL | `mcp__gitnexus__route_map` |
| What tools / commands does this script orchestrate? | `mcp__gitnexus__tool_map` |
| Search by concept ("where do we handle refunds?") | `mcp__gitnexus__query` |
| What changed in this session vs main? | `mcp__gitnexus__detect_changes` |
| What's likely affected by this change? | `mcp__gitnexus__impact` on the changed symbol |
| Cypher query against the graph | `mcp__gitnexus__cypher` |

## Workflows

### Workflow 1: "Function X gives wrong result. Why?"

Don't grep. Walk the graph:

1. `impact({ target: "X", direction: "downstream" })` — what X calls. Is one of those returning bad data?
2. For each suspicious callee: same pattern. Drill down until you find the leaf where the data first goes wrong.
3. At the leaf: read the function, form hypothesis (probably an input validation issue or a constant).

Faster than grep because the graph knows static call edges; you don't waste time on string-matching same names in unrelated files.

### Workflow 2: "I changed function X — what tests should I run?"

1. `impact({ target: "X", direction: "upstream" })` — list of all callers (transitively)
2. For each caller: find tests that cover it (`find_referencing_symbols` on the caller name, filter to `_test.*` / `test_*.py`)
3. Run that union of tests, not the full suite

This is what `mcp__gitnexus__detect_changes(scope: "staged")` does automatically — gives you the affected test set.

### Workflow 3: "Where does this enum value come from?"

E.g., `status: 'PENDING_REVIEW'` shows up in a UI; you want to know where it's set.

```
mcp__gitnexus__query("PENDING_REVIEW")
```

vs grep — graph search understands string literals AND symbol references; grep just finds text.

### Workflow 4: "This data is malformed. Trace it back to source."

You see: `user.tenantId === undefined`.

```
mcp__serena__find_referencing_symbols(name_path: "tenantId", relative_path: "src/types/user.ts")
```

Returns every read AND write of `tenantId`. Filter to writes — that's where the value originates. Read each: does any write set it to `undefined`? Found it.

### Workflow 5: "What's the request flow for POST /api/orders?"

```
mcp__gitnexus__route_map(method: "POST", path: "/api/orders")
```

Returns: handler function → middlewares → service calls → DB queries. Reveals the full path; you can pinpoint which step fails.

## When to fall back to grep / Read

Graph tools require an indexed repo. If the index is stale or missing:

```bash
# Re-index
npx gitnexus analyze .
```

If gitnexus isn't installed at all:
- Use `Grep` / `Glob` (text search; misses dynamic dispatches)
- Use IDE features ("Find references" in VS Code / IntelliJ)
- Use `grep -rn "<name>"` with care — same name in unrelated files is noise

## Tracing changes that broke something

Combine bisect + graph:

1. Bisect to commit X that introduced the bug → see [bisection.md](bisection.md)
2. `git show X --stat` → list of changed files
3. For each changed function in those files: `impact({ target: <fn>, direction: "upstream" })`
4. Cross-reference impact list with where the symptom appears
5. Match → that's the broken caller; that's where to focus the fix

## Symptoms that scream "use the graph"

| Symptom | Action |
|---|---|
| "I changed X but Y broke" | `impact(X, upstream)` — is Y in the list? Then yes, you broke a caller. |
| "I refactored, now type errors" | `find_referencing_symbols` on the renamed/changed type — get exact caller list |
| "This value comes from somewhere unexpected" | `find_referencing_symbols` filtered to writes |
| "Search by name returns 50 unrelated hits" | `find_symbol` (definition only) or `query` (semantic) — graph distinguishes definitions from text-mentions |
| "I want to understand the whole module" | `context(module_path)` returns AST + relationships in one call |

## Anti-patterns

- **Grepping when graph is available** — graph is faster, more accurate, knows ASTs
- **Searching without indexing first** — if graph index is stale, gitnexus_impact returns stale results
- **Trusting the graph without verifying** — if hand-modified code makes index drift, verify hits with Read on the actual file
- **Using graph for files that don't exist yet** — if you're planning new code, the graph can't see what hasn't been written

## Maintenance

```bash
# Health check
mcp__gitnexus__list_repos

# Reanalyse (after pulling main, after big refactor)
npx gitnexus analyze .

# Detect drift
mcp__gitnexus__detect_changes
```

If FTS warnings appear in Bash output, ignore them — the AST graph and FTS are separate; `impact` works even when FTS is stale.

## Graph + tracing combined (advanced)

The trace shows you which span errored (runtime info). The graph shows you which code path was taken (static info). Combining:

1. Trace: `payments.charge` errored on span X at 12:00:42
2. Graph: `route_map(POST, /api/checkout)` → checkout → orders.create → payments.charge (matches the span)
3. Graph: `impact(payments.charge, downstream)` → reveals it calls `cloudpayments.client.charge` → that's where the actual error originates
4. Logs: filter to that service + that timestamp → root cause appears

Use this combination for production-only bugs where you need both "where in code" (graph) and "what happened at runtime" (trace+logs).
