# Estimator API

Every scikit-learn object — model, transformer, meta-estimator — implements the same small surface. Learn it once.

## The core methods

| Method | Returns | Where it lives |
|---|---|---|
| `fit(X, y=None, **kwargs)` | `self` | Every estimator |
| `predict(X)` | `y_hat` | Classifiers, regressors, clusterers |
| `predict_proba(X)` / `decision_function(X)` | probabilities / scores | Probabilistic classifiers |
| `transform(X)` | transformed `X` | Transformers (encoders, scalers, decomposers) |
| `fit_transform(X, y=None)` | transformed `X` | Transformers — *only* legal outside a Pipeline on training data |
| `score(X, y, sample_weight=None)` | scalar score | Default scoring (`accuracy` for classifiers, `R²` for regressors) |
| `get_params(deep=True)` | `dict` | All estimators |
| `set_params(**params)` | `self` | All estimators |
| `get_feature_names_out(input_features=None)` | array of names | Transformers that produce named columns |

`fit_transform` on a fitted Pipeline step is *forbidden after deployment* — use `transform` only. The Pipeline itself enforces the right call ordering during CV.

## Conventions you must follow

1. **Constructor stores parameters verbatim.** No data validation, no computation in `__init__`. Anything that depends on `X` happens in `fit`.
2. **Fitted attributes end with `_`** (`coef_`, `classes_`, `n_features_in_`, `feature_names_in_`). They do not exist before `fit`.
3. **`fit` must accept any `X` shaped `(n_samples, n_features)`** — numpy array, sparse matrix, pandas DataFrame, or (with `set_output`) a polars DataFrame.
4. **Idempotent `fit`** — calling `fit` twice replaces all fitted attributes; no incremental learning unless the estimator implements `partial_fit`.
5. **`set_params` mirrors constructor** — every constructor kwarg must round-trip through `get_params` / `set_params`.

## Custom estimator template

```python
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.utils.validation import check_X_y, check_array, check_is_fitted
from sklearn.utils.multiclass import unique_labels
import numpy as np


class ThresholdedMean(BaseEstimator, ClassifierMixin):
    """Toy classifier: predict class 1 iff mean(x) > threshold."""

    def __init__(self, threshold: float = 0.0):
        self.threshold = threshold  # store verbatim, no validation

    def fit(self, X, y):
        X, y = check_X_y(X, y)
        self.classes_ = unique_labels(y)
        self.n_features_in_ = X.shape[1]
        return self

    def predict(self, X):
        check_is_fitted(self)
        X = check_array(X)
        means = X.mean(axis=1)
        return np.where(means > self.threshold, self.classes_[1], self.classes_[0])
```

### Mixins available

| Mixin | Adds | Default `score` |
|---|---|---|
| `ClassifierMixin` | tags + `score` | `accuracy_score` |
| `RegressorMixin` | tags + `score` | `r2_score` |
| `TransformerMixin` | `fit_transform` from `fit` + `transform` | — |
| `ClusterMixin` | tags + `fit_predict` | — |
| `OutlierMixin` | tags + `fit_predict` | — |
| `MetaEstimatorMixin` | tag for wrappers | — |

## `check_estimator` — the contract test

Before you ship a custom estimator, run the conformance test suite:

```python
from sklearn.utils.estimator_checks import check_estimator
check_estimator(ThresholdedMean())
```

It exercises every API rule above (idempotence, `get_params`/`set_params` round-trip, sparse support, dtype preservation, cloneability, etc.). Failing checks indicate API violations that will eventually break inside a Pipeline.

## `set_output` — pandas / polars output

By default transformers return NumPy arrays. From 1.2 (pandas) and 1.4 (polars), you can ask for DataFrames back:

```python
from sklearn.preprocessing import StandardScaler

sc = StandardScaler().set_output(transform="pandas")
sc.fit_transform(df)        # pandas DataFrame in, pandas DataFrame out

sc = StandardScaler().set_output(transform="polars")
sc.fit_transform(df_pl)     # polars DataFrame in, polars DataFrame out
```

Globally:

```python
import sklearn
sklearn.set_config(transform_output="polars")
```

`set_output` propagates through `Pipeline` and `ColumnTransformer`. Inside a `ColumnTransformer`, set it once on the outer object — child transformers inherit it. Pair with `verbose_feature_names_out=False` to keep original column names when there's no collision.

## Metadata routing — `sample_weight`, `groups`, custom keys

Before 1.3, `sample_weight` and other metadata didn't reliably flow through meta-estimators (Pipeline, GridSearchCV, calibration). Metadata routing fixes this. Enable globally and request explicitly:

```python
import sklearn
sklearn.set_config(enable_metadata_routing=True)

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV
from sklearn.pipeline import Pipeline

clf = LogisticRegression().set_fit_request(sample_weight=True)
pipe = Pipeline([("clf", clf)])
gs = GridSearchCV(pipe, {"clf__C": [0.1, 1.0]}).set_fit_request(sample_weight=True)
gs.fit(X, y, sample_weight=w)   # w now routes correctly into LogisticRegression.fit
```

`set_fit_request(sample_weight=True)` declares that `fit` may receive `sample_weight`. `False` refuses it. A string aliases the kwarg name. The grid search's CV splitter can independently `set_split_request(groups=True)` for `GroupKFold` etc.

1.8 specifically fixed the long-standing issue where `sample_weight` passed to `GridSearchCV.fit` raised inside a `Pipeline`.

## Common subtleties

- **`fit` returns `self`** — always. This is what makes `Pipeline` chaining work and is required by `check_estimator`.
- **Do not validate inputs in `__init__`.** `Pipeline` calls `set_params` during cloning, which would crash with eager validation.
- **Use `clone(est)` not `copy.deepcopy`** when you need a fresh unfitted copy with the same params (e.g., in CV loops).
- **`n_features_in_` and `feature_names_in_`** are set by `_validate_data` (or `check_X_y`) — preserve them to support feature-name-aware pipelines.
- **Tags** (via `_get_tags()` / `__sklearn_tags__()`) signal capabilities like `requires_y`, `allow_nan`, `multioutput`. Custom estimators inherit sensible defaults from their mixin.
