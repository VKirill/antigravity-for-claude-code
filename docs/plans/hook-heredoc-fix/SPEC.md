# SPEC — fix heredoc false-positive in guard-orchestrator-agy-no-source-read.sh

## Root cause

The hook scans the entire raw Bash CMD with a single line-oriented
`grep -iE` over a regex. `grep` processes the CMD line-by-line. When the
orchestrator inserts a YAML task contract via a heredoc, every interior
line of that heredoc is treated as an independent command string. Lines
containing reader-like tokens (`cat`, `grep`, ...) followed by a path
with a source extension match the regex and the entire `task insert` is
denied. The YAML body is *data*, not a command — only the outer pipeline
should be inspected.

Second class of the same bug: the regex is case-insensitive (`grep -iE`),
so the git ref token `HEAD` matches the `head` reader and `git diff HEAD`
pipelines get denied too.

## Chosen approach

Replace the regex scan with structural parsing, mirroring the sibling
`scripts/guard-dangerous-bash.sh` (already in the repo and known-correct).
Inline-call `python3` to:

1. Split CMD into shell segments by operators (`&&`, `||`, `;`, `|`).
2. Tokenize each segment with `shlex.split` (handles quoting + heredoc
   bodies as a single multi-line token).
3. Inspect ONLY the command name (`segment[0]`) and its positional
   arguments (`segment[1:]`), NOT the body of any heredoc passed via stdin.
4. Deny iff `segment[0]` is in the reader list AND one of `segment[1:]`
   matches the source-extension regex.
5. On parse error → fail-open (exit 0).

## Observable outcomes

- Heredoc with YAML body containing reader+source-ext literals → ALLOW (was DENY)
- `git diff HEAD -- file | head -5` → ALLOW (was DENY — case-insensitive false positive)
- Standalone reader on a source file → DENY (unchanged)
- Pipeline reader on a source file → DENY (unchanged)
- `task list | grep done` → ALLOW (unchanged)
- `git diff -- file` → ALLOW (unchanged)
- Read of source file → DENY (Read branch unchanged)
- Non-orchestrator agent → ALLOW (early-return unchanged)

## Touched files

- `scripts/guard-orchestrator-agy-no-source-read.sh` — Bash branch only
- `scripts/guard-orchestrator-agy-no-source-read.test.ts` — new, 8 cases

## Verification

`bun test scripts/guard-orchestrator-agy-no-source-read.test.ts` — 8/8 pass.

## Known tradeoffs (from reviewer)

- **Medium**: wrapped reader commands (xargs/eval/bash -c wrappers) bypass
  the new logic because shlex sees the wrapper as argv[0]. The old regex
  caught some by accident. Accepted: orchestrator does not construct such
  commands; threat model is "accidental peek", not "active evasion".
- **Low**: dead code in the deny condition (a check that is unreachable
  given the current reader set).

## Backlog (not in scope)

- Address the wrapper bypass with a recursive parse or a fallback regex.
- Remove the dead-code check.
- Extract a shared lib/hook-common.sh for the two guard hooks.
- Apply the same shlex-based fix shape to guard-dangerous-bash.sh if its
  similar (milder) false-positive starts to bite.
