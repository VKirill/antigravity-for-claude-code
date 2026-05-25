# Eval Cases — Routing Tests for max-bridge

User-voice prompts grouped by expected behavior. Run these against Claude to confirm the skill activates correctly.

## Positive (skill SHOULD load)

1. «Как валидировать initData в мини-приложении MAX?»
2. «Подключаю MAX Bridge — где взять скрипт max-web-app.js?»
3. «How do I verify the hash signature from window.WebApp.initData server-side?»
4. «Делаем мини-приложение для мессенджера MAX, как достать user.id?»
5. «MAX webapp на React — нужна типизация window.WebApp»
6. «У меня signature mismatch при проверке initData от MAX Bridge — как дебажить?»
7. «Чем отличается WebAppData в MAX от launch params в VK Bridge?»
8. «Реализуем оплату в мини-приложении MAX — есть API?» (skill should activate AND warn that payments aren't documented upstream)
9. «window.WebApp.BiometricManager.authenticate — что возвращает?»
10. «MAX мини-приложение в Nuxt 4 — как обернуть bridge?»
11. «dev.max.ru/docs/webapps/bridge — найди для меня openCodeReader»
12. «Мне нужна RU-аналог Telegram Mini Apps, только под МАХ»
13. «Validate launch data from MAX webapp using bot token»
14. «What's the HMAC algorithm for MAX initData?»
15. «MAX webapp для VK Tech messenger — где документация?»

## Negative (skill should NOT load)

1. «Как настроить Telegram Mini App?» → telegram-bot
2. «VK Bridge VKWebAppOpenPayForm не работает» → vk-bridge
3. «Build me a React component for a button» → react / shadcn
4. «PostgreSQL индекс по jsonb-полю» → postgresql
5. «How to set up Cloudflare Worker?» → hono
6. «Анализ траффика nginx логов» → linux-sysadmin
7. «Discord bot с slash-commands» → unrelated
8. «Оплата через ЮКассу» → yookassa
9. «WhatsApp Business API webhook» → unrelated
10. «Vue 3 reactivity — почему не обновляется ref?» → vue

## Edge cases (ambiguous — verify the routing)

1. «Мини-приложение для MAX с CloudPayments» → BOTH max-bridge AND cloudpayments should load. The skill should reference cloudpayments for payment integration, not invent a MAX-native payment API.
2. «Сделай платежи в MAX webapp через ЮKassa» → max-bridge + yookassa. Same logic.
3. «Telegram WebApp initData vs MAX initData — какая разница?» → both telegram-bot and max-bridge should be available; max-bridge should provide the algorithm comparison.
4. «Migrating from VK Mini App to MAX» → max-bridge primary, vk-bridge secondary. The `comparison-vk-bridge.md` reference must be the answer's anchor.
5. «Мини-приложение работает в браузере, но в MAX не запускается» → max-bridge (troubleshooting.md), not generic browser debugging.

## Expected reference loads by query type

| Query mentions | Should open |
|---|---|
| "signature" / "hash" / "validate" / "HMAC" | `launch-data-validation.md`, `wrong-vs-right.md` (pair 4) |
| "VK Bridge" / "VK Mini App" / "migrate" | `comparison-vk-bridge.md` |
| "script tag" / "CDN" / "max-web-app.js" / "init" | `setup.md` |
| "не работает" / "fails" / "broken" / "doesn't fire" | `troubleshooting.md` |
| "TTL" / "retry" / "timeout" / "cache" | `recommended-defaults.md` |
| "all methods" / "API surface" / "what can I do" | `bridge-api.md`, `upstream/bridge.md` |

## Anti-trigger sanity

Confirm the SKIP rules in the SKILL.md description correctly route:

- "Telegram Mini App initData" → telegram-bot, NOT max-bridge
- "VK Mini App sign validation" → vk-bridge, NOT max-bridge
- "generic OAuth flow" → nodejs / better-auth, NOT max-bridge
