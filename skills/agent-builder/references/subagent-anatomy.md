# Subagent anatomy — every frontmatter field

Authoritative source: <https://code.claude.com/docs/en/sub-agents> (verified 2026-05-16). This file digests it for daily reference.

## File location and identity

| Scope | Path | Priority |
|---|---|---|
| Organization (managed settings) | (deployed centrally) | 1 (highest) |
| `--agents` CLI flag (JSON) | session-only | 2 |
| Project | `.claude/agents/<anything>.md` | 3 |
| User | `~/.claude/agents/<anything>.md` | 4 |
| Plugin | `<plugin>/agents/<anything>.md` | 5 |

**Identity comes from `name` frontmatter, not from filename or path.** Subfolders are allowed but don't affect identity. Duplicate `name` within one scope = silently dropped.

Plugin path adds namespace: `agents/review/security.md` inside plugin `my-plugin` → `my-plugin:review:security`.

## Required fields

### `name` (required)

Lowercase letters, numbers, hyphens. Max 64 characters.

```yaml
name: test-verifier
```

Used for hooks (`agent_type`), `@-mentions` (`@agent-test-verifier`), tool restrictions (`Agent(test-verifier)`).

**When to set:** always.
**Naming:** `<role>-<modifier>` or just `<role>`. Examples: `test-verifier`, `security-checker`, `db-reader`, `feature-planner`.

### `description` (required)

When Claude should delegate. Heavy lifting for auto-delegation. See [description-engineering.md](description-engineering.md).

```yaml
description: Expert test-runner. Runs the full test suite after any code modification and reports failures. Use proactively after edits to source files.
```

**When to set:** always.

## Optional fields — frequently used

### `tools` (allowlist)

If omitted, the subagent inherits **all tools** from the main session.

```yaml
tools: Read, Grep, Glob
```

**When to set:** when you want a read-only or otherwise restricted agent. The act of writing `tools:` is itself the restriction — listed tools are the *only* allowed.

For canonical sets, see [tool-permission-matrix.md](tool-permission-matrix.md).

### `disallowedTools` (denylist)

Tools to deny — removed from inherited or specified list.

```yaml
disallowedTools: Write, Edit
```

**When to set:** when you want most of inherited tools minus specific ones. "Inherit everything except writes" is the common case.

If both are set: `disallowedTools` applies first, then `tools` resolves against remaining pool. Tool in both = removed.

### `model`

Aliases (`sonnet`, `opus`, `haiku`), full IDs (`claude-opus-4-7`, `claude-sonnet-4-6`), or `inherit`. Default: `inherit`.

```yaml
model: haiku
```

**When to set:**
- `haiku` — fast read-only ops (search, lint, format-check). Built-in `Explore` uses this.
- `sonnet` — typical implementation and verification work.
- `opus` — verification with judgment, orchestrators, planners. Errors compound here.
- `inherit` — match the main session (default).
- Full ID — pin for reproducibility.

Resolution: `CLAUDE_CODE_SUBAGENT_MODEL` env → per-invocation override → frontmatter → main's model.

### `permissionMode`

```yaml
permissionMode: plan
```

| Mode | Behavior |
|---|---|
| `default` | Standard permission checking |
| `acceptEdits` | Auto-accept edits and common fs commands in cwd / additional dirs |
| `auto` | Background classifier reviews commands |
| `dontAsk` | Auto-deny permission prompts (explicit allowlist works) |
| `bypassPermissions` | Skip prompts entirely — DANGEROUS |
| `plan` | Plan mode (read-only) |

**When to set:**
- `plan` — explorers / planners that should never write
- `acceptEdits` — trusted code-writers in your own repo
- `dontAsk` — headless / CI runs
- `bypassPermissions` — only with explicit `tools:` allowlist; skips checks on `.git`, `.claude`, `.vscode`, `.idea`, `.husky`

**Inheritance:** parent `bypassPermissions` / `acceptEdits` → subagent inherits, can't override. Parent `auto` → subagent inherits auto, frontmatter `permissionMode` **ignored**.

### `skills` (May 2026 surface)

Skills to preload at startup. **Full skill content** is injected, not just description.

```yaml
skills:
  - api-conventions
  - error-handling-patterns
```

**When to set:** when the agent has a domain it should know inside-out on every invocation.

**Cap at ~4 skills.** Auto-compaction gives all preloaded skills a shared 25K-token budget.

**Cannot preload** skills with `disable-model-invocation: true` — silent fail, warning to debug log only.

This is what makes Kirill's stack-skills useful as agent equipment. See [memory-and-skills-preload.md](memory-and-skills-preload.md).

### `mcpServers`

MCP servers for this subagent. String references reuse parent session's connection; inline definitions are scoped to this subagent.

```yaml
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  - github   # reuse already-configured
```

**When to set:**
- Inline — server available *only* to this agent, doesn't bloat main's context
- String reference — server configured in `.mcp.json`, this agent opts in

Common scoping in Kirill's stack: `playwright` (browser-tester), `serena` (semantic search), `git-nexus` (history), `context7` (lib docs), `supermemory`.

### `memory` (May 2026 surface)

Persistent directory across conversations.

```yaml
memory: project
```

| Scope | Location | Use when |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name>/` | Cross-project knowledge |
| `project` | `.claude/agent-memory/<name>/` | Project-specific, shareable via git |
| `local` | `.claude/agent-memory-local/<name>/` | Project-specific, gitignored |

**When to set:** when the agent has a job that benefits from accumulated experience.

**Effects:** system prompt extended with read/write instructions; first 200 lines or 25KB of `MEMORY.md` included; Read/Write/Edit auto-enabled (override your `tools:` allowlist if you have one).

### `hooks`

Lifecycle hooks scoped to this subagent.

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-db.sh"
```

**When to set:** rules richer than `tools` / `disallowedTools` can express. Canonical example: `db-reader` blocking SQL writes via shell-level inspection.

Most common events: `PreToolUse`, `PostToolUse`, `Stop` (auto-converted to `SubagentStop`).

Ignored for plugin subagents.

### `isolation`

```yaml
isolation: worktree
```

Gives subagent an isolated git worktree (auto-cleanup if no changes).

**When to set:** when the subagent might make changes you want to inspect before applying.

## Optional fields — used less often

### `maxTurns`

Circuit breaker.

```yaml
maxTurns: 20
```

### `effort`

```yaml
effort: high
```

Options: `low`, `medium`, `high`, `xhigh`, `max` (model-dependent).

For verifiers/planners: `high`. For fast read-only: `low`/`medium`.

### `background`

```yaml
background: true
```

Run as background always. Background subagents auto-deny prompts.

### `color`

```yaml
color: blue
```

Options: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`.

Suggested mapping in [recommended-defaults.md](recommended-defaults.md).

### `initialPrompt`

Auto-submitted as first user turn when agent runs as main session (via `--agent` or `agent` setting).

## Body / system prompt

Markdown body after the frontmatter is the system prompt. Subagents receive **only this prompt + environment details** — not the full Claude Code system prompt.

Good body (~50-150 lines):

1. **Role statement** — "You are a senior X specialist."
2. **When invoked** — what triggers + first actions
3. **Process** — numbered steps
4. **Standing rules** — 3-7 principles
5. **Output format** — what the digest back to main looks like
6. **What you must NOT do** — explicit prohibitions

Every line is a token cost on every invocation. Keep it lean.

## Important constraints

- **Subagents cannot spawn other subagents.** No nesting.
- **A subagent starts in main's cwd.** `cd` doesn't persist across Bash calls.
- **Loaded at session start.** Edit on disk → restart session. `/agents` interface edits = live reload.
- **`name` collisions within one scope are silently dropped.** Check before adding.
- **Each invocation creates a fresh instance.** Use `SendMessage` (with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) to resume.

## Minimal viable subagent

```yaml
---
name: dependency-checker
description: Checks package.json/package-lock.json consistency, flags version mismatches and known CVEs. Use proactively after dependency edits.
tools: Read, Bash
model: haiku
color: yellow
---

You are a dependency-hygiene checker.

When invoked:
1. Read package.json and package-lock.json
2. Run `npm ls --depth=0` to check unmet peer deps
3. Run `npm audit --json` and parse the output
4. Return a digest

You MUST run all three checks before reporting. Do not report "no issues" after only checking one.

Do not modify any files. Do not run `npm install` / `npm update`.

Output format:
- ✅ Clean | ⚠️ Warnings | 🔴 Critical
- One line per issue: <file>:<line> — <issue>
```

~25 lines including frontmatter. Get there.
