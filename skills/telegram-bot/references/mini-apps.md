# Telegram Mini Apps (Web Apps) Reference

> Source: https://core.telegram.org/bots/webapps
> Bot API version: 10.0 (May 2026)

---

## Overview

Mini Apps are full web applications embedded in Telegram. They run in a WebView and can access Telegram user context, send messages, process payments, and integrate deeply with the chat interface.

---

## Launch Methods

Seven ways to open a Mini App:

| Method | How | Use Case |
|--------|-----|---------|
| **Profile Button** | "Launch app" on bot profile | Primary app entry point |
| **Keyboard Button** | `web_app` type in reply keyboard | Transmit form data via `sendData()` |
| **Inline Button** | `web_app` type in inline keyboard | Receive `query_id` for `answerWebAppQuery` |
| **Menu Button** | Customizable menu button | Replace command list with app |
| **Inline Mode** | Button in inline query results | Redirect inline flow to web UI |
| **Direct Link** | `https://t.me/botusername/appname?startapp=param` | Shareable deep links |
| **Attachment Menu** | Bot icon in attachment menu | Quick-access from any chat |

### BotFather Mini App Setup

```
/newapp        – register a Mini App for your bot
/editapp       – update app settings (title, URL, description)
/setmenubutton – configure the menu button to launch the app
```

---

## Frontend SDK

Include in your HTML:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

Or use the npm package:

```bash
npm install @twa-dev/sdk
```

---

## Initialization Data

Access via `window.Telegram.WebApp`:

```javascript
const tg = window.Telegram.WebApp;

tg.ready();          // signal that app is ready
tg.expand();         // expand to full screen

// Initialization data
tg.initData          // raw query string (validate server-side)
tg.initDataUnsafe    // parsed object (DO NOT trust without validation)

// Fields in initDataUnsafe:
// user            – { id, first_name, last_name, username, language_code, photo_url }
// chat_type       – "private" | "group" | "supergroup" | "channel"
// chat_instance   – unique chat identifier
// query_id        – session identifier (for answerWebAppQuery)
// start_param     – value from ?startapp= URL parameter
// auth_date       – Unix timestamp of authentication
// hash            – HMAC-SHA256 signature for validation
```

---

## Server-Side Validation

**Always validate `initData` server-side before trusting user data.**

```typescript
import { createHmac } from "crypto";

function validateInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  // Build data-check string: sorted key=value pairs
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // Derive secret key
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // Compute expected hash
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return hash === expectedHash;
}
```

Third-party launch validation uses Ed25519 signature:
- Format: `<bot_id>:WebAppData\n` + sorted fields

---

## Mini App UI Methods

```javascript
const tg = window.Telegram.WebApp;

// Buttons
tg.MainButton.text = "Submit";
tg.MainButton.show();
tg.MainButton.onClick(() => handleSubmit());
tg.MainButton.showProgress();   // spinner
tg.MainButton.hideProgress();

tg.BackButton.show();
tg.BackButton.onClick(() => goBack());

// Theme
tg.colorScheme        // "light" | "dark"
tg.themeParams        // bg_color, text_color, button_color, etc.

// Haptics
tg.HapticFeedback.impactOccurred("medium");   // light | medium | heavy | rigid | soft
tg.HapticFeedback.notificationOccurred("success"); // success | warning | error
tg.HapticFeedback.selectionChanged();

// Popup
tg.showPopup({ title: "Alert", message: "Text", buttons: [{ type: "ok" }] });
tg.showAlert("Message", callback);
tg.showConfirm("Sure?", (confirmed) => { /* */ });
tg.showScanQrPopup({ text: "Scan QR" }, (data) => { /* */ });

// Navigation
tg.close();
tg.openLink("https://example.com");
tg.openTelegramLink("https://t.me/username");
tg.switchInlineQuery("query", ["users", "groups"]);

// Share
tg.shareMessage(msg_id);   // share prepared message
```

---

## Sending Data to Bot

### Keyboard Button App (sendData)

For apps launched via reply keyboard `web_app` button — no `query_id`, data sent directly:

```javascript
// Frontend
tg.sendData(JSON.stringify({ action: "submit", value: 42 }));
// App closes automatically

// Bot receives: message.web_app_data.data
bot.on("message:web_app_data", async (ctx) => {
  const data = JSON.parse(ctx.message.web_app_data!.data);
  await ctx.reply(`Received: ${JSON.stringify(data)}`);
});
```

### Inline Button App (answerWebAppQuery)

For apps launched via inline keyboard `web_app` button — use `query_id`:

```typescript
// Bot server
await bot.api.answerWebAppQuery(queryId, {
  type: "article",
  id: "result-1",
  title: "Result",
  input_message_content: {
    message_text: "Content from Mini App",
  },
});
// Sends message on behalf of user and closes app
```

---

## Payment Integration in Mini Apps

```javascript
// Open invoice
tg.openInvoice(invoiceUrl, (status) => {
  if (status === "paid") {
    // payment successful
  } else if (status === "cancelled") {
    // user cancelled
  } else if (status === "failed") {
    // payment failed
  }
});
```

Bot creates invoice URL, frontend opens it via `openInvoice`. Works with both Stars (XTR) and fiat Payments 2.0.

---

## Bot API: Menu Button

```typescript
// Set Mini App as menu button for all chats
await bot.api.setMyCommands([], { scope: { type: "all_private_chats" } });

await bot.api.setChatMenuButton({
  menu_button: {
    type: "web_app",
    text: "Open App",
    web_app: { url: "https://your-mini-app.example.com" },
  },
});

// For specific chat
await bot.api.setChatMenuButton({
  chat_id: chatId,
  menu_button: { type: "web_app", text: "App", web_app: { url } },
});

// Reset to default (commands list)
await bot.api.setChatMenuButton({ menu_button: { type: "default" } });
```

---

## Inline Keyboard Web App Button

```typescript
const keyboard = new InlineKeyboard()
  .webApp("Open App", "https://your-mini-app.example.com");

await ctx.reply("Open the app:", { reply_markup: keyboard });
```

---

## grammY Integration Pattern

```typescript
import { Bot, InlineKeyboard } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);
const MINI_APP_URL = "https://your-mini-app.example.com";

// Launch via command
bot.command("app", (ctx) =>
  ctx.reply("Open the app:", {
    reply_markup: new InlineKeyboard().webApp("Open", MINI_APP_URL),
  })
);

// Receive keyboard button data
bot.on("message:web_app_data", async (ctx) => {
  const raw = ctx.message.web_app_data!.data;
  const data = JSON.parse(raw);
  await ctx.reply(`Received action: ${data.action}`);
});

bot.start();
```

---

## Deep Links

Direct link format:
```
https://t.me/botusername/appname?startapp=PAYLOAD
```

- `appname` is the short name set in BotFather
- `startapp` value appears in `tg.initDataUnsafe.start_param`
- URL-encode the payload: base64url recommended for complex data

```typescript
// Generate deep link
function miniAppLink(username: string, appName: string, payload: string): string {
  return `https://t.me/${username}/${appName}?startapp=${encodeURIComponent(payload)}`;
}
```
