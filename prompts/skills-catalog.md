# Skill catalog — agy worker skill stack

The orchestrator (Claude Code / `dev-orchestrator-agy`) and the agy workers share the **same skill
stack** (agy loads skills from its skills dir; Claude Code knows the identical set). When dispatching,
the orchestrator sends a **clean task contract (ТЗ) + a `skill_hints` array**. The worker reads each
listed skill's `SKILL.md` BEFORE working, to get current (2026) API/idioms — instead of relying on
training-data defaults.

> **How a worker loads a skill:** read `<skills-dir>/<skill-name>/SKILL.md` (agy: `~/.agents/skills/…`).
> Load the role DEFAULTS below + everything in the contract's `skill_hints`.

---

## Result envelope (EVERY worker — single parse contract)

Every worker ends its reply with **exactly one** fenced ` ```yaml ` block whose only top-level key is
`result:`. The orchestrator parses that one block — **no worker puts payload outside `result:`**.

**Common keys (all roles):**
- `summary:` — 1-3 sentences, outcome not actions (always).
- `status:` — role verdict (always): coder/frontend `done|paused|needs_decomposition`; reviewer
  `passed|changes_requested`; test/security/payments/ui-verifier `passed|issues_found|inconclusive`;
  planner `planned`; doctor `diagnosed`; refactor-architect `planned|no_refactor_needed|blocked`;
  db-reader `ok|inconclusive`.
- `errors:` — array of failure summaries the worker hit: build/verification failures (coders) or "a check could not RUN" (verifiers → also set `status: inconclusive`). `[]` when all green; never null. Issues/findings go in `findings`, not here.
- `artifacts:` — array of changed files (coders) / `[]` otherwise.
- `verification_output:` — optional; command/sweep output.

**Role payload — nested under `result:`**, only the keys for that role:
- reviewer / verifiers → `findings: [{severity, file, line, title, detail?, category?, fix_suggestion?}]`
  (only `severity`/`file`/`line`/`title` required; verifiers add `category`, reviewer adds `detail`/`fix_suggestion`).
  Reviewer also: `task_fully_implemented`, `missing`.
- planner → `spec`, `contracts: [...]`.
- doctor → `diagnosis`, `proposed_fix_strategy`, `confidence`, `risks`.
- refactor-architect → `refactoring_plan`.
- db-reader → `query`, `rows`, `notes`.

Workers MAY add role-specific extra keys under `result:` (e.g. `self_review`, `discovery_note`, `concerns`) — harmless; the orchestrator reads the documented keys and saves the full transcript anyway.

---

## Per-role DEFAULT skills (auto-loaded — do NOT re-pass)

Each worker prompt hardcodes its DEFAULTS in its `## 0. Skills to load FIRST` section and loads
them automatically. The orchestrator/planner must put **ONLY task-specific OPTIONAL picks** in
`skill_hints` / `{{skills}}` — never repeat the defaults (that wastes context & breaks the cache).
Choose optional picks from **"Available skills"** (below) by stack / need.

| Worker (role) | DEFAULT skills (auto-loaded by the worker) |
|---|---|
| **worker-coder** (programmer) | `karpathy-guidelines`, `coder-craft` |
| **worker-frontend** (designer) | `karpathy-guidelines`, `coder-craft`, `frontend-craft` |
| **worker-reviewer** (architect) | `karpathy-guidelines`, `review-craft`, `ru-text-quick` |
| **worker-planner** (architect) | `karpathy-guidelines`, `orchestrator-workflow`, `architecture-craft` |
| **worker-refactor-architect** (architect) | `karpathy-guidelines`, `refactoring`, `refactor-hotspots-craft` |
| **worker-test-verifier** (programmer) | `testing-craft`, `tdd` |
| **worker-security-verifier** (architect) | `cybersecurity-audit` |
| **worker-payments-verifier** (architect) | `cybersecurity-audit`, `review-craft` |
| **worker-ui-verifier** (designer) | `ui-craft`, `web-qa-2026` |
| **worker-db-reader** (architect) | `postgresql`, `data-systems-craft` |
| **worker-doctor** (programmer) | `systematic-debugging`, `debugging-craft` |

---

## Full stack (catalog, grouped)

**Core craft / discipline:** `karpathy-guidelines` `coder-craft` `tdd` `testing-craft`
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

---

<!-- SKILLS:START -->
## Available skills — pick OPTIONAL ones by description

> Auto-generated from skills/*/SKILL.md by `scripts/gen-skill-catalog.ts` — 94 skills. Role DEFAULTS load automatically (baked into each worker prompt); put ONLY task-specific picks in `skill_hints`.

**CSS-native**
- `web-animation-router` — Route AND implement web animation for 2026 — pick the right tool (CSS-native, Motion/motion.dev, GSAP, Auto…

**MAX Bridge**
- `max-bridge` — [RU: интеграция MAX мессенджера (VK Tech) — Mini Apps Bridge, валидация initData, HMAC] MAX Bridge SDK для …

**MCP Spec**
- `mcp-builder` — Design, build, and validate MCP (Model Context Protocol) servers for Claude Code, Codex CLI, OpenCode and o…

**Polars**
- `polars` — Polars 1.40 — Rust-backed columnar DataFrame for Python

**Pydantic**
- `pydantic` — Pydantic v2 runtime data validation for Python — BaseModel, Field, validators, JSON Schema, settings

**Remotion**
- `remotion` — Remotion — programmatic video framework where React components render to MP4 / WebM / GIF / stills frame-by…

**agents**
- `agent-evaluation` — Tests and benchmarks LLM agents covering behavioral testing, capability assessment, reliability metrics, an…

**astro**
- `astro` — Build modern websites with Astro 6.x — Islands Architecture, zero-JS defaults, Server Islands, Actions, Con…

**better-auth**
- `better-auth` — Better Auth — framework-agnostic TypeScript authentication

**bullmq**
- `bullmq` — BullMQ 5 — Redis-backed Node.js queue

**claude-code**
- `agent-builder` — Designs and authors Claude Code sub-agents (.claude/agents/*.md files) that integrate with an existing skil…
- `claude-code` — Anthropic's official Claude Code CLI — terminal coding agent with skills, hooks, subagents, MCP, plan mode,…

**cloud**
- `yandex-cloud` — [RU: Яндекс.Облако — yc CLI, Compute Cloud, Managed PostgreSQL/MySQL/Redis/ClickHouse/MongoDB/Kafka, Object…

**cloudpayments**
- `cloudpayments` — [RU: интеграция CloudPayments — карты, СБП, рекуррент, 54-ФЗ] CloudPayments Russian payment gateway — REST …

**codex**
- `codex` — OpenAI Codex CLI — OpenAI's official Rust-based agentic terminal coding tool (NOT the deprecated 2021 Codex…

**css**
- `css-architecture-2026` — CSS architecture for vanilla HTML/CSS pre-framework — ITCSS-style tokens, BEM, OKLCH, @layer cascade layers…

**cuda-python**
- `cuda-python` — GPU compute in Python with NVIDIA's cuda-python bindings, CuPy (drop-in NumPy on GPU), Numba @cuda.jit, and…

**debugging**
- `systematic-debugging` — Methodology for finding root cause of bugs, test failures, and unexpected behaviour — symptom → reproductio…

**django**
- `django` — Django — batteries-included Python web framework

**fastapi**
- `fastapi` — FastAPI — modern async Python web framework on Starlette + Pydantic v2 with auto-generated OpenAPI 3.1

**frontend**
- `frontend-craft` — Дисциплина вёрстки для worker-coder: БЭМ, design tokens, accessibility (WCAG AA), responsive (mobile-first)…
- `nuxt` — Nuxt 4 Vue meta-framework — file routing, SSR/SSG, server routes, auto-imports
- `react` — Production React 19 — composition patterns, hooks, state management, performance, React Compiler, Actions, …
- `shadcn` — shadcn/ui — copy-paste React components built on Radix UI primitives + Tailwind
- `vite` — Vite 7 frontend build tool — fast HMR via native ESM, Rollup production builds, plugin ecosystem, modernize…
- `vitest` — Vitest 4 unit testing — Vite-native, ESM-first, fast HMR
- `vue` — Vue 3.5 — Composition API with script setup, reactivity, SFC, TypeScript

**frontend-libraries**
- `zod` — Zod 4 TS-first runtime validation — schemas, parsing, transforms, refinements, async, discriminated unions

**general**
- `architecture-craft` — System architecture discipline from Newman + Khononov + Richards/Ford
- `coder-craft` — Universal coder discipline for editing files inside YAML task contracts
- `data-systems-craft` — Data-systems design discipline from Kleppmann (DDIA)
- `debugging-craft` — Universal debugging discipline for failure investigation. Distilled from Agans + Zeller + Spinellis
- `refactor-hotspots-craft` — Behavioral code analysis from Tornhill (Software Design X-Rays)
- `review-craft` — Code review discipline from Cohen's SmartBear empirical research
- `testing-craft` — Universal test-writing discipline from Meszaros + Osherove + Beck/GOOS
- `ui-craft` — UI/UX verification discipline for frontend changes. From Krug + Wathan/Schoger + Nielsen 10 + WCAG 2.2

**google-cloud-auth**
- `google-cloud-auth` — [RU: oauth google, авторизация гугл, service account, sa key, refresh token, invalid_grant, adc, google clo…

**hono**
- `hono` — Hono 4 — small ultrafast multi-runtime web framework on Web Standards

**httpx**
- `httpx` — httpx — modern Python HTTP client with sync + async APIs, HTTP/2, strict timeouts, and a broadly requests-c…

**langchain**
- `langchain` — LangChain Python v1 — LLM app framework

**lint-format**
- `biome` — Biome 2 — Rust-based lint + format for JS/TS/JSON/CSS
- `eslint` — ESLint 10 — JS/TS linter with flat config, typescript-eslint, framework plugins, Prettier/Biome coexistence

**logging**
- `logging-standards-2026` — Production logging standards — structured JSON logs, correlation IDs, OpenTelemetry, log levels (TRACE/DEBU…

**meta**
- `skill-evaluation` — Audit, rewrite, and design Claude Code skills per Anthropic's Agent Skills best practices

**mobile**
- `expo` — Expo SDK 55 + React Native 0.85 — build, ship, and update iOS/Android apps

**next-intl**
- `i18n` — Web app internationalization — next-intl (Next.js/React) and vue-i18n (Nuxt/Vue)

**nextjs**
- `nextjs` — Next.js 16 App Router — Server Components, Server Actions, 'use cache', PPR, Turbopack, async params/cookie…

**nodejs-backend**
- `fastify` — Fastify 5 — Node-native production HTTP framework
- `nodejs` — Node.js 24 production — type stripping, native APIs, framework selection, graceful shutdown, security, obse…

**numpy**
- `numpy` — NumPy — N-dimensional arrays, broadcasting, ufuncs, linalg, random Generator API for Python scientific comp…

**opencode**
- `opencode` — OpenCode CLI — open-source multi-provider terminal coding agent (sst/opencode, Anomaly fork) with BYOK for …

**other**
- `brainstorming` — Requirements gathering before any creative work
- `ckm:design-system` — Token architecture, component specifications, and slide generation
- `design-system-2026` — Design system foundations 2026 — OKLCH color ramps (perceptually-even, APCA/WCAG verified), fluid typograph…
- `gitnexus-cli`
- `gitnexus-debugging`
- `gitnexus-exploring`
- `gitnexus-guide` — Documents GitNexus itself — available tools, knowledge graph queries, MCP resources, graph schema, and work…
- `gitnexus-impact-analysis`
- `gitnexus-pr-review`
- `gitnexus-refactoring`
- `karpathy-guidelines` — Behavioral guidelines to reduce common LLM coding mistakes
- `media-asset-pipeline` — Web media asset pipeline & budgets 2026 — glTF/GLB optimization (Draco, meshopt, KTX2 via gltf-transform), …
- `orchestrator-workflow` — DB-persistent task dispatch + YAML contracts for dev-orchestrator
- `project-architecting` — Senior Architect methodology for greenfield projects — collects business requirements through 1-3 chat phas…
- `refactoring` — Architecture analysis + refactoring planning
- `ru-text-quick` — Выжимка ru-text для коротких русских отчётов / findings / статусов / комментариев
- `svg-canvas-craft` — SVG & Canvas2D craft for 2026 — SVG animation (CSS/SMIL/JS), stroke draw-on, MorphSVG vs flubber, SVG filte…
- `tailwind`
- `tdd` — Test-driven development discipline for workers — write failing test first, minimal implementation, green, r…
- `ux-craft-2026` — UX & content craft for high-end sites 2026 — information architecture & page blueprints (pages.yaml, hero a…
- `web-qa-2026` — Deterministic web QA/verification suite 2026 — the exact runnable toolchain to verify a built site WITHOUT …
- `webgl-creative-2026` — WebGL/WebGPU creative front-end for 2026 — Three.js + React Three Fiber + drei + TSL + WebGPU production se…

**pandas**
- `pandas` — pandas 3.0 — DataFrame analysis library for Python

**postgresql**
- `postgresql` — PostgreSQL 18 — production-grade open-source RDBMS

**prisma**
- `prisma` — Prisma 7 — TypeScript-first ORM

**proxy6**
- `proxy6` — [RU: интеграция proxy6.net — покупка/продление прокси, пул, ipauth, scraping] proxy6.net REST API — RU prox…

**pytest**
- `pytest` — pytest 9 — Python's #1 testing framework

**python**
- `python` — Python 3.14 foundation — syntax, type hints, packaging with uv, ruff/mypy, asyncio

**pytorch**
- `pytorch` — PyTorch deep learning framework — tensor compute, autograd, nn.Module training loops, DataLoader, mixed pre…

**react**
- `react-hook-form` — React Hook Form v7 — performant forms via uncontrolled inputs, Zod validation

**react-frontend**
- `tanstack-query` — TanStack Query 5 server-state management — queries, mutations, infinite, optimistic, cache

**redis**
- `redis` — Redis 8 — in-memory data store

**scikit-learn**
- `scikit-learn` — scikit-learn 1.8 — classical machine learning in Python

**security**
- `cybersecurity-audit` — Stack-agnostic vulnerability hunting — OWASP Top 10 2025, OWASP API Top 10, OWASP LLM Top 10, supply-chain …

**sqlalchemy**
- `sqlalchemy` — SQLAlchemy 2.0 — modern Python ORM + Core toolkit with first-class async support, type-annotated declarativ…

**sysadmin**
- `linux-sysadmin` — Linux sysadmin for Ubuntu 24.04 production — Angie (Nginx fork), PM2, PostgreSQL 18, Redis 8, Docker 29, PH…

**telegram**
- `telegram-bot` — Build, architect, deploy Telegram bots on grammY 1.x + Node 24 + TypeScript 5.9

**testing**
- `playwright` — Playwright 1.60 E2E testing — Chromium/Firefox/WebKit, auto-wait, web-first assertions, fixtures, trace viewer

**transformers**
- `transformers` — HuggingFace Transformers — pretrained model hub, pipelines, AutoModel/AutoTokenizer, .generate() for LLMs/V…

**typescript**
- `typescript` — TypeScript expert — TS 6.0 type system, conditional/mapped types, branded types, generics, tsconfig strict …

**vcs**
- `git` — Git distributed VCS workflows

**vk-bridge**
- `vk-bridge` — [RU: интеграция VK Mini Apps через VK Bridge — auth, VK Pay, sign launch params] VK Bridge SDK для VK Mini …

**yookassa**
- `yookassa` — [RU: интеграция ЮKassa] YooKassa by ЮMoney — API v3, Checkout.js widget, payment lifecycle (pending→waiting…
<!-- SKILLS:END -->
