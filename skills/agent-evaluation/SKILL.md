---
name: agent-evaluation
description: Tests and benchmarks LLM agents covering behavioral testing, capability assessment, reliability metrics, and production monitoring. Use when evaluating agent quality, designing eval suites, building regression tests, or measuring real-world reliability beyond benchmark scores.
tags:
  - agents
  - testing
source: vibeship-spawner-skills (Apache 2.0)
risk: low-stakes
---

<!-- versions:start -->
<!-- versions:end -->

## Usage

Loaded automatically when the description matches the active task. The body below provides the working context.

## Use this skill when

- Designing an eval suite for a coding agent, RAG pipeline, or tool-use agent
- Building behavioral regression tests that run on every model or prompt change
- Measuring real-world reliability over N runs, not just single-run pass/fail
- Choosing between DeepEval, Promptfoo, OpenAI Evals, or a custom harness
- Setting up production monitoring with LangSmith, LangFuse, or Arize Phoenix
- Running red-team / adversarial tests (prompt injection, tool misuse, jailbreaks)
- Designing statistically sound A/B tests for prompt or model changes

## Do not use this skill when

- The task is evaluating a classical ML model (classification, regression) — use `ml-engineer`
- You need to build an agent, not evaluate one — use `autonomous-agent-patterns`
- The concern is purely about test infrastructure (pytest fixtures, mocking) — use `testing-patterns`

## Purpose

LLM agents are non-deterministic, context-sensitive, and often optimized to score well on narrow benchmarks while failing at the actual task. Evaluating them requires a fundamentally different approach from traditional software testing: probabilistic assertions over distributions of outputs, multi-dimensional rubrics, LLM-as-judge for semantic correctness, and production monitoring for drift.

The goal is never 100% pass rate on a fixed test suite — it is high reliability across real-world input distributions, with early warning when that reliability degrades.

## Capabilities

### Behavioral Testing

Behavioral tests define what an agent must always or never do, regardless of phrasing. They are the regression suite for agent development.

**Invariant tests** assert properties that hold across paraphrased inputs: "the agent never exposes PII from retrieved documents", "tool calls always include required parameters", "the agent refuses requests classified as harmful". Run each invariant against N input variants (typically 10–30) and require a pass rate threshold (e.g., 95%) rather than 100%.

**Contract tests** verify the agent honors its declared interface: output schema conforms to spec, citations link to real sources, tool call arguments validate against JSON Schema. These are determinstic and should pass 100%.

**Snapshot tests** capture the semantic shape of an output for a golden input, then flag regressions when prompt or model changes alter it. Use embedding similarity (cosine > 0.85) or an LLM rubric as the comparator, not string equality.

**Regression suites** accumulate cases from past failures. Every production bug becomes a test. Gate CI on this suite; new model versions must not regress existing passing cases.

See [references/behavioral-testing.md](references/behavioral-testing.md).

### Capability Benchmarks

Standard benchmarks measure task-specific capability with a shared, reproducible methodology.

**SWE-bench** (software engineering): resolves real GitHub issues across 300+ Python repos. Best overall signal for coding agents. Verified variant reduces false positives from test-generation exploits. Pass@1 on SWE-bench Verified is the de facto leaderboard metric for coding agents as of 2026.

**AgentBench**: multi-environment tool-use benchmark (OS, database, web, game). Better for evaluating general agent capability than coding specifically.

**HumanEval / MBPP**: function-level code generation. Fast to run, but saturated at the frontier — use primarily for regression, not differentiation.

**Pass@k**: generate k completions per problem; count problem as passed if at least one is correct. Pass@1 is most production-relevant. Pass@10 or Pass@100 measures maximum capability at the cost of inference budget.

**Custom domain benchmarks**: always build one alongside public benchmarks. Curate 50–200 problems from your actual use case, manually verified. This is what benchmark-vs-production correlation requires.

**Calibration**: a model's self-reported confidence should match actual accuracy across a holdout set. A calibrated model saying "80% confident" should be correct ~80% of the time. Measure with Expected Calibration Error (ECE). Poorly calibrated agents over-commit to wrong answers.

See [references/capability-benchmarks.md](references/capability-benchmarks.md).

### Reliability Metrics

Single-run accuracy hides the variance that determines real-world user experience.

**Consistency over N runs**: run each test case N times (N=10 minimum, N=50 for production readiness). Report mean accuracy, standard deviation, and worst-case (10th percentile). An agent that scores 90% mean with 40% worst-case is unreliable in practice.

**Failure mode taxonomy**: classify failures by type — hallucination, tool misuse, plan abandonment, context window overflow, format non-compliance, harmful output. Track failure rates by category over time. Different failure types require different mitigations.

**Error budgets**: define the maximum acceptable failure rate per category over a rolling 30-day window. Trigger retraining or prompt revision when the budget is exhausted. Treat this like an SLO for a production service.

**SLOs for agents**: Task Success Rate ≥ X%, Mean Time to Complete ≤ Y seconds, Tool Error Rate ≤ Z%. Set these before launch; measure continuously. Tie them to retraining triggers.

See [references/reliability-metrics.md](references/reliability-metrics.md).

### LLM-as-Judge

When the correct answer is not a single string, use a separate LLM to evaluate the output against a rubric.

**Rubric design**: decompose quality into measurable sub-dimensions (relevance, faithfulness, coherence, completeness, safety). Score each dimension 1–5 with explicit level descriptors. Vague rubrics produce noisy scores.

**Bias mitigation**: LLM judges favor their own outputs (self-preference bias), verbose responses (verbosity bias), and whichever option appears first in pairwise comparisons (position bias). Counter with: use a different model family as the judge, show options in random order, use chain-of-thought prompting before the score, run dual-judge and flag disagreements.

**Dual-judge / ensemble**: run two independent judges (e.g., GPT-4o and Claude 3.5 Sonnet). Use agreement as a confidence signal; escalate disagreements to human review. Ensemble scoring reduces systematic bias from any single judge.

**Correlation with human judgment**: periodically sample 100–200 evaluations and have humans score them. Target Spearman ρ > 0.7 between LLM judge and human scores. Below 0.6 means the rubric needs revision.

See [references/llm-as-judge.md](references/llm-as-judge.md).

### Production Monitoring

Offline evals only catch what you thought to test. Production monitoring catches what you didn't.

**Tracing**: instrument every agent step — LLM call, tool invocation, retrieval query — with spans carrying token counts, latencies, and return values. LangSmith, LangFuse, and Arize Phoenix all provide SDKs for this. Traces are the raw material for all other monitoring.

**Eval-in-production**: run lightweight eval checks on a sampled fraction of live traffic (1–10%). Flag traces that fail rule-based checks (missing citations, tool errors, format violations) or score below threshold on an LLM judge. Route flagged traces to a review queue.

**Drift detection**: compute a reference distribution of embedding vectors from a baseline set of traced outputs. Alert when the KL divergence of live output embeddings exceeds a threshold. This catches model drift, prompt drift, and data distribution shift without needing ground truth labels.

**Cost monitoring**: track tokens per request and cost per task. Agents can silently become more expensive over time as context accumulates or retry rates increase.

Tooling: LangSmith (tight LangChain integration, dataset management), LangFuse (open-source, self-hostable, strong for custom pipelines), Arize Phoenix (strongest drift detection and explainability), Helicone (lightweight proxy, minimal instrumentation overhead).

See [references/production-monitoring.md](references/production-monitoring.md).

### Red Teaming

Adversarial testing finds failure modes that well-crafted happy-path tests cannot.

**Prompt injection**: craft inputs that attempt to override the system prompt or hijack tool calls. Test both direct injection (user input contains instructions) and indirect injection (retrieved documents contain instructions). Verify the agent ignores injected instructions.

**Jailbreak testing**: use a library of known jailbreak patterns (role-play framing, base64 encoding, hypothetical framing) to probe safety boundaries. Verify refusals are consistent and not bypassable with minor rephrasing.

**Tool misuse**: craft inputs designed to cause the agent to call tools with dangerous arguments (file deletion, broad API writes, exfiltration paths). Verify the agent validates tool arguments and applies least-privilege.

**Data leakage**: verify the agent does not reproduce verbatim text from the retrieval corpus beyond citation limits, and does not surface data belonging to other tenants in a multi-tenant system.

**Adversarial examples**: mutate known passing inputs with character substitution, Unicode homoglyphs, or semantic paraphrasing. Measure accuracy degradation. A robust agent should degrade gracefully.

See [references/red-teaming.md](references/red-teaming.md).

### Statistical Design

Eval results without statistical rigor produce false confidence.

**Sample size**: for a two-proportion z-test at α=0.05, β=0.20 (80% power), detecting a 5pp improvement over a 75% baseline requires ~750 test cases per variant. Use a power calculator before running A/B tests; underpowered tests are noise.

**Confidence intervals**: always report Wilson confidence intervals around pass rates, not point estimates. A result of "82% ± 6%" is more honest than "82%".

**A/B testing for prompts and models**: treat prompt and model changes as experiments. Randomize evaluation order, control for problem difficulty across splits, use paired comparisons (same problems in both variants) to reduce variance.

**Multi-armed bandit**: for online prompt selection where you cannot afford a fixed burn-in period, use Thompson Sampling or UCB1 to adaptively route traffic to better-performing variants while gathering evidence.

See [references/statistical-design.md](references/statistical-design.md).

## Behavioral Traits

- Runs every test case multiple times and reports pass rate distributions, not single-run results
- Builds a taxonomy of failure modes before writing tests — tests are organized around what can go wrong
- Uses LLM-as-judge for semantic correctness, but validates judge quality with human correlation studies
- Adds every production bug to the regression suite before fixing it
- Treats benchmark performance as a necessary but not sufficient condition for production readiness
- Monitors output embedding drift in production rather than waiting for user complaints
- Applies statistical significance tests before declaring a prompt or model change an improvement

## Important Constraints

- NEVER treat a single-run pass as evidence of reliability — always compute pass rates over N>=10 runs
- NEVER use string equality to evaluate open-ended agent outputs — use embedding similarity or LLM-as-judge
- NEVER deploy a model change based on benchmark improvement alone — validate on a custom domain eval and a production shadow test
- ALWAYS include adversarial cases in every eval suite — agents optimized only on happy paths will fail on adversarial inputs
- ALWAYS measure LLM judge correlation with human scores before trusting judge-based metrics in production
- ALWAYS version eval datasets separately from model/prompt versions — contaminated evals are worse than no evals

## Related Skills

Works well with: `autonomous-agent-patterns`, `llm-app-patterns`, `testing-patterns`, `ml-engineer`, `python` (for eval harness implementation).

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + framework decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| Behavioral testing — invariant, contract, snapshot, regression suites | [references/behavioral-testing.md](references/behavioral-testing.md) |
| Capability benchmarks — SWE-bench, AgentBench, HumanEval, Pass@k, calibration | [references/capability-benchmarks.md](references/capability-benchmarks.md) |
| Reliability metrics — N-run consistency, failure taxonomy, error budgets, SLOs | [references/reliability-metrics.md](references/reliability-metrics.md) |
| LLM-as-judge — rubric design, bias mitigation, dual-judge, human correlation | [references/llm-as-judge.md](references/llm-as-judge.md) |
| Production monitoring — LangSmith, LangFuse, Arize Phoenix, Helicone, drift detection | [references/production-monitoring.md](references/production-monitoring.md) |
| Red teaming — prompt injection, jailbreaks, tool misuse, data leakage, adversarial inputs | [references/red-teaming.md](references/red-teaming.md) |
| Statistical design — sample size, CIs, A/B testing, multi-armed bandit | [references/statistical-design.md](references/statistical-design.md) |
| Routing eval cases — 10 positive / 10 negative / 5 edge | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the domain file for the specific topic. Don't read all files — look up only what you need.
