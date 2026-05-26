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
    toks = shlex.split(cmd, posix=True)
    ops = {"&&", "||", ";", "|"}
    segs = [[]]
    for t in toks:
        if t in ops:
            segs.append([])
        else:
            segs[-1].append(t)
    readers = {"cat", "sed", "awk", "head", "tail", "less", "more", "bat", "view", "grep", "egrep", "fgrep", "rg"}
    WRAPPERS = {"bash","sh","zsh","ksh","xargs","eval","env","sudo","exec","find"}
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
        elif argv0 in WRAPPERS:
            for arg in s[1:]:
                if src_pattern.search(arg):
                    print("DENY"); sys.exit(1)
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
