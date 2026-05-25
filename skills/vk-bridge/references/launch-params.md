# Launch params and server-side sign validation

When the VK client opens your Mini App, it appends a set of `vk_*` parameters plus a `sign` to the URL query string. **The `sign` is the only thing that lets the server trust the user identity** — everything else is forgeable.

## The parameters

| Key | Type | Meaning |
|---|---|---|
| `vk_user_id` | number | Current viewer's VK user ID |
| `vk_app_id` | number | Your Mini App's numeric ID |
| `vk_is_app_user` | 0 \| 1 | 1 if user has previously installed/granted access |
| `vk_are_notifications_enabled` | 0 \| 1 | 1 if user allowed push notifications |
| `vk_language` | string | UI language code (e.g., `ru`, `en`, `be`, `uk`, `kk`) |
| `vk_ref` | string | Where the launch came from (e.g., `catalog_recents`, `menu`, `share`) |
| `vk_access_token_settings` | string | Comma-separated scopes already granted (if any) |
| `vk_platform` | string | `mobile_iphone` \| `mobile_android` \| `mobile_web` \| `desktop_web` \| etc. |
| `vk_ts` | number | Unix seconds — sign timestamp (for replay protection) |
| `vk_group_id` | number? | Present only when launched inside a community context |
| `vk_viewer_group_role` | string? | `admin` \| `editor` \| `moder` \| `member` \| `none` (community context only) |
| `sign` | string | base64url no-padding HMAC-SHA256 of sorted params, with the app secret as key |

There are more `vk_*` params for ads, A/B test ids, etc. — your sign verification must include **every** key starting with `vk_` (whatever it is) in the input.

## Client-side parsing

```ts
import { parseURLSearchParamsForGetLaunchParams } from '@vkontakte/vk-bridge';

const params = parseURLSearchParamsForGetLaunchParams(window.location.search);

console.log(params.vk_user_id);            // number
console.log(params.vk_app_id);             // number
console.log(params.vk_platform);           // 'mobile_android' | ...
console.log(params.vk_is_app_user);        // 0 | 1
console.log(params.vk_viewer_group_role);  // string | undefined
console.log(params.sign);                  // string
```

The parser coerces numeric strings to numbers, toggle strings to `0|1`, validates enums, and silently drops unknown/malformed values.

## Sending to the server

Forward the **raw query string** so the server can re-build the canonical sign input without ambiguity:

```ts
const res = await fetch('/api/auth/vk', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ search: window.location.search }),
});
```

Alternative: send `Authorization: Bearer <search>` header on every API request — your backend middleware re-validates the sign on each call.

## Server-side sign algorithm (canonical)

1. Take the URL query string (or an equivalent map).
2. Keep ONLY keys starting with `vk_` (drop `sign` itself and anything else).
3. Sort keys ASCII-ascending.
4. URL-encode values (RFC3986; same encoding the client uses — `encodeURIComponent`).
5. Join as `k1=v1&k2=v2&...` (no trailing `&`).
6. Compute `HMAC-SHA256(secret = APP_SECURE_KEY, message = joined_string)`.
7. Encode the digest as **base64url** (replace `+` with `-`, `/` with `_`, strip `=` padding).
8. Compare with the supplied `sign` using `crypto.timingSafeEqual`.

The `APP_SECURE_KEY` is your Mini App's **защищённый ключ** (NOT the service token, NOT the publicId). Find it in vk.com → "Управление приложением" → "Настройки" → "Ключи доступа" → "Защищённый ключ" / "Secure key".

## Node.js reference implementation

```ts
import crypto from 'node:crypto';

const APP_SECURE_KEY = process.env.VK_APP_SECURE_KEY!;
const REPLAY_WINDOW_SEC = 60 * 60; // 1 hour

export type VerifiedLaunchParams = {
  vk_user_id: number;
  vk_app_id: number;
  vk_is_app_user: 0 | 1;
  vk_platform: string;
  vk_ts: number;
  vk_group_id?: number;
  vk_viewer_group_role?: string;
  // ...add others as needed
};

export function verifyLaunchParams(search: string): VerifiedLaunchParams {
  // 1. Parse params
  const url = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sign = url.get('sign');
  if (!sign) throw new Error('VK_SIGN_MISSING');

  // 2-5. Build canonical message
  const vkPairs: [string, string][] = [];
  for (const [k, v] of url.entries()) {
    if (k.startsWith('vk_')) vkPairs.push([k, v]);
  }
  vkPairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const message = vkPairs
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  // 6-7. HMAC-SHA256 → base64url no-padding
  const digest = crypto
    .createHmac('sha256', APP_SECURE_KEY)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 8. Timing-safe compare
  const a = Buffer.from(digest);
  const b = Buffer.from(sign);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('VK_SIGN_INVALID');
  }

  // 9. Replay-window check
  const ts = Number(url.get('vk_ts'));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > REPLAY_WINDOW_SEC) {
    throw new Error('VK_SIGN_STALE');
  }

  // 10. Build typed result
  const vk_user_id = Number(url.get('vk_user_id'));
  const vk_app_id = Number(url.get('vk_app_id'));
  if (!Number.isFinite(vk_user_id) || !Number.isFinite(vk_app_id)) {
    throw new Error('VK_PARAMS_MALFORMED');
  }

  const groupId = url.get('vk_group_id');
  const role = url.get('vk_viewer_group_role');

  return {
    vk_user_id,
    vk_app_id,
    vk_is_app_user: url.get('vk_is_app_user') === '1' ? 1 : 0,
    vk_platform: url.get('vk_platform') ?? '',
    vk_ts: ts,
    vk_group_id: groupId ? Number(groupId) : undefined,
    vk_viewer_group_role: role ?? undefined,
  };
}
```

## Common encoding pitfalls

- **base64 vs base64url**: VK uses **base64url no-padding**. Standard base64 produces `+`, `/`, `=` — these MUST be substituted/stripped, otherwise comparison always fails.
- **Value encoding**: Use `encodeURIComponent`-style encoding for values when building the message. Spaces become `%20`, not `+`. If your URL parser already decoded values, you must re-encode them in step 4.
- **Key filter**: include EVERY `vk_*` key, not just the ones you care about. VK adds new keys over time (A/B test ids, tracking) — leaving them out breaks the digest.
- **Sort order**: ASCII-ascending byte comparison, not locale-aware. The basic JS `Array.sort` with `<`/`>` on lowercase ASCII keys is correct.

## Fastify middleware pattern

```ts
import type { FastifyPluginAsync } from 'fastify';
import { verifyLaunchParams } from './vk-launch.js';

declare module 'fastify' {
  interface FastifyRequest {
    vk?: ReturnType<typeof verifyLaunchParams>;
  }
}

export const vkAuth: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (req, reply) => {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'no_launch_params' });
    try {
      req.vk = verifyLaunchParams(auth.slice('Bearer '.length));
    } catch (err) {
      req.log.warn({ err }, 'vk sign verification failed');
      return reply.code(401).send({ error: 'invalid_sign' });
    }
  });
};
```

Now downstream handlers can trust `req.vk.vk_user_id` because it was signed by VK.

## Caching the verification

Sign verification is cheap (HMAC-SHA256 on ~200 bytes), but you can cache verified strings in Redis keyed by the raw search string for the replay window — this avoids re-doing HMAC on every API call from the same session. See [recommended-defaults.md](recommended-defaults.md).
