# Auth and identity

VK Bridge exposes three layers of identity:
1. **Launch params** (`vk_user_id` + verified `sign`) — proves user identity. Free, no extra prompt.
2. **Profile fields** (`VKWebAppGetUserInfo`) — name, photo. No extra consent.
3. **OAuth scopes** (`VKWebAppGetAuthToken`) — friends, messages, wall, etc. User-prompted consent.

Always start with launch params for identity; only request OAuth scopes if you genuinely need them — every prompt is friction.

## `VKWebAppGetUserInfo`

Returns the current viewer's basic profile. No additional consent.

```ts
import bridge from '@vkontakte/vk-bridge';

type UserInfo = {
  id: number;
  first_name: string;
  last_name: string;
  sex: 0 | 1 | 2;            // 0 = unknown, 1 = female, 2 = male
  city: { id: number; title: string };
  country: { id: number; title: string };
  bdate: string;             // 'DD.MM.YYYY' or 'DD.MM'
  photo_100: string;
  photo_200: string;
  timezone: number;
};

const user = (await bridge.send('VKWebAppGetUserInfo')) as UserInfo;
console.log(`${user.first_name} ${user.last_name}`);
```

Treat the response as untrusted until you cross-check `user.id` against the verified `vk_user_id` from launch params. The two should match.

## `VKWebAppGetEmail` and `VKWebAppGetPhoneNumber`

User-prompted consent — they can decline.

```ts
try {
  const { email } = await bridge.send('VKWebAppGetEmail');
  // email: string
} catch (err) {
  // User declined or the platform doesn't support email
  if (err.error_type === 'client_error' && err.error_data?.error_code === 4) {
    // Code 4 = user denied
  }
}

const { phone_number, sign } = await bridge.send('VKWebAppGetPhoneNumber');
// phone_number: '79991234567'
// sign: HMAC over phone_number — verify server-side
```

Phone numbers come with their **own** signature — verify on the server before storing or trusting the number.

## `VKWebAppGetAuthToken` — OAuth scopes

Request an access token bound to your Mini App + a set of scopes:

```ts
const { access_token, scope } = await bridge.send('VKWebAppGetAuthToken', {
  app_id: Number(import.meta.env.VITE_VK_APP_ID),
  scope: 'friends,photos,wall',
});
```

Common scopes:
- `friends` — `friends.get`, `friends.search`
- `photos` — read user photo albums
- `wall` — post on user's wall (write — high-risk; users often decline)
- `messages` — community-side `messages.send` (community apps)
- `notify` — push notifications
- `email` — user's email (cheaper than `VKWebAppGetEmail`)
- `groups` — list of user's groups
- `offline` — long-lived token (no automatic expiry)

`scope` in the response is a bitmask string of actually-granted scopes (the user may grant a subset of what you requested). Validate that what you got covers what you need before proceeding.

## Calling VK API through the bridge

`VKWebAppCallAPIMethod` proxies API calls. Useful for client-only flows where you don't want to round-trip to your server, and to bypass CORS / origin restrictions.

```ts
const { response } = await bridge.send('VKWebAppCallAPIMethod', {
  method: 'users.get',
  params: {
    user_ids: '1,2,3',
    access_token,
    v: '5.131',
    fields: 'photo_200,city',
  },
});
// response: User[]
```

Pass the access_token explicitly. The `v` parameter is the VK API version — pin a stable version (`5.131` is current and widely used; check the official changelog for what's available in your timeframe).

## Server-side calls — when to prefer them

Prefer server-side VK API calls when:
- The action mutates state (`wall.post`, `messages.send`, `groups.join`) — server can rate-limit, log, retry safely
- The result depends on app secret (e.g., the app's service token for `secure.*` methods)
- You want a single audit trail and idempotency layer

Server-side flow:
1. Client obtains `access_token` via `VKWebAppGetAuthToken` and sends it to the server (HTTPS body or Authorization header).
2. Server stores it bound to the verified `vk_user_id` from launch params.
3. Server calls `https://api.vk.com/method/<method>` with the token as a query/body param.

```ts
// Server-side example (Node 24, fetch)
async function vkApi(method: string, accessToken: string, params: Record<string, string>) {
  const url = new URL(`https://api.vk.com/method/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('v', '5.131');
  const res = await fetch(url, { method: 'POST' });
  const json = await res.json();
  if (json.error) throw new Error(`VK_API_${json.error.error_code}: ${json.error.error_msg}`);
  return json.response;
}
```

## Service token vs user token

| Token type | How to obtain | Use for |
|---|---|---|
| **User access_token** (via `VKWebAppGetAuthToken`) | User consent flow | Operations on behalf of the user — wall.post, friends.get |
| **Service token** | App settings → "Ключи доступа" → "Сервисный ключ" | Public/no-user-context calls — `users.get` of public profiles, `database.*` lookups |
| **Community token** | Community settings → "Работа с API" → "Создать ключ" | Community-side actions — `messages.send` from group, `wall.post` to community |

The service token is the only one safe to ship server-side as an env var. Never embed user tokens or community tokens in code or logs.

## Token lifecycle

- User tokens without `offline` scope expire after a few hours; the user re-grants on next launch if needed.
- With `offline` scope, tokens are long-lived but can still be revoked by the user (in VK settings → "Игры и приложения") — handle `error_code: 5` (auth failed) by re-requesting via `VKWebAppGetAuthToken`.
- Store the granted `scope` alongside the token — re-prompt if you later need a scope you don't have.

## Permission denial UX

When the user declines (`VKWebAppGetEmail`, `VKWebAppGetAuthToken`), the promise rejects with `{ error_type: 'client_error', error_data: { error_code, error_reason } }`. Don't re-prompt immediately — the user just said no. Show an inline explanation of why you need it and let them retry on a button click.

```ts
async function requestEmail(): Promise<string | null> {
  try {
    const { email } = await bridge.send('VKWebAppGetEmail');
    return email;
  } catch (err: any) {
    if (err?.error_data?.error_reason === 'User denied') return null;
    throw err;
  }
}
```
