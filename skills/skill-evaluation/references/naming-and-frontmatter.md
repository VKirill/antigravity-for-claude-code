# Naming & Frontmatter

## Name

Format: **kebab-case**, **plain library name** when it's a library/framework, **descriptive** when it's a role/methodology.

### Convention by skill type

| Skill type | Naming pattern | Examples |
|---|---|---|
| **Library/framework** | plain name (no suffix) | `prisma`, `astro`, `bullmq`, `fastify`, `redis`, `docker`, `postgresql`, `flutter`, `terraform`, `langchain` |
| **Language** | plain name | `typescript`, `python`, `php`, `javascript`, `bash` |
| **Platform/runtime** | plain name | `nodejs`, `bun`, `deno` |
| **Role-based** (methodology/professional) | role-descriptive | `linux-sysadmin`, `ml-engineer`, `incident-responder`, `bug-hunter` |
| **Action/process** | descriptive verb-noun | `skill-evaluation`, `agent-evaluation`, `database-migration`, `code-review` |
| **Platform + medium** (domain app) | platform + medium | `telegram-bot`, `discord-bot`, `wordpress` |
| **Pattern collection** | domain + `-patterns` (only when ambiguous) | `microservices-patterns`, `auth-implementation-patterns` |

### Good vs bad

| ✅ Good | ❌ Bad | Why bad |
|---|---|---|
| `prisma` | `prisma-expert` | suffix adds no signal — Claude routes by description trigger terms |
| `astro` | `astro-developer` | suffix noise |
| `bullmq` | `bullmq-specialist` | suffix noise |
| `redis` | `redis-patterns` | only add `-patterns` if `redis` alone is ambiguous (it isn't) |
| `react` | `react-best-practices` | suffix noise + version-like (best practices change) |
| `react-native-architecture` | OK — `react-native` is the platform; `architecture` clarifies scope vs `react` |
| `telegram-bot` | `telegram-bot-builder` | suffix `-builder` is noise; "bot" already implies the medium |
| `flutter` | `flutter-expert` | suffix noise |

### Suffixes that ARE justified

Some descriptive suffixes carry real meaning — keep them:
- `linux-sysadmin` — `sysadmin` IS the role, not a noise word
- `ml-engineer` — `engineer` IS the role
- `incident-responder` — `responder` IS the action
- `agent-evaluation` — `evaluation` IS the action (vs `agent-building`)
- `skill-evaluation` — same as above

Rule of thumb: if the suffix could be replaced with `-developer/-expert/-pro/-specialist/-skill` and the meaning doesn't change, **drop it**. If the suffix changes what the skill does (`-evaluation` ≠ `-implementation`), **keep it**.

### Other rules

- Always kebab-case (no spaces, underscores, dots)
- Avoid versions in the name — use the version block instead (`react`, not `react-19`)
- 1–3 words. 4 only if there's no ambiguous shorter form
- Match the directory name exactly — `name: foo` ↔ `~/.claude/skills/foo/`
- Cascade-generation default: when generating a fresh skill for a library, use **plain name**. Don't carry over historical suffixes from archived skills.

## Required frontmatter fields

```yaml
---
name: my-skill-name              # REQUIRED — matches dir name, kebab-case
description: "..."               # REQUIRED — 150-400 chars, trigger-heavy
---
```

## Recommended optional fields

```yaml
stacks:                           # list of high-level domains
  - nodejs
  - typescript
tags:                             # searchable keywords (loose)
  - queue
  - worker
  - redis
packages:                         # actual npm/pypi packages this skill covers
  - bullmq
  - "@bull-board/api"
manifests:                        # files whose presence triggers this skill
  - package.json
  - pyproject.toml
source: vechkasov-global-skills   # provenance
risk: safe                        # safe | unknown | high-stakes
user-invocable: false             # if true, can be triggered explicitly via `/skill-name`
metadata:
  model: opus                     # optional — force a specific model when loading
```

## What about `claude-skills-format` fields?

The Anthropic spec is minimal: only `name` and `description` are required. Our extras (`stacks`, `tags`, `packages`, `manifests`) are project conventions for grepability and tooling integration. Don't omit them just because they're not in the spec — they help local audits and routing heuristics.

## Frontmatter ordering

Anthropic's convention (top to bottom):

```yaml
---
name: ...
description: ...
# Optional, in this order:
stacks: [...]
tags: [...]
packages: [...]
manifests: [...]
risk: ...
source: ...
user-invocable: ...
metadata: ...
---
```

Order doesn't break anything but matches what most readers expect.

## Forbidden in frontmatter

- ❌ Multi-line strings that fold weirdly (use double-quoted single-line for descriptions to be safe)
- ❌ Embedded versions in the description (use the version block, not frontmatter)
- ❌ HTML in description (it leaks into the routing tokenizer poorly)
- ❌ Emoji at the start of description (some tooling strips it, breaking content)
- ❌ Trailing whitespace inside YAML strings (causes routing inconsistencies)

## Verification

After editing frontmatter, run:

```bash
python3 -c "import yaml; yaml.safe_load(open('SKILL.md').read().split('---')[1])"
```

If this fails the frontmatter is malformed. The `php-pro` skill had this problem before fixing — a single-quoted multi-line description ate a subsequent key.

## Description vs body

| Field | Purpose | Visible to user? |
|---|---|---|
| `description` | Routing signal for Claude | No (internal) |
| `## Purpose` (body) | Detail loaded after routing | Yes |
| `## Capabilities` | Concrete features with subsections | Yes |

A description is for **getting the skill loaded**. The body is for **using it well once loaded**. Don't confuse the two — duplicating body content into the description bloats routing without helping.
