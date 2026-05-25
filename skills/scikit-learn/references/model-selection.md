# Model Selection

Three problems, one toolbox:

1. **Estimate generalization** — cross-validation
2. **Tune hyperparameters** — search over a CV loop
3. **Diagnose** — learning curves, validation curves

All sklearn search objects are themselves estimators: `search.fit(X, y)`, `search.predict(X)`, `search.score(X, y)`.

## Splitters

Pick the splitter that matches the data's dependency structure.

| Splitter | When |
|---|---|
| `KFold(n_splits=5, shuffle=True, random_state=42)` | i.i.d. regression |
| `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` | i.i.d. **classification** (default for `*CV` classes) |
| `GroupKFold(n_splits=5)` | Rows share entity keys (patient, user, session); no entity in multiple folds |
| `StratifiedGroupKFold(n_splits=5)` | Classification + grouped |
| `TimeSeriesSplit(n_splits=5, gap=0, max_train_size=None, test_size=None)` | Chronological; only past predicts future |
| `LeaveOneOut()`, `LeavePOut(p)` | Small-data; expensive |
| `RepeatedKFold(n_splits=5, n_repeats=3, random_state=42)` | Reduce variance of CV estimate |
| `ShuffleSplit(n_splits=5, test_size=0.2, random_state=42)` | Bootstrap-style; folds can overlap |

```python
from sklearn.model_selection import StratifiedKFold, TimeSeriesSplit, GroupKFold

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv = TimeSeriesSplit(n_splits=5, gap=24, test_size=168)   # daily/weekly
cv = GroupKFold(n_splits=5)
```

When metadata routing is enabled, `set_split_request(groups=True)` on the splitter and pass `groups=` to `fit`/`cross_val_*`.

## `cross_val_score` and `cross_validate`

`cross_val_score` returns one metric per fold. `cross_validate` returns a dict with multiple metrics, plus fit/score timings. Prefer `cross_validate`.

```python
from sklearn.model_selection import cross_validate

scores = cross_validate(
    estimator=pipe,
    X=X_train, y=y_train,
    cv=cv,
    scoring=["roc_auc", "average_precision", "balanced_accuracy"],
    n_jobs=-1,
    return_train_score=True,
    return_estimator=False,
)
print(scores["test_roc_auc"].mean(), scores["test_roc_auc"].std())
```

`return_train_score=True` is essential for diagnosing under/overfit. Wide train-test gap = overfit; both low = underfit.

`cross_val_predict` looks similar but is for **stacking only** — never use its output to report performance, because the predictions don't come from a single coherent model.

## Grid search

Exhaustive over a small explicit grid:

```python
from sklearn.model_selection import GridSearchCV

grid = {
    "prep__cat__oh__min_frequency": [5, 10, 20],
    "model__learning_rate": [0.01, 0.03, 0.1],
    "model__max_leaf_nodes": [15, 31, 63],
}
gs = GridSearchCV(
    pipe, grid,
    cv=cv,
    scoring="roc_auc",
    n_jobs=-1,
    refit=True,           # refit best on all training data after search
    return_train_score=False,
)
gs.fit(X_train, y_train)

gs.best_params_
gs.best_score_
gs.best_estimator_
gs.cv_results_       # full table of every (param, fold) → score
```

Use `GridSearchCV` only when the total combinatoric count is < ~50. Above that, use `RandomizedSearchCV`.

## Randomized search

Sample `n_iter` configurations from distributions:

```python
from sklearn.model_selection import RandomizedSearchCV
from scipy.stats import loguniform, randint

dist = {
    "model__learning_rate": loguniform(1e-3, 1e-1),
    "model__max_iter":      randint(100, 1000),
    "model__max_leaf_nodes": randint(8, 256),
    "model__l2_regularization": loguniform(1e-3, 10),
}
rs = RandomizedSearchCV(
    pipe, dist,
    n_iter=40,
    cv=cv, scoring="roc_auc",
    n_jobs=-1, refit=True,
    random_state=42,
)
rs.fit(X_train, y_train)
```

Use `loguniform` for any scale parameter (learning rate, regularization strength). Use `randint` for integer counts.

## Successive halving — `HalvingRandomSearchCV` / `HalvingGridSearchCV`

Train many candidates on tiny resources, eliminate poor ones, keep doubling resources for survivors. 5–10× faster than `RandomizedSearchCV` at the same budget.

```python
from sklearn.experimental import enable_halving_search_cv  # noqa
from sklearn.model_selection import HalvingRandomSearchCV

hs = HalvingRandomSearchCV(
    pipe, dist,
    n_candidates="exhaust",     # use full budget
    factor=3,                   # keep top 1/3 each round
    resource="n_samples",       # ramp up training set size
    max_resources="auto",
    cv=cv, scoring="roc_auc",
    n_jobs=-1, random_state=42, refit=True,
)
hs.fit(X_train, y_train)
```

For tree ensembles, set `resource="model__max_iter"` instead — ramp up the number of boosting iterations rather than the sample size.

## Diagnostics

### Learning curve

```python
from sklearn.model_selection import learning_curve
import numpy as np

train_sizes, train_scores, val_scores = learning_curve(
    pipe, X_train, y_train,
    train_sizes=np.linspace(0.1, 1.0, 5),
    cv=cv, scoring="roc_auc", n_jobs=-1, random_state=42,
)
```

Use to decide: more data needed (val_score still rising) vs. more capacity needed (train and val plateau together with a gap).

### Validation curve

Vary one hyperparameter, holding everything else fixed:

```python
from sklearn.model_selection import validation_curve

train_scores, val_scores = validation_curve(
    pipe, X_train, y_train,
    param_name="model__max_leaf_nodes",
    param_range=[7, 15, 31, 63, 127],
    cv=cv, scoring="roc_auc", n_jobs=-1,
)
```

## Nested cross-validation

When you both **tune** and **estimate generalization**, you must nest: the outer CV reports the score, an inner CV inside `GridSearchCV` does the tuning per outer fold. Otherwise the reported score is optimistically biased.

```python
from sklearn.model_selection import GridSearchCV, cross_val_score

inner = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

gs = GridSearchCV(pipe, grid, cv=inner, scoring="roc_auc", n_jobs=-1, refit=True)
nested_scores = cross_val_score(gs, X_train, y_train, cv=outer, scoring="roc_auc", n_jobs=-1)
print(nested_scores.mean(), nested_scores.std())
```

If you skip nesting, your `best_score_` is biased upward by 1–3% and you'll overpromise on the test set.

## Threshold tuning — `TunedThresholdClassifierCV`

Decision threshold (default 0.5) almost never matches business cost. `TunedThresholdClassifierCV` tunes it via CV:

```python
from sklearn.model_selection import TunedThresholdClassifierCV

tuned = TunedThresholdClassifierCV(
    estimator=pipe,
    scoring="balanced_accuracy",   # or any metric
    cv=cv,
).fit(X_train, y_train)
print(tuned.best_threshold_)
```

Use this on imbalanced classification before you ship probabilities to a downstream rule that uses `> 0.5`.

## Common mistakes

- **Reporting `best_score_` as test performance** — that's the inner CV score, biased by selection. Use nested CV or hold out a final test set.
- **Hyperparameter search without a Pipeline** — preprocessing leaks across folds.
- **`GridSearchCV` over giant grids** — combinatoric explosion; switch to randomized or halving.
- **CV without `shuffle=True` on ordered data** — folds correlate; CV variance estimate is wrong.
- **Forgetting `random_state` on the splitter** — every CV run differs, debugging becomes guessing.
