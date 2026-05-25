# fastify skill — CHANGELOG

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards. `risk: high-stakes` added (production HTTP framework = request-handling trust boundary). Bullmq v2.0.1 used as gold-standard exemplar.

### Added
- `references/recommended-defaults.md` — canonical values for `bodyLimit`/`connectionTimeout`/`keepAliveTimeout`/`requestTimeout`/`trustProxy`, Pino logger config with redact, type provider choice matrix, plugin registration order, `@fastify/rate-limit` defaults, CORS allowlist pattern, JWT secret rotation, HTTPS termination guidance, graceful shutdown PM2/k8s timing, raw-body webhook pattern. All knobs include default + range + tune-up / tune-down conditions.
- `references/troubleshooting.md` — required for `risk: high-stakes` per v3. Symptom-indexed: schema validation cryptic AJV path, raw body lost for webhooks, plugin encapsulation surprise, `FST_ERR_*` matrix, logger silently dropped, 502/504 from upstream proxy, memory leak from plugin lifecycle, TypeBox vs Zod conflict, WebSocket drops, graceful shutdown drops in-flight, schema serialization strips fields. Each entry has Symptoms → Diagnose → Common causes → Fix.
- `references/wrong-vs-right.md` — 5 production wrong-vs-right pairs with "Why it matters": schema vs no-schema serialization, raw-body vs parsed for HMAC, `fastify-plugin` vs scoped decorator, `trustProxy` correct vs wrong, Pino logger redact for sensitive fields.

### Changed
- `SKILL.md` compressed 241 → 199 lines. Capabilities section now one-liner-per-domain pointing to references — removed inline code blocks that duplicated reference content. Description rewritten to 596 chars (within ≤600 limit) with sharper trigger terms and SKIP-only routing guidance.
- Frontmatter `risk: high-stakes` added — triggers v3 mandatory artifacts (troubleshooting + recommended-defaults).
- `packages` frontmatter — added `fastify-raw-body` (community webhook plugin).
- `references/eval-cases.md` rewritten in v3 format: user-voice phrasing (Russian/typos/incomplete) + "Expected behavior" column that names which sub-files should load, not just whether the skill activates.
- Behavioral Traits and Important Constraints updated to reference `recommended-defaults.md` for numeric values — eliminates cross-file drift. Added constraints around `JSON.stringify` for HMAC, `origin: '*'` + `credentials`, `keepAliveTimeout` vs LB.

### Verified versions (Context7, 2026-05-15)
- Confirmed via `/fastify/fastify`: server option defaults (`bodyLimit` 1 MB, `keepAliveTimeout`/`connectionTimeout`/`requestTimeout` default `null`), Pino logger config including `redact`, `addContentTypeParser` with `parseAs: 'buffer'` for raw body, `setErrorHandler` shape, graceful shutdown via `app.close()`.
- Confirmed via `/sinclairzx81/typebox`: package name `typebox` for 1.x (vs `@sinclair/typebox` for legacy 0.34.x), `import Type from 'typebox'` default import.
- No hallucinated imports introduced. Existing `import Type from 'typebox'` (already in `validation-schemas.md`) re-verified correct.
- `fastify-raw-body` is the canonical community plugin (NOT `@fastify/raw-body`).

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation under skill-evaluation v2 standards (Pattern 2)
- SKILL.md navigator with 9 reference files + eval-cases
- `references/core-api.md` — Fastify() options, instance lifecycle, hooks, decorators, logger
- `references/routing.md` — shorthand, route options, schemas, content-type parsers
- `references/validation-schemas.md` — JSON Schema, TypeBox, json-schema-to-ts, Zod adapter, type providers (v5 ValidatorSchema/SerializerSchema split)
- `references/plugins-ecosystem.md` — fastify-plugin, encapsulation rules, official plugin map
- `references/authentication.md` — @fastify/jwt, @fastify/cookie, @fastify/auth, preHandler patterns
- `references/error-handling.md` — setErrorHandler, AppError integration, validation errors, 404 handler
- `references/performance.md` — response schemas, keepAliveTimeout, plugin compilation, hot-path tips
- `references/testing.md` — fastify.inject(), node:test/Vitest, buildApp() factory pattern
- `references/migration.md` — v4 → v5: Node 20+, full JSON Schema, type provider split, breaking changes
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge routing tests
- `templates/minimal-server.ts.template` — production-shaped Fastify 5 server, Pino logger, health, graceful shutdown
- `templates/fastify-with-zod.ts.template` — `fastify-type-provider-zod` end-to-end typed endpoint
- `templates/jwt-auth-plugin.ts.template` — @fastify/jwt preHandler authentication pattern
- `examples/typebox-crud-with-tests.md` — CRUD + TypeBox + fastify.inject() tests
- `examples/webhook-with-hmac.md` — raw-body parser + HMAC-SHA256 verification (CloudPayments-style)

### Verified versions (Context7, 2026-05-15)
- Fastify: `5.x` (Migration Guide V5 confirmed; v5 introduces ValidatorSchema/SerializerSchema split, full JSON Schema requirement, Node 20+, default bodyLimit reduced)
- `@fastify/type-provider-typebox`: latest 5.x
- `@fastify/type-provider-json-schema-to-ts`: latest
- `fastify-type-provider-zod`: latest 5.x
- Sources: `/fastify/fastify` and `/llmstxt/fastify_dev_llms_txt`

### Notes
- Fastify 5 mandates Node 20+; pair with `nodejs` skill (Node 24 LTS) by default
- Custom type providers must define both `validator` and `serializer` properties (v5 breaking change)
- Schema shorthand (`{ name: { type: 'string' } }`) NO LONGER works — must be full JSON Schema with `type: 'object'`, `properties`, `required`
