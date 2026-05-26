# SPEC — orchestrator hook backlog cleanup

Follow-up to `docs/plans/hook-heredoc-fix/SPEC.md` (commit f1d5adb).

Three items in the prior SPEC's backlog, decomposed into two parallel
contracts (disjoint files).

## Contract A — no-source-read.sh: wrapper bypass + dead code

Closes ITEMS 1 + 2 from the prior backlog.

After the shlex refactor, the hook only inspects `argv[0]` of each
pipeline segment. Wrapped readers slip through:
- `xargs cat src/foo.ts`        (argv[0] = xargs)
- `bash -c "cat src/foo.ts"`    (argv[0] = bash)
- `sh -c 'grep TODO src/foo.ts'`(argv[0] = sh)
- `eval 'cat src/foo.ts'`       (argv[0] = eval)
- `find . -name '*.ts' -exec cat {} \;` (argv[0] = find)
- `env FOO=bar cat src/foo.ts`  (argv[0] = env)

Fix: a second pass — for each segment whose `argv[0]` is a WRAPPER
(bash/sh/zsh/ksh/xargs/eval/env/sudo/exec/find), scan `argv[1:]` for
source-ext tokens; deny on first hit.

Also remove the unreachable `and argv0 != 'git'` clause (`git` is not
in `readers`).

## Contract B — dangerous-bash.sh: per-segment scan (vendor first)

Closes ITEM 3.

`guard-dangerous-bash.sh` currently lives ONLY at
`~/.claude/hooks/guard-dangerous-bash.sh` — no project-local copy.

Step 1: vendor it into `scripts/guard-dangerous-bash.sh` (this repo's
established pattern, parallels `guard-orchestrator-agy-no-source-read.sh`).

Step 2: SAFE_CMDS branch — byte-for-byte unchanged (correct as-is).

Step 3: Replace the four post-fallthrough `case "$UPPER"` / `case "$CMD"`
blocks (SQL DROP, TRUNCATE, DELETE-without-WHERE, rm -rf, git push --force)
with a single Python segment-walk that:
- shlex-tokenizes CMD, splits by OPS into segments;
- per segment, slices `argv[1:idx_of_first_<<]` (excludes command name
  AND heredoc body tokens);
- joins-and-uppercases the slice;
- applies the existing SQL globs on that scoped string;
- for rm-rf and git-push, joins `segment[:]` (command name matters) and
  re-applies the existing whitelist case-glob byte-for-byte.

All `block()` calls + original deny message strings preserved byte-for-byte.
Fail-open on shlex parse error preserved.

## Path correction (acknowledged)

The planning request named both hooks under `scripts/`, but only one was
actually there. Vendor + test in repo; manual `cp` to runtime by the
orchestrator post-commit. install-hooks.cjs untouched (future contract).

## Parallel batch

Two contracts, disjoint files, no dependencies, both `risk_class: medium`
(not high), so they run in one parallel batch (MAX_PARALLEL = 3, only
using 2 slots).

## Tradeoffs

- Wrapper detection is one level deep. `bash -c "bash -c \"cat src/x.ts\""`
  (nested) still slips. Accepted: same threat model as before — accidental
  PM peek, not active evasion.
- `bash -c 'CMD="cat src/foo.ts"; echo done'` (source-ext literal inside
  an inert string) → DENIES. Accepted contrived false-positive.
