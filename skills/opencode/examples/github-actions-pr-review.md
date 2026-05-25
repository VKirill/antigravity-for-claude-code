# GitHub Actions — Headless PR Review with OpenCode (Groq, cheap)

End-to-end pipeline using a cheap fast provider for bulk review.

## Workflow

`.github/workflows/opencode-review.yml`:

```yaml
name: OpenCode PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: opencode-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Install OpenCode
        run: curl -fsSL https://opencode.ai/install | VERSION=1.0.92 bash

      - name: Compute diff
        id: diff
        run: |
          git fetch origin ${{ github.event.pull_request.base.ref }}
          git diff origin/${{ github.event.pull_request.base.ref }}...HEAD > /tmp/diff.patch
          wc -l /tmp/diff.patch

      - name: Review with OpenCode (Groq)
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
        run: |
          PROMPT=$(cat <<'EOF'
          Review the attached PR diff. Identify:
          1. Security risks (high priority)
          2. Likely bugs
          3. Missing test coverage
          4. Style / naming issues

          Output Markdown. If clean, reply exactly: ## OpenCode review: OK
          EOF
          )
          opencode run "$PROMPT$(echo; cat /tmp/diff.patch)" \
            --json \
            --agent plan \
            --model groq/llama-3.3-70b-versatile \
            --max-turns 4 \
            > /tmp/run.jsonl
          jq -r 'select(.type=="done") | .result' /tmp/run.jsonl > /tmp/review.md
          cat /tmp/review.md

      - name: Post comment
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
        run: gh pr comment ${{ github.event.pull_request.number }} --repo ${{ github.repository }} --body-file /tmp/review.md
```

## Cost characteristics

- Groq's free tier covers a meaningful PR volume (~14400 requests/day)
- Average review: ~3000 prompt tokens, ~500 completion tokens, ~1s wall clock
- Cost: essentially $0 on free tier; pennies above

## Upgrade path

Hot PRs / merging-to-main: rerun with Claude Sonnet for depth.

```yaml
- name: Deep review (main-merge only)
  if: github.event.pull_request.base.ref == 'main'
  env: { ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }} }
  run: |
    opencode run "..." --json --agent plan --model anthropic/claude-sonnet-4-6 --max-turns 6 > /tmp/deep.jsonl
```

## Fallback

If Groq is rate-limited:

```jsonc
// opencode.json
{ "provider": { "default": "groq/llama-3.3-70b-versatile", "fallback": "openai/gpt-5.4" } }
```

`fallback` kicks in automatically on provider error.

## Compare with Claude Code action

Same shape, different price/quality knob. Claude Code's `anthropics/claude-code-action@v1` is Anthropic-only — better quality, higher cost. OpenCode gives you the dial.
