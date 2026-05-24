#!/bin/bash
# Per-PROJECT isolated home for the MCP Antigravity instance.
# Capture the project directory BEFORE sourcing profiles (which could cd).
PROJECT_DIR="$(pwd)"
PROJECT_KEY="$(printf '%s' "$PROJECT_DIR" | sha1sum | cut -c1-12)"

# Each project gets its own agy state dir so concurrent sessions on DIFFERENT
# projects do not share conversations/history (no TASK-NNN conversationId
# collisions, no getNewestConversationId races, no cross-project context bleed).
# NOTE: the Gemini account/OAuth is still shared (one account = one rate-limit pool).
export MCP_HOME="/home/ubuntu/.gemini_mcp/$PROJECT_KEY"
mkdir -p "$MCP_HOME/.gemini/antigravity-cli/conversations"

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
