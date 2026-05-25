# Mini App Launch — End-to-End Setup

## Scenario

Set up a Telegram Mini App for a bot: configure BotFather, validate `initData` on the server, handle `sendData` (keyboard button) and `answerWebAppQuery` (inline button), and generate shareable deep links.

---

## Step 1 — BotFather setup

In chat with `@BotFather`:

```
/newapp             — register a Mini App
  Enter bot username when prompted: @YourBot
  Enter app title:  My App
  Enter short name: myapp          (used in deep links: t.me/YourBot/myapp)
  Enter app URL:    https://app.your-domain.com

/setmenubutton      — make Mini App the default button
  Select bot: @YourBot
  Select: Set custom button
  Enter button text: Open App
  Enter URL: https://app.your-domain.com
```

Programmatic equivalent (set once at deploy time):

```typescript
// scripts/setup-webhook.ts
await bot.api.setChatMenuButton({
  menu_button: {
    type: "web_app",
    text: "Open App",
    web_app: { url: process.env.MINI_APP_URL! },
  },
});
```

---

## Step 2 — Frontend SDK integration

Add to your Mini App HTML:

```html
<!-- Option A: CDN (always latest) -->
<script src="https://telegram.org/js/telegram-web-app.js"></script>

<!-- Option B: npm package (pinned version) -->
<!-- npm install @twa-dev/sdk -->
```

```typescript
// frontend/app.ts
const tg = window.Telegram.WebApp;

// Signal that the app is ready to display
tg.ready();
// Expand to full screen
tg.expand();

// NEVER trust initDataUnsafe without server validation
// const userId = tg.initDataUnsafe.user?.id;  // WRONG — client-controlled
// const rawInitData = tg.initData;             // Send this to server for validation
```

---

## Step 3 — Server-side initData validation (HMAC-SHA256)

Always validate `initData` before reading any field. `initDataUnsafe` is client-controlled.

```typescript
// server/validate-init-data.ts
import { createHmac } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramUser;
  chatType?: string;
  chatInstance?: string;
  queryId?: string;          // present for inline button launches
  startParam?: string;       // present when ?startapp= is in the URL
  authDate: number;
}

export function validateInitData(
  rawInitData: string,
  botToken: string
): ValidatedInitData {
  if (!rawInitData) throw new Error("initData is empty");

  const params = new URLSearchParams(rawInitData);
  const hash = params.get("hash");
  if (!hash) throw new Error("initData missing hash");

  // Remove hash before building the check string
  params.delete("hash");

  // Sort keys alphabetically, join as key=value\n
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // Derive HMAC-SHA256 key: HMAC("WebAppData", botToken)
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // Compute expected hash
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (hash !== expectedHash) {
    throw new Error("initData validation failed — invalid signature");
  }

  // Check that auth_date is within 1 hour (prevent replay attacks)
  const authDate = Number(params.get("auth_date"));
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > 3600) {
    throw new Error("initData expired (auth_date > 1 hour ago)");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("initData missing user field");

  const user = JSON.parse(userRaw) as TelegramUser;

  return {
    user,
    chatType: params.get("chat_type") ?? undefined,
    chatInstance: params.get("chat_instance") ?? undefined,
    queryId: params.get("query_id") ?? undefined,
    startParam: params.get("start_param") ?? undefined,
    authDate,
  };
}
```

Fastify API endpoint:

```typescript
// server/routes/auth.ts
fastify.post("/api/auth/telegram", async (request, reply) => {
  const { initData } = request.body as { initData: string };

  let validated: ValidatedInitData;
  try {
    validated = validateInitData(initData, process.env.BOT_TOKEN!);
  } catch (err) {
    return reply.code(401).send({ error: "Invalid initData" });
  }

  // Issue a JWT or session for subsequent API calls
  const token = await issueSessionToken(validated.user.id);
  return reply.send({ token, user: validated.user });
});
```

---

## Step 4a — Keyboard button app (sendData)

Used when the Mini App is opened via a `web_app` reply keyboard button.
The app sends data directly to the bot without needing an API call.

```typescript
// frontend: send data and close
function submitForm(data: Record<string, unknown>) {
  window.Telegram.WebApp.sendData(JSON.stringify(data));
  // App closes automatically — no further JS runs
}
```

```typescript
// bot: receive the data
bot.on("message:web_app_data", async (ctx) => {
  const raw = ctx.message.web_app_data!.data;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    await ctx.reply("Invalid data received from app.");
    return;
  }
  // Process data.action, data.value, etc.
  await ctx.reply(`Received: ${JSON.stringify(data)}`);
});
```

---

## Step 4b — Inline button app (answerWebAppQuery)

Used when the Mini App is opened via an inline keyboard `web_app` button.
The app must call `answerWebAppQuery` via your bot server — it sends a message on behalf of the user.

```typescript
// frontend: call your API, which calls answerWebAppQuery
async function submitViaApi(queryId: string, result: unknown) {
  await fetch("/api/mini-app/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queryId, result }),
  });
  window.Telegram.WebApp.close();
}

// Use queryId from:
// const queryId = window.Telegram.WebApp.initDataUnsafe.query_id;
```

```typescript
// server: forward result to Telegram
fastify.post("/api/mini-app/submit", async (request, reply) => {
  const { queryId, result } = request.body as { queryId: string; result: string };
  // Validate the caller's session token first

  await bot.api.answerWebAppQuery(queryId, {
    type: "article",
    id: crypto.randomUUID(),
    title: "Result from Mini App",
    input_message_content: {
      message_text: typeof result === "string" ? result : JSON.stringify(result),
    },
  });

  return reply.send({ ok: true });
});
```

---

## Step 5 — Deep link generation

```typescript
// Generate a shareable link that opens the Mini App with a payload
function miniAppDeepLink(
  botUsername: string,
  appName: string,
  payload: string
): string {
  // payload is available in tg.initDataUnsafe.start_param after app opens
  return `https://t.me/${botUsername}/${appName}?startapp=${encodeURIComponent(payload)}`;
}

// Example: user referral link
const referralLink = miniAppDeepLink(
  "YourBot",
  "myapp",
  `ref_${ctx.from!.id}`
);
await ctx.reply(`Share your referral link:\n${referralLink}`);
```

Frontend reads the payload:

```typescript
const startParam = window.Telegram.WebApp.initDataUnsafe.start_param;
// e.g. "ref_123456789"
if (startParam?.startsWith("ref_")) {
  const referrerId = parseInt(startParam.slice(4), 10);
  // credit the referrer
}
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Reading user data from `initDataUnsafe` without validation | Always validate server-side HMAC first |
| Not checking `auth_date` age | Add 1-hour expiry check to prevent replay |
| Using `sendData` for inline button apps | `sendData` only works for reply-keyboard-launched apps; use `answerWebAppQuery` for inline |
| Calling `tg.close()` before `answerWebAppQuery` resolves | Close after the API call completes (await your fetch first) |
| Hardcoding bot token in frontend | Frontend never receives the token; all validation is server-side |
