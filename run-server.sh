#!/bin/bash
# Per-PROJECT isolated home for the MCP Antigravity instance, stored INSIDE the
# project at <project>/.gemini_mcp/ — keeps each project's agy state (conversations,
# history) next to its code and avoids cluttering ~ with opaque hashed dirs.
# Capture the project directory BEFORE sourcing profiles (which could cd).
PROJECT_DIR="$(pwd)"
export MCP_HOME="$PROJECT_DIR/.gemini_mcp"
mkdir -p "$MCP_HOME/.gemini/antigravity-cli/conversations"

# Self-protecting ignore: make git in ANY host project ignore the whole state dir
# (conversations/.pb, history.jsonl, scratch/node_modules can be large/sensitive).
# This does not touch the host project's own root .gitignore.
if [ ! -f "$MCP_HOME/.gitignore" ]; then
  printf '*\n' > "$MCP_HOME/.gitignore"
fi

# Share credentials/config (read-only) from the main home; isolate conversations/history.
ln -sf /home/ubuntu/.gemini/antigravity-cli/antigravity-oauth-token "$MCP_HOME/.gemini/antigravity-cli/antigravity-oauth-token"
ln -sf /home/ubuntu/.gemini/antigravity-cli/settings.json "$MCP_HOME/.gemini/antigravity-cli/settings.json"
ln -sf /home/ubuntu/.gemini/antigravity-cli/installation_id "$MCP_HOME/.gemini/antigravity-cli/installation_id"
ln -sf /home/ubuntu/.gemini/antigravity-cli/keybindings.json "$MCP_HOME/.gemini/antigravity-cli/keybindings.json"

# Load user environment variables
if [ -f /home/ubuntu/.profile ]; then
    source /home/ubuntu/.profile
fi
if [ -f /home/ubuntu/.bashrc ]; then
    source /home/ubuntu/.bashrc
fi

# Override HOME so the spawned agy CLI uses the isolated config/state paths
export HOME="$MCP_HOME"

# Run the server via Bun (from the project dir, so agy edits the right project)
cd "$PROJECT_DIR"
exec bun run /home/ubuntu/tools/antigravity-for-claude-code/src/index.ts
