# Storage — per-user key-value via the bridge

`VKWebAppStorageSet` / `VKWebAppStorageGet` / `VKWebAppStorageGetKeys` give you a per-user, per-app key-value store inside VK's infrastructure. Useful for UI state and "last-seen" markers; **not** for sensitive data.

## Scope and lifetime

- **Scope**: per `(app_id, user_id)`. The same user across two devices sees the same keys.
- **Lifetime**: persists until the user removes the app or VK garbage-collects.
- **Visibility**: only your app can read its own keys (no cross-app access).
- **Trust**: the user can read their own storage in principle — never store secrets here.

## API

```ts
import bridge from '@vkontakte/vk-bridge';

// Write
await bridge.send('VKWebAppStorageSet', {
  key: 'last_seen_feed_at',
  value: String(Date.now()),
});

// Write a structured value
await bridge.send('VKWebAppStorageSet', {
  key: 'user_preferences',
  value: JSON.stringify({ theme: 'dark', sound: true }),
});

// Read one or more keys
const { keys } = await bridge.send('VKWebAppStorageGet', {
  keys: ['last_seen_feed_at', 'user_preferences', 'first_run_completed'],
});
// keys: Array<{ key: string; value: string }>
//   missing keys come back as { key, value: '' }
const prefs = JSON.parse(keys.find((k) => k.key === 'user_preferences')?.value || '{}');

// Enumerate all stored keys (paginated)
const list = await bridge.send('VKWebAppStorageGetKeys', {
  count: 20,
  offset: 0,
});
// list: { keys: string[] }
```

## Quotas (approximate)

| Limit | Value (typical) | Notes |
|---|---|---|
| Max keys per user per app | ~1000 | Check current platform docs — has shifted across versions |
| Max value length | ~4096 chars | UTF-16 code units; emoji eat multiple |
| Max keys per `VKWebAppStorageGet` call | ~10 | Batch into multiple calls if needed |

Always validate quota numbers against the live VK Mini Apps documentation for your launch window — these have historically been platform-dependent.

## Typed wrapper pattern

```ts
type Schema = {
  last_seen_feed_at: number;
  user_preferences: { theme: 'light' | 'dark'; sound: boolean };
  first_run_completed: boolean;
};

const PREFIX = 'app.';  // namespace your keys

async function storageGet<K extends keyof Schema>(key: K): Promise<Schema[K] | null> {
  const { keys } = await bridge.send('VKWebAppStorageGet', { keys: [PREFIX + (key as string)] });
  const raw = keys[0]?.value;
  if (!raw) return null;
  try { return JSON.parse(raw) as Schema[K]; } catch { return null; }
}

async function storageSet<K extends keyof Schema>(key: K, value: Schema[K]) {
  await bridge.send('VKWebAppStorageSet', {
    key: PREFIX + (key as string),
    value: JSON.stringify(value),
  });
}
```

## Namespacing

Prefix all keys with a short tag (e.g., `app.`, `v2.`). Two reasons:
- If you later rebrand or migrate schema, a fresh prefix lets you ignore stale rows.
- Helps differentiate during debugging.

## When to use bridge storage vs server storage

| Use bridge storage | Use server storage |
|---|---|
| UI state — last route, feed scroll position | User profile data |
| First-run flags — "show onboarding done" | Subscription state, entitlements |
| Per-device dismissed-tip markers | Order history |
| Anything safe to lose | Anything that drives billing or access |
| Anything small and frequently accessed | Anything large or queryable |

Rule of thumb: if losing the key would cause real damage (revenue, support tickets, data loss), it belongs server-side. The user can lose access to bridge storage by reinstalling the app.

## Deleting keys

There's no dedicated delete method. Set the value to an empty string:

```ts
await bridge.send('VKWebAppStorageSet', { key: 'user_preferences', value: '' });
```

It will still count against the keys-per-user quota until VK garbage-collects empty entries.

## Pitfalls

- **Values are strings only**. Always `JSON.stringify` on write, `JSON.parse` on read; handle parse failure as "missing key".
- **Empty string = missing**. There's no nullability in the API — both unset and empty come back as `value: ''`.
- **No transactions**. Reading then writing is not atomic across two calls; treat the store as best-effort UI cache.
- **Quota errors are silent on some platforms** — set returns success even when over-quota in some legacy clients. Check the value reads back.
