# Data Preparation

Preprocessing turns raw `X` into something a model can consume. Three rules:

1. **Always inside a `Pipeline`** so the train/test split is respected.
2. **Scale before any distance- or gradient-based model** (linear, SVM, KNN, neural nets). Tree ensembles are scale-invariant — don't waste cycles scaling for them.
3. **Encode categoricals before any non-tree model.** `HistGradientBoosting*` accepts categoricals natively with `categorical_features="from_dtype"`.

## Splitting

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    stratify=y,        # MANDATORY for classification
    random_state=42,
    shuffle=True,
)
```

- `stratify=y` preserves class proportions in both splits. Skip this on imbalanced classification and your CV variance explodes.
- For time series, do **not** shuffle — use `TimeSeriesSplit` instead of `train_test_split`.
- For grouped data (same patient across multiple rows), use `GroupShuffleSplit`.

## Numeric scalers

| Scaler | What it does | When to pick |
|---|---|---|
| `StandardScaler()` | `(x - μ) / σ` | Default for linear, SVM, KNN, NN |
| `MinMaxScaler(feature_range=(0,1))` | rescale to `[0, 1]` | When you need bounded output (e.g., NN with sigmoid) |
| `RobustScaler()` | `(x - median) / IQR` | Heavy-tailed / outlier-laden features |
| `MaxAbsScaler()` | `x / max(|x|)` | Sparse data (preserves sparsity); 1.8 adds `clip=True` |
| `PowerTransformer(method="yeo-johnson")` | Gaussianize | Skewed features for linear models |
| `QuantileTransformer(output_distribution="normal")` | Rank → Gaussian | Robust to outliers; can hurt for piecewise-flat features |

```python
from sklearn.preprocessing import StandardScaler, RobustScaler, MaxAbsScaler

StandardScaler().fit_transform(X_train_num)
RobustScaler(quantile_range=(25.0, 75.0)).fit_transform(X_train_num)
MaxAbsScaler(clip=True).fit_transform(X_train_num)   # clip ∈ [-1, 1] at transform
```

## Categorical encoders

### `OneHotEncoder` — the default

```python
from sklearn.preprocessing import OneHotEncoder

OneHotEncoder(
    handle_unknown="ignore",     # unseen test categories → all-zeros row, not crash
    min_frequency=20,            # categories with < 20 train occurrences → "infrequent_sklearn"
    max_categories=50,           # cap total categories per column
    sparse_output=True,          # default; set False if downstream densifies anyway
    drop=None,                   # or "first" / "if_binary" to avoid dummy-variable trap in linear
)
```

`min_frequency` + `max_categories` are the cure for high-cardinality columns: rare levels go into a single "infrequent" bucket. Without them, OHE on a `user_id` column ruins your day.

### `OrdinalEncoder` — ordered categories or tree models

```python
from sklearn.preprocessing import OrdinalEncoder

OrdinalEncoder(
    handle_unknown="use_encoded_value",
    unknown_value=-1,
    encoded_missing_value=-2,
)
```

Use only when (a) the categorical has a real order (`"low" < "mid" < "high"`), or (b) the downstream is a tree ensemble that will discover splits on its own.

### `TargetEncoder` — leak-safe for high cardinality + linear

```python
from sklearn.preprocessing import TargetEncoder

TargetEncoder(
    target_type="binary",        # "continuous" for regression, "multiclass" otherwise
    smooth="auto",               # empirical Bayes shrinkage toward global mean
    cv=5,                        # internal cross-fit to avoid target leakage
    random_state=42,
)
```

Cross-fitted by design — replaces each category with its target mean computed on out-of-fold data. Use this instead of OHE when cardinality is in the hundreds-to-thousands range and you're using a linear/boosting model that benefits from the signal.

### `KBinsDiscretizer` — bucketize numeric

```python
from sklearn.preprocessing import KBinsDiscretizer

KBinsDiscretizer(
    n_bins=5,
    encode="onehot",                          # or "ordinal" or "onehot-dense"
    strategy="quantile",                      # or "uniform" or "kmeans"
    quantile_method="averaged_inverted_cdf",  # 1.3+ default; future-proof
)
```

Useful for non-linear effects in linear models (cf. equal-width vs equal-frequency tradeoffs).

## Imputation

### `SimpleImputer`

```python
from sklearn.impute import SimpleImputer

SimpleImputer(strategy="median")           # for numeric
SimpleImputer(strategy="most_frequent")    # for categorical
SimpleImputer(strategy="constant", fill_value="missing")
SimpleImputer(add_indicator=True)          # adds a missing-indicator column
```

`add_indicator=True` is often a free win — gives the model both the imputed value *and* the fact that it was missing.

### `KNNImputer`

```python
from sklearn.impute import KNNImputer

KNNImputer(n_neighbors=5, weights="distance")
```

Useful for moderate-dim numeric data where MCAR is implausible. Expensive on large datasets.

### `IterativeImputer` (experimental — explicit import)

```python
from sklearn.experimental import enable_iterative_imputer  # noqa
from sklearn.impute import IterativeImputer

IterativeImputer(
    estimator=None,            # default BayesianRidge; pass any sklearn regressor
    max_iter=10,
    initial_strategy="median",
    random_state=42,
)
```

Models each column as a function of the others and iterates. Best imputation quality, slowest. Cache it via `Pipeline(memory=...)` for CV.

## Native missing-value handling

If your downstream is `HistGradientBoostingClassifier` / `Regressor` or any tree ensemble that supports NaN-aware splits, **don't impute** — the model handles missingness as a learnable signal:

```python
HistGradientBoostingClassifier()    # NaN supported out of the box
RandomForestClassifier()            # also NaN-tolerant since 1.3
```

Imputing in front of these models discards useful information.

## Putting it together with ColumnTransformer

```python
from sklearn.compose import ColumnTransformer, make_column_selector
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

prep = ColumnTransformer(
    [
        ("num", Pipeline([
            ("imp", SimpleImputer(strategy="median", add_indicator=True)),
            ("sc", StandardScaler()),
        ]), make_column_selector(dtype_include="number")),

        ("cat", Pipeline([
            ("imp", SimpleImputer(strategy="constant", fill_value="missing")),
            ("oh", OneHotEncoder(handle_unknown="ignore", min_frequency=10)),
        ]), make_column_selector(dtype_include=["object", "category"])),
    ],
    remainder="drop",
    verbose_feature_names_out=False,
)
```

## Common mistakes

- **Fitting any of these on the full `X` before splitting** — textbook leakage. Always inside a `Pipeline`.
- **OneHotEncoder without `handle_unknown="ignore"`** — crashes on unseen test categories.
- **OneHotEncoder on > 50 cardinality without `min_frequency`/`max_categories`** — explodes feature count and memory.
- **Scaling for a tree ensemble** — wastes time and may hide useful raw values from inspection.
- **Imputing for `HistGradientBoosting*`** — discards "is missing" as a signal.
