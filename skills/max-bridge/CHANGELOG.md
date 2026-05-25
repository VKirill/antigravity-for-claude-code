# Changelog — max-bridge

All notable changes to this skill are tracked here.

## [1.0.0] — 2026-05-16

### Added
- Initial release covering MAX Bridge for mini-apps in the MAX messenger (VK Tech, RU market).
- Pattern 2 reference layout:
  - `references/REFERENCE.md` — decision map / index.
  - `references/setup.md` — CDN script integration, TypeScript types, environment detection, dev stub.
  - `references/bridge-api.md` — consolidated capability matrix of every documented `window.WebApp.*` method, sub-object surface, and explicit list of capabilities NOT documented upstream (themes, payments, viewport events, main button, cloud storage).
  - `references/launch-data-validation.md` — server-side HMAC-SHA256 validation, full Node.js production validator with `timingSafeEqual`, structured error types, and Cloudflare Workers / Vercel Edge variant via Web Crypto. Fastify `preHandler` and Hono middleware integration examples.
  - `references/comparison-vk-bridge.md` — side-by-side method mapping, signing-algorithm diff (two-layer HMAC for MAX vs single-layer for VK; hex vs base64url; `\n` vs `&` separator), multi-platform architecture guidance.
  - `references/troubleshooting.md` — 11 symptom-indexed entries covering bridge-not-loaded, signature mismatch, empty initData, openLink no-op without user gesture, biometry closes app, CSP / iframe breakage, server clock drift.
  - `references/recommended-defaults.md` — single source of truth for validation TTL (3600 s matching upstream), clock-drift tolerance, retry policy, cache strategy, CSP directives, header naming, 401 response shapes.
  - `references/wrong-vs-right.md` — five high-stakes pairs: trusting `initDataUnsafe`, skipping TTL, hardcoding bot token in client, leaving `hash` in `launch_params`, treating native methods as guaranteed-available.
  - `references/eval-cases.md` — positive / negative / edge routing prompts.
- Hybrid pattern upstream mirror:
  - `references/upstream/bridge.md` — verbatim mirror of `https://dev.max.ru/docs/webapps/bridge`.
  - `references/upstream/validation.md` — verbatim mirror of `https://dev.max.ru/docs/webapps/validation`, including the upstream TypeScript reference implementation.
  - `references/upstream/SOURCE.md` — attribution, fetch date, sibling navigation discovered, re-sync instructions.

### Notes

- MAX is a young platform launching in 2025–2026. The API surface captured here is the snapshot as of 2026-05-16 fetched from `dev.max.ru`. Expect API evolution — payments, themes, viewport events, and other Telegram-WebApp / VK-Bridge equivalents are NOT documented upstream as of this release.
- `STACK_VERSIONS.md` pins MAX Bridge as **`docs-only`** (no public npm package). No version block is injected into `SKILL.md` until MAX publishes a stable, semver-versioned SDK.
- Risk classification: **`high-stakes`** — the skill is identity-critical (HMAC validation of user identity) and is likely-payments-adjacent in production deployments. A `references/troubleshooting.md` and a `references/wrong-vs-right.md` ship with v1.0.0 as required by the high-stakes audit checklist.
- Re-sync policy: re-fetch upstream pages at least quarterly, or when a user reports a method documented upstream that this skill does not cover. Diff `references/upstream/*.md` against fresh fetches before bumping minor/patch versions.

### Known gaps

- Upstream code-example tabs for Python / Go / Java in the validation page were not extractable from the server-rendered HTML at fetch time. Only the TypeScript example is mirrored verbatim. Re-fetch with a headless browser when those examples are needed.
- No payments documentation found upstream — if MAX adds Payments later, this skill must gain a `payments.md` reference and the description trigger terms must be updated.
- No theme parameter surface documented — if MAX adds theme params, add `themes.md` and update the «What is NOT in the API surface» list in `bridge-api.md`.
