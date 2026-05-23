#!/bin/bash
# Create isolated home directory for the MCP Antigravity instance
export MCP_HOME="/home/ubuntu/.gemini_mcp"
mkdir -p "$MCP_HOME/.gemini/antigravity-cli/conversations"

# Link configuration and credentials from the main home directory
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

# Run the server via Bun
exec bun run /home/ubuntu/tools/antigravity-for-claude-code/server.ts
