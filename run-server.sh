#!/bin/bash
# Per-PROJECT isolated home for the MCP Antigravity instance, stored OUTSIDE the project
# tree under the XDG cache. Keeping agy state out of the workspace prevents the agent's
# own logs/conversation cache from being slurped back into its context during codebase
# search (agy does not reliably honor .gitignore), while still isolating concurrent
# sessions per project. One dir per project — no dotfile clutter in $HOME root.
# Capture the project directory + real home BEFORE sourcing profiles / overriding HOME.
PROJECT_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_BASE="${XDG_CACHE_HOME:-$HOME/.cache}"
REAL_GEMINI="$HOME/.gemini/antigravity-cli"
PROJECT_KEY="$(printf '%s' "$PROJECT_DIR" | sha1sum | cut -c1-12)"

export MCP_HOME="$CACHE_BASE/antigravity-mcp/$PROJECT_KEY"
mkdir -p "$MCP_HOME/.gemini/antigravity-cli/conversations"

# Share credentials/config (read-only) from the main home; isolate conversations/history.
ln -sf "$REAL_GEMINI/antigravity-oauth-token" "$MCP_HOME/.gemini/antigravity-cli/antigravity-oauth-token"
ln -sf "$REAL_GEMINI/settings.json"           "$MCP_HOME/.gemini/antigravity-cli/settings.json"
ln -sf "$REAL_GEMINI/installation_id"         "$MCP_HOME/.gemini/antigravity-cli/installation_id"
ln -sf "$REAL_GEMINI/keybindings.json"        "$MCP_HOME/.gemini/antigravity-cli/keybindings.json"

# Load user environment variables
if [ -f "$HOME/.profile" ]; then
    source "$HOME/.profile"
fi
if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

# Override HOME so the spawned agy CLI uses the isolated config/state paths
export HOME="$MCP_HOME"

# Run the server via Bun (from the project dir, so agy edits the right project)
cd "$PROJECT_DIR"
exec bun run "$SCRIPT_DIR/src/index.ts"
