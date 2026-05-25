# Installation, Auth, Multi-Provider Setup

## Install paths

### Native install script (recommended)

```bash
curl -fsSL https://opencode.ai/install | bash
# Pin a version:
curl -fsSL https://opencode.ai/install | VERSION=1.0.92 bash
```

Installs binary to `$OPENCODE_INSTALL_DIR` → `$XDG_BIN_DIR` → `$HOME/bin` → `$HOME/.opencode/bin` (first writable wins).

### Homebrew

```bash
brew install sst/tap/opencode
```

(Tap still works for both SST and Anomaly forks at time of writing.)

### npm (SDK + CLI)

```bash
npm i -g opencode-ai
```

Useful when you want to call OpenCode from Node scripts via the SDK.

### AUR (Arch)

```bash
yay -S opencode-bin
```

### Verify

```bash
opencode --version
opencode doctor   # check PATH, auth, MCP handshake
```

### Upgrade

```bash
opencode upgrade
```

## Authentication — multi-provider

```bash
opencode auth login
```

Interactive picker. Choose one of:
- `anthropic` (Claude) — uses OAuth or API key
- `openai` (GPT) — API key
- `google` (Gemini) — API key or service account
- `mistral`, `groq`, `together`, `cohere` — API keys
- `ollama` — local; no auth, just `OLLAMA_BASE_URL`
- `azure`, `aws-bedrock` — cloud-IAM auth
- `openrouter` — single key, many models

Credentials stored at `~/.local/share/opencode/auth.json`.

### Multi-provider — env-var path

For CI or scripted setups:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
export OLLAMA_BASE_URL="http://localhost:11434"
```

OpenCode auto-discovers these. To verify reachability:

```bash
opencode models
```

Lists every model your current auth gives you access to (often 200+ across all providers).

### Logout / remove

```bash
opencode auth logout       # remove all
opencode auth logout anthropic   # remove one provider
```

## Devcontainer

Reference image: `ghcr.io/anomalyco/opencode-devcontainer:latest`. Mount `~/.local/share/opencode/` for auth persistence and `~/.config/opencode/` for user config.

## Project init

```bash
cd ~/projects/my-app
opencode
> /init
```

`/init` analyses the repo and writes `AGENTS.md` to the project root (same file format used by Codex CLI — fully portable).

## Config locations

```
~/.config/opencode/opencode.json   # user defaults
~/.config/opencode/agents/*.md     # user-wide custom agents
~/.config/opencode/commands/*.md   # user-wide custom commands
<project>/opencode.json            # project (committed)
<project>/opencode.jsonc           # JSONC variant (comments allowed)
<project>/.opencode/agents/*.md    # project agents
<project>/.opencode/commands/*.md  # project commands
```

Project config wins over user config; CLI flags win over both.
