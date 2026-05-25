# Recommended defaults — single source of truth

For technical skills (frameworks, databases, queues, ORMs), recommended values for retry/timeout/concurrency/pool-size/connection-strategy tend to drift across files: the SKILL.md says one thing, `production-patterns.md` says another, an example shows a third. Opus's bullmq review caught this drift (concurrency 10-20 vs 20-50).

## Rule

**Every technical skill with operational knobs MUST have one file** — `references/recommended-defaults.md` — that owns the recommended values. All other files cite it instead of duplicating values.

## When required

REQUIRED when the skill has any of:
- Retry policies (attempts, backoff, jitter)
- Concurrency / pool sizes / worker counts
- Timeouts (connection, command, request, idle)
- TTL / cache windows
- Rate limits
- Connection-strategy choices (single vs pool vs cluster)
- Resource limits (memory, prepared statements, max payload)

OPTIONAL for:
- Pure language/type-system skills (typescript, zod)
- Pure UI component skills (shadcn, react-hook-form)
- Process skills (git, karpathy-guidelines)

## Anatomy of `recommended-defaults.md`

```md
# Recommended defaults

The canonical values for this skill. All other files (SKILL.md, examples, templates) cite this table — do not redefine.

## Production defaults

| Knob | Default | Range | Why |
|---|---|---|---|
| `attempts` | 5 | 3–10 | balances transient errors vs runaway retries |
| `backoff.type` | `exponential` | `exponential` / `fixed` | exponential survives provider hiccups |
| `backoff.delay` | 5000 ms | 1000–30000 | first retry buffers most blips |
| `concurrency` (I/O-bound) | 20 | 10–50 | matches typical HTTP pool size |
| `concurrency` (CPU-bound) | 2 | 1–4 | usually want one worker per core minus headroom |
| `removeOnComplete` | `{ age: 86400, count: 1000 }` | — | 24h or last 1k jobs |
| `removeOnFail` | `{ age: 604800 }` | — | keep failures 7d for postmortem |
| `connection.maxRetriesPerRequest` | `null` | required by BullMQ |
| `lockDuration` | 30000 ms | 15000–60000 | jobs over this become stalled |

## Tuning guidance

- Start with defaults. Only deviate after measurement.
- If you see retry storms → reduce `attempts` or increase `backoff.delay`.
- If you see stalled jobs → either reduce `concurrency` or increase `lockDuration`.

## Citation rule

Other files in this skill **MUST NOT redefine these values inline**. Link back here:

> See [recommended-defaults.md](recommended-defaults.md) for the canonical `attempts`/`backoff` values.

## Last verified

2026-05-15 against BullMQ 5.76.x docs.
```

Three sections: table of knobs, tuning guidance, citation rule, verified date.

## Anti-patterns

- ❌ Inline recommended values scattered across 5 files.
- ❌ A "production checklist" with values that conflict with the SKILL.md examples.
- ❌ Defaults without ranges — the reader has no idea when they're allowed to deviate.
- ❌ Defaults without "why" — readers cargo-cult without context and stop tuning when measurements suggest otherwise.

## Audit grep

```bash
# Skills with operational knobs but no recommended-defaults.md
for skill in bullmq postgresql redis prisma fastify hono; do
  if [ ! -f "/home/ubuntu/.claude/skills/$skill/references/recommended-defaults.md" ]; then
    echo "MISSING: $skill needs recommended-defaults.md"
  fi
done
```

## When the values are sourced from defaults of the library itself

If the library ships sensible defaults and you don't override them, the file should still exist but be SHORT — just list the values the library uses and the rationale. This gives users one place to read the defaults instead of digging through docs.
