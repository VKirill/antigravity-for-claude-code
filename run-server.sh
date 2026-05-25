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

# Per-SESSION home: PROJECT_KEY + this server's PID. Two Claude sessions in the SAME
# folder no longer share a conversations store (getNewestConversationId can't grab
# another session's conversation). $$ survives the `exec bun` below (same PID).
export MCP_HOME="$CACHE_BASE/antigravity-mcp/$PROJECT_KEY-$$"
# Best-effort GC: drop stale per-session homes for this project whose process is gone.
for d in "$CACHE_BASE/antigravity-mcp/$PROJECT_KEY"-*; do
  [ -d "$d" ] || continue
  pid="${d##*-}"
  case "$pid" in (*[!0-9]*) continue ;; esac
  kill -0 "$pid" 2>/dev/null || rm -rf "$d"
done
mkdir -p "$MCP_HOME/.gemini/antigravity-cli/conversations"

# Share credentials/config (read-only) from the main home; isolate conversations/history.
ln -sf "$REAL_GEMINI/antigravity-oauth-token" "$MCP_HOME/.gemini/antigravity-cli/antigravity-oauth-token"
ln -sf "$REAL_GEMINI/settings.json"           "$MCP_HOME/.gemini/antigravity-cli/settings.json"
ln -sf "$REAL_GEMINI/installation_id"         "$MCP_HOME/.gemini/antigravity-cli/installation_id"
ln -sf "$REAL_GEMINI/keybindings.json"        "$MCP_HOME/.gemini/antigravity-cli/keybindings.json"

# MCP servers for the agy worker. WITHOUT this, agy under the isolated $MCP_HOME has ZERO
# MCP tools — so planners/coders can't call gitnexus_query/serena and waste time scanning
# the filesystem to "find the project path". We propagate ONLY the set the workers actually
# reference (gitnexus + serena + postgres + perplexity), NOT the heavy unrelated stdio
# servers (github/tavily/vue-docs/open-design/…) that would slow per-job startup. The first
# three are HTTP (serverURL+headers) → agy just connects to the already-running localhost
# servers; nothing re-indexes the home dir. Extracted at runtime so the bearer token never
# lands in this repo. Fallback to symlinking the full config if jq is unavailable.
WORKER_MCP_CFG="$MCP_HOME/.gemini/antigravity-cli/mcp_config.json"
if command -v jq >/dev/null 2>&1 && [ -f "$REAL_GEMINI/mcp_config.json" ]; then
  jq '{mcpServers: (.mcpServers | {gitnexus, serena, postgres, perplexity} | with_entries(select(.value != null)))}' \
     "$REAL_GEMINI/mcp_config.json" > "$WORKER_MCP_CFG" 2>/dev/null \
   || ln -sf "$REAL_GEMINI/mcp_config.json" "$WORKER_MCP_CFG"
else
  ln -sf "$REAL_GEMINI/mcp_config.json" "$WORKER_MCP_CFG"
fi

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
