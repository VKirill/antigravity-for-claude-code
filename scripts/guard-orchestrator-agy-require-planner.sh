#!/usr/bin/env bash
# PreToolUse guard: dev-orchestrator-agy MUST run a discovery pass (worker-planner)
# before inserting an implementation contract (worker-coder / worker-frontend).
# Even a single new isolated file is the planner's call — it decides WHERE the file
# lives and HOW it is wired into the project. This enforces discovery-first under
# autonomy (the PM was observed self-composing trivial contracts and skipping it).
#
# Fail-open: any other agent, non-`task insert` command, a planner/other-assignee
# contract, or any uncertainty → allowed.

set -eu

INPUT=$(cat)

AGENT=$(printf '%s' "$INPUT" | jq -r '.agent_type   // empty' 2>/dev/null || true)
TOOL=$(printf '%s'  "$INPUT" | jq -r '.tool_name     // empty' 2>/dev/null || true)
[ "$AGENT" = "dev-orchestrator-agy" ] || exit 0
[ "$TOOL"  = "Bash" ] || exit 0

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
[ -z "$CMD" ] && exit 0

# Only guard `task insert` of an IMPLEMENTATION contract (coder/frontend).
printf '%s' "$CMD" | grep -q "task insert" || exit 0
printf '%s' "$CMD" | grep -qE "assignee_agent:[[:space:]]*\"?(worker-coder|worker-frontend)\"?" || exit 0

CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$CWD" ] && CWD=$(pwd)
JOBS="$CWD/.claude/jobs"

# Did a worker-planner discovery job run in this project? (its prompt.txt carries
# the worker-planner instruction header.)
if grep -rqs "worker-planner" "$JOBS" 2>/dev/null; then
  exit 0
fi

jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"[guard-orchestrator-agy] Dispatch worker-planner (depth: express for trivial, depth: full for a feature) BEFORE inserting a worker-coder/worker-frontend contract. Even a single new file is the planner job: it decides where the file lives and how it is wired into the project. Run the planner discovery, then insert the contract it returns."}}'
exit 2
