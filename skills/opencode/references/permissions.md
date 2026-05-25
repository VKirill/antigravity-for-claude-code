# Permissions, Sandboxing, Hook-as-Wrapper

## Permission model

OpenCode is simpler than Claude Code:
- **Per-agent tool allowlist** in `opencode.json` (object: `tools: { edit: false }`)
- **Runtime approval prompts** for write/bash/web by default
- **`--auto` flag** skips prompts (for CI / sandboxed environments)

There are no `permissions.allow`/`deny` matchers à la Claude Code — disable tools entirely at the agent level instead.

## Configure

```jsonc
{
  "permissions": {
    "auto": false,
    "tools": {
      "read": true,
      "edit": true,
      "write": true,
      "bash": true,
      "web": false
    }
  },
  "agent": {
    "review": {
      "tools": { "edit": false, "write": false, "bash": false }
    }
  }
}
```

Agent-level `tools` overrides global `permissions.tools` for that agent.

## `--auto` / `permissions.auto`

Skips all approval prompts. **Use only inside a sandbox** (Docker container, devcontainer, ephemeral CI runner). The OpenCode binary itself does not enforce filesystem/network isolation — that's your runtime's job.

## No native hooks → use wrappers

Claude Code has `PreToolUse`, `PostToolUse`, etc. OpenCode does not. To replicate:

### Pattern 1 — post-format after every run

```bash
#!/usr/bin/env bash
# opencode-with-format.sh
opencode run "$@" --json > /tmp/oc.jsonl
jq -r 'select(.type=="tool_use" and (.tool=="Edit" or .tool=="Write")) | .input.file_path' /tmp/oc.jsonl \
  | sort -u | xargs -r -n1 biome format --write
cat /tmp/oc.jsonl
```

### Pattern 2 — pre-flight check

Wrap with a script that validates input before invoking:

```bash
#!/usr/bin/env bash
case "$*" in
  *"rm -rf"*) echo "blocked"; exit 1 ;;
esac
exec opencode "$@"
```

### Pattern 3 — git hook integration

Use git's native `pre-commit` to run `opencode run "..."` on staged diff for review.

## Sandbox

OpenCode does not include a sandbox like Claude Code's `sandbox.network.deniedDomains`. Best practices:
- Run inside a Docker container with `--network none` or a restrictive network
- Use `firejail` or `nsjail` on Linux for filesystem isolation
- For CI: GitHub Actions ephemeral runners already provide isolation

## Compare with Claude Code

| Concern | Claude Code | OpenCode |
|---|---|---|
| Tool allow/deny matchers | `permissions.allow/deny` (rich glob/cmd patterns) | per-agent `tools.<name>: false` |
| Network sandbox | `sandbox.network.deniedDomains` | not built-in; use container `--network` |
| Bash command gating | `Bash(rm -rf:*)` deny | `tools.bash: false` (all-or-nothing) |
| Filesystem gating | `Edit(.env*)` deny | not built-in; use OS perms / wrapper |
| Hooks for inspection | `PreToolUse` | shell wrapper around `opencode run` |

If fine-grained gating matters, Claude Code is the stronger choice. OpenCode prioritizes simplicity and multi-provider — the assumption is that you run it in a sandbox layer above.
