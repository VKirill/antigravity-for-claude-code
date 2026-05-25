# Statistical Design for Agent Evaluation

Eval results without statistical rigor produce false confidence. This reference covers sample size calculation, confidence intervals, A/B testing for prompts/models, and online optimization.

## Why Statistics Matter for Agent Evals

LLM outputs are stochastic. A model that solves 75 out of 100 test cases might solve 68/100 or 82/100 on a different 100-case sample from the same distribution. Without confidence intervals, you cannot distinguish meaningful improvements from noise.

Common mistake: "We changed the prompt and accuracy went from 73% to 76% on our 50-case test set. Ship it." — A 3pp gain on N=50 is statistically indistinguishable from noise.

## Sample Size Calculation

### Two-proportion z-test (comparing two variants)

```python
from scipy.stats import norm
import numpy as np

def required_sample_size(
    baseline_rate: float,
    minimum_detectable_effect: float,  # absolute, e.g., 0.05 for 5pp
    alpha: float = 0.05,  # significance level
    power: float = 0.80,  # 1 - beta
) -> int:
    """
    Returns required N per variant for a two-proportion z-test.
    """
    p1 = baseline_rate
    p2 = baseline_rate + minimum_detectable_effect

    z_alpha = norm.ppf(1 - alpha / 2)  # two-tailed
    z_beta = norm.ppf(power)

    p_avg = (p1 + p2) / 2
    n = (z_alpha * np.sqrt(2 * p_avg * (1 - p_avg)) + z_beta * np.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
    n = n / (p2 - p1) ** 2

    return int(np.ceil(n))

# Examples:
print(required_sample_size(0.75, 0.05))   # 75% baseline, detect 5pp → ~1,210 per variant
print(required_sample_size(0.75, 0.10))   # 75% baseline, detect 10pp → ~316 per variant
print(required_sample_size(0.75, 0.03))   # 75% baseline, detect 3pp → ~3,280 per variant
```

**Rule of thumb**: detecting a 5pp improvement over a 75% baseline requires ~1,200 test cases per variant (both variants combined: ~2,400). Most agent eval sets are far too small.

**When you cannot afford 1,200 cases**: report results as "directional" or "preliminary" and do not make production decisions based on them. Alternatively, reduce the MDE to what you can realistically detect given your budget.

### Paired comparison (same problems in both variants)

Paired design reduces variance significantly — you control for problem difficulty.

```python
from scipy.stats import wilcoxon, binom_test

def paired_significance(
    variant_a_scores: list[float],
    variant_b_scores: list[float],
) -> dict:
    """
    Compare two variants on the same set of problems.
    Returns Wilcoxon signed-rank test result.
    """
    assert len(variant_a_scores) == len(variant_b_scores)

    stat, p_value = wilcoxon(variant_a_scores, variant_b_scores)
    n = len(variant_a_scores)
    mean_diff = np.mean(np.array(variant_b_scores) - np.array(variant_a_scores))

    return {
        "n_problems": n,
        "mean_a": np.mean(variant_a_scores),
        "mean_b": np.mean(variant_b_scores),
        "mean_diff": mean_diff,
        "wilcoxon_p": p_value,
        "significant_at_0.05": p_value < 0.05,
    }
```

Paired design requires ~30–40% fewer samples than unpaired to detect the same effect size.

## Confidence Intervals

Always report Wilson confidence intervals around pass rates, not point estimates.

```python
from statsmodels.stats.proportion import proportion_confint

def wilson_ci(successes: int, n: int, alpha: float = 0.05) -> tuple[float, float]:
    """
    Returns (lower, upper) Wilson confidence interval.
    More accurate than normal approximation, especially for extreme proportions.
    """
    return proportion_confint(successes, n, alpha=alpha, method="wilson")

# Example:
lower, upper = wilson_ci(82, 100)
print(f"82/100 → 95% CI: [{lower:.3f}, {upper:.3f}]")
# → 95% CI: [0.733, 0.887]

# Reporting format:
def format_result(successes: int, n: int) -> str:
    rate = successes / n
    lower, upper = wilson_ci(successes, n)
    return f"{rate:.1%} (95% CI: {lower:.1%}–{upper:.1%}, N={n})"
```

**Never report**: "Accuracy: 82%"
**Always report**: "Accuracy: 82% (95% CI: 73.3%–88.7%, N=100)"

## A/B Testing for Prompts and Models

Treat every prompt and model change as an experiment. Never ship based on a single eval run comparison.

```python
from scipy.stats import chi2_contingency
import numpy as np

def ab_test_prompts(
    prompt_a_results: list[bool],  # True = pass, False = fail
    prompt_b_results: list[bool],
    alpha: float = 0.05,
) -> dict:
    """
    Two-proportion chi-squared test for comparing two prompt variants.
    Use on independent samples (different problems or different runs).
    """
    a_pass = sum(prompt_a_results)
    a_fail = len(prompt_a_results) - a_pass
    b_pass = sum(prompt_b_results)
    b_fail = len(prompt_b_results) - b_pass

    contingency = np.array([[a_pass, a_fail], [b_pass, b_fail]])
    chi2, p_value, dof, expected = chi2_contingency(contingency)

    rate_a = a_pass / len(prompt_a_results)
    rate_b = b_pass / len(prompt_b_results)
    lift = (rate_b - rate_a) / rate_a if rate_a > 0 else float("inf")

    return {
        "rate_a": rate_a,
        "rate_b": rate_b,
        "absolute_diff": rate_b - rate_a,
        "relative_lift": lift,
        "chi2": chi2,
        "p_value": p_value,
        "significant": p_value < alpha,
        "winner": "B" if (rate_b > rate_a and p_value < alpha) else (
                  "A" if (rate_a > rate_b and p_value < alpha) else "inconclusive"
        ),
    }
```

**Checklist before running an A/B test**:
- [ ] Calculated required sample size before starting
- [ ] Randomized evaluation order to avoid ordering effects
- [ ] Used paired design (same problems in both variants) when possible
- [ ] Defined the primary metric upfront (do not change after seeing results)
- [ ] Set the significance threshold before running (p < 0.05 standard; p < 0.01 for safety-critical decisions)

**Common mistakes**:
- **Peeking**: checking results before reaching required sample size and stopping early when p < 0.05. Use sequential testing if you need early stopping.
- **Multiple comparisons**: testing 10 prompt variants and treating any p < 0.05 as significant. Apply Bonferroni correction (divide α by number of comparisons).
- **Underpowered tests**: running too few samples and concluding "no significant difference" when there was insufficient power to detect it.

## Multi-Armed Bandit (Online Prompt Selection)

When offline A/B testing is too slow and you must route production traffic while gathering evidence.

**Thompson Sampling** (Bayesian approach, recommended):

```python
import numpy as np
from dataclasses import dataclass, field

@dataclass
class BanditArm:
    """Beta distribution representing our belief about this arm's success rate."""
    name: str
    successes: int = 0
    failures: int = 0

    def sample(self) -> float:
        """Sample from Beta(α=successes+1, β=failures+1)."""
        return np.random.beta(self.successes + 1, self.failures + 1)

    @property
    def mean(self) -> float:
        total = self.successes + self.failures
        return self.successes / total if total > 0 else 0.5

class ThompsonSamplingRouter:
    def __init__(self, arms: list[BanditArm]):
        self.arms = arms

    def select(self) -> BanditArm:
        """Select the arm with the highest sampled value."""
        return max(self.arms, key=lambda arm: arm.sample())

    def update(self, arm_name: str, success: bool):
        arm = next(a for a in self.arms if a.name == arm_name)
        if success:
            arm.successes += 1
        else:
            arm.failures += 1

    def summary(self) -> list[dict]:
        return [
            {"name": a.name, "mean": a.mean, "n": a.successes + a.failures}
            for a in sorted(self.arms, key=lambda a: -a.mean)
        ]

# Usage: route each request to selected arm, update after getting quality signal
router = ThompsonSamplingRouter([
    BanditArm("prompt_v1"),
    BanditArm("prompt_v2"),
    BanditArm("prompt_v3"),
])
```

**When to use bandit vs A/B test**:
- **A/B test**: pre-production comparison with enough traffic to reach predetermined sample size. More statistically clean.
- **Bandit**: live production where you want to minimize exposure to worse variants while learning. Higher complexity, harder to interpret.

## Bootstrapping for Small Sample Sizes

When you cannot afford hundreds of test cases, use bootstrapping to estimate confidence intervals.

```python
def bootstrap_ci(scores: list[float], n_iterations: int = 10_000, alpha: float = 0.05) -> tuple:
    """
    Non-parametric confidence interval via bootstrapping.
    Works for any metric, even custom ones.
    """
    boot_means = []
    arr = np.array(scores)
    n = len(arr)

    for _ in range(n_iterations):
        sample = np.random.choice(arr, size=n, replace=True)
        boot_means.append(np.mean(sample))

    lower = np.percentile(boot_means, 100 * alpha / 2)
    upper = np.percentile(boot_means, 100 * (1 - alpha / 2))
    return lower, upper

# Honest reporting with small N:
scores = [0.8, 0.6, 0.9, 0.7, 0.85, 0.75, 0.9, 0.65, 0.8, 0.7]  # N=10
lower, upper = bootstrap_ci(scores)
print(f"Mean: {np.mean(scores):.2f} (95% CI via bootstrap: {lower:.2f}–{upper:.2f}, N={len(scores)})")
# Wide CI signals you need more data before making decisions
```
