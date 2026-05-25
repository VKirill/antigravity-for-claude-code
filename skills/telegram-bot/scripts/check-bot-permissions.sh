#!/usr/bin/env bash
# scripts/check-bot-permissions.sh
# Query the Telegram Bot API to verify:
#   1. getMe — bot token is valid and bot info is returned
#   2. getChatAdministrators — bot is an admin with required permissions in a chat
#
# Usage:
#   BOT_TOKEN=xxx CHAT_ID=-100xxx ./check-bot-permissions.sh
#   ./check-bot-permissions.sh --token xxx --chat -100xxx
#
# Required:
#   - BOT_TOKEN  (or --token)
#   - CHAT_ID    (or --chat) — the target group/channel, e.g. -1001234567890
#
# Example:
#   ./check-bot-permissions.sh --token 110201543:AAH... --chat -1001234567890

set -euo pipefail

API="https://api.telegram.org"

# ─── Argument parsing ─────────────────────────────────────────────────────────

TOKEN="${BOT_TOKEN:-}"
CHAT_ID="${CHAT_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --chat)  CHAT_ID="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: BOT_TOKEN is not set. Use --token or set the env var."
  exit 1
fi

# ─── Helper: call Telegram API ───────────────────────────────────────────────

tg_api() {
  local method="$1"
  shift
  curl -s "${API}/bot${TOKEN}/${method}" "$@"
}

# ─── Test 1: getMe ────────────────────────────────────────────────────────────

echo "=== Bot Token Validation ==="
ME=$(tg_api "getMe")

OK=$(echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")

if [[ "$OK" != "True" ]]; then
  echo "FAIL — getMe returned error:"
  echo "$ME" | python3 -m json.tool 2>/dev/null || echo "$ME"
  exit 1
fi

BOT_USERNAME=$(echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['username'])")
BOT_ID=$(echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'])")
CAN_GROUPS=$(echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'].get('can_join_groups', False))")
CAN_READ_ALL=$(echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'].get('can_read_all_group_messages', False))")

echo "  PASS — Token valid"
echo "  Bot: @${BOT_USERNAME} (ID: ${BOT_ID})"
echo "  can_join_groups:            $CAN_GROUPS"
echo "  can_read_all_group_messages: $CAN_READ_ALL"

if [[ -z "$CHAT_ID" ]]; then
  echo ""
  echo "  (No --chat specified — skipping permission check)"
  echo "  Run with: ./check-bot-permissions.sh --token $TOKEN --chat <CHAT_ID>"
  exit 0
fi

# ─── Test 2: getChatAdministrators ────────────────────────────────────────────

echo ""
echo "=== Chat Admin Permissions (chat: $CHAT_ID) ==="

ADMINS=$(tg_api "getChatAdministrators" \
  -d "chat_id=${CHAT_ID}" \
  -d "return_bots=true")

ADMINS_OK=$(echo "$ADMINS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")

if [[ "$ADMINS_OK" != "True" ]]; then
  echo "FAIL — getChatAdministrators error:"
  echo "$ADMINS" | python3 -m json.tool 2>/dev/null || echo "$ADMINS"
  echo ""
  echo "Possible causes:"
  echo "  - Bot is not a member of the chat"
  echo "  - Chat ID is wrong (groups use negative IDs, channels use -100...)"
  echo "  - Bot does not have permission to see admin list"
  exit 1
fi

# Find this bot in the admin list
BOT_ADMIN=$(echo "$ADMINS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
bot_id = int('${BOT_ID}')
for member in d.get('result', []):
    if member.get('user', {}).get('id') == bot_id:
        print(json.dumps(member, indent=2))
        break
" 2>/dev/null)

if [[ -z "$BOT_ADMIN" ]]; then
  echo "FAIL — Bot @${BOT_USERNAME} is NOT an admin in chat $CHAT_ID"
  echo "Add the bot as an admin in BotFather or the chat settings."
  exit 1
fi

echo "  PASS — Bot @${BOT_USERNAME} is an admin"
echo ""
echo "  Admin permissions:"
echo "$BOT_ADMIN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
permissions = [
  'can_manage_chat',
  'can_delete_messages',
  'can_manage_video_chats',
  'can_restrict_members',
  'can_promote_members',
  'can_change_info',
  'can_invite_users',
  'can_pin_messages',
  'can_post_messages',
  'can_edit_messages',
]
for perm in permissions:
    val = d.get(perm, False)
    status = '  YES' if val else '  NO '
    print(f'  {status}  {perm}')
"

echo ""
echo "=== Summary ==="
echo "  Bot token: VALID (@${BOT_USERNAME})"
echo "  Chat ${CHAT_ID}: Bot is an admin"
echo ""
echo "If any required permissions are missing, grant them via:"
echo "  Group Settings → Administrators → @${BOT_USERNAME} → Edit"
