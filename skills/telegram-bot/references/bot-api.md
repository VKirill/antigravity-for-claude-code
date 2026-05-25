# Telegram Bot API Reference

> Source: https://core.telegram.org/bots/api · https://core.telegram.org/bots/features
> Bot API version: **10.0** (May 2026)

---

## Current API Version

Bot API 10.0 is the current stable release. Key milestones:
- 7.x: Stars payments, message reactions, business connections, chat boosts, Mini Apps expansion
- 8.x–9.x: Enhanced business features, managed bots, bot-to-bot communication
- 10.0: Guest mode, live photos, `answerGuestQuery`, `getManagedBotToken`, multi-correct quiz answers

---

## BotFather Setup

Register and manage bots at `@BotFather`:

| Command | Purpose |
|---------|---------|
| `/newbot` | Create a new bot (requires name + username) |
| `/mybots` | List your bots with inline edit controls |
| `/token` | Generate a new auth token |
| `/setname` | Change bot display name |
| `/setdescription` | Set description (≤ 512 chars) |
| `/setabouttext` | Set profile bio (≤ 120 chars) |
| `/setuserpic` | Change profile photo |
| `/setcommands` | Define command list shown to users |
| `/setinline` | Enable inline mode |
| `/setprivacy` | Control group message visibility |
| `/setjoingroups` | Allow/disallow adding bot to groups |
| `/setdomain` | Link domain for login widgets |
| `/deletebot` | Permanently delete bot |

**Username rules:** 5–32 chars, Latin letters/numbers/underscores, must end in `bot`.

**Token format:** `110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw` — treat as a secret credential.

### Required Commands (all bots)

```
/start  – begins interaction with the user
/help   – returns help message
/settings – user-specific settings (if applicable)
```

Command format: starts with `/`, up to 32 chars, letters/numbers/underscores. Use specific names (`/newlocation` over `/new`).

### Menu Button

The menu button can either:
1. Display the bot command list
2. Launch a Mini App (Web App) directly

Configure via BotFather `/setmenubutton` or programmatically via `setChatMenuButton`.

---

## Core Update Types (7.x+)

```
message                    – new message
edited_message             – edited message
channel_post               – new channel post
edited_channel_post        – edited channel post
inline_query               – inline query
chosen_inline_result       – chosen inline result
callback_query             – inline keyboard press
shipping_query             – shipping address (payments)
pre_checkout_query         – pre-checkout confirmation
poll / poll_answer         – poll updates
my_chat_member             – bot membership change
chat_member                – chat member status change
chat_join_request          – join requests

# Bot API 7.x+ additions:
message_reaction           – MessageReactionUpdated
message_reaction_count     – MessageReactionCountUpdated
chat_boost                 – ChatBoostUpdated
removed_chat_boost         – ChatBoostRemoved
business_connection        – BusinessConnection
business_message           – business account message
```

---

## Key Methods

### Messaging

```typescript
// Send text message
sendMessage(chat_id, text, {
  parse_mode: "MarkdownV2" | "HTML",
  reply_markup: InlineKeyboardMarkup | ReplyKeyboardMarkup,
  message_thread_id,          // topic thread ID (supergroups)
  protect_content: boolean,
  reply_parameters: { message_id },
})

// Edit message text
editMessageText(text, { chat_id, message_id, parse_mode, reply_markup })

// Delete message
deleteMessage(chat_id, message_id)

// Forward message
forwardMessage(chat_id, from_chat_id, message_id)

// Copy message (no forward tag)
copyMessage(chat_id, from_chat_id, message_id, { caption })
```

### Media

```typescript
sendPhoto(chat_id, photo, { caption, parse_mode })
sendDocument(chat_id, document, { caption, filename })
sendVideo(chat_id, video, { caption, duration, width, height })
sendAudio(chat_id, audio, { caption, duration, performer, title })
sendVoice(chat_id, voice, { caption })
sendVideoNote(chat_id, video_note)
sendSticker(chat_id, sticker)
sendAnimation(chat_id, animation, { caption })
sendMediaGroup(chat_id, media[])   // up to 10 items

// File size limits: download 20 MB, upload 50 MB, photos via URL 5 MB
```

### Chat Management

```typescript
getChatAdministrators(chat_id, { return_bots: true })  // Bot API 10.0
setChatMemberTag(chat_id, user_id, tag)                 // Bot API 10.0
banChatMember(chat_id, user_id, { until_date, revoke_messages })
unbanChatMember(chat_id, user_id)
restrictChatMember(chat_id, user_id, permissions)
promoteChatMember(chat_id, user_id, permissions)
getChat(chat_id)
getChatMember(chat_id, user_id)
getChatMemberCount(chat_id)
```

### Reactions (Bot API 7.x+)

```typescript
// Set reaction on a message
setMessageReaction(chat_id, message_id, reaction?, is_big?)

// Delete reactions (Bot API 10.0)
deleteMessageReaction(chat_id, message_id, reaction)
deleteAllMessageReactions(chat_id, message_id)

// Updates received:
// message_reaction → MessageReactionUpdated
// message_reaction_count → MessageReactionCountUpdated (anonymous agg)
```

### Chat Boosts (Bot API 7.x+)

```typescript
getUserChatBoosts(chat_id, user_id)   // returns ChatBoostAdded[]

// Update types:
// chat_boost → ChatBoostUpdated { chat, boost: ChatBoost }
// removed_chat_boost → ChatBoostRemoved { chat, boost_id, remove_date, source }
```

### Business Connections (Bot API 7.x+)

```typescript
// Received via business_connection update:
// BusinessConnection { id, user, user_chat_id, date, can_reply, is_enabled }

// business_message updates carry:
// Message.business_connection_id

getBusinessConnection(business_connection_id)
```

### Webhook & Long Polling

```typescript
// Set webhook
setWebhook(url, {
  certificate,        // public key for self-signed TLS
  ip_address,         // fixed IP
  max_connections,    // 1–100 (default 40)
  allowed_updates,    // filter update types
  drop_pending_updates: boolean,
  secret_token,       // header X-Telegram-Bot-Api-Secret-Token
})

// Remove webhook (switch to long polling)
deleteWebhook({ drop_pending_updates: boolean })

// Check status
getWebhookInfo()   // returns WebhookInfo

// Long polling
getUpdates({
  offset,             // ack previous updates
  limit,              // 1–100
  timeout,            // 0 = short poll, >0 = long poll
  allowed_updates,
})
```

### Guest Mode (Bot API 10.0)

```typescript
// Bots can receive messages and reply without being chat members
// User.supports_guest_queries: boolean

answerGuestQuery(guest_query_id, result)
```

### Managed Bots (Bot API 10.0)

```typescript
// Retrieve the token of a managed bot (bot created on behalf of the current bot's user).
// No parameters — operates on the implicit "managed bot" context attached to the current bot.
getManagedBotToken()   // returns string

// Companion: reply keyboard button asking the user to create+share a managed bot
import { Keyboard } from "grammy";
const kb = new Keyboard().requestManagedBot("Create managed bot", /* requestId */ 1, { /* options */ });
```

---

## File Handling

Files are identified by `file_id`. Use `getFile(file_id)` to resolve `file_path`, then download from:

```
https://api.telegram.org/file/bot<token>/<file_path>
```

`file_id` is valid for at least 1 hour after `getFile` call.

---

## Privacy Mode

Default behaviour in groups (enabled by default):
- Bot receives only: commands addressed to it, general commands if bot last spoke, inline messages via the bot, replies to bot messages, all service messages, all private messages.
- Admin bots always receive all messages.
- Disable via BotFather `/setprivacy` for specific bots (e.g., group management bots).

---

## MarkdownV2 Escaping

Characters requiring `\` escape in MarkdownV2:
```
_ * [ ] ( ) ~ ` > # + - = | { } . !
```

HTML parse mode is often simpler for dynamic content:
```html
<b>bold</b>, <i>italic</i>, <code>code</code>, <a href="url">link</a>
<pre><code class="language-python">code block</code></pre>
```
