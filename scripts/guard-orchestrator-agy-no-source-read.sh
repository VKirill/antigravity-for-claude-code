#!/usr/bin/env bash
# PreToolUse guard: dev-orchestrator-agy (project manager) MUST NOT read source code.
# Blocks `Read` of source files and `Bash` source-reading commands (cat/grep/sed/... on
# *.ts/*.py/...). Code/symbol/graph discovery is delegated to worker-planner.
#
# Rationale: the PM reading code "by hand" is exactly what makes it miss files. The
# prompt says "don't"; this hook enforces it under pressure.
#
# Fail-open: any other agent (incl. workers), missing fields, or uncertainty → allowed.

set -eu

INPUT=$(cat)

AGENT=$(printf '%s' "$INPUT" | jq -r '.agent_type // empty' 2>/dev/null || true)
TOOL=$(printf '%s'  "$INPUT" | jq -r '.tool_name  // empty' 2>/dev/null || true)

# Only guard the agy orchestrator. Every other agent (workers, plain Claude) reads freely.
[ "$AGENT" = "dev-orchestrator-agy" ] || exit 0

# Clear source-code extensions (docs *.md, config *.json/*.yml, logs, .claude/* are allowed).
SRC='ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|rb|php|vue|svelte|astro|sql|prisma|css|scss|c|cpp|h|hpp|kt|swift'

REASON='[guard-orchestrator-agy] You are the project manager — you do NOT read source code. Delegate discovery to worker-planner (depth: express for a quick file map, depth: full for a feature). Reading code yourself is exactly what causes missed files. Docs (*.md), config manifests, and logs are allowed.'

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 2
}

case "$TOOL" in
  Read)
    FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
    [ -z "$FILE" ] && exit 0
    if printf '%s' "$FILE" | grep -qiE "\.($SRC)\$"; then
      deny "$REASON  (Tried to Read: $FILE)"
    fi
    exit 0
    ;;
  Bash)
    CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
    [ -z "$CMD" ] && exit 0
    RESULT=$(CMD="$CMD" SRC="$SRC" python3 -c '
import os, sys, re, shlex
try:
    cmd = os.environ.get("CMD", "")
    # Newline acts as a statement separator in bash, but shlex.split treats it as
    # plain whitespace and would bleed the next statements args into the previous
    # ones argv list (e.g. `git status | head -15\ngit add foo.ts` parses as
    # `head -15 git add foo.ts`, falsely flagging `head` as reading source).
    # Normalise to `;` before splitting. Safe because newlines inside double
    # quotes / $() are preserved by shlex as part of a single quoted token, so
    # heredocs embedded in `git commit -m "$(cat <<EOF ... EOF)"` are unaffected.
    cmd = cmd.replace("\n", " ; ")
    # Bash also lets `;` `|` glue directly to adjacent words (`head -30;` is two
    # commands). shlex parses `-30;` as a single token, so the operator never
    # appears as its own element and per-segment scan collapses both statements
    # into one (`head` ends up owning the rest of the line, including .ts args).
    # Pad ops with surrounding spaces so they tokenise standalone. Order:
    # double-char ops first (so we do not break `&&` / `||` into two `&`/`|`),
    # then single `|` left over (only when not part of `||`), then `;`.
    cmd = cmd.replace("&&", " && ").replace("||", " || ")
    cmd = re.sub(r"(?<!\|)\|(?!\|)", " | ", cmd)
    cmd = cmd.replace(";", " ; ")
    toks = shlex.split(cmd, posix=True)
    ops = {"&&", "||", ";", "|"}
    segs = [[]]
    for t in toks:
        if t == ";" and segs[-1] and segs[-1][0] == "find":
            segs[-1].append(t)
        elif t in ops:
            segs.append([])
        else:
            segs[-1].append(t)
    readers = {"cat", "sed", "awk", "head", "tail", "less", "more", "bat", "view", "grep", "egrep", "fgrep", "rg"}
    wrappers = {"bash","sh","zsh","ksh","xargs","eval","env","sudo","exec","find"}
    src = os.environ.get("SRC", "")
    src_pattern = re.compile(r"\.(" + src + r")$", re.IGNORECASE)
    for s in segs:
        if not s:
            continue
        argv0 = s[0]
        if argv0 in readers:
            for arg in s[1:]:
                if src_pattern.search(arg):
                    print("DENY")
                    sys.exit(1)
        elif argv0 in wrappers:
            for arg in s[1:]:
                if src_pattern.search(arg):
                    print("DENY")
                    sys.exit(1)
except Exception:
    sys.exit(0)
' 2>/dev/null || true)
    if [ "$RESULT" = "DENY" ]; then
      deny "$REASON  (Tried to read source via Bash: $CMD)"
    fi
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
