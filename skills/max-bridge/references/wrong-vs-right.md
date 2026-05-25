# Wrong vs Right — MAX Bridge Identity & Security

Five high-stakes pairs. Read all five before merging anything that touches identity, payments, or stored secrets. Each pair has a one-line «why it matters».

---

## Pair 1 — Trusting client-claimed user identity

### ❌ Wrong

```typescript
// Backend route handler
app.post('/api/orders', async (req, reply) => {
  const userId = req.body.user_id; // sent from client
  const order = await createOrder({ userId, ...req.body });
  return reply.send(order);
});
```

```typescript
// Or worse — reading initDataUnsafe directly and trusting it
app.post('/api/orders', async (req, reply) => {
  const initDataUnsafe = req.body.initDataUnsafe;
  const userId = initDataUnsafe.user.id; // attacker controls this
  // ...
});
```

### ✅ Right

```typescript
import { validateMaxInitData } from './max-validation';

app.addHook('preHandler', async (req, reply) => {
  const initData = req.headers['x-max-initdata'];
  if (typeof initData !== 'string') return reply.code(401).send({ error: 'missing init data' });
  try {
    req.maxUser = validateMaxInitData(initData, env.MAX_BOT_TOKEN);
  } catch {
    return reply.code(401).send({ error: 'invalid init data' });
  }
});

app.post('/api/orders', async (req, reply) => {
  const userId = req.maxUser!.user.id; // verified by HMAC
  const order = await createOrder({ userId, ...req.body });
  return reply.send(order);
});
```

**Why it matters:** `initDataUnsafe` is mutable in the client iframe. Anyone with DevTools can change `user.id`. Without server-side HMAC validation against the bot token, the request says nothing about who actually made it. Account takeover is one cURL away.

---

## Pair 2 — Skipping the TTL check

### ❌ Wrong

```typescript
export function validateMaxInitData(initData: string, botToken: string) {
  // ... HMAC check ...
  if (computedHash !== originalHash) throw new Error('bad signature');
  return parseInitData(initData);
  // (no auth_date check)
}
```

### ✅ Right

```typescript
export function validateMaxInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
) {
  // ... HMAC check ...
  if (computedHash !== originalHash) throw new MaxValidationError('signature mismatch', 'bad_signature');

  const map = pairsAsObject(decoded);
  const authDate = Number(map.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds) {
    throw new MaxValidationError('expired', 'expired');
  }
  return buildTrustedView(map);
}
```

**Why it matters:** `initData` does not have a built-in expiration on the client. A signed payload from a year ago will still verify by HMAC — but the user may have revoked access, changed phone, or been banned. Upstream recommends 1 hour («Рекомендуемый интервал составляет 1 час»). No TTL = permanent credential, period.

---

## Pair 3 — Hardcoding the bot token in client code

### ❌ Wrong

```typescript
// In src/api.ts (shipped to the browser!)
const BOT_TOKEN = 'AAAA-BBBB-CCCC-real-token';

async function login(initData: string) {
  return validateMaxInitData(initData, BOT_TOKEN); // running in browser
}
```

### ✅ Right

```typescript
// On the server only:
const botToken = process.env.MAX_BOT_TOKEN!;
if (!botToken) throw new Error('MAX_BOT_TOKEN missing');

// Validation runs on the server; client only forwards initData
app.post('/api/me', async (req, reply) => {
  const initData = req.headers['x-max-initdata'] as string;
  const user = validateMaxInitData(initData, botToken);
  return reply.send({ user });
});
```

**Why it matters:** The bot token IS the validation key. Anyone with the token can mint arbitrary `initData` strings and impersonate any user. It must never appear in client bundles, public repos, or logs. Validation is a server-only operation.

> If you accidentally shipped the token: rotate it in MAX для партнёров immediately, redeploy backend with the new value, and audit logs for unauthorized access during the exposure window.

---

## Pair 4 — Excluding `hash` incorrectly from `launch_params`

### ❌ Wrong

```typescript
// Sort first, then build the string — but forgot to filter hash
const pairs = initData
  .split('&')
  .map((p) => p.split('='))
  .sort((a, b) => a[0].localeCompare(b[0])); // also wrong sort
const launchParams = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
// launchParams now INCLUDES `hash=<value>` — signature will never match
```

### ✅ Right

```typescript
const pairs = initData
  .split('&')
  .map((p) => p.split('=') as [string, string]);

const hashEntry = pairs.find(([k]) => k === 'hash');
if (!hashEntry) throw new Error('missing hash');

const sorted = pairs
  .filter(([k]) => k !== 'hash')                          // step 3
  .map<[string, string]>(([k, v]) => [k, decodeURIComponent(v)]) // step 4
  .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)); // step 5: ASCII order

const launchParams = sorted.map(([k, v]) => `${k}=${v}`).join('\n'); // step 6
```

**Why it matters:** The validation algorithm signs «every param except `hash`». If you leave `hash` in, the input to the HMAC includes its own would-be signature — by construction, the equality check can never succeed for legitimate payloads. You will spend hours debugging «valid users can't log in» when the bug is one missing `.filter()`.

> Also: `localeCompare()` can return different sort orders for Cyrillic / mixed-script keys depending on the host's locale. Always use raw `<` / `>` comparison (ASCII codepoint order) — matching the upstream reference implementation.

---

## Pair 5 — Treating native bridge methods as guaranteed-available

### ❌ Wrong

```typescript
async function vibrateOnTap() {
  await window.WebApp.HapticFeedback.impactOccurred('light');
  // Rejects with { error: { code: '...' } } on web/desktop — uncaught
}
```

```typescript
async function loadUserPrefs() {
  const { value } = await window.WebApp.DeviceStorage.getItem('prefs');
  // Promise rejects on web client — DeviceStorage не поддерживается веб-клиентом
  return JSON.parse(value);
}
```

### ✅ Right

```typescript
async function vibrateOnTap() {
  const wa = window.WebApp;
  if (!wa) return; // bridge not loaded — running outside MAX
  if (wa.platform === 'web' || wa.platform === 'desktop') return; // haptic mobile-only
  try {
    await wa.HapticFeedback.impactOccurred('light');
  } catch {
    // soft-fail — haptic is non-critical UX
  }
}

async function loadUserPrefs(): Promise<UserPrefs> {
  const wa = window.WebApp;
  if (wa && wa.platform !== 'web') {
    try {
      const { value } = await wa.DeviceStorage.getItem('prefs');
      return JSON.parse(value);
    } catch {
      // fall through to fallback
    }
  }
  // Web client and any failure path: use localStorage
  const raw = localStorage.getItem('prefs');
  return raw ? JSON.parse(raw) : DEFAULT_PREFS;
}
```

**Why it matters:** Upstream marks Storage, Biometry, NFC, Haptic, and native Share as platform-restricted. An uncaught Promise rejection in a `useEffect` or top-level click handler can crash an entire React tree or trigger Sentry alerts. Always capability-check by `platform` before calling these methods, and wrap in `try`/`catch`. Treat the bridge as «may fail on any call» — your UX must degrade gracefully.

---

## Audit checklist before merging

- [ ] All authenticated endpoints validate `initData` server-side (no exceptions).
- [ ] TTL is enforced; `maxAgeSeconds` matches `recommended-defaults.md`.
- [ ] Bot token is in env, not in client bundles, not in git.
- [ ] Validation code uses `timingSafeEqual` (or constant-time XOR on Edge).
- [ ] `hash` is excluded from `launch_params` before HMAC.
- [ ] Sort uses ASCII codepoint order (not `localeCompare`).
- [ ] Native bridge calls are guarded by `platform` checks and `try`/`catch`.
- [ ] `initDataUnsafe` is used only for UI prefill, never for authorization.
