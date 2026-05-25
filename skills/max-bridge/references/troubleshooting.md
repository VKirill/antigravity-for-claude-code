# Troubleshooting — MAX Bridge

Symptom-indexed. Find the user-visible failure, follow the diagnosis, apply the fix.

---

## `window.WebApp` is undefined in the mini-app

**Symptoms**
- TypeError: «Cannot read property of undefined (reading 'initData')»
- The mini-app works in a regular browser but fails inside MAX

**Diagnose**
```bash
# 1. Confirm the CDN script tag is in <head> and NOT deferred
grep -n 'max-web-app.js' src/*.html

# 2. Verify the script URL responds (from your dev machine)
curl -I https://st.max.ru/js/max-web-app.js
```

**Common causes**
- Script tag is `<script defer src=...>` or `type="module"` — bundle reads `window.WebApp` before the script executes.
- Content-Security-Policy header blocks `st.max.ru` — check `script-src` directive in your CSP.
- iframe sandboxing strips `allow-scripts` or your app is hosted in an iframe without the right `allow` flags.

**Fix**
- Place the script tag in `<head>`, NOT deferred, NOT `type="module"`:
  ```html
  <script src="https://st.max.ru/js/max-web-app.js"></script>
  ```
- Add `st.max.ru` to your CSP `script-src` directive.
- If you must support pre-script access, guard with `getWebApp()` helper (see `setup.md`) that returns `null` instead of throwing.

---

## Signature validation always fails on the server

**Symptoms**
- Every authenticated request returns 401 with `code: 'bad_signature'`
- `initData` is non-empty; the client says everything is fine
- Works on one environment but not another

**Diagnose**
```bash
# 1. Print the exact initData received server-side
# (truncate the hash to log safely)

# 2. Replay through the reference TypeScript implementation from upstream/validation.md
# 3. Confirm BOT_TOKEN is the same one the bot is registered with (not a stale rotation)
```

**Common causes**
- **Bot token mismatch.** Bot was rotated; backend still has old token.
- **Decode applied twice.** Body parser auto-decoded `initData`, then you decoded again.
- **Decode not applied.** Values still URL-encoded when joined into `launch_params`.
- **Wrong sort.** Used `localeCompare()` instead of ASCII order.
- **Wrong separator.** Used `&` instead of `\n` between pairs.
- **`hash` not excluded** from `launch_params` (signing includes its own signature).
- **Used `initDataUnsafe.hash`** as the comparison target — the unsafe object can be mutated by user code in the iframe.
- **Treated `auth_date` as milliseconds**, then computed «expired» mistakenly. (This shows up as `expired`, not `bad_signature`, but is the next-most-common.)

**Fix**
- Use the reference implementation in [`launch-data-validation.md`](launch-data-validation.md) unchanged. Diff your custom version against it.
- Log `launchParams` (the string fed into HMAC) once during incident response — most bugs are visible on inspection.
- Re-verify against the upstream TypeScript example in [`upstream/validation.md`](upstream/validation.md).

---

## `initData` is empty string when opened inside MAX

**Symptoms**
- `window.WebApp.initData === ''`
- `initDataUnsafe.user.id` looks plausible
- This only happens on specific platforms

**Common causes**
- Mini-app was opened directly by URL (not via the MAX entry point) — the platform never injected launch params.
- The launch URL fragment was stripped by a redirect upstream of your app (e.g., a CDN edge rewrite).

**Fix**
- Confirm the URL still has `#WebAppData=...` after all redirects. Use the Network panel to inspect the final URL.
- If your app SPA-routes on the fragment, capture `WebAppData` once on first load before your router consumes it.

---

## `initDataUnsafe.user` is populated but the user has no bot interaction

**Symptoms**
- `initDataUnsafe.user.id` is a valid number
- Server-side validation passes
- But the bot has never received a `/start` from this user, so backend has no record

**Cause**
- This is normal. Mini-apps can be launched in scenarios where the user discovers the app without having started the bot. Treat the first authenticated request as «user just joined» and create the user row lazily — bound to the validated `user.id`, NOT to the bot's user-state table.

---

## Promise rejects on `web` platform for storage / biometry / haptic / NFC

**Symptoms**
- `wa.DeviceStorage.setItem(...)` → rejects with `{ error: { code: '...' } }`
- `wa.HapticFeedback.impactOccurred('light')` → same
- Works on iOS / Android, fails on `web`

**Cause**
- Upstream documents these as «Не поддерживается веб-клиентом». NFC is Android-only. Biometry is iOS / Android only.

**Fix**
- Capability-check first:
  ```typescript
  if (wa.platform !== 'web' && wa.platform !== 'desktop') {
    await wa.HapticFeedback.impactOccurred('light');
  }
  ```
- For `DeviceStorage`, fall back to `localStorage` on `web` with the same key namespace.

---

## `BiometricManager.openSettings()` closes the mini-app and never comes back

**Symptoms**
- After calling `openSettings()`, the mini-app disappears
- User has to re-launch manually

**Cause**
- This is documented behaviour: «Вызывает закрытие мини-приложения». Same for `NfcManager.openSystemSettings()`.

**Fix**
- Persist any in-flight state to `DeviceStorage` before calling `openSettings()`.
- On next launch, detect the «returning from settings» case by re-calling `BiometricManager.init()` and checking `accessGranted`.

---

## `openLink(url)` or `downloadFile(...)` silently does nothing

**Symptoms**
- Promise never resolves OR returns `cancelled` immediately
- No system browser opens
- Same code worked in development

**Cause**
- Upstream: «MAX Bridge проверяет клик пользователя в мини-приложении. Если клика не было, перехода по ссылке не будет».
- You called `openLink` from a timer, `useEffect`, or `Promise.then` — not from a user-gesture-rooted handler.

**Fix**
- Always invoke `openLink` / `downloadFile` / `shareMaxContent` directly inside the click / touchend handler. Do not `await` anything between the user event and the call:
  ```typescript
  button.addEventListener('click', () => {
    wa.openLink('https://example.com'); // synchronous; user gesture still active
  });
  ```

---

## `shareMaxContent({ mid })` rejects or shares the wrong content

**Symptoms**
- The wrong file shows up in the recipient chat
- Or share sheet opens but the bot's message doesn't appear as the attachment

**Common causes**
- `mid` was reused across sessions — a `mid` is bound to the message the bot posted to the user; not a generic content ID.
- The bot has NOT posted that message to the current user yet. Upstream flow: «Бот отправляет контент пользователю, например медиафайл … Мини-приложение получает идентификатор этого сообщения `mid`».
- `chatType` is `DIALOG` for a `CHAT` recipient (or vice versa).

**Fix**
- Always fetch a fresh `mid` from your backend by having the bot post the content to the user immediately before the share. Do not cache `mid` across sessions.
- Verify `chatType` matches the destination: `DIALOG` for 1:1, `CHAT` for groups.

---

## `BackButton.onClick(callback)` does not fire

**Symptoms**
- User taps the system back button in MAX header
- Your callback never runs
- App navigates back to the chat list instead

**Common causes**
- `BackButton.show()` was never called — without it the button stays hidden and the gesture is handled by the platform.
- Callback was an inline arrow function on `useEffect`, never re-registered after re-render. You also passed a different function to `offClick`, leaving stale subscriptions.

**Fix**
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  wa.BackButton.onClick(handler);
  wa.BackButton.show();
  return () => {
    wa.BackButton.offClick(handler); // same reference
    wa.BackButton.hide();
  };
}, []);
```

---

## CSP / iframe headers break the bridge

**Symptoms**
- `window.WebApp` is undefined
- Console: «Refused to load the script 'https://st.max.ru/js/max-web-app.js' because it violates the following Content Security Policy directive»

**Fix**
- CSP headers must include `https://st.max.ru` in `script-src`.
- Inside MAX, the mini-app runs in an iframe. Your hosting must NOT set `X-Frame-Options: DENY` or a `frame-ancestors` directive that excludes `max.ru`.
- Use Angie / Nginx config:
  ```nginx
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://st.max.ru; frame-ancestors https://*.max.ru;" always;
  ```

---

## `initData` validation succeeds but `auth_date` keeps being «just now» on stale tabs

**Symptoms**
- User opened the mini-app yesterday, left the tab open
- They return today, every request still validates
- Your TTL is 1 hour but it never trips

**Cause**
- `initData` is captured at launch and reused. It does not auto-refresh.
- Your client is sending yesterday's `initData` today; if your validation TTL is generous, the timestamp `auth_date` is the gate.

**Fix**
- Server-side TTL must be enforced (`MaxValidationError('expired')`). See `recommended-defaults.md`.
- On the client, if you detect a 401 with `code: 'expired'`, reload the page — MAX will re-inject a fresh `WebAppData` fragment.

---

## Server-side time drift causes false `expired`

**Symptoms**
- Random users get `code: 'expired'` immediately after launching
- `auth_date` looks recent (seconds ago)
- Other users are fine

**Cause**
- Server clock is ahead of client by more than your safety margin.
- Common on un-tuned VMs without `chrony` / `systemd-timesyncd`.

**Fix**
```bash
# On server (Ubuntu 24.04):
timedatectl status
sudo systemctl enable --now systemd-timesyncd
```
Add at least a 60 s tolerance on the past direction (`auth_date - now > 60` is still acceptable; account for client clock drift in the other direction).
