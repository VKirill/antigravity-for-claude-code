# Changelog — vk-bridge

## v1.0.0 — 2026-05-16

Initial release. Pattern 2 structure for `@vkontakte/vk-bridge` 3.0.x integration in VK Mini Apps.

### Added

- `SKILL.md` navigator with high-stakes risk tag (payments + identity)
- `references/REFERENCE.md` — capability map and decision flow
- `references/setup.md` — install, `VKWebAppInit`, `bridge.isEmbedded()`, supports/supportsAsync, middleware
- `references/launch-params.md` — vk_* params, parseURLSearchParamsForGetLaunchParams, **canonical Node.js HMAC-SHA256 sign verification** with base64url no-padding
- `references/auth-and-identity.md` — VKWebAppGetUserInfo, VKWebAppGetEmail/PhoneNumber, VKWebAppGetAuthToken scopes, VKWebAppCallAPIMethod, server-side VK API flow
- `references/ui-events.md` — VKWebAppUpdateConfig (theme, insets, viewport), VKWebAppSetViewSettings, swipe-back control, `useAppearance` / `useInsets` React hooks
- `references/sharing-and-social.md` — VKWebAppShare, VKWebAppShowWallPostBox, VKWebAppShowStoryBox, VKWebAppShowInviteBox
- `references/payments.md` — VKWebAppOpenPayForm (`pay-to-service` / `pay-to-user` / `pay-to-group` / `transfer-to-user` / `transfer-to-group`), idempotency via `transaction_id`, server-side verification pattern, comparison vs CloudPayments/YooKassa
- `references/storage.md` — VKWebAppStorageSet/Get/GetKeys, quotas, key namespacing, vs server-side
- `references/notifications.md` — VKWebAppAllowNotifications, messages.send with intent (`non_promo_newsletter`, `confirmed_notification`), `random_id` idempotency
- `references/community-apps.md` — vk_group_id, vk_viewer_group_role, admin gating with defense-in-depth via VK API
- `references/troubleshooting.md` — symptom-indexed: bridge hangs, supports lies, sign mismatch, VK Pay race, events not firing, iframe sandbox, desktop quirks, error_code 7
- `references/recommended-defaults.md` — sign TTL (1 hour), bridge.send timeout (5 s), storage prefix, VK API version pin, VK Pay polling backoff
- `references/wrong-vs-right.md` — 5 high-stakes pairs: trusting vk_user_id, idempotency keying, supports check, token storage, admin gating
- `references/eval-cases.md` — 10 positive / 10 negative / 7 edge routing tests

### Related skills referenced

- `react`, `typescript`, `nodejs`, `zod`, `fastify`, `hono`, `postgresql`, `redis`, `telegram-bot`, `cloudpayments`, `yookassa`, `karpathy-guidelines`, `skill-evaluation`
