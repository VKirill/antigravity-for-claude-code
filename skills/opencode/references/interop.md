# Interop — Headless, CI/CD, JSON Events

## Headless

```bash
opencode run "<prompt>" --json
```

Emits a **JSONL stream** (one event per line), not a single JSON object. Stream types:

| `type` | Payload |
|---|---|
| `message` | Assistant message text chunk |
| `tool_use` | Tool call: `{tool, input}` |
| `tool_result` | Tool result: `{tool, output}` |
| `usage` | Token counts so far |
| `done` | Final: `{result, cost_usd, session_id}` |
| `error` | Error |

### Parse final result

```bash
opencode run "Summarize README.md" --json --agent plan \
  | jq -r 'select(.type=="done") | .result'
```

### Stream messages live

```bash
opencode run "..." --json | jq -r 'select(.type=="message") | .content'
```

## GitHub Actions

### Hand-rolled

```yaml
name: OpenCode Review
on: pull_request
jobs:
  review:
    runs-on: ubuntu-latest
    permissions: { pull-requests: write, contents: read }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: curl -fsSL https://opencode.ai/install | VERSION=1.0.92 bash
      - run: |
          opencode run "Review the diff between origin/${{ github.event.pull_request.base.ref }} and HEAD. Reply 'OK' or list concerns." \
            --json \
            --agent plan \
            --model groq/llama-3.3-70b-versatile \
            > /tmp/run.jsonl
          jq -r 'select(.type=="done") | .result' /tmp/run.jsonl > /tmp/review.md
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
      - run: gh pr comment ${{ github.event.pull_request.number }} -F /tmp/review.md
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

### Provider choice in CI

| Goal | Pick |
|---|---|
| Cheapest review | `groq/llama-3.3-70b-versatile` (fast + free tier) |
| Highest quality | `anthropic/claude-sonnet-4-6` |
| OpenAI tied | `openai/gpt-5.4` |
| Air-gapped | `ollama/qwen2.5-coder` (self-hosted runner) |

## SDK — `opencode-ai`

```typescript
import { opencode } from 'opencode-ai';

const result = await opencode.run({
  prompt: 'Review this file',
  agent: 'plan',
  model: 'anthropic/claude-sonnet-4-6',
  cwd: process.cwd(),
});

console.log(result.text);
```

Streaming:

```typescript
for await (const event of opencode.runStream({ prompt: '...' })) {
  if (event.type === 'message') process.stdout.write(event.content);
}
```

## Comparison vs Claude Code, Codex

| Concern | Claude Code | OpenCode | Codex |
|---|---|---|---|
| Headless flag | `claude -p` | `opencode run` | `codex exec` |
| Output mode | JSON object | JSONL stream | text or JSON |
| Provider lock | Anthropic only | 75+ providers | OpenAI only |
| Cost flexibility | Fixed (Anthropic pricing) | Pick provider | Fixed (OpenAI pricing) |
| Native CI action | `anthropics/claude-code-action@v1` | community actions | community actions |

## Cost control

```bash
opencode run "..." --json --max-turns 6 --model groq/llama-3.3-70b-versatile
```

`--max-turns` is the same cap-loops idiom as Claude Code. Pair with a cheap provider for bulk runs.
