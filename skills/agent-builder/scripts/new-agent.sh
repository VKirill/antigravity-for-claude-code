#!/bin/bash
# new-agent.sh
# Scaffold a new agent file from a template, place it in ~/.claude/agents/
#
# Usage:
#   ./scripts/new-agent.sh <agent-name> <template>
#
# Templates:
#   verifier     — generic verifier (default)
#   architect    — memory-keeping architect
#   explorer     — deep semantic explorer (MCP-backed)
#   orchestrator — main-thread orchestrator
#
# Example:
#   ./scripts/new-agent.sh schema-verifier verifier
#   ./scripts/new-agent.sh treba-architect architect

set -euo pipefail

AGENT_NAME="${1:-}"
TEMPLATE="${2:-verifier}"

if [ -z "$AGENT_NAME" ]; then
  echo "Usage: $0 <agent-name> [template]" >&2
  echo "" >&2
  echo "Templates: verifier (default), architect, explorer, orchestrator" >&2
  exit 1
fi

# Validate name: lowercase, hyphens, max 64 chars
if ! echo "$AGENT_NAME" | grep -qE '^[a-z][a-z0-9-]{0,63}$'; then
  echo "Error: agent name must be lowercase letters/numbers/hyphens, start with letter, max 64 chars" >&2
  echo "Got: '$AGENT_NAME'" >&2
  exit 1
fi

# Resolve template file
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

case "$TEMPLATE" in
  verifier)     TEMPLATE_FILE="$SKILL_DIR/templates/verifier-generic.md.template" ;;
  architect)    TEMPLATE_FILE="$SKILL_DIR/templates/memory-keeping-architect.md.template" ;;
  explorer)     TEMPLATE_FILE="$SKILL_DIR/templates/explorer-deep.md.template" ;;
  orchestrator) TEMPLATE_FILE="$SKILL_DIR/templates/orchestrator-main-agent.md.template" ;;
  *)
    echo "Error: unknown template '$TEMPLATE'" >&2
    echo "Available: verifier, architect, explorer, orchestrator" >&2
    exit 1
    ;;
esac

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: template file not found: $TEMPLATE_FILE" >&2
  exit 1
fi

# Check name uniqueness across scopes
DEST="$HOME/.claude/agents/${AGENT_NAME}.md"
PROJECT_DEST=".claude/agents/${AGENT_NAME}.md"

if [ -f "$DEST" ]; then
  echo "Error: $DEST already exists" >&2
  exit 1
fi

if [ -f "$PROJECT_DEST" ]; then
  echo "Warning: $PROJECT_DEST exists in current project" >&2
  echo "Project-scope agent will shadow user-scope. Continue? [y/N]" >&2
  read -r CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

# Check name collision in other user-scope files
EXISTING=$(grep -l "^name: $AGENT_NAME$" "$HOME/.claude/agents/"*.md 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "Error: agent name '$AGENT_NAME' already used in:" >&2
  echo "$EXISTING" >&2
  echo "Choose a different name or rename existing." >&2
  exit 1
fi

# Ensure target dir
mkdir -p "$HOME/.claude/agents"

# Copy template, substitute name placeholder
sed "s/<verifier-name>/$AGENT_NAME/g; s/<project>-architect/$AGENT_NAME/g; s/<domain>-explorer/$AGENT_NAME/g; s/<project>-orchestrator/$AGENT_NAME/g" "$TEMPLATE_FILE" > "$DEST"

echo "Created: $DEST"
echo ""
echo "Next steps:"
echo "  1. Open $DEST and fill in placeholders:"
echo "     - description (role + concrete action + 'use proactively' + trigger terms)"
echo "     - skills: preload list (verify names exist in ~/.claude/skills/)"
echo "     - body: domain-specific checks, output format, standing rules"
echo "  2. Restart Claude Code (on-disk creates aren't live-reloaded)"
echo "  3. Test with: @agent-$AGENT_NAME <test prompt>"
echo "  4. Once @-mention works, test auto-delegation with a natural-language prompt"
echo ""
echo "Reference:"
echo "  - $SKILL_DIR/references/description-engineering.md (for the description field)"
echo "  - $SKILL_DIR/references/recommended-defaults.md (for frontmatter values)"
echo "  - $SKILL_DIR/references/anti-patterns.md (what to avoid)"
