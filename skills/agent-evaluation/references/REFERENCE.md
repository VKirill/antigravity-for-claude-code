# Agent Evaluation — Reference Index

Navigator for all `agent-evaluation` reference files. Read the matching file for the topic you're working on; don't load all files.

## Decision map: which reference to open

| I need to... | Open |
|---|---|
| Write behavioral regression tests or invariant tests | [behavioral-testing.md](behavioral-testing.md) |
| Run or interpret SWE-bench, HumanEval, or build a domain benchmark | [capability-benchmarks.md](capability-benchmarks.md) |
| Measure reliability over N runs, define SLOs, classify failure modes | [reliability-metrics.md](reliability-metrics.md) |
| Design or audit an LLM-as-judge pipeline | [llm-as-judge.md](llm-as-judge.md) |
| Set up LangSmith, LangFuse, Arize Phoenix, or Helicone | [production-monitoring.md](production-monitoring.md) |
| Run adversarial / red-team tests against an agent | [red-teaming.md](red-teaming.md) |
| Calculate sample sizes or run an A/B test on a prompt | [statistical-design.md](statistical-design.md) |

## Framework decision map

```
Need eval tooling?
├── Python pipeline / LangChain → DeepEval or LangSmith Evaluations
├── Multi-framework / YAML-driven → Promptfoo
├── OpenAI native → OpenAI Evals
├── Custom scoring logic → build a harness with pytest + any judge SDK
└── Production tracing first → LangFuse (OSS) or LangSmith (managed)
```

## File inventory

| File | Lines | Contents |
|---|---|---|
| `REFERENCE.md` | (this file) | Navigator + decision maps |
| `behavioral-testing.md` | <500 | Invariant, contract, snapshot, regression patterns |
| `capability-benchmarks.md` | <500 | SWE-bench, AgentBench, HumanEval, Pass@k, calibration |
| `reliability-metrics.md` | <500 | N-run consistency, failure taxonomy, error budgets, SLOs |
| `llm-as-judge.md` | <500 | Rubric design, bias types, dual-judge, human correlation |
| `production-monitoring.md` | <500 | Tracing setup, eval-in-production, drift detection, tooling |
| `red-teaming.md` | <500 | Prompt injection, jailbreaks, tool misuse, data leakage |
| `statistical-design.md` | <500 | Sample size, CIs, A/B testing, Thompson Sampling |

## Key tools referenced across files

| Tool | Category | License |
|---|---|---|
| DeepEval | Eval framework (Python) | Apache 2.0 |
| Promptfoo | Eval framework (CLI/YAML) | MIT |
| OpenAI Evals | Eval framework | MIT |
| LangSmith | Tracing + evals (managed) | Proprietary |
| LangFuse | Tracing + evals (OSS) | MIT |
| Arize Phoenix | Tracing + drift detection | Elv2 |
| Helicone | Proxy-based observability | MIT |
| RAGAS | RAG-specific eval | Apache 2.0 |
