# Notifications

Push notifications to a VK user happen through the host VK client. Your Mini App requests permission via the bridge; the actual send is a server-side VK API call from your community account.

## The two stages

1. **Bridge**: `VKWebAppAllowNotifications` — prompts the user for consent.
2. **Server**: `messages.send` (community → user direct message) with `intent` parameter.

## Step 1 — request consent

```ts
import bridge from '@vkontakte/vk-bridge';

try {
  await bridge.send('VKWebAppAllowNotifications');
  // User granted permission — record on server
  await fetch('/api/notifications/enabled', { method: 'POST' });
} catch (err: any) {
  if (err?.error_data?.error_reason === 'User denied') {
    // Show inline explanation, let user retry on button click
  }
}
```

Don't auto-prompt on first launch. Show a brief inline explainer first, prompt on a deliberate user action.

## Detecting current state

The launch param `vk_are_notifications_enabled` (0 or 1) tells you the current state when the app opens. Use it to decide whether to show the "enable notifications" CTA.

```ts
const params = parseURLSearchParamsForGetLaunchParams(window.location.search);
if (params.vk_are_notifications_enabled === 0) {
  // Show CTA — they haven't granted or have revoked
}
```

## Revoking

`VKWebAppDenyNotifications` revokes consent from inside the app:

```ts
await bridge.send('VKWebAppDenyNotifications');
```

The user can also revoke in their VK settings → "Игры и приложения" → your app. After revocation, `vk_are_notifications_enabled` returns `0` on next launch.

## Step 2 — sending via VK API

Use the **community access token** (community → "Работа с API" → "Создать ключ", with `messages` scope) to send. Service tokens and user tokens are not allowed for this method.

```ts
async function sendNotification(userId: number, text: string, intent: 'non_promo_newsletter' | 'confirmed_notification') {
  const url = new URL('https://api.vk.com/method/messages.send');
  url.searchParams.set('access_token', COMMUNITY_TOKEN);
  url.searchParams.set('v', '5.131');
  url.searchParams.set('user_id', String(userId));
  url.searchParams.set('random_id', String(Date.now() + Math.floor(Math.random() * 1000)));
  url.searchParams.set('intent', intent);
  url.searchParams.set('message', text);
  url.searchParams.set('subscribe_id', '1');  // optional — subscription category id, if you've configured them

  const res = await fetch(url, { method: 'POST' });
  const json = await res.json();
  if (json.error) throw new Error(`VK_API_${json.error.error_code}: ${json.error.error_msg}`);
  return json.response;
}
```

### Intents

| Intent | Meaning | Constraints |
|---|---|---|
| `non_promo_newsletter` | Periodic non-promotional update | Subject to VK rate limits and category subscriptions |
| `confirmed_notification` | Transactional (order paid, password reset) | Higher trust, lower volume |
| `promo_newsletter` (legacy) | Promotional content | Often restricted / no longer accepted — verify in current docs |

Always pick the intent that matches the actual content. Misusing `confirmed_notification` for marketing will lead to revocation of your community's notify permission.

### `random_id` — idempotency

`messages.send` accepts a `random_id` field. Pass a stable hash of the logical message (e.g., `hash(user_id + event_id)`) — VK deduplicates within ~1 hour, preventing accidental double-sends from your retry layer.

## Subscription categories (optional)

For larger apps, segment notifications: VK lets you configure named subscription categories (e.g., "Sales", "New features", "Security") in the app dashboard. The user can opt in/out per-category. Pass `subscribe_id` matching the category in `messages.send`.

## Handling delivery failures

| `error_code` | Meaning | Action |
|---|---|---|
| 7 | User has not granted permission | Stop sending; show CTA on next launch |
| 901 | Privacy settings restrict messaging | Stop sending; surface in account UI |
| 902 | Group is hidden | Check community config |
| 6 | Rate limit | Backoff and retry later |
| 15 | User blocked the community | Mark inactive; do not retry |

Wrap sends in a queue (BullMQ) with exponential backoff for transient errors and a "never retry" marker for terminal codes 7/15/901.

## Pitfalls

- **No web push** — this is in-VK only. The notification appears as a community DM in the user's VK inbox, plus a push if they have VK mobile installed and push enabled at the OS level.
- **`vk_are_notifications_enabled` is launch-time** — to detect revocation mid-session, re-fetch on `VKWebAppViewRestore` or call your own server endpoint that re-checks via VK API.
- **Community vs personal apps** — personal apps cannot send notifications. You need a community-app context with a community token. Check `vk_group_id` in launch params.
- **Don't blast promotional content** — VK will revoke your community's notify permission. Use subscription categories to let users opt in.
