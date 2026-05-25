# Feature Selection

Three motivations: (a) fewer features = faster inference, (b) fewer features = easier interpretation, (c) on small-sample-wide-feature problems, removing noise features can help generalization. For most tabular problems a regularized model (Lasso, ElasticNet, `HistGradientBoosting*` with `l2_regularization`) handles selection implicitly — explicit selection is most useful when you need to *show* a short feature list to a human.

All selectors implement `fit` + `transform` so they drop into a `Pipeline` like any other transformer.

## Filter methods — fast, model-agnostic

### Variance threshold

Drops near-constant features:

```python
from sklearn.feature_selection import VarianceThreshold

VarianceThreshold(threshold=0.01).fit_transform(X_train)
```

Tiny gain; only useful as a sanity step after OneHotEncoder spawned many rare-category columns.

### Univariate — `SelectKBest`, `SelectPercentile`

Scores each feature independently against the target:

```python
from sklearn.feature_selection import (
    SelectKBest, SelectPercentile,
    f_classif, f_regression,
    chi2,
    mutual_info_classif, mutual_info_regression,
)

# classification, linear association
SelectKBest(score_func=f_classif, k=20).fit_transform(X_train, y_train)

# classification, non-linear (rank-based)
SelectKBest(score_func=mutual_info_classif, k=20).fit_transform(X_train, y_train)

# regression
SelectPercentile(score_func=f_regression, percentile=25).fit_transform(X_train, y_train)
```

`mutual_info_*` is non-parametric and catches non-linear relationships; slower than `f_*`. Use `chi2` only on non-negative features (counts, bag-of-words).

Caveat: univariate ignores feature interactions. A feature useless alone may be highly informative together with another.

## Wrapper methods — model-aware

### `SelectFromModel` — threshold on coefficients/importances

```python
from sklearn.feature_selection import SelectFromModel
from sklearn.linear_model import LassoCV
from sklearn.ensemble import HistGradientBoostingClassifier

# L1 selection
SelectFromModel(LassoCV(cv=5, random_state=42), threshold="median").fit(X_train, y_train)

# tree-based selection (uses .feature_importances_)
SelectFromModel(
    HistGradientBoostingClassifier(random_state=42),
    threshold="1.25*mean",
    max_features=30,
).fit(X_train, y_train)
```

`threshold=` accepts `"mean"`, `"median"`, or a `"<factor>*<stat>"` string, or a float. `max_features=` is a hard cap regardless of threshold.

### `RFE` / `RFECV` — recursive elimination

Train, drop the worst feature(s), repeat:

```python
from sklearn.feature_selection import RFE, RFECV
from sklearn.linear_model import LogisticRegression

RFE(LogisticRegression(max_iter=1000), n_features_to_select=10, step=1).fit(X_train, y_train)

# pick number of features via CV
rfecv = RFECV(
    estimator=LogisticRegression(max_iter=1000),
    step=1,
    cv=5,
    scoring="roc_auc",
    min_features_to_select=5,
    n_jobs=-1,
).fit(X_train, y_train)
rfecv.n_features_
rfecv.support_
```

`RFECV` is the right choice when you genuinely don't know how many features to keep. Expensive — number of fits is roughly `n_features × n_folds / step`.

### Sequential — `SequentialFeatureSelector`

Forward or backward greedy:

```python
from sklearn.feature_selection import SequentialFeatureSelector

SequentialFeatureSelector(
    estimator=HistGradientBoostingClassifier(random_state=42),
    n_features_to_select="auto",
    tol=1e-3,
    direction="forward",
    scoring="roc_auc",
    cv=5,
    n_jobs=-1,
).fit(X_train, y_train)
```

Slower than RFE; works with estimators that don't expose `coef_` or `feature_importances_`.

## Inspection — `permutation_importance`

Model-agnostic, unbiased, **the right way** to attribute importance after fitting:

```python
from sklearn.inspection import permutation_importance

pi = permutation_importance(
    pipe, X_val, y_val,
    n_repeats=10,
    random_state=42,
    scoring="roc_auc",
    n_jobs=-1,
)

import numpy as np
order = np.argsort(pi.importances_mean)[::-1]
for i in order[:10]:
    print(f"{X_val.columns[i]:30s}  {pi.importances_mean[i]:.4f}  ± {pi.importances_std[i]:.4f}")
```

### Why not `.feature_importances_`?

Tree-based `.feature_importances_` (Gini / split-count) is **biased toward high-cardinality features** and toward continuous features. A useless `user_id` column with thousands of unique values will look important even after fitting a strong model. `permutation_importance` does not have this bias — it asks "how much does shuffling this column hurt the model?".

Always prefer `permutation_importance` for reporting. Use `.feature_importances_` only as a quick training-time diagnostic.

## In a Pipeline

Selectors are transformers. Put them after preprocessing, before the model:

```python
from sklearn.feature_selection import SelectFromModel
from sklearn.linear_model import LassoCV
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("prep", prep),
    ("select", SelectFromModel(LassoCV(cv=5, random_state=42))),
    ("model", HistGradientBoostingClassifier(random_state=42)),
])
```

The selector's `fit` will only see training-fold data during CV — no leakage.

## Common mistakes

- **Selecting on the full dataset, then splitting** — leakage. Always inside a Pipeline.
- **Reporting `.feature_importances_` to stakeholders** — biased toward high-cardinality. Use `permutation_importance`.
- **Selecting features with one metric, evaluating with another** — fix the metric upfront.
- **Selecting then refitting on a different model and assuming the selected features still help** — they may not. Re-evaluate.
- **RFECV with `step=1` on hundreds of features** — combinatorically expensive. Bump `step` or use `SelectFromModel` instead.
