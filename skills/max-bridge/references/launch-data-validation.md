# Launch Data Validation — server-side

This is **the** critical security control in a MAX mini-app. The client-claimed `user_id` is never trustworthy on its own — every authenticated request must be backed by a fresh, validated `initData` proving the request came from the MAX client and was not tampered with.

Authoritative source: [upstream/validation.md](upstream/validation.md). The algorithm below is copied step-for-step; only the implementation language and integration framing are ours.

## When to validate

Validate on EVERY request that consumes `initData`:

- Mini-app boot → first `/api/me` call.
- Any state-changing endpoint (payment intent, order placement, profile update, etc.).
- Any data read scoped to the user (`/api/orders`, `/api/balance`, etc.).

Do NOT cache «validated» flags by `user.id`. Cache by the raw `initData` string + its `auth_date` only.

## The algorithm (verbatim from upstream, 10 steps)

Inputs:

- `BOT_TOKEN` — bot token from MAX для партнёров.
- `USER_URL` — the URL the user opened the mini-app with (or the raw `initData` string posted from the client).

Steps:

1. Extract the URL fragment — everything after `#`. The fragment contains `key=value&...` pairs, including `WebAppData`. Every key must appear exactly once.
2. Convert `WebAppData` from `key=value&key=value` form into `[['key', 'value']]`.
3. Confirm `hash` appears exactly once. Save the original hash value. Remove the hash entry from the array.
4. Apply URL-decoding to every value (if your platform did not auto-decode).
5. Sort the array by key, ascending `a` → `z`.
6. Build the `launch_params` string: join entries as `key=value` separated by `\n` (LF, 0x0A).
7. Derive `secret_key` = `HMAC-SHA256("WebAppData", BOT_TOKEN)` — key is the literal string `WebAppData`, message is the bot token.
8. Compute the signature: `HMAC-SHA256(secret_key, launch_params)`.
9. Convert the signature to a lowercase hex string.
10. If the hex string equals the saved `hash` value — the data is authentic.

> Step 7 is the part most easily misimplemented. The key is the literal string `"WebAppData"`. The message is the bot token. This is the same shape Telegram uses, but the constant is `WebAppData` (not `WebAppData` vs Telegram's `WebAppData` — they happen to share the constant name; do not assume the constants would always match).

## Reference implementation — Node.js (server)

Production-ready, no external deps:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

export class MaxValidationError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | 'missing_hash'
      | 'duplicate_key'
      | 'expired'
      | 'bad_signature'
      | 'malformed',
  ) {
    super(message);
    this.name = 'MaxValidationError';
  }
}

export interface ValidateOptions {
  /** Maximum age of initData in seconds. Default 3600 (1 hour). */
  maxAgeSeconds?: number;
  /** Current Unix time (seconds). Defaults to Date.now()/1000. Useful for tests. */
  now?: () => number;
}

export interface ValidatedInitData {
  query_id: string;
  ip?: string;
  auth_date: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    username: string | null;
    language_code: string;
    photo_url: string | null;
  };
  chat: {
    id: number;
    type: 'DIALOG' | 'CHAT' | 'CHANNEL';
  };
  start_param?: string;
}

/**
 * Validate a MAX mini-app launch `initData` string.
 *
 * Per dev.max.ru/docs/webapps/validation (verified 2026-05-16).
 *
 * @param initData    raw `initData` string from `window.WebApp.initData`
 *                    (the value of the `WebAppData` URL fragment key)
 * @param botToken    bot token from MAX для партнёров
 * @param options     maxAgeSeconds (default 3600), now() injector
 * @returns           parsed, trusted init data
 * @throws            MaxValidationError on any failure
 */
export function validateMaxInitData(
  initData: string,
  botToken: string,
  options: ValidateOptions = {},
): ValidatedInitData {
  const maxAge = options.maxAgeSeconds ?? 3600;
  const now = options.now ? options.now() : Math.floor(Date.now() / 1000);

  if (typeof initData !== 'string' || initData.length === 0) {
    throw new MaxValidationError('initData is empty', 'malformed');
  }

  // Step 2: parse into [key, value] pairs
  const rawPairs: Array<[string, string]> = initData
    .split('&')
    .map((p) => {
      const eq = p.indexOf('=');
      if (eq < 0) {
        throw new MaxValidationError(`malformed pair: ${p}`, 'malformed');
      }
      return [p.slice(0, eq), p.slice(eq + 1)];
    });

  // Step 1+3: every key exactly once; hash exactly once
  const seen = new Set<string>();
  for (const [k] of rawPairs) {
    if (seen.has(k)) {
      throw new MaxValidationError(`duplicate key: ${k}`, 'duplicate_key');
    }
    seen.add(k);
  }

  const hashPairs = rawPairs.filter(([k]) => k === 'hash');
  if (hashPairs.length !== 1) {
    throw new MaxValidationError('hash missing or duplicated', 'missing_hash');
  }
  const originalHash = hashPairs[0][1];

  // Step 3 (continued): remove hash from the working set
  // Step 4: URL-decode values
  const decoded: Array<[string, string]> = rawPairs
    .filter(([k]) => k !== 'hash')
    .map(([k, v]) => [k, decodeURIComponent(v)]);

  // Step 5: sort by key a → z
  decoded.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  // Step 6: join with \n
  const launchParams = decoded.map(([k, v]) => `${k}=${v}`).join('\n');

  // Step 7: secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

  // Step 8 + 9: signature = HMAC-SHA256(secret_key, launch_params) → hex
  const computedHash = createHmac('sha256', secretKey).update(launchParams).digest('hex');

  // Step 10: timing-safe compare
  const a = Buffer.from(computedHash, 'utf8');
  const b = Buffer.from(originalHash, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new MaxValidationError('signature mismatch', 'bad_signature');
  }

  // Build the trusted view. We pull values from `decoded` (not `initDataUnsafe`).
  const map = Object.fromEntries(decoded);

  const authDate = Number(map.auth_date);
  if (!Number.isFinite(authDate)) {
    throw new MaxValidationError('auth_date missing or NaN', 'malformed');
  }

  if (now - authDate > maxAge) {
    throw new MaxValidationError(
      `initData older than ${maxAge}s (auth_date=${authDate}, now=${now})`,
      'expired',
    );
  }

  let user: ValidatedInitData['user'];
  let chat: ValidatedInitData['chat'];
  try {
    user = JSON.parse(map.user);
    chat = JSON.parse(map.chat);
  } catch (cause) {
    throw new MaxValidationError('user/chat is not valid JSON', 'malformed');
  }

  return {
    query_id: map.query_id,
    ip: map.ip,
    auth_date: authDate,
    user,
    chat,
    start_param: map.start_param,
  };
}
```

## Pitfalls and clarifications

1. **`initData` vs URL fragment.** `window.WebApp.initData` returns the **value of the `WebAppData` key only** — not the full fragment. Do not include `WebAppPlatform=...` or `WebAppVersion=...` in the validation input. The upstream TypeScript example explicitly extracts only `hashParams.get('WebAppData')`.
2. **Hash encoding.** The computed signature is lowercase hex. Compare strings byte-for-byte using `timingSafeEqual` to prevent timing attacks.
3. **URL-decoding scope.** Decode `value` only; never decode the `key` (per spec). The TypeScript upstream example decodes all values uniformly.
4. **`auth_date` units.** Unix timestamp in SECONDS (not milliseconds). Mixing units is the #1 cause of false «expired» rejections.
5. **`hash` not in payload.** The `hash` parameter itself is excluded from `launch_params` before signing. The whole point is signing a payload that lacks its own signature.
6. **Sort order.** ASCII / Unicode codepoint order. JavaScript `Array.sort` with the simple comparator above matches the upstream reference. Do NOT use `localeCompare()` blindly — locale-aware sort can shuffle non-ASCII keys differently.
7. **Never trust `initDataUnsafe`.** Upstream is explicit: «Объект нельзя использовать для валидации данных». Use it for UI prefill (display name, avatar) but never for authorization decisions.

## Integration patterns

### Fastify preHandler

```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validateMaxInitData, MaxValidationError, type ValidatedInitData } from './max-validation';

declare module 'fastify' {
  interface FastifyRequest {
    maxUser?: ValidatedInitData;
  }
}

export function registerMaxAuth(app: FastifyInstance, botToken: string): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const initData = req.headers['x-max-initdata'];
    if (typeof initData !== 'string') {
      return reply.code(401).send({ error: 'missing X-Max-InitData' });
    }
    try {
      req.maxUser = validateMaxInitData(initData, botToken, { maxAgeSeconds: 3600 });
    } catch (err) {
      const code = err instanceof MaxValidationError ? err.reason : 'unknown';
      return reply.code(401).send({ error: 'invalid init data', code });
    }
  });
}
```

### Hono middleware (edge-compatible — uses Web Crypto)

For Cloudflare Workers / Vercel Edge, the `node:crypto` import is not available. Use `crypto.subtle`:

```typescript
import type { Context, Next } from 'hono';

async function hmacSha256(key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyBytes = typeof key === 'string' ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function validateMaxInitDataEdge(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
): Promise<Record<string, string>> {
  const pairs = initData.split('&').map((p) => {
    const eq = p.indexOf('=');
    return [p.slice(0, eq), p.slice(eq + 1)] as [string, string];
  });
  const hashEntry = pairs.find(([k]) => k === 'hash');
  if (!hashEntry) throw new Error('no hash');
  const decoded = pairs
    .filter(([k]) => k !== 'hash')
    .map<[string, string]>(([k, v]) => [k, decodeURIComponent(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const launchParams = decoded.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = await hmacSha256('WebAppData', botToken);
  const computed = toHex(await hmacSha256(secretKey, launchParams));

  if (computed !== hashEntry[1]) throw new Error('bad signature');

  const map = Object.fromEntries(decoded);
  const authDate = Number(map.auth_date);
  if (Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) {
    throw new Error('expired');
  }
  return map;
}
```

> The edge variant deliberately omits `timingSafeEqual`-equivalent constant-time comparison (the Web Crypto spec does not expose one). The runtime cost of a successful HMAC + lookup dwarfs the signal a timing attacker can extract here — but if you must, compare byte-by-byte XOR-accumulated and check the accumulator at the end.

## Caching validation results

Re-validating on every request is fast (~50 µs per call) and safe. If you must cache:

- Key by the SHA-256 of the raw `initData` string.
- TTL: `min(maxAgeSeconds - (now - auth_date), 60s)` — never longer than the remaining lifetime of the credential or 60 s, whichever is smaller.
- Invalidate aggressively on any user-mutating endpoint.

See [recommended-defaults.md](recommended-defaults.md) for canonical values.
