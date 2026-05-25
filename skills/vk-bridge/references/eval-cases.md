# Eval cases — vk-bridge skill routing tests

Positive cases should load the skill; negative cases should NOT load it; edge cases verify disambiguation.

## Positive (should load `vk-bridge`)

1. "Help me set up `@vkontakte/vk-bridge` in my React Mini App."
2. "How do I validate `vk_user_id` server-side?"
3. "Реализуй проверку подписи параметров запуска VK Mini App на Node.js."
4. "VKWebAppOpenPayForm with action `pay-to-service` — what's the merchant signature algorithm?"
5. "How do I subscribe to theme changes from the VK client in my Mini App?"
6. "Запрашиваю VKWebAppGetAuthToken, какие scopes нужны для wall.post?"
7. "Show me how to use `useAppearance` from `@vkontakte/vk-bridge-react`."
8. "В community mini app получить роль администратора — vk_viewer_group_role validation."
9. "Why is my HMAC-SHA256 sign always invalid? I'm using base64 encoding."
10. "Send a notification to a VK user via messages.send with intent=non_promo_newsletter."

## Negative (should NOT load `vk-bridge`)

1. "Build a Telegram Mini App with initData validation." → `telegram-bot`
2. "Set up Stripe Checkout for my e-commerce site." → not relevant
3. "Render a 3D scene with Three.js." → not relevant
4. "Configure CloudPayments webhook with Content-HMAC." → `cloudpayments`
5. "How do I create a Vue 3 component with `<script setup>`?" → `vue`
6. "Set up a Fastify route with Zod validation." → `fastify` + `zod` (unless VK context mentioned)
7. "What's the YooKassa idempotency key header?" → `yookassa`
8. "Install Prisma with PostgreSQL." → `prisma` + `postgresql`
9. "Build a Discord bot in TypeScript." → not relevant
10. "Configure Angie reverse proxy on Ubuntu 24.04." → `linux-sysadmin`

## Edge cases (disambiguation)

1. **"Validate launch params HMAC in a Russian-market Mini App"** — could be VK or Telegram. Trigger terms `vk_user_id` / `VKWebApp` / `vk-bridge` route to this skill; `initData` / `tgWebAppData` route to `telegram-bot`. If ambiguous, ask which platform.
2. **"Process a payment from a user in our VKontakte app, route to CloudPayments instead of VK Pay"** — both skills load. `vk-bridge` for the Mini App launch context, `cloudpayments` for the actual payment widget integration.
3. **"Send a push notification from our community"** — `vk-bridge` (notification request + messages.send pattern). Not generic push (FCM/APNs).
4. **"User says 'мини-приложение' but doesn't specify which platform"** — ask. RU-language `мини-приложение` could be VK, Telegram, MAX, RuStore, OK.
5. **"Build the React UI for a VK Mini App"** — `react` for UI patterns + `vk-bridge` for bridge integration. Both loaded. UI design / VKUI questions → `ui-ux-pro-max`.
6. **"OAuth into a VK API outside a Mini App context"** — bare VK ID OAuth without bridge → `nodejs` (raw HTTP) or `better-auth`. This skill is bridge-specific.
7. **"Theme detection in a SPA"** — only relevant to this skill if the SPA is a VK Mini App. Otherwise `react` or `tailwind`.
