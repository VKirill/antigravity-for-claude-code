# Skill catalog — agy worker skill stack

The orchestrator (Claude Code / `dev-orchestrator-agy`) and the agy workers share the **same skill
stack** (agy loads skills from its skills dir; Claude Code knows the identical set). When dispatching,
the orchestrator sends a **clean task contract (ТЗ) + a `skill_hints` array**. The worker reads each
listed skill's `SKILL.md` BEFORE working, to get current (2026) API/idioms — instead of relying on
training-data defaults.

> **How a worker loads a skill:** read `<skills-dir>/<skill-name>/SKILL.md` (agy: `~/.agents/skills/…`).
> Load the role DEFAULTS below + everything in the contract's `skill_hints`.

---

## Per-role skills (orchestrator: fill `skill_hints` from here)

| Worker (role) | DEFAULT skills (always load) | OPTIONAL — add per task |
|---|---|---|
| **worker-coder** (programmer) | `karpathy-guidelines`, `coder-craft`, `clean-code` | stack: `react` / `vue` / `nextjs` / `nuxt` / `fastapi` / `nodejs` / `fastify` / `hono` / `prisma` / `drizzle-orm-expert` / `sqlalchemy` / `postgresql` / `redis` / `bullmq` / `graphql`; lang: `typescript` / `python` / `sql-pro`; cross: `tdd`, `testing-craft`, `logging-standards-2026` (any endpoint/job/integration), `backend-security-coder` (auth/input/secrets), `systematic-debugging` (bug fix), `api-patterns`, `better-auth` |
| **worker-frontend** (designer) | `karpathy-guidelines`, `frontend-craft`, `coder-craft` | `css-architecture-2026`, `design-system-2026`, `ux-craft-2026`, `web-animation-router`, `webgl-creative-2026`, `svg-canvas-craft`, `ui-craft`, `ui-styling`, `tailwind`, `shadcn`, `react` / `vue` / `nextjs` / `nuxt` / `astro`, `react-hook-form`, `web-qa-2026` |
| **worker-reviewer** (architect) | `karpathy-guidelines`, `review-craft`, `ru-text-quick` | `cybersecurity-audit` (security-sensitive diff), `architecture-craft` / `software-architecture` (design/SPEC review), `data-systems-craft` (DB/consistency), stack skill matching the diff |
| **worker-planner** (architect) | `karpathy-guidelines`, `orchestrator-workflow`, `architecture-craft` | `refactoring`, `data-systems-craft`, the feature's stack skill (`react`/`fastapi`/…) |
| **worker-refactor-architect** (architect) | `karpathy-guidelines`, `refactoring`, `refactor-hotspots-craft` | `architecture-craft`, `software-architecture`, `code-refactoring-tech-debt`, `data-systems-craft`, stack skill of the target |
| **worker-test-verifier** (programmer) | `testing-craft`, `tdd` | `pytest` / `vitest` / `playwright` (by stack) |
| **worker-security-verifier** (architect) | `cybersecurity-audit`, `backend-security-coder` | `security-audit`, `better-auth`, stack skill |
| **worker-payments-verifier** (architect) | `cybersecurity-audit`, `review-craft` | payment-provider skill if present (e.g. `yookassa`, `cloudpayments`), `data-systems-craft` |
| **worker-ui-verifier** (designer) | `ui-craft`, `web-qa-2026` | `ux-craft-2026`, `design-system-2026`, `tailwind` |
| **worker-db-reader** (architect) | `postgresql`, `data-systems-craft` | `postgresql-optimization`, `sql-pro`, `redis-patterns` |
| **worker-doctor** (programmer) | `systematic-debugging`, `debugging-craft` | `gitnexus-debugging`, stack skill of the failing area |

---

## Full stack (catalog, grouped)

**Core craft / discipline:** `karpathy-guidelines` `coder-craft` `clean-code` `tdd` `testing-craft`
`testing-patterns` `review-craft` `debugging-craft` `systematic-debugging` `gitnexus-debugging`
`refactoring` `refactor-hotspots-craft` `code-refactoring-tech-debt` `architecture-craft`
`software-architecture` `data-systems-craft` `microservices-patterns` `logging-standards-2026`
`backend-security-coder` `cybersecurity-audit` `security-audit`

**Languages:** `typescript` `typescript-pro` `python` `python-pro` `javascript-pro` `sql-pro` `go`
`c-pro` `cpp-pro` `csharp-pro` `php-pro` `cuda-python`

**Frontend:** `react` `react-patterns` `react-best-practices` `react-hook-form` `react-native-architecture`
`vue` `vue-developer` `nextjs` `nextjs-app-router-patterns` `nextjs-best-practices` `nuxt` `astro`
`tailwind` `shadcn` `ui-styling` `ui-designer` `ui-ux-pro-max` `ui-craft` `frontend-craft`
`frontend-developer` `css-architecture-2026` `design-system` `design-system-2026` `ux-craft-2026`
`web-animation-router` `webgl-creative-2026` `svg-canvas-craft` `web-qa-2026`

**Backend / data:** `nodejs` `nodejs-backend-patterns` `nodejs-expert` `fastify` `fastify-pro` `hono`
`nestjs-expert` `fastapi` `fastapi-pro` `django` `api-patterns` `graphql` `graphql-architect`
`better-auth` `bullmq` `bullmq-specialist` `prisma` `prisma-expert` `drizzle-orm-expert` `sqlalchemy`
`postgresql` `postgresql-optimization` `redis` `redis-patterns` `nosql-expert` `database-architect`

**Testing:** `pytest` `vitest` `playwright`

> 222 skills total are available in the agy skills dir; this lists the ones relevant to code workers.
> For the exhaustive list run `ls ~/.agents/skills/`. Keep `skill_hints` tight (3-6 skills) — loading
> everything wastes the worker's context window.
