# grammY 1.x Framework Reference

> Source: https://grammy.dev · Node.js 24.x + TypeScript 5.9.x
> Framework: grammY 1.x (current stable, May 2026)

---

## Installation

```bash
# Node.js
npm install grammy

# Deno (no install step — import directly)
import { Bot } from "https://deno.land/x/grammy/mod.ts";
```

Enable debug logging:
```bash
DEBUG="grammy*" node bot.js
```

---

## Basic Bot

```typescript
import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => ctx.reply("Welcome!"));
bot.on("message:text", (ctx) => ctx.reply("Got a message!"));

// Long polling (development)
bot.start();
```

---

## Context Object

Every handler receives `ctx` (a `Context` instance):

```typescript
bot.on("message", async (ctx) => {
  // Shortcut methods
  await ctx.reply("Hello!");
  await ctx.reply("*bold*", { parse_mode: "MarkdownV2" });
  await ctx.forwardMessage(otherChatId);
  await ctx.deleteMessage();
  await ctx.pinMessage();

  // Raw update data
  ctx.update          // full Update object
  ctx.message         // current message (if any)
  ctx.from            // sender User
  ctx.chat            // current Chat
  ctx.msg             // shortcut for ctx.message

  // Direct API access
  await ctx.api.sendMessage(chatId, "text");
});

bot.callbackQuery("data", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Done!" });
  await ctx.editMessageText("Updated");
  await ctx.editMessageReplyMarkup({ reply_markup: newKeyboard });
});
```

Outside middleware, use `bot.api`:
```typescript
await bot.api.sendMessage(chatId, "Hello!");
```

---

## Filter Queries

```typescript
// Commands
bot.command("start", handler);
bot.command(["start", "help"], handler);   // multiple commands

// Message filters
bot.on("message", handler);                // any message
bot.on("message:text", handler);           // text only
bot.on("message:photo", handler);
bot.on("message:document", handler);
bot.on("message:sticker", handler);
bot.on("message:voice", handler);
bot.on("message:video", handler);
bot.on("message:animation", handler);
bot.on("message:contact", handler);
bot.on("message:location", handler);

// Text matching
bot.hears("hello", handler);              // exact text
bot.hears(/hello/i, handler);             // regex

// Callback queries
bot.callbackQuery("data", handler);
bot.callbackQuery(/^prefix:/, handler);   // regex match
bot.on("callback_query:data", handler);

// Other update types
bot.on("inline_query", handler);
bot.on("edited_message", handler);
bot.on("channel_post", handler);
bot.on("my_chat_member", handler);
bot.on("chat_member", handler);

// Bot API 7.x+ filters
bot.on("message_reaction", handler);
bot.on("chat_boost", handler);
bot.on("removed_chat_boost", handler);
bot.on("business_connection", handler);
bot.on("business_message", handler);
```

---

## Middleware & Composers

```typescript
import { Bot, Composer } from "grammy";

// Timing middleware
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${Date.now() - start}ms`);
});

// Scoped composers
const admin = new Composer<MyContext>();
admin.command("ban", (ctx) => ctx.reply("Banned"));
admin.command("kick", (ctx) => ctx.reply("Kicked"));

const user = new Composer<MyContext>();
user.command("start", (ctx) => ctx.reply("Welcome!"));

bot.use(admin);
bot.use(user);

// Filter middleware to specific users
bot.filter(
  (ctx) => ctx.from?.id === ADMIN_ID,
  adminComposer
);
```

---

## Keyboards

### Inline Keyboards

```typescript
import { InlineKeyboard } from "grammy";

const keyboard = new InlineKeyboard()
  .text("Click me", "click-payload")
  .url("Open URL", "https://example.com")
  .row()
  .text("Row 2 Button", "row2");

await ctx.reply("Choose:", { reply_markup: keyboard });

bot.callbackQuery("click-payload", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Clicked!" });
});
```

InlineKeyboard methods:
- `.text(label, callbackData)` — callback button
- `.url(label, url)` — opens URL
- `.webApp(label, url)` — opens Mini App
- `.switchInline(label, query)` — switch to inline mode
- `.switchInlineCurrent(label, query)` — inline in current chat
- `.pay(label)` — payment button (use with invoices)
- `.row()` — start new row

### Reply Keyboards (Custom Keyboard)

```typescript
import { Keyboard } from "grammy";

const keyboard = new Keyboard()
  .text("Option A").text("Option B").row()
  .text("Option C").requestContact("Share Contact").row()
  .requestLocation("Share Location");

await ctx.reply("Choose:", {
  reply_markup: keyboard.resized().oneTime(),
});

// Remove keyboard
await ctx.reply("Done", { reply_markup: { remove_keyboard: true } });
```

---

## Sessions

```typescript
import { Bot, Context, session, SessionFlavor } from "grammy";

interface SessionData {
  count: number;
  name?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

bot.use(session({
  initial: (): SessionData => ({ count: 0 }),
  // Default storage: RAM (lost on restart)
  // For production use a persistent adapter
}));

bot.command("count", async (ctx) => {
  ctx.session.count++;
  await ctx.reply(`Count: ${ctx.session.count}`);
});
```

### Storage Adapters

```typescript
import { freeStorage } from "@grammyjs/storage-free";
import { FileAdapter } from "@grammyjs/storage-file";
import { RedisAdapter } from "@grammyjs/storage-redis";

// Free hosted storage (hobby projects)
bot.use(session({ initial, storage: freeStorage<SessionData>(bot.token) }));

// File-based (single-server)
bot.use(session({ initial, storage: new FileAdapter({ dirName: "sessions" }) }));

// Redis (production/multi-instance)
bot.use(session({ initial, storage: new RedisAdapter({ instance: redisClient }) }));
```

### Multi-Sessions

```typescript
bot.use(session({
  type: "multi",
  userPrefs: { initial: (): UserPrefs => ({ lang: "en" }), storage: new RedisAdapter({ instance: redis }) },
  chatData: { initial: (): ChatData => ({ warns: 0 }), storage: new FileAdapter({ dirName: "chat-sessions" }) },
}));
// Access: ctx.session.userPrefs.lang, ctx.session.chatData.warns
```

### Lazy Sessions

```typescript
import { lazySession, LazySessionFlavor } from "grammy";
type MyContext = Context & LazySessionFlavor<SessionData>;
bot.use(lazySession({ initial, storage }));
// ctx.session is a Promise — must await
const data = await ctx.session;
```

### Storage Enhancements

Wrap any adapter with `enhanceStorage({ storage, millisecondsToLive, migrations })` to add TTL auto-expiry and version migrations.

---

## Menu Plugin

```typescript
import { Menu } from "@grammyjs/menu";

const menu = new Menu<MyContext>("my-menu")
  .text("Option A", (ctx) => ctx.reply("A clicked!"))
  .text("Option B", (ctx) => ctx.reply("B clicked!"))
  .row()
  .submenu("More options", "sub-menu", (ctx) => ctx.editMessageText("Submenu:"));

const subMenu = new Menu<MyContext>("sub-menu")
  .text("Back", (ctx) => ctx.menu.back());

menu.register(subMenu);
bot.use(menu);

bot.command("menu", (ctx) => ctx.reply("Menu:", { reply_markup: menu }));
```

### Dynamic Menu Labels

```typescript
const toggleMenu = new Menu<MyContext>("toggle")
  .text(
    (ctx) => (ctx.session.enabled ? "✅ Enabled" : "❌ Disabled"),
    async (ctx) => {
      ctx.session.enabled = !ctx.session.enabled;
      await ctx.menu.update();   // re-render with new state
    }
  );
```

### Dynamic Button Ranges

```typescript
const dynamicMenu = new Menu<MyContext>("items");

dynamicMenu.dynamic(async (ctx, range) => {
  const items = await db.getItems(ctx.chat.id);
  for (const item of items) {
    range.text(item.name, (ctx) => ctx.reply(`Selected: ${item.name}`)).row();
  }
});
```

---

## Conversations Plugin

```typescript
import { conversations, createConversation, ConversationFlavor, Conversation } from "@grammyjs/conversations";

type MyContext = ConversationFlavor<Context>;

const bot = new Bot<MyContext>(token);
bot.use(conversations());

async function registration(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  await ctx.reply("What is your name?");
  const nameCtx = await conversation.wait();
  const name = nameCtx.message?.text ?? "Unknown";

  await ctx.reply("What is your age?");
  const age = await conversation.form.int({ otherwise: (c) => c.reply("Please enter a number") });

  // Side effects MUST use conversation.external()
  await conversation.external(() => db.saveUser(name, age));

  await ctx.reply(`Registered: ${name}, age ${age}`);
}

bot.use(createConversation(registration));
bot.command("register", (ctx) => ctx.conversation.enter("registration"));
```

### Key Wait Methods

```typescript
conversation.wait()                          // any update
conversation.waitFor("message:text")         // filtered
conversation.waitForCommand("cancel")        // specific command
conversation.waitForCallbackQuery("yes|no")  // callback regex

// Form helpers (auto-retry with validation message)
conversation.form.text()
conversation.form.photo()
conversation.form.int()
conversation.form.number()
conversation.form.select(["yes", "no"])
```

### External Side Effects (Critical Rule)

```typescript
// WRONG — runs on every replay (a conversation may replay many times for the same update)
const user = await db.getUser(ctx.from.id);

// CORRECT — runs once; result is persisted by the plugin and reused on subsequent replays
const user = await conversation.external(() => db.getUser(ctx.from.id));
```

Always wrap: DB calls, `Math.random()`, `Date.now()`, file I/O, any non-`ctx.api` call. The return value must be serializable (`JSON.parse(JSON.stringify(data))` semantics) — return plain objects, not ORM model instances.

### Persistence

```typescript
import { FileAdapter } from "@grammyjs/storage-file";

bot.use(conversations({
  storage: {
    type: "key",
    version: 1,                                // increment to migrate data on logic change
    adapter: new FileAdapter({ dirName: "conversations" }),
  },
}));
```

`version` is part of the `storage` config object, NOT a sibling of `storage`. Other adapters (`RedisAdapter`, custom) plug in via `adapter:` the same way.

### Parallel Conversations

```typescript
bot.use(createConversation(handler, { parallel: true }));
// Allows multiple concurrent conversations per chat
```

---

## Error Handling

```typescript
import { GrammyError, HttpError } from "grammy";

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) {
    // e.error_code 429 = rate limited → use @grammyjs/auto-retry
    console.error("API error:", e.error_code, e.description);
  } else if (e instanceof HttpError) {
    console.error("Network error:", e);
  } else {
    console.error("Unknown error:", e);
  }
});
// bot.catch applies to long polling + runner; not called for webhook errors
```

---

## Context Flavors (TypeScript)

Combine multiple plugin context extensions:

```typescript
import { Context, SessionFlavor } from "grammy";
import { ConversationFlavor } from "@grammyjs/conversations";
import { HydrateFlavor } from "@grammyjs/hydrate";

interface SessionData { count: number }

type MyContext = HydrateFlavor<
  ConversationFlavor<
    Context & SessionFlavor<SessionData>
  >
>;

const bot = new Bot<MyContext>(token);
```

---

## File Uploads & Inline Mode

See `bot-api.md` for file size limits and `getFile` usage.

```typescript
import { InputFile, InlineQueryResultBuilder } from "grammy";

// Upload: file path / buffer / URL / file_id (fastest, no re-upload)
await ctx.replyWithPhoto(new InputFile("/tmp/photo.jpg"), { caption: "Caption" });
await ctx.replyWithDocument(new InputFile(buffer, "file.pdf"));
await ctx.replyWithPhoto(new InputFile(new URL("https://example.com/img.png")));
await ctx.replyWithPhoto(existingFileId);

// Download received file
bot.on("message:document", async (ctx) => {
  const file = await ctx.getFile();  // valid ≥1 hour
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
});

// Inline query results
bot.on("inline_query", async (ctx) => {
  await ctx.answerInlineQuery([
    InlineQueryResultBuilder
      .article("id-1", "Title", { description: "Subtitle" })
      .text("Result text", { parse_mode: "HTML" }),
    InlineQueryResultBuilder
      .photo("id-2", "https://example.com/photo.jpg", "https://example.com/thumb.jpg"),
  ], { cache_time: 300, is_personal: true });
});
```

---

## Plugin Ecosystem

| Plugin | Package | Purpose |
|--------|---------|---------|
| Sessions | built-in | Per-chat/user data persistence |
| Keyboard | built-in | Inline & reply keyboards |
| Menu | `@grammyjs/menu` | Interactive inline menus with navigation |
| Conversations | `@grammyjs/conversations` | Multi-step conversational flows |
| Hydrate | `@grammyjs/hydrate` | Add methods to API response objects |
| Runner | `@grammyjs/runner` | Concurrent long-polling update processing |
| Auto-retry | `@grammyjs/auto-retry` | Retry on rate-limit (429) errors |
| Rate limiter | `@grammyjs/ratelimiter` | Throttle per-user request rates |
| Files | `@grammyjs/files` | Convenient file download helpers |
| i18n | `@grammyjs/i18n` | Multi-language support with Fluent |
| Parse mode | `@grammyjs/parse-mode` | Set default parse mode globally |
| Router | `@grammyjs/router` | Route updates by runtime condition |
| Stateless question | `@grammyjs/stateless-question` | Ask questions without session state |
| Free storage | `@grammyjs/storage-free` | Free hosted session storage (hobby) |
| Storage file | `@grammyjs/storage-file` | File-based session storage |
| Storage Redis | `@grammyjs/storage-redis` | Redis-backed session storage |
