#!/bin/bash
# Simple bash script to test Antigravity MCP debate tool directly from terminal

SERVER_PATH="../../dist/index.js"

if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: built server not found at $SERVER_PATH"
  echo "Please run 'npm run build' in the root directory first."
  exit 1
fi

echo "Simulating a quick architectural debate via Antigravity MCP..."
echo "Topic: 'Should we replace our custom task scheduler with BullMQ?'"
echo "------------------------------------------------------------------"

# JSON-RPC payloads for:
# 1. initialize
# 2. tools/call (run_debate_deliberation)
# We send them sequentially to the server process stdio
(
  echo '{"jsonrpc":"2.0","method":"initialize","params":{"clientInfo":{"name":"bash-client","version":"1.0"},"protocolVersion":"2024-11-05"},"id":1}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"run_debate_deliberation","arguments":{"topic":"Should we replace our custom task scheduler with BullMQ?","rounds":1}},"id":2}'
) | node "$SERVER_PATH" | grep -o '"text":"[^"]*"' | sed 's/"text":"//;s/"//' | sed 's/\\n/\
/g' | sed 's/\\t/  /g'
