#!/usr/bin/env bash
# scripts/validate-webhook.sh
# POST a synthetic Telegram update to a local webhook server and verify:
#   1. HTTP 200 response when secret_token is correct
#   2. HTTP 401 response when secret_token is missing or wrong
#
# Usage:
#   ./validate-webhook.sh [OPTIONS]
#
# Options:
#   --url      Webhook URL (default: http://localhost:3000/webhook)
#   --secret   WEBHOOK_SECRET value (default: reads from $WEBHOOK_SECRET env var)
#   --chat-id  Chat ID to use in the synthetic update (default: 12345678)
#
# Example:
#   WEBHOOK_SECRET=mysecret ./validate-webhook.sh
#   ./validate-webhook.sh --url http://localhost:3001/webhook --secret mytoken

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3000/webhook}"
SECRET="${WEBHOOK_SECRET:-}"
CHAT_ID="${TEST_CHAT_ID:-12345678}"

# ─── Argument parsing ─────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)    WEBHOOK_URL="$2"; shift 2 ;;
    --secret) SECRET="$2";      shift 2 ;;
    --chat-id) CHAT_ID="$2";   shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$SECRET" ]]; then
  echo "ERROR: WEBHOOK_SECRET is not set."
  echo "Set it via env var or --secret flag."
  exit 1
fi

# ─── Synthetic Telegram update payload ───────────────────────────────────────

PAYLOAD=$(cat <<EOF
{
  "update_id": 999999999,
  "message": {
    "message_id": 1,
    "from": {
      "id": 111111111,
      "is_bot": false,
      "first_name": "TestUser",
      "username": "testuser",
      "language_code": "en"
    },
    "chat": {
      "id": ${CHAT_ID},
      "first_name": "TestUser",
      "username": "testuser",
      "type": "private"
    },
    "date": $(date +%s),
    "text": "/start"
  }
}
EOF
)

echo "=== Telegram Webhook Validator ==="
echo "URL:    $WEBHOOK_URL"
echo "Secret: ${SECRET:0:4}****${SECRET: -4}"
echo ""

# ─── Test 1: Correct secret_token (should return 200) ─────────────────────────

echo "--- Test 1: Valid secret_token ---"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $SECRET" \
  -d "$PAYLOAD" \
  --max-time 10)

if [[ "$RESPONSE" == "200" ]]; then
  echo "  PASS — HTTP $RESPONSE (correct secret accepted)"
else
  echo "  FAIL — HTTP $RESPONSE (expected 200)"
  echo "  Check that your webhook server is running and the secret matches."
  exit 1
fi

# ─── Test 2: Wrong secret_token (should return 401) ────────────────────────────

echo ""
echo "--- Test 2: Wrong secret_token ---"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: wrong-secret-token-12345" \
  -d "$PAYLOAD" \
  --max-time 10)

if [[ "$RESPONSE" == "401" ]]; then
  echo "  PASS — HTTP $RESPONSE (wrong secret rejected)"
else
  echo "  FAIL — HTTP $RESPONSE (expected 401)"
  echo "  Your webhook server is not validating the secret_token header!"
  echo "  Add X-Telegram-Bot-Api-Secret-Token validation before processing updates."
  exit 1
fi

# ─── Test 3: Missing secret_token (should return 401) ─────────────────────────

echo ""
echo "--- Test 3: Missing secret_token header ---"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --max-time 10)

if [[ "$RESPONSE" == "401" ]]; then
  echo "  PASS — HTTP $RESPONSE (missing secret rejected)"
else
  echo "  FAIL — HTTP $RESPONSE (expected 401)"
  echo "  Missing secret_token should be rejected with 401."
  exit 1
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=== All tests passed ==="
echo "Webhook at $WEBHOOK_URL is correctly validating secret_token."
