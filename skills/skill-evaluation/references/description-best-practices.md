# Description Best Practices

The frontmatter `description` is the routing key. This is the single most important field in a skill.

## Anatomy of a good description

```yaml
description: "<one-sentence WHAT>. Use when: <comma-separated trigger terms — verbs and nouns the user will say>. <Optional: skip when ...>"
```

### Length

| Length | Verdict |
|---|---|
| < 80 chars | Almost always too generic. Probably lacks triggers. |
| 80–149 chars | Borderline. OK only for narrow tool-wrapper skills. |
| **150–400 chars** | **Sweet spot.** Target for all new skills. |
| 400–550 chars | Acceptable for cross-domain skills with many triggers. Review for compactness. |
| > 550 chars | Dilutes signal. **Hard cap = 600.** Move detail into body. |

**Compactness rule (from May 2026 reviews):** description should hold *only* (a) one-sentence WHAT, (b) high-density trigger keywords, (c) SKIP rules. Move out: migration notes, feature lists, architecture explanations, version-history mentions. Examples of "creep" to remove:

```yaml
# ❌ creep — description tries to teach
description: "...QueueScheduler (removed in v5; responsibilities folded into Worker), JobScheduler.upsertJobScheduler API for repeating jobs added 2024-Q3, supports child processes via Worker constructor with processorFile option, BullMQ Pro distinguished by..."

# ✅ tight — triggers only, lessons in references/migration.md
description: "...JobScheduler, FlowProducer, sandboxed processors, graceful shutdown. SKIP: legacy Bull (→bull-legacy), Agenda, Sidekiq."
```

### What to include

1. **What the skill does** — 1 sentence, domain nouns, no jargon-free filler
2. **Trigger verbs/nouns** — the actual words users say: "telegram bot", "redis queue", "view transitions", "async/await", "Pydantic v2", "Server Islands"
3. **Use-when phrasing** — "Use when: ...", "Trigger terms: ...", "Activate proactively whenever the user mentions: ..."
4. **Negative triggers (optional)** — "Skip when: file imports openai SDK" / "Do not use for mobile RN tasks"

### What to avoid

- ❌ Vague verbs: "Master", "Expert", "Provides" without follow-up specifics
- ❌ Marketing prose: "production-ready, world-class, enterprise-grade"
- ❌ Implementation details: "Uses fetch internally" (irrelevant to routing)
- ❌ Dates/versions in description: "as of 2026" (version block owns this)
- ❌ Wikipedia-style intros: "Foo is a software framework that..."

## Before → After examples

### Example 1 — generic to specific

**Before** (30 chars, no triggers):
```yaml
description: "Deploy Expo apps to production"
```

**After** (200+ chars, triggers + edges):
```yaml
description: "Deploy Expo SDK 55 apps to App Store and Google Play via EAS Build, EAS Submit, EAS Update. Use when: eas build, eas submit, eas update, channel, branch, runtimeVersion, ASC API key, FCM v1, TestFlight, internal distribution. Skip for dev-only builds — use expo-dev-client."
```

### Example 2 — verb-heavy to trigger-heavy

**Before**:
```yaml
description: "Master Python 3.12+ with modern features, async programming, performance optimization, and production-ready practices."
```

**After**:
```yaml
description: "Master Python 3.14+ with modern features (free-threading, JIT, template strings, deferred annotations), async/asyncio TaskGroups, uv package manager, ruff linter, pyright/ty type checking. Use when: python 3.13, python 3.14, asyncio, free-threaded, pyproject.toml, uv, ruff, pydantic v2, fastapi, django 6, sqlalchemy 2. Use PROACTIVELY for Python development, optimization, or advanced patterns."
```

### Example 3 — vibeship boilerplate to real

**Before** (vibeship-spawner scaffold):
```yaml
description: "BullMQ expert for Redis-backed job queues, background processing, and reliable async execution in Node.js/TypeScript applications. Use when: bullmq, bull queue, redis queue, background job, job queue."
```

This one's actually OK — has trigger terms. Improvement is at the body level.

## Negative triggers (skip-when)

If a skill is easily confused with another, add explicit skip rules. This prevents Claude from loading the wrong skill:

```yaml
description: "Build, debug, and optimize Claude API / Anthropic SDK apps... TRIGGER when: code imports `anthropic`/`@anthropic-ai/sdk`. SKIP: file imports `openai`/other-provider SDK, filename like `*-openai.py`."
```

The `claude-api` skill does this perfectly — it disambiguates from `openai`/generic LLM SDK work.

## Multi-language trigger terms

Our team works in Russian + English. Include Russian triggers when they're natural for the user:

```yaml
description: "...Trigger terms: создать скилл, написать скилл, audit skill, evaluate skill, fix skill description, написать description..."
```

Don't translate every word — only include Russian terms the user actually says (commands, domain nouns).

## Validating a description

After writing a description, ask:

1. If a user said "{quote their likely prompt}", would these trigger terms match?
2. What does this skill share triggers with? Does the negative rule disambiguate?
3. Is the length in the 150–400 sweet spot?
4. Does it pass a 1-second skim — would a stranger know what this skill does?

If any check fails, rewrite.

## Common bad descriptions in our repo (May 2026 audit)

| Skill | Issue |
|---|---|
| `roadmap-methodology` | Description completely empty |
| `expo-deployment` | 30 chars, zero trigger terms |
| `frontend-developer` | No "use when" — describes capabilities only |
| `bash-pro` | Marketing prose ("Master of defensive Bash") + no triggers |
| `flutter-expert` | "Master Flutter development with Dart 3" — no triggers |
| `graphql-architect` | "Master modern GraphQL with federation" — no triggers |

Apply this file's rules to each.
