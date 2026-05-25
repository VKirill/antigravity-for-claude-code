# Reliability Metrics for LLM Agents

Reliability is about consistent performance across real-world input distributions — not peak performance on a curated test set. An agent that scores 90% mean accuracy with 40% worst-case accuracy is not reliable.

## N-Run Consistency

Run each test case N times. Report the distribution, not a single result.

**Minimum N by use case**:
- Development iteration: N=5 (fast feedback, noisy)
- Pre-release validation: N=20 (reasonable signal)
- Production readiness: N=50 (acceptable confidence)
- SLO calibration: N=100+ (tight CI on true pass rate)

```python
from dataclasses import dataclass
import numpy as np
from scipy import stats

@dataclass
class ConsistencyResult:
    pass_rate_mean: float
    pass_rate_std: float
    p10: float          # worst-case (10th percentile)
    p50: float          # median
    wilson_lower: float # 95% CI lower bound
    wilson_upper: float # 95% CI upper bound
    n_runs: int

def measure_consistency(agent, test_case: dict, n: int = 20) -> ConsistencyResult:
    results = []
    for _ in range(n):
        response = agent.run(test_case["input"])
        results.append(evaluate(response, test_case["criteria"]))

    successes = sum(results)
    mean = successes / n

    # Wilson confidence interval (better than normal approx for proportions)
    ci = stats.proportion_confint(successes, n, alpha=0.05, method="wilson")

    return ConsistencyResult(
        pass_rate_mean=mean,
        pass_rate_std=float(np.std(results)),
        p10=float(np.percentile(results, 10)),
        p50=float(np.percentile(results, 50)),
        wilson_lower=ci[0],
        wilson_upper=ci[1],
        n_runs=n,
    )
```

**What to report**: always include mean, 95% CI, and 10th-percentile (p10). P10 is the closest proxy to "what does a bad day look like for this agent."

## Failure Mode Taxonomy

Classifying failures by type reveals where to invest in fixes. Aggregate counts per category over time.

| Category | Definition | Common Causes |
|---|---|---|
| Hallucination | Stated a fact not in context or not true | Retrieval miss, model overconfidence |
| Tool misuse | Called a tool with wrong args or at wrong time | Tool description ambiguity, prompt issues |
| Plan abandonment | Stopped mid-task without completing or explaining | Context window overflow, max iterations hit |
| Format non-compliance | Output did not match required schema | Weak output parser, model drift |
| Context overflow | Lost critical information from earlier in conversation | Long context handling, chunking issues |
| Harmful output | Generated policy-violating content | Insufficient safety prompting or fine-tuning |
| Refusal false positive | Refused a legitimate request | Over-restrictive safety classifier |

```python
from enum import Enum

class FailureMode(Enum):
    HALLUCINATION = "hallucination"
    TOOL_MISUSE = "tool_misuse"
    PLAN_ABANDONMENT = "plan_abandonment"
    FORMAT_NON_COMPLIANCE = "format_non_compliance"
    CONTEXT_OVERFLOW = "context_overflow"
    HARMFUL_OUTPUT = "harmful_output"
    REFUSAL_FALSE_POSITIVE = "refusal_false_positive"
    UNKNOWN = "unknown"

def classify_failure(response, expected, metadata: dict) -> FailureMode:
    # Rule-based classification — augment with LLM judge for ambiguous cases
    if metadata.get("finish_reason") == "length":
        return FailureMode.CONTEXT_OVERFLOW
    if response.tool_calls and any(is_malformed(tc) for tc in response.tool_calls):
        return FailureMode.TOOL_MISUSE
    if response.content and is_refusal(response.content) and not expected.get("should_refuse"):
        return FailureMode.REFUSAL_FALSE_POSITIVE
    # ... additional rules
    return FailureMode.UNKNOWN
```

Track failure rates per category in a time-series database. Alert when any category exceeds its error budget.

## Error Budgets

Treat agent reliability like a service SLO. Define the maximum acceptable failure rate per category over a rolling window.

```yaml
# Example error budget config
error_budgets:
  window_days: 30
  categories:
    harmful_output:
      max_rate: 0.001   # 0.1% — near-zero tolerance
      alert_at: 0.0005  # alert at 50% budget consumed
    hallucination:
      max_rate: 0.05    # 5% — tolerate some, but monitor
      alert_at: 0.03
    tool_misuse:
      max_rate: 0.03
      alert_at: 0.02
    format_non_compliance:
      max_rate: 0.10    # 10% — higher tolerance, usually recoverable
      alert_at: 0.07
```

**Implementation pattern**:
1. Log every agent invocation with success/failure and failure mode
2. Compute rolling 30-day failure rates per category in a scheduled job
3. Alert when any category exceeds its alert threshold
4. Trigger remediation review when any category exceeds its budget

## SLOs for Agents

Define these before launch. Measure continuously. Tie them to retraining/revision triggers.

| SLO | Example Target | Measurement |
|---|---|---|
| Task Success Rate | ≥ 85% | LLM judge or human review on sampled production traces |
| Tool Error Rate | ≤ 3% | Tool call failures logged at executor level |
| Mean Time to Complete | ≤ 30s | Traced span from first token to final output |
| Context Overflow Rate | ≤ 1% | finish_reason == "length" in LLM response |
| Harmful Output Rate | ≤ 0.1% | Safety classifier on all outputs |
| Cost per Task | ≤ $0.05 | Token counts × per-token price |

```python
from datetime import datetime, timedelta

class AgentSLOMonitor:
    def __init__(self, db_client, config: dict):
        self.db = db_client
        self.config = config

    def check_slos(self, window_hours: int = 24) -> list[dict]:
        since = datetime.utcnow() - timedelta(hours=window_hours)
        traces = self.db.get_traces(since=since)

        violations = []
        total = len(traces)
        if total == 0:
            return []

        success_rate = sum(1 for t in traces if t["success"]) / total
        if success_rate < self.config["task_success_rate_min"]:
            violations.append({
                "slo": "task_success_rate",
                "target": self.config["task_success_rate_min"],
                "actual": success_rate,
            })

        tool_error_rate = sum(1 for t in traces if t.get("tool_error")) / total
        if tool_error_rate > self.config["tool_error_rate_max"]:
            violations.append({
                "slo": "tool_error_rate",
                "target": self.config["tool_error_rate_max"],
                "actual": tool_error_rate,
            })

        return violations
```

## Variance Analysis

High variance is a reliability signal even when mean accuracy is acceptable.

- Compute variance across runs for each test case
- Identify "high variance" problems: those where pass rate standard deviation > 0.3
- High-variance problems are candidates for prompt improvement (more precise instructions) or few-shot examples

```python
def identify_high_variance_cases(results: dict[str, list[bool]], threshold: float = 0.3) -> list[str]:
    """
    results: {problem_id: [True, False, True, ...]} — N runs per problem
    Returns problem IDs with std deviation above threshold.
    """
    high_variance = []
    for problem_id, runs in results.items():
        std = float(np.std(runs))
        if std > threshold:
            high_variance.append((problem_id, std))
    return sorted(high_variance, key=lambda x: -x[1])
```

## Retraining Triggers

Define when reliability metrics should trigger a model or prompt revision:

- Any SLO violated for 3 consecutive days → immediate review
- Error budget for any category > 80% consumed → prompt revision sprint
- Variance on regression suite increases > 15% week-over-week → investigate input distribution shift
- New failure mode category appears with > 10 instances in 7 days → add to taxonomy, add tests
