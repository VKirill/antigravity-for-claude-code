#!/bin/bash
# eval-routing.sh
# Print routing eval cases for this skill — used for manual verification
# that auto-delegation works as expected.
#
# Usage:
#   ./scripts/eval-routing.sh                 # print all cases
#   ./scripts/eval-routing.sh positive        # print only positive
#   ./scripts/eval-routing.sh negative        # print only negative
#   ./scripts/eval-routing.sh edge            # print only edge

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
EVAL_FILE="$SKILL_DIR/references/eval-cases.md"

if [ ! -f "$EVAL_FILE" ]; then
  echo "Error: $EVAL_FILE not found" >&2
  exit 1
fi

FILTER="${1:-all}"

case "$FILTER" in
  all)
    cat "$EVAL_FILE"
    ;;
  positive)
    awk '/^## Positive/,/^## Negative/' "$EVAL_FILE" | head -n -1
    ;;
  negative)
    awk '/^## Negative/,/^## Edge cases/' "$EVAL_FILE" | head -n -1
    ;;
  edge)
    awk '/^## Edge cases/,/^## How to verify/' "$EVAL_FILE" | head -n -1
    ;;
  *)
    echo "Usage: $0 [all|positive|negative|edge]" >&2
    exit 1
    ;;
esac

echo ""
echo "---"
echo "How to use these cases manually:"
echo "  1. Start a fresh Claude Code session with this skill installed at ~/.claude/skills/agent-builder/"
echo "  2. For each Positive prompt: paste it, confirm agent-builder activates and loads expected refs"
echo "  3. For each Negative prompt: paste it, confirm agent-builder does NOT activate"
echo "  4. For each Edge case: confirm cross-link mentioned in 'Resolution' column appears"
echo ""
echo "If routing is wrong:"
echo "  - Negative → Positive (false trigger): tighten SKIP rules in SKILL.md description"
echo "  - Positive → Negative (missed trigger): add trigger term to description"
echo "  - Edge wrong: enrich 'Related Skills' cross-links section of SKILL.md"
