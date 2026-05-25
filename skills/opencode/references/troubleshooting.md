# Troubleshooting — opencode

Symptom-indexed. Find what you see, follow diagnosis, apply fix.

---

## BYOK auth fails

**Symptoms**
- `opencode run` errors with "401 Unauthorized" or "model not accessible"
- `opencode models` shows fewer models than expected
- Auth seemed to succeed but no tokens captured

**Diagnose**
```bash
# 1. Verify auth file
cat ~/.local/share/opencode/auth.json | jq 'keys'

# 2. Verify env vars (used directly if no auth.json entry)
echo "ANTHROPIC: ${ANTHROPIC_API_KEY:+set}"
echo "OPENAI:    ${OPENAI_API_KEY:+set}"

# 3. Test the provider directly
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/models | jq .
```

**Common causes**
- Used `opencode auth login` but selected wrong provider in the picker
- Env var set in shell A but `opencode` launched from shell B
- `{env:VAR}` in `opencode.json` references a var that's not exported (only set in `.envrc` without `direnv reload`)
- Provider key has expired or been revoked

**Fix**
- Re-run `opencode auth login`; pick the right provider
- Move secrets to a tool that exports reliably (direnv, 1Password CLI)
- Use `/connect` slash command in TUI for ad-hoc provider addition

See `references/providers.md` and `references/recommended-defaults.md`.

---

## Provider fallback doesn't engage

**Symptoms**
- Primary provider rate-limited or down
- Expected automatic failover; OpenCode errors out instead

**Cause**
- There is **no** generic top-level `provider.fallback` knob in OpenCode (a common assumption from other tools)
- Failover is per-model via gateway providers (OpenRouter, Vercel) or done at the shell level

**Fix — pick one of three patterns**

1. **OpenRouter per-model**:
   ```jsonc
   {
     "provider": {
       "openrouter": {
         "models": {
           "anthropic/claude-sonnet-4": {
             "options": { "provider": { "order": ["anthropic"], "allow_fallbacks": true } }
           }
         }
       }
     }
   }
   ```
2. **Vercel gateway** — `options.order` per model
3. **Shell wrapper** — retry with different `--model` on non-zero exit

See `references/providers.md` Failover section.

---

## opencode.json schema error

**Symptoms**
- `opencode` fails to start; error mentions JSON schema validation
- IDE shows red squiggles under config keys

**Diagnose**
```bash
# 1. Confirm valid JSON
jq . opencode.json

# 2. Confirm schema URL is correct
head -1 opencode.json
# Should be:  "$schema": "https://opencode.ai/config.json"

# 3. For tui.json — different schema:
# "$schema": "https://opencode.ai/tui.json"
```

**Common causes**
- Mixing `tui.json` keys (`theme`, `keybinds`) into `opencode.json` — wrong file
- Trailing commas in plain `.json` (use `.jsonc` for comments and trailing commas)
- Old key names from pre-1.0 versions

**Fix**
- Split: themes/keybinds → `~/.config/opencode/tui.json`; providers/agents/MCP → `opencode.json`
- Rename to `.jsonc` if you need comments / trailing commas
- Re-generate with `opencode init` and diff

---

## Agent switching broken (Tab key, `/agent` command)

**Symptoms**
- `Tab` in TUI doesn't switch agents
- `/agent <name>` says "agent not found"
- `--agent` CLI flag ignored

**Diagnose**
1. List agents OpenCode knows about: `opencode agents` (or `/agent` in TUI shows the picker)
2. Confirm custom agent path: `.opencode/agents/<name>.md` (project) or `~/.config/opencode/agents/<name>.md` (user)
3. Validate frontmatter: `description`, `model`, `tools`, `prompt`

**Common causes**
- Agent filename doesn't match invocation (e.g., file `review.md` but you typed `/agent reviewer`)
- Frontmatter YAML parse error — agent silently skipped
- Custom agent in wrong directory (project vs user)
- `default_agent` in config points to a non-existent agent

**Fix**
- Filename = agent name (without `.md`)
- Run with `--debug` (if supported) to see which agents were loaded
- Move agent to user location for cross-project availability

See `references/agents.md`.

---

## MCP server not connecting

**Symptoms**
- `/mcp` shows server status "error"
- Tool calls fail with "MCP server <name> not available"

**Diagnose**
```bash
# 1. Run server manually
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | <command>

# 2. Check PATH resolution
which <command>

# 3. Confirm transport type matches: type "local" (stdio) vs "remote" (http)
```

**Common causes**
- `command` array missing `-y` for `npx` (will hang waiting for prompt)
- Wrong transport type
- Env var unset: `{env:GITHUB_TOKEN}` references undefined var
- Cold install timeout

**Fix**
```jsonc
{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "{env:GITHUB_TOKEN}" }
    }
  }
}
```

See `references/recommended-defaults.md` for the canonical MCP block.

---

## More symptoms?

Capture: `opencode --version`, `opencode auth list`, `opencode.json` (redacted), `tui.json` if relevant, and a sample failed run. File at <https://github.com/anomalyco/opencode/issues>.
