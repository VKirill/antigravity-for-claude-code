# Wrong vs Right — opencode

Side-by-side contrast for common OpenCode footguns.

---

### Secrets: inline vs env interpolation

**❌ Wrong — API keys inline in committed config:**

```jsonc
{
  "provider": {
    "anthropic": {
      "options": { "apiKey": "sk-ant-api03-xxxxxxxxxxxxxxxx" }
    },
    "openai": {
      "options": { "apiKey": "sk-proj-xxxxxxxxxxxxxxxx" }
    }
  }
}
```

`opencode.json` is normally committed (provider list, agents, MCP are useful in repo). Inline secrets leak to git history forever.

**✅ Right — `{env:VAR}` interpolation:**

```jsonc
{
  "provider": {
    "anthropic": { "options": { "apiKey": "{env:ANTHROPIC_API_KEY}" } },
    "openai":    { "options": { "apiKey": "{env:OPENAI_API_KEY}" } }
  }
}
```

Combine with `direnv` or `1Password CLI` for ergonomic local dev.

**Why it matters:** Committed secrets are permanent — even after rotation, the old value lives in history. The `{env:VAR}` and `{file:...}` interpolation patterns are first-class OpenCode primitives; use them.

---

### Agent type: `build` vs `plan` choice

**❌ Wrong — using `build` for an unfamiliar repo:**

```bash
cd ~/code/unfamiliar-monorepo
opencode --agent build "rewrite the auth module"
```

`build` has full tools (write/edit/bash). On an unfamiliar codebase the model edits before understanding — often makes destructive changes you have to revert.

**✅ Right — `plan` first, then promote:**

```bash
cd ~/code/unfamiliar-monorepo
opencode --agent plan "propose a plan to rewrite the auth module"
# Review the plan
# Then in same session: /agent build  (Tab key in TUI)
```

**Why it matters:** `plan` is read-only by design. The model can grep, read files, run `git log/diff`, but cannot Edit/Write/Bash. You get a written plan to review before any side effect lands. Promoting to `build` in the same session preserves the context.

---

### Model ID: prefixed vs unprefixed

**❌ Wrong — unprefixed model ID:**

```jsonc
{ "agent": { "build": { "model": "claude-sonnet-4-6" } } }
```

OpenCode doesn't know which provider this comes from. With multiple providers configured (Anthropic + OpenRouter), the routing is ambiguous and may fail.

**✅ Right — `<provider>/<model-id>`:**

```jsonc
{ "agent": { "build": { "model": "anthropic/claude-sonnet-4-6" } } }
```

For OpenRouter routing: `openrouter/anthropic/claude-sonnet-4-6`.

**Why it matters:** The provider prefix is part of the model identity in OpenCode. It also makes failover via OpenRouter/Vercel explicit — you can swap `anthropic/...` for `openrouter/anthropic/...` and get gateway routing without touching agent definitions.

---

### Tool allowlist: explicit vs default

**❌ Wrong — review agent with default tools:**

```jsonc
{
  "agent": {
    "review": { "model": "anthropic/claude-haiku-4-5" }
  }
}
```

Inherits default tool set including `write`, `edit`, `bash`. A "review" agent can now accidentally modify files.

**✅ Right — narrow tool allowlist:**

```jsonc
{
  "agent": {
    "review": {
      "model": "anthropic/claude-haiku-4-5",
      "tools": { "write": false, "edit": false, "bash": false }
    }
  }
}
```

**Why it matters:** OpenCode has no native hooks (unlike Claude Code's PreToolUse). Tool allowlists per agent are the primary safety boundary. A read-only review agent should be unable to edit by construction, not by polite request.

---

### Theme: `tui.json` vs `opencode.json`

**❌ Wrong — putting theme/keybinds in `opencode.json`:**

```jsonc
{
  "theme": "tokyonight",
  "keybinds": { "leader": "ctrl+x" }
}
```

Schema validation rejects this. `opencode.json` is for providers/agents/MCP only.

**✅ Right — separate `tui.json`:**

```jsonc
// ~/.config/opencode/tui.json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "tokyonight",
  "leader_timeout": 2000,
  "keybinds": { "leader": "ctrl+x", "command_list": "ctrl+p" }
}
```

**Why it matters:** OpenCode splits concerns — runtime/provider config in `opencode.json`, TUI presentation in `tui.json`. Mixing them produces schema errors that look mysterious.
