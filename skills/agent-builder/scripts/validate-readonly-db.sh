#!/bin/bash
# validate-readonly-db.sh
# Companion script for agents/db-reader.md
# Blocks SQL writes and Redis writes; allows reads.
#
# Install path: copy to <your-project>/.claude/scripts/validate-readonly-db.sh
# Make executable: chmod +x .claude/scripts/validate-readonly-db.sh
#
# Tested against: Claude Code 2.1.x PreToolUse hook input schema (May 2026)
# Reference: https://code.claude.com/docs/en/hooks#pretooluse-input
#
# KNOWN LIMITATION: this script does word-boundary grep against the whole command string.
# That means SQL keywords appearing inside string literals (e.g., SELECT comment WHERE comment LIKE '%UPDATE%')
# will be flagged as writes. This is an intentional false-positive tradeoff — better to block
# a legitimate query than to let a real write through. If this bites you in practice, escape
# the keyword in the query or run that specific query outside the agent.

set -euo pipefail

INPUT=$(cat)

# Extract .tool_input.command from JSON.
# Prefer jq if available (cleaner), fall back to Python (almost always available on dev machines),
# fall back to sed (last resort, fragile against escaped quotes in the command but works for typical cases).
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
elif command -v python3 >/dev/null 2>&1; then
  COMMAND=$(echo "$INPUT" | python3 -c 'import sys, json; d = json.load(sys.stdin); print(d.get("tool_input", {}).get("command", ""))')
elif command -v python >/dev/null 2>&1; then
  COMMAND=$(echo "$INPUT" | python -c 'import sys, json; d = json.load(sys.stdin); print(d.get("tool_input", {}).get("command", ""))')
else
  # Last-resort sed extraction. This is fragile — if your project has neither jq nor python,
  # install jq: `brew install jq` (macOS) or `apt install jq` (Linux).
  COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)
fi

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ---- PostgreSQL write detection ----
# Case-insensitive, word-boundary match.
# Matches keywords even inside `psql -c "..."` invocations because we grep
# against the whole command string.
if echo "$COMMAND" | grep -iqE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE)\b'; then
  echo "Blocked: SQL write operations (INSERT/UPDATE/DELETE/DROP/CREATE/ALTER/TRUNCATE/REPLACE/MERGE/GRANT/REVOKE) not allowed." >&2
  echo "Use SELECT, EXPLAIN, or PostgreSQL system queries only." >&2
  exit 2
fi

# Block stored procedure execution (may contain writes)
if echo "$COMMAND" | grep -iqE '\b(CALL|EXEC|EXECUTE)\b' && echo "$COMMAND" | grep -qE 'psql|postgres'; then
  echo "Blocked: stored procedure execution may contain writes — not allowed." >&2
  exit 2
fi

# COPY ... TO/FROM — both directions touch the filesystem and can leak/import data
if echo "$COMMAND" | grep -iqE '\bCOPY\b.*\bFROM\b|\bCOPY\b.*\bTO\b'; then
  echo "Blocked: COPY operations not allowed (filesystem read/write)." >&2
  exit 2
fi

# ---- Redis write detection ----
# Look for redis-cli invocations with write commands.
# `redis-cli SET foo bar` or `redis-cli -h host SET foo bar` etc.
if echo "$COMMAND" | grep -qE 'redis-cli'; then
  # Extract everything after redis-cli for analysis
  if echo "$COMMAND" | grep -iqE 'redis-cli[^|;]*\b(SET|DEL|UNLINK|EXPIRE|EXPIREAT|PEXPIRE|PEXPIREAT|PERSIST|RENAME|RENAMENX|FLUSHDB|FLUSHALL|HSET|HDEL|HMSET|HSETNX|LPUSH|RPUSH|LPOP|RPOP|LSET|LREM|LTRIM|LINSERT|SADD|SREM|SPOP|SMOVE|ZADD|ZREM|ZINCRBY|ZPOPMIN|ZPOPMAX|XADD|XDEL|XTRIM|MIGRATE|DEBUG|CONFIG\s+SET|CLIENT\s+KILL|SCRIPT\s+FLUSH|SLAVEOF|REPLICAOF|SHUTDOWN|BGSAVE|SAVE|BGREWRITEAOF|MULTI|EXEC|DISCARD|EVAL|EVALSHA|FUNCTION)\b'; then
    echo "Blocked: Redis write command not allowed." >&2
    echo "Allowed: GET, MGET, HGETALL, HGET, HMGET, LRANGE, LINDEX, LLEN, SMEMBERS, SCARD, SISMEMBER, ZRANGE, ZSCORE, ZCARD, ZCOUNT, KEYS (avoid in prod), SCAN, HSCAN, SSCAN, ZSCAN, INFO, DBSIZE, TYPE, TTL, EXISTS, OBJECT, MEMORY USAGE." >&2
    exit 2
  fi
fi

# ---- Dangerous shell patterns that could exfiltrate data ----
# Block writing query results to disk via redirect operators that touch sensitive paths.
# This is intentionally conservative — refine if it interferes with legitimate workflows.
if echo "$COMMAND" | grep -qE '>\s*/etc/|>\s*~/\.ssh|>\s*\.env'; then
  echo "Blocked: write redirect to sensitive path detected." >&2
  exit 2
fi

# Default: allow
exit 0
