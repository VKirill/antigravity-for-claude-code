# Commands — Built-in + Custom

## Built-in slash commands

| Command | Purpose |
|---|---|
| `/new` | Clear session and start fresh |
| `/compact` | Compress conversation context |
| `/init` | Generate `AGENTS.md` from repo scan |
| `/permissions` | View / change permission mode |
| `/mcp` | List & manage MCP servers |
| `/models` | List available models |
| `/agent <name>` | Switch active agent |
| `/connect` | Add a provider interactively |
| `/share` | Generate a share URL for the session |
| `/help` | Show command list |

## Custom commands

Drop a markdown file at:
- **Project**: `.opencode/commands/<name>.md`
- **User**: `~/.config/opencode/commands/<name>.md`

Invoked as `/<name> [args]`.

### Frontmatter

```yaml
---
description: "PR description from current diff"
agent: review                   # which agent to run this in
tools:
  bash: true                    # override tool allowlist for this command
argument-hint: "<ticket-id>"
---
```

### Body — prompt template

Placeholders:
- `$ARGUMENTS` — everything after the command name
- `$1`, `$2`, ... — positional args
- `$CWD` — current working directory
- `$FILE` — currently focused file (TUI)

### Example: `.opencode/commands/pr-desc.md`

```markdown
---
description: "Generate Conventional Commits PR description"
agent: build
argument-hint: "<ticket-id>"
---
Generate a PR description for the current git diff.
Reference ticket: $ARGUMENTS

Sections required: Summary, Why, Test plan, Risk.

Run `git diff origin/main...HEAD` and `git log origin/main..HEAD --oneline` first.
```

Invoke: `/pr-desc PROJ-1234`.

## Namespaced commands

Commands under `<group>/<name>.md` become `/group:name`. Useful for plugin distribution.

## Comparison vs Claude Code custom commands

| Feature | OpenCode | Claude Code |
|---|---|---|
| Project commands | `.opencode/commands/*.md` | `.claude/commands/*.md` |
| User commands | `~/.config/opencode/commands/*.md` | `~/.claude/commands/*.md` |
| Frontmatter `description` | ✅ | ✅ |
| Frontmatter `tools` | ✅ (object form) | ✅ (`allowed-tools` string) |
| Frontmatter `model` | ✅ (via `agent`) | ✅ (`model` field) |
| Frontmatter `agent` | ✅ | (subagent path is different) |
| Placeholders | `$ARGUMENTS`, `$1..N`, `$FILE`, `$CWD` | `$ARGUMENTS`, `$1..N`, `$FILE_PATH` |
| Namespacing | `/group:name` via subdir | `/group:name` via subdir |

Commands are largely portable — most `.claude/commands/*.md` work as `.opencode/commands/*.md` after a frontmatter tweak.
