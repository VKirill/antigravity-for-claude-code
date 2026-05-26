# Round-3 hook backlog cleanup — SPEC

## Goal

Close 4 reviewer-flagged items on the two guard hooks shipped in d0e1e03 + 42efb4d
without changing observable behaviour outside the bypass cases they describe.

## Items

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | medium | no-source-read.sh | `find … -exec cat {} \;` — bare `;` token splits the find segment; wrapper-scan misses post-`;` args |
| 2 | medium | dangerous-bash.sh | `shlex posix=True` strips quotes during heredoc-marker detection; `echo "<<EOF"` looks like a real marker |
| 3 | low | no-source-read.sh | `WRAPPERS` UPPER vs `readers` lower — rename for consistency |
| 4 | low | no-source-read.sh | `print("DENY"); sys.exit(1)` one-liner vs two-line style above — reformat |

## Fix shapes

### Contract A (items 1+3+4)
- ITEM 1: post-loop merge — when a bare `;` token would otherwise start a new
  segment AND the current in-progress segment starts with `find`, append `;` to
  the current segment instead. Picks the simplest of three planner-evaluated
  options. Doesn't change OPS semantics for non-find commands.
- ITEM 3: rename `WRAPPERS → wrappers` (consistency with `readers`).
- ITEM 4: split one-liner into two-line style.

### Contract B (item 2)
- Switch ONE line: `tokens = shlex.split(line, posix=False)` in `strip_heredocs`.
- With posix=False, `"<<EOF"` keeps its quotes → token starts with `"`, not `<<`
  → no false detection. Unquoted `<<EOF` still tokenizes bare.
- Body-scan tokenization (the OTHER shlex call, posix=True) is preserved — quoted
  argv still tokenizes correctly for DROP/DELETE detection.

## Tests added

- Contract A: test p (`find . -type f -exec cat {} \; -print` → DENY) +
  test q (`find . -type d` → ALLOW; no over-fire).
- Contract B: test t13 (the bypass case → DENY) + test t14 (real heredoc
  with DROP TABLE body → ALLOW; regression guard) + test t15 (standalone
  `echo '<<EOF'` → ALLOW).

## Parallel

Two contracts, disjoint files, both risk_class: low, run in one batch.

## Tradeoffs

- Contract A only handles `find -exec` form; `xargs -exec` style isn't
  affected (xargs has its own wrapper branch already).
- Contract B: `posix=False` keeps quotes on tokens — fine for line-level
  marker scan; whitespace-in-quotes nuance doesn't apply.
