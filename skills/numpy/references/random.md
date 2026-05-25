# Random Number Generation

NumPy has **two** random APIs. Use the modern `Generator` exclusively for new code; the legacy `np.random.*` global state is kept only for backwards compatibility.

## Modern API — `np.random.default_rng()`

```python
import numpy as np

# Create a Generator instance — seedable, reproducible, independent of global state
rng = np.random.default_rng(seed=42)

# Uniform floats in [0, 1)
rng.random()                  # scalar
rng.random(5)                 # shape (5,)
rng.random((3, 4))            # shape (3, 4)

# Integers
rng.integers(low=0, high=10, size=5)              # [0, 10) — high is exclusive!
rng.integers(low=0, high=10, size=5, endpoint=True)  # [0, 10] inclusive
rng.integers(10, size=(3, 4))                     # short form: [0, 10)

# Common distributions
rng.standard_normal(1000)                         # N(0, 1)
rng.normal(loc=5.0, scale=2.0, size=1000)         # N(mu=5, sigma=2)
rng.uniform(low=-1, high=1, size=10)
rng.exponential(scale=1.0, size=100)
rng.gamma(shape=2.0, scale=1.0, size=100)
rng.beta(a=2.0, b=5.0, size=100)
rng.binomial(n=10, p=0.5, size=100)
rng.poisson(lam=3.0, size=100)
rng.multivariate_normal(mean, cov, size=100)

# Sampling from a collection
rng.choice(arr, size=5, replace=False)            # without replacement
rng.choice(arr, size=10, p=probs)                 # weighted

# Permutations / shuffling
rng.permutation(10)             # permute arange(10)
rng.permutation(arr)            # returns shuffled copy
rng.shuffle(arr)                # in-place
rng.shuffle(arr, axis=1)        # shuffle along an axis
```

## Reproducibility

`default_rng(seed)` is deterministic per seed and per NumPy version. Seeding strategy:

```python
# Reproducible
rng = np.random.default_rng(42)
arr1 = rng.standard_normal(100)
rng = np.random.default_rng(42)
arr2 = rng.standard_normal(100)
assert np.array_equal(arr1, arr2)
```

For non-determinism (e.g. true random testing): `np.random.default_rng()` with no argument seeds from OS entropy.

## Parallel-safe streams — `SeedSequence`

For parallel work, never split a single Generator across processes — its state would race. Use `SeedSequence.spawn` to create independent, statistically-decorrelated child sequences:

```python
from numpy.random import SeedSequence, default_rng

ss = SeedSequence(42)
child_seeds = ss.spawn(8)                          # 8 independent seeds
rngs = [default_rng(s) for s in child_seeds]

# Pass rngs to workers — each worker has an independent stream
```

For nested parallelism, each child can spawn its own:

```python
def worker(child_ss):
    rng = default_rng(child_ss)
    # ...do work...
    grandchildren = child_ss.spawn(4)
    # ...further parallelize...
```

`SeedSequence` uses a hash-based mixing scheme that gives quasi-independent streams without overlap.

## BitGenerators

`default_rng` defaults to `PCG64`. Other choices:

```python
from numpy.random import PCG64, PCG64DXSM, MT19937, Philox, SFC64

rng = np.random.Generator(PCG64DXSM(seed=42))    # newer PCG variant, better statistics
rng = np.random.Generator(Philox(seed=42))       # counter-based, jumpable
rng = np.random.Generator(SFC64(seed=42))        # fastest, simpler statistics
```

Reach for `PCG64DXSM` or `Philox` for distributed work — both support deterministic jumping/advancing for parallel streams.

## Legacy API — DO NOT USE in new code

```python
# ❌ Legacy global state
np.random.seed(42)
np.random.rand(5)              # uniform — name mismatch with rng.random
np.random.randn(5)             # standard normal
np.random.randint(0, 10, 5)    # high is exclusive — incompatible with rng.integers default
np.random.choice(arr, 5)
np.random.shuffle(arr)
```

The legacy API uses an internal global `Mersenne Twister` (MT19937), can be silently re-seeded by any library code, and has poorer statistical properties than `PCG64`. Migration is mechanical:

| Legacy | Modern |
|---|---|
| `np.random.seed(s); np.random.rand(N)` | `rng = np.random.default_rng(s); rng.random(N)` |
| `np.random.randn(N)` | `rng.standard_normal(N)` |
| `np.random.randint(low, high, N)` | `rng.integers(low, high, N)` |
| `np.random.choice(...)` | `rng.choice(...)` |
| `np.random.shuffle(arr)` | `rng.shuffle(arr)` |

## Common pitfalls

- `rng.integers(0, 10)` returns a value in `[0, 10)` by default. The legacy `np.random.randint(0, 10)` was the same. But `rng.integers(0, 10, endpoint=True)` includes 10 — useful for "1 to 6 dice"
- Don't share a Generator across processes — each process needs its own seeded instance (spawn from a shared `SeedSequence`)
- `rng.choice(arr, replace=False, p=probs)` is O(N log N) and requires `len(arr) <= N` for the sampled count — for huge arrays consider `rng.permutation` + slicing
- Sampling `multivariate_normal` is expensive; if cov is fixed, factor it once with Cholesky and reuse
