# Providers (75+ BYOK)

OpenCode's headline differentiator: pick the right model per task across 75+ providers.

## Provider catalog (mainstream subset)

| Provider | Format | Auth |
|---|---|---|
| Anthropic | `anthropic/<model-id>` | API key or OAuth |
| OpenAI | `openai/<model-id>` | API key |
| Google | `google/<model-id>` | API key / service account |
| Mistral | `mistral/<model-id>` | API key |
| Groq | `groq/<model-id>` | API key |
| Together | `together/<model-id>` | API key |
| Cohere | `cohere/<model-id>` | API key |
| AWS Bedrock | `bedrock/<model-id>` | IAM |
| Azure OpenAI | `azure/<deployment>` | Azure auth |
| OpenRouter | `openrouter/<model-id>` | API key (single key, many models) |
| Ollama (local) | `ollama/<model-id>` | none (env: `OLLAMA_BASE_URL`) |
| LM Studio (local) | `lmstudio/<model-id>` | none |
| Custom OpenAI-compatible | `custom/<id>` | `baseURL` + `apiKey` |

## Common picks 2026

| Use case | Best provider/model | Why |
|---|---|---|
| Hard reasoning, refactors | `anthropic/claude-opus-4-7` | Top agentic quality |
| Daily default | `anthropic/claude-sonnet-4-6` | Cost / quality sweet spot |
| Long context | `google/gemini-2.5-pro` | 2M token window |
| Fast classification, bulk runs | `groq/llama-3.3-70b-versatile` | ~600 tokens/s |
| Local / air-gapped | `ollama/qwen2.5-coder:32b` | Zero cost, offline |
| OpenAI-tied workflow | `openai/gpt-5.4` | Native OpenAI features |
| Privacy / EU | `mistral/mistral-large-2` | EU-hosted option |

## Configure providers

```jsonc
{
  "provider": {
    "default": "anthropic/claude-sonnet-4-6",
    "fallback": "openai/gpt-5.4",
    "anthropic": { "options": { "apiKey": "{env:ANTHROPIC_API_KEY}" } },
    "openai":    { "options": { "apiKey": "{env:OPENAI_API_KEY}" } },
    "groq":      { "options": { "apiKey": "{env:GROQ_API_KEY}" } },
    "ollama":    { "options": { "baseURL": "http://localhost:11434" } }
  }
}
```

## Per-agent model selection

```jsonc
{
  "agent": {
    "plan":   { "model": "anthropic/claude-opus-4-7" },
    "build":  { "model": "anthropic/claude-sonnet-4-6" },
    "review": { "model": "anthropic/claude-haiku-4-5" },
    "bulk":   { "model": "groq/llama-3.3-70b-versatile" }
  }
}
```

## Fallback / failover

OpenCode does **not** ship a generic top-level `provider.fallback` knob. Real failover patterns:

1. **OpenRouter `allow_fallbacks` / `order`** — per-model, routes through alternative backends:
   ```jsonc
   {
     "provider": {
       "openrouter": {
         "models": {
           "moonshotai/kimi-k2": {
             "options": { "provider": { "order": ["baseten"], "allow_fallbacks": false } }
           }
         }
       }
     }
   }
   ```
2. **Vercel AI Gateway `order`** — per-model provider preference:
   ```jsonc
   {
     "provider": {
       "vercel": {
         "models": {
           "anthropic/claude-sonnet-4": { "options": { "order": ["anthropic", "vertex"] } }
         }
       }
     }
   }
   ```
3. **Application-level wrapping** — for first-class failover across two distinct providers (`anthropic/...` ↔ `openai/...`), call `opencode run` from a script that retries with a different `--model`.

## OpenRouter — one key, many models

OpenRouter is a meta-provider that routes to many backends with a single API key. Convenient for experimentation:

```jsonc
{ "provider": { "openrouter": { "options": { "apiKey": "{env:OPENROUTER_API_KEY}" } } } }
```

Then: `--model openrouter/anthropic/claude-sonnet-4-6` (provider-routed) or `--model openrouter/openai/gpt-5.4`.

## Verify

```bash
opencode models               # list all reachable models
opencode models --provider anthropic   # filter
```

## Cost considerations

| Use case | Spend ratio |
|---|---|
| Heavy refactor (Opus) | ~1.0 |
| Daily (Sonnet) | ~0.2 |
| Bulk review (Haiku / Groq) | ~0.02 |
| Local (Ollama) | $0 (electricity) |

The right OpenCode setup uses **multiple providers** — Opus for the hard 5% of tasks, Sonnet for the daily 80%, Groq/Ollama for the bulk 15%.
