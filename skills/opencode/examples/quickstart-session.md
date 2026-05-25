# Quickstart Session — Install → Multi-Provider Auth → First Edit

## 1. Install

```bash
curl -fsSL https://opencode.ai/install | bash
opencode --version
```

## 2. Auth across providers

```bash
opencode auth login
# Pick: anthropic → paste key
opencode auth login
# Pick: openai → paste key
opencode auth login
# Pick: groq → paste key
```

Or via env:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GROQ_API_KEY="gsk_..."
```

Verify:

```bash
opencode models | head -20
# Should list many models across providers
```

## 3. Project init

```bash
cd ~/projects/my-app
opencode
> /init
```

`/init` writes `AGENTS.md` to the project root.

## 4. Configure providers + agents

```bash
cp ~/.claude/skills/opencode/templates/opencode.json.template ./opencode.json
$EDITOR opencode.json   # fill placeholders
```

Commit `opencode.json` and `AGENTS.md`. Gitignore `.opencode/local.json` if you use it.

## 5. First edit — plan first

In TUI:

```text
> /agent plan
> Add a /healthz endpoint to the Fastify server.
```

Claude Opus (configured for `plan`) drafts a plan. Review.

Switch to build:

```text
> /agent build
> Execute the plan.
```

Sonnet (configured for `build`) makes the edits.

## 6. Bulk task with cheap model

```bash
opencode run "List every TODO in src/ with file:line" \
  --agent bulk \
  --model groq/llama-3.3-70b-versatile \
  --json
```

Routes to Groq for fast/cheap classification.

## 7. ACP from Zed

In Zed's `settings.json`:

```jsonc
{ "agent_servers": { "OpenCode": { "command": "/usr/local/bin/opencode", "args": ["acp"] } } }
```

Now you can drive OpenCode agents from inside Zed's agent panel.

## 8. Headless in CI

`.github/workflows/opencode-review.yml`:

```yaml
- run: curl -fsSL https://opencode.ai/install | VERSION=1.0.92 bash
- run: opencode run "Review the diff" --json --agent plan --model groq/llama-3.3-70b-versatile > /tmp/r.jsonl
  env: { GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }} }
```

Done. Multi-provider, headless, ~$0.001 per PR review with Groq.
