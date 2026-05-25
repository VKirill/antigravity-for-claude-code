# Popularity Filter (90% Rule)

How to decide which entries belong in `## Related Skills` and which don't.

## The rule

> An entry in `## Related Skills` must be **mainstream in 2026** — used in a majority of relevant projects, or recognized as the **#1–2 dominant choice** in its category. If a tool is useful in only 1-in-1000 projects, it does not belong here.

Related Skills is a **routing hint**, not a comprehensive directory. Tight beats thorough.

## Inclusion criteria

A skill qualifies for `## Related Skills` if **all** are true:

1. **Mainstream adoption**: ≥30% of new projects in the relevant domain use it, OR it is the #1–2 choice in its category
2. **Stable**: GA / 1.0+, not beta/alpha/experimental
3. **Not pure vendor lock-in** unless it IS the dominant choice (e.g., Vercel for Next.js — yes; Sentry — no, it's vendor-specific observability)
4. **User-facing**, not hidden infrastructure (e.g., Vite uses esbuild internally — users don't write esbuild configs, so no `esbuild` skill)

## Exclusion examples

| Type | Examples | Reason to exclude |
|---|---|---|
| Niche libs | `kysely`, `valibot`, `effect-schema`, `mongodb` | <20% adoption in their category |
| Beta / experimental | `oxlint`, `rolldown`, `mastra` | Not GA in 2026 |
| Vendor-specific SaaS | `sentry`, `clerk`, `datadog`, `new-relic` | Tool-specific, not "the" mainstream choice |
| Sunset / legacy | `lucia`, deprecated frameworks | Superseded |
| Hidden infra | `esbuild`, `tsup`, `rolldown` | Wrapped by frameworks; users rarely interact directly |
| Vertical-specific | `inngest`, `trigger-dev`, `email-server` | Solve narrow problems used by <10% of projects |
| Build tools behind frameworks | Turbopack, Rspack (when used via Next/Nuxt) | Hidden behind the meta-framework |
| Workflow vendors | LaunchDarkly, Unleash, Hookdeck | Vendor-specific |

## Mainstream stack 2026 (canonical lists)

### Frontend (web)

```
Language:         typescript
Framework:        react        OR vue
Meta-framework:   nextjs       OR nuxt        OR astro (content sites)
Styling:          tailwind     (95% of new TS apps)
Components:       shadcn       (React)        OR Headless UI (Vue)
Async state:     tanstack-query
Forms:            react-hook-form (React)
Validation:       zod
Build:            vite         (when not using Next/Nuxt)
Lint:             biome        OR eslint
Test (unit):     vitest
Test (E2E):       playwright
Deploy:           vercel       OR docker      OR linux-sysadmin
```

### Backend (Node)

```
Language:         typescript
Framework:        fastify      OR hono        OR express
ORM:              prisma       (or drizzle in some teams)
Validation:       zod
Logger:           pino
Queue:            bullmq
Cache/session:   redis
DB:               postgresql
Test:             vitest       + playwright
Auth:             better-auth  OR auth-patterns (generic OAuth/OIDC/JWT)
Observability:   opentelemetry
Deploy:           docker       + linux-sysadmin
```

### Mobile

```
Cross-platform:   react-native + expo
Native (iOS):     swift / swiftui
Native (Android): kotlin / compose
```

### AI / LLM

```
SDK (Claude):     anthropic-sdk
SDK (OpenAI):     openai-sdk
TS streaming:     vercel-ai-sdk
Framework:        langchain
Agent eval:       agent-evaluation
```

These canonical lists ARE the 90% filter. If a tool isn't in them, it's probably niche.

## Per-category limit

Aim for **1–3 entries per category**. More than 3 dilutes routing — Claude doesn't know which to load first. If you have 4+ candidates, pick the top 2 by adoption and drop the rest.

Categories where all candidates are niche → **drop the category entirely**. Don't list `email-server`, `discord-bot`, `slack-app`, `inngest`, `trigger-dev` together as "Background workflows" — those are vertical-specific. Keep `bullmq` alone as `## Background processing`.

## How to apply when writing a new skill

When generating Related Skills for a fresh skill:

1. **Brainstorm full neighborhood** — all technically related tools
2. **Apply the 90% filter** — drop everything <20% adoption / beta / vendor-locked / niche
3. **Group by relationship type** (Language, Frameworks, Data, Testing, Deploy, etc.)
4. **Cap at 1–3 per category**
5. **Drop categories where everything is niche**
6. **Mark active skills with ✓**

## Examples — before/after

### Before (no filter)

```markdown
### Validation & schema
- `zod` — Zod 4: TS-first runtime validation (2026 default)
- `valibot` — Valibot: tree-shakable Zod alternative
- `effect-schema` — Effect.Schema: part of Effect ecosystem
- `yup` — Yup: older alternative
- `joi` — Joi: legacy Node validation
- `ajv` — Ajv: JSON Schema validator
```

6 entries — diluted routing.

### After (90% filter)

```markdown
### Validation
- `zod` — Zod 4 (dominant TS-first runtime validation)
```

1 entry — clear signal. Other validators exist; users who need them can ask explicitly.

## When in doubt — drop

Borderline tool? Drop it. The skill doesn't disappear if it's not in Related Skills — you just don't preemptively suggest it. The user can always say "actually I'm using Drizzle for this" and you add it then.

## What this changes for cascade-generation

When the user starts work that needs a skill not in Related Skills (because we filtered it), cascade-generation still applies. Just generate the skill on-demand. The popularity filter doesn't prevent generation — it prevents **preemptive suggestion**.

## Audit — find skills that violate the filter

Quick grep to find Related Skills sections with too many entries per category:

```bash
cd ~/.claude/skills
for s in */; do
  count=$(awk '/^## Related Skills/,/^## API Reference/' "$s/SKILL.md" 2>/dev/null | grep -c '^- `')
  if [ "$count" -gt 25 ] 2>/dev/null; then
    echo "  $s: $count Related Skills entries (likely too many)"
  fi
done
```

Goal: keep total Related Skills count per skill under 25.
