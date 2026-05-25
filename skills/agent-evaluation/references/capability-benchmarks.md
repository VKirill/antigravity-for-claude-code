# Capability Benchmarks for LLM Agents

Standard benchmarks measure task-specific capability with a shared, reproducible methodology. They are useful for comparing models/prompts and tracking progress over time — but never sufficient alone for production readiness.

## Public Benchmarks

### SWE-bench

The de facto benchmark for coding agents (2024-2026). Measures the ability to resolve real GitHub issues in open-source Python repositories.

**Variants**:
- **SWE-bench Full**: 2,294 issues from 12 repos (Django, Flask, requests, etc.)
- **SWE-bench Lite**: 300 issues, more tractable for development cycles
- **SWE-bench Verified**: 500 human-verified issues with confirmed test suites; preferred for leaderboard comparisons — reduces false positives from test-generation exploits

**What it tests**: repository-level understanding, multi-file editing, test execution, understanding of failing test → code change loop.

**Metric**: Resolved % (Pass@1 with a single attempt per issue). As of 2026, frontier coding agents score 40–65% on Verified.

**Running it**:
```bash
pip install swebench
python -m swebench.harness.run_evaluation \
  --dataset_name "princeton-nlp/SWE-bench_Verified" \
  --predictions_path your_predictions.jsonl \
  --run_id my_eval_run
```

**Caution**: SWE-bench scores require Docker + the original repo environments. Local execution is slow (~48h for full suite on 8 workers). Use the hosted inference API for development.

### AgentBench

Multi-environment tool-use benchmark across 8 environments: OS, database, knowledge graph, web browser, web shopping, game, lateral thinking puzzles, HouseHolding.

Best for evaluating general agent reasoning and tool use, not coding specifically.

```
Score = weighted average of success rates across environments
```

Less commonly used for production readiness decisions; more useful for research comparisons.

### HumanEval / MBPP

**HumanEval**: 164 Python function synthesis problems with docstring + test cases. Saturated at the frontier (GPT-4-class models score >90%). Use only for regression detection, not differentiation.

**MBPP**: 500 crowd-sourced Python problems. Similar saturation issue.

Both are useful for catching regressions after fine-tuning or prompt changes — if your agent drops 10pp on HumanEval, something broke.

### MMLU

Massive Multitask Language Understanding: 57 subjects, 14,000 questions. Measures knowledge breadth. Useful for general-purpose assistants; less relevant for specialized coding agents.

## Metric: Pass@k

Pass@k measures capability upper bound: generate k completions per problem, count the problem as solved if at least one completion is correct.

```
Pass@k = 1 - C(n-c, k) / C(n, k)
```

Where n = total samples generated, c = correct samples.

**In practice**:
- Pass@1: most production-relevant (one attempt per task)
- Pass@10: useful for measuring potential with best-of-N selection
- Pass@100: measures maximum capability ceiling

```python
import numpy as np
from scipy.stats import binom

def pass_at_k(n: int, c: int, k: int) -> float:
    """
    n: number of samples generated per problem
    c: number of correct samples
    k: k in pass@k
    """
    if n - c < k:
        return 1.0
    return 1.0 - np.prod(
        1.0 - k / np.arange(n - c + 1, n + 1)
    )

# Example: 10 samples, 3 correct, compute pass@1 and pass@5
print(pass_at_k(10, 3, 1))  # ~0.30
print(pass_at_k(10, 3, 5))  # ~0.83
```

## Building Custom Domain Benchmarks

Public benchmarks measure general capability. A domain benchmark measures capability on your actual use case. Both are necessary.

**Design process**:

1. **Curate 100–200 problems** from real user tasks. Sample from production logs or design representative cases manually.
2. **Write acceptance criteria** per problem: exact match, schema validation, or LLM rubric with specific criteria.
3. **Verify all problems** with a human expert before using them as ground truth.
4. **Split into development and holdout sets** (80/20). Only run holdout evaluation before major releases.
5. **Track version history**: when the problem set changes, re-run historical model versions to preserve comparability.

```python
# Minimal custom benchmark harness
import json
from pathlib import Path

def run_benchmark(agent, benchmark_path: str, n_runs: int = 5) -> dict:
    problems = json.loads(Path(benchmark_path).read_text())
    results = {}

    for problem in problems:
        passes = 0
        for _ in range(n_runs):
            response = agent.run(problem["input"])
            if evaluate(response, problem["acceptance_criteria"]):
                passes += 1
        results[problem["id"]] = {
            "pass_rate": passes / n_runs,
            "n_runs": n_runs,
        }

    overall = sum(r["pass_rate"] for r in results.values()) / len(results)
    return {"overall_pass_rate": overall, "per_problem": results}
```

## Calibration

A well-calibrated agent's stated confidence should match its actual accuracy. Poor calibration causes agents to confidently produce wrong answers.

**Expected Calibration Error (ECE)**:

```python
import numpy as np

def expected_calibration_error(confidences: list, correctness: list, n_bins: int = 10) -> float:
    """
    confidences: list of floats in [0, 1] — model's stated confidence per sample
    correctness: list of bools — whether each sample was correct
    """
    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    n = len(confidences)

    for i in range(n_bins):
        in_bin = [j for j, c in enumerate(confidences) if bins[i] <= c < bins[i+1]]
        if not in_bin:
            continue
        bin_accuracy = np.mean([correctness[j] for j in in_bin])
        bin_confidence = np.mean([confidences[j] for j in in_bin])
        ece += len(in_bin) / n * abs(bin_accuracy - bin_confidence)

    return ece
```

ECE < 0.05 is well-calibrated. ECE > 0.15 is a reliability concern.

**Note**: most LLM agents don't expose numeric confidence values directly. Calibration measurement requires either logprobs access or instructing the model to state confidence explicitly in its output, then parsing that.

## Benchmark vs Production Correlation

Benchmark improvements do not automatically transfer to production gains. Common causes of divergence:

- **Data contamination**: benchmark problems appear in training data
- **Distribution shift**: real user inputs differ from benchmark problem phrasing
- **Metric gaming**: agent learns to satisfy benchmark criteria without solving the underlying task
- **Environment mismatch**: benchmark runs in a clean environment, production has noisy retrieval/tools

Always validate benchmark improvements with: (1) custom domain eval, (2) shadow traffic comparison on production, (3) A/B test on a slice of real users.
