# Troubleshooting — VK Bridge

Symptom-indexed. Find your symptom, follow the diagnosis, apply the fix.

---

## `bridge.send(...)` hangs forever (no resolve, no reject)

**Symptoms**
- Promise never settles
- No error in console
- App appears frozen on a button click

**Diagnose**
- Did you call `bridge.send('VKWebAppInit')` first? Without it the host doesn't register the app.
- Are you running standalone (`bridge.isEmbedded() === false`)? Methods silently hang in some legacy bundles.
- Is the method actually supported on the current platform? `bridge.supports(method)` first.
- Open devtools → Network. The bridge uses `postMessage` (web) — you won't see HTTP traffic. On iOS Safari Web Inspector, you can inspect the bridge calls.

**Common causes**
- Missing `VKWebAppInit` — most common.
- Calling a method that doesn't exist on this platform (e.g., `VKWebAppShowStoryBox` on a desktop client without story support).
- Iframe sandbox blocks `postMessage` (rare; CSP misconfig on a custom domain).

**Fix**
```ts
async function safeBridge() {
  if (!bridge.isEmbedded()) {
    console.warn('Not running inside VK client — bridge calls will be no-ops');
    return;
  }
  await bridge.send('VKWebAppInit');
  // Always feature-detect before optional methods
}
```

Wrap optional sends with a timeout:
```ts
function sendWithTimeout<M>(method: M, params?: any, ms = 5000): Promise<any> {
  return Promise.race([
    bridge.send(method as any, params),
    new Promise((_, rej) => setTimeout(() => rej(new Error('bridge_timeout')), ms)),
  ]);
}
```

---

## `bridge.supports('VKWebAppX')` returns `true` but the call rejects

**Symptoms**
- Feature-detect says yes
- Call still fails with `error_type: 'client_error'`

**Diagnose**
- `supports()` is best-effort sync — it can lie. The host registers a method name without guaranteeing the runtime can execute it.
- Try `bridge.supportsAsync('VKWebAppX')` — round-trips to the client, more authoritative.

**Fix**
Use both and treat the call itself as the source of truth:

```ts
async function tryCall<R>(method: string, params: any): Promise<R | null> {
  if (!bridge.supports(method as any)) return null;
  try {
    return await bridge.send(method as any, params);
  } catch {
    return null;
  }
}
```

---

## Sign validation always fails on server

**Symptoms**
- Server returns 401 even for legit users
- HMAC digest does not match `sign` from launch params

**Diagnose**
Print on the server: the canonical message (sorted `vk_*` pairs joined with `&`), the computed digest, and the supplied `sign`. Compare lengths and first/last 8 chars.

**Common causes**
1. **Wrong secret**: using the service token or app ID instead of the **secure key** (защищённый ключ). The secret comes from app settings → "Ключи доступа" → "Защищённый ключ".
2. **Wrong encoding**: using standard base64 instead of base64url no-padding. `+` `/` `=` must be substituted/stripped.
3. **Wrong value encoding**: spaces became `+` (form-encoded) instead of `%20` (RFC3986). Use `encodeURIComponent`.
4. **Missing keys**: you only included known `vk_*` keys, not ALL of them. VK adds new keys over time — your filter must be `startsWith('vk_')`.
5. **Sort order**: locale-aware sort instead of byte sort.
6. **Pre-decoded values**: you let your URL parser decode the values, then signed the decoded form. Re-encode them in the canonical message.

**Fix**
See the canonical implementation in [launch-params.md](launch-params.md). The most common single fix:

```ts
// WRONG — standard base64
.digest('base64')
// RIGHT
.digest('base64')
.replace(/\+/g, '-')
.replace(/\//g, '_')
.replace(/=+$/, '')
```

---

## `VKWebAppOpenPayForm` succeeds on client but server can't find the transaction

**Symptoms**
- Client gets `{ status: 'success', transaction_id }`
- Server-side VK Pay API lookup by `transaction_id` returns 404 or stale data

**Diagnose**
- Has the VK Pay async settlement finished? Wait 5–10s and retry.
- Is your merchant ID correct? Cross-check the dashboard.
- Test vs production keys mismatched between mint and verify endpoints?

**Common causes**
- Eventually-consistent backend on VK Pay's side — the transaction is created but not yet propagated to lookup.
- Race condition: client confirmed before VK Pay finalized.

**Fix**
- Retry the server-side lookup with exponential backoff (e.g., 1s, 3s, 9s) up to 30s before giving up.
- Use webhook-based confirmation if available — VK Pay can push a confirmation to your callback URL, removing the polling.
- Pre-create `pending` order row; only flip to `paid` when verification succeeds.

---

## Events don't fire in `bridge.subscribe`

**Symptoms**
- Theme changes don't propagate
- `VKWebAppLocationChanged` never appears

**Diagnose**
- Did you call `subscribe` BEFORE `VKWebAppInit` resolved? Some events fire only after init.
- Is the handler still registered? React strict mode mounts twice — you may have unsubscribed.
- Did the host actually emit the event? Trigger manually (toggle theme in VK settings).

**Fix**
Subscribe inside an effect with a stable handler and clean up correctly:

```tsx
useEffect(() => {
  const handler = (event: any) => { /* ... */ };
  const off = bridge.subscribe(handler);
  return () => off?.();  // unsubscribe on unmount
}, []);
```

If using strict mode, ensure no early-returns leave handlers dangling between mount/unmount cycles.

---

## Iframe sandbox warnings / `postMessage` blocked

**Symptoms**
- Browser console: "Refused to load … due to its frame ancestor"
- Bridge calls fail silently in dev

**Diagnose**
- Are you opening the Mini App URL directly in the browser (not via VK)? You're not inside the VK iframe — bridge can't work.
- Is your custom domain configured in the VK Mini App dashboard? VK's iframe will reject mismatched origins.

**Fix**
- For local dev: serve over HTTPS via ngrok / cloudflared and register the tunnel URL in the app dashboard as the Mini App URL. Then open vk.com/app<APP_ID> — the iframe loads your tunnel.
- For prod: ensure your domain matches the registered URL exactly (no www/non-www mismatch, no http→https redirect on the first request).

---

## Desktop runtime differs from mobile WebView

**Symptoms**
- Method `VKWebAppOpenCodeReader` works on mobile, missing on desktop
- Status bar customization has no effect on desktop

**Reason**
Desktop is its own runtime; method coverage is platform-dependent. Hardware-bound methods (camera, geolocation, contacts, code reader) often don't exist on desktop.

**Fix**
Branch behavior on `parseURLSearchParamsForGetLaunchParams(...).vk_platform`:

```ts
const isDesktop = ['desktop_web', 'mobile_web'].includes(params.vk_platform ?? '');
if (!isDesktop && bridge.supports('VKWebAppOpenCodeReader')) {
  await bridge.send('VKWebAppOpenCodeReader', {});
}
```

Always provide a fallback for non-supported runtimes (paste-code input, browser-native `<input capture>`, etc.).

---

## User logged into VK on web but `vk_user_id` is unexpected

**Symptoms**
- Two different `vk_user_id` values arrive for the same person

**Common causes**
- User has multiple VK accounts and switched while your tab was open. The new app launch carries the new identity.
- Tester account vs production account confusion.

**Fix**
Bind your session to the verified `vk_user_id` on every API request — don't cache it across launches in client state. If launch params change between two requests, treat it as a new session and re-authenticate.

---

## `messages.send` returns `error_code: 7` (no permission)

**Symptoms**
- Notification sends fail
- User claims they tapped "allow"

**Common causes**
- The user denied permission, then `VKWebAppAllowNotifications` was never re-prompted.
- User revoked from VK settings between when they granted and now.
- You're using a personal app — community required for `messages.send` with intent.

**Fix**
- Check `vk_are_notifications_enabled` on every launch; show CTA if `0`.
- Mark the user as `notifications_revoked = true` on `error_code: 7` so you don't retry until they re-grant.

---

## `VKWebAppInit` rejects with "Unknown bridge method"

**Symptoms**
- `await bridge.send('VKWebAppInit')` throws

**Diagnose**
- Running outside VK client (browser, dev mode)? Expected — wrap with try/catch.
- Very old VK client version that doesn't recognize the method name? Unlikely now, but possible on outdated Android builds.

**Fix**
```ts
try {
  await bridge.send('VKWebAppInit');
} catch (err) {
  // Fall back to standalone mode
  setStandalone(true);
}
```

---

## My typed wrapper / `satisfies` thinks `send` returns `any`

**Symptoms**
- TypeScript autocomplete missing for method results
- `result.transaction_id` typed as `any`

**Fix**
- Import the method name as a string literal type, not as a variable. `bridge.send('VKWebAppOpenPayForm', ...)` is correctly typed; `const m = 'VKWebAppOpenPayForm'; bridge.send(m, ...)` widens to `string` and loses the discrimination.
- Update `@vkontakte/vk-bridge` to the current major — older versions had looser types.
