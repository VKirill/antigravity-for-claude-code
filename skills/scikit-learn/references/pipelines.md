# Pipelines and ColumnTransformer

`Pipeline` and `ColumnTransformer` are the two composition primitives. Used together they prevent the single most common ML bug — train/test leakage from preprocessing.

## Pipeline

A `Pipeline` is a sequence of named `(name, estimator)` steps where every step except the last is a transformer (implements `transform`), and the last step can be anything (`fit`+`predict`, or another transformer).

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(max_iter=1000)),
])
pipe.fit(X_train, y_train)
pipe.predict(X_test)
pipe.score(X_test, y_test)
```

During `fit`:
1. `scaler.fit_transform(X_train)` → scaled training data
2. `clf.fit(scaled, y_train)`

During `predict`:
1. `scaler.transform(X_test)` → scaled with **training** statistics
2. `clf.predict(scaled)`

That's the leakage fix: the scaler never sees test rows during `fit`.

### `make_pipeline` — auto-named steps

```python
from sklearn.pipeline import make_pipeline

pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
# step names: "standardscaler", "logisticregression" (lowercased class name)
```

Use `make_pipeline` for one-offs; use `Pipeline` with explicit names when you'll be doing hyperparameter search (you'll be typing `"clf__C"` a lot).

### Accessing steps

```python
pipe.named_steps["clf"]     # the LogisticRegression instance
pipe["clf"]                 # same, shorter
pipe[-1]                    # last step
pipe[:-1]                   # sub-pipeline of all but last step (useful for transform only)
```

### Setting nested params with `__`

Double-underscore syntax navigates into nested estimators:

```python
pipe.set_params(clf__C=10.0, scaler__with_mean=False)
```

This is exactly the param grid format for `GridSearchCV`:

```python
grid = {"clf__C": [0.1, 1.0, 10.0], "scaler__with_mean": [True, False]}
```

### `memory=` — caching expensive transformers

When CV-tuning, the same transformer fits the same data over and over. Cache it:

```python
from joblib import Memory

pipe = Pipeline(
    [("imp", IterativeImputer()), ("clf", HistGradientBoostingClassifier())],
    memory=Memory("./cache", verbose=0),
)
```

Now `GridSearchCV` only re-fits `IterativeImputer` when its inputs or params change.

## ColumnTransformer

Real tabular data is heterogeneous — numeric columns want scaling, categoricals want encoding, text wants vectorizing. `ColumnTransformer` applies different transformers to different column subsets in parallel and concatenates the outputs.

```python
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

num_cols = ["age", "income"]
cat_cols = ["country", "plan"]

prep = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ],
    remainder="drop",                    # default; "passthrough" keeps unselected
    verbose_feature_names_out=False,     # keep "age" not "num__age"
    n_jobs=-1,
)
```

### Selectors

The column selector can be:
- a list of names (DataFrame input)
- a list of integer indices
- a single string/int
- a boolean mask
- a callable `selector(X) -> list-of-cols`
- `make_column_selector(dtype_include=...)`

```python
from sklearn.compose import make_column_selector

prep = ColumnTransformer([
    ("num", StandardScaler(), make_column_selector(dtype_include="number")),
    ("cat", OneHotEncoder(handle_unknown="ignore"),
            make_column_selector(dtype_include=["object", "category"])),
])
```

### `remainder=`

- `"drop"` (default) — silently drops columns not picked by any transformer
- `"passthrough"` — keeps them as-is, concatenated at the end
- a transformer instance — applies it to leftovers

For models that handle raw values (tree ensembles), `remainder="passthrough"` is often what you want.

### `verbose_feature_names_out=`

- `True` (default) — output names are prefixed by transformer name: `num__age`, `cat__country_US`
- `False` — keep original names where there's no collision; raise on collision
- `False` + callable — custom naming

After 1.0, set this on the outer `ColumnTransformer`, not on children.

### `make_column_transformer`

Like `make_pipeline` — skips the names, auto-derives them from transformer class names:

```python
from sklearn.compose import make_column_transformer

prep = make_column_transformer(
    (StandardScaler(), num_cols),
    (OneHotEncoder(handle_unknown="ignore"), cat_cols),
    remainder="drop",
    verbose_feature_names_out=False,
)
```

## The canonical chain

```python
from sklearn.compose import ColumnTransformer, make_column_selector
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

prep = ColumnTransformer(
    [
        (
            "num",
            Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]),
            make_column_selector(dtype_include="number"),
        ),
        (
            "cat",
            Pipeline([
                ("imp", SimpleImputer(strategy="most_frequent")),
                ("oh", OneHotEncoder(handle_unknown="ignore", min_frequency=10)),
            ]),
            make_column_selector(dtype_include=["object", "category"]),
        ),
    ],
    verbose_feature_names_out=False,
)

pipe = Pipeline(
    [("prep", prep), ("model", HistGradientBoostingClassifier(random_state=42))]
)
```

The whole `pipe` is one estimator — `fit`, `predict`, `score`, `clone`, pass to `GridSearchCV`, pickle, all of it.

## FeatureUnion

`FeatureUnion` concatenates the outputs of transformers that all see the *same* columns (unlike `ColumnTransformer`, which slices). Useful when stacking heterogeneous featurizers (`TfidfVectorizer` + `HashingVectorizer` on the same text). Rare in 2026 — most jobs are better expressed as a `ColumnTransformer` over groups of columns. Reach for it when you genuinely need parallel feature-engineering on identical inputs.

```python
from sklearn.pipeline import FeatureUnion
from sklearn.decomposition import PCA, FastICA

union = FeatureUnion([("pca", PCA(n_components=5)), ("ica", FastICA(n_components=5))])
```

## Pipeline + set_output

`set_output("pandas"|"polars")` on the Pipeline propagates to every intermediate transform — useful for debugging (`pipe[:-1].transform(X).head()`) and for downstream consumers that expect DataFrames.

```python
pipe.set_output(transform="pandas")
pipe[:-1].fit_transform(X_train).head()
```

## Common gotchas

- **`fit_transform` before `train_test_split` defeats the entire point.** Always split first, fit the Pipeline on `X_train`.
- **`ColumnTransformer` selectors evaluate at `fit` time** — if you pass column names, the same columns must exist (with the same dtypes) at predict time. Use `make_column_selector(dtype_include=...)` to be robust to column-order shifts.
- **Mixed sparse + dense outputs** become sparse by default (`sparse_threshold=0.3`). Set `sparse_threshold=0` to force dense.
- **Sparse output requires sparse-aware downstream estimator.** Tree ensembles handle sparse; many others densify silently and use a lot of RAM.
- **`OneHotEncoder` in `ColumnTransformer` with `verbose_feature_names_out=False` will collide** if two transformers produce a column with the same name. Either rename or set `verbose_feature_names_out=True`.
