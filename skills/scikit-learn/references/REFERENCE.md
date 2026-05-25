# scikit-learn — Capability Map and Decision Matrix

This index helps you open the right reference file fast. The skill follows one canonical chain for tabular data:

```
train_test_split  →  Pipeline([("prep", ColumnTransformer(...)), ("model", Estimator)])
                  →  RandomizedSearchCV or HalvingRandomSearchCV (over Pipeline)
                  →  cross_validate on best estimator with held-out metrics
                  →  joblib / skops / ONNX persistence
```

## Where to open which file

| Question | File |
|---|---|
| "What does `fit` / `transform` / `score` actually do? How do I write a custom estimator? Where does `set_output` go? How does metadata routing work?" | [estimator-api.md](estimator-api.md) |
| "How do I assemble preprocessing + model into one Pipeline? How does `ColumnTransformer` route columns by dtype?" | [pipelines.md](pipelines.md) |
| "Which scaler? Encoder for high-cardinality categoricals? How do I split with stratification?" | [data-prep.md](data-prep.md) |
| "Which CV splitter for my problem? GridSearchCV vs RandomizedSearchCV vs Halving?" | [model-selection.md](model-selection.md) |
| "What's a sensible classifier to start with? `class_weight=balanced` vs resampling?" | [classification.md](classification.md) |
| "Linear regression with regularization vs HistGradientBoosting vs quantile regression?" | [regression.md](regression.md) |
| "KMeans vs DBSCAN vs HDBSCAN vs GaussianMixture? How do I evaluate clusters?" | [clustering.md](clustering.md) |
| "Which metric for imbalanced classification? Multi-output regression? Custom scorer?" | [metrics.md](metrics.md) |
| "Should I select features? RFECV, SelectFromModel, mutual_info, permutation_importance?" | [feature-selection.md](feature-selection.md) |
| "How do I save and load a model safely? joblib vs skops vs ONNX?" | [model-persistence.md](model-persistence.md) |
| "I'm hitting `NotFittedError`, `ConvergenceWarning`, or unexpected NaN output." | [troubleshooting.md](troubleshooting.md) |
| "What defaults should I assume — CV folds, random_state policy, search budget, scoring?" | [recommended-defaults.md](recommended-defaults.md) |
| "Show me the textbook wrong code and the right code for common ML traps." | [wrong-vs-right.md](wrong-vs-right.md) |
| "How is this skill's routing tested?" | [eval-cases.md](eval-cases.md) |

## Model-selection decision matrix (tabular)

Use this as a first-pass heuristic. Always validate with cross-validation.

| Situation | First reach | Second option | Notes |
|---|---|---|---|
| **Tabular classification**, mixed dtypes, < 10M rows | `HistGradientBoostingClassifier` | `RandomForestClassifier` | Native NaN + categorical support; `early_stopping=True` |
| **Tabular regression**, mixed dtypes | `HistGradientBoostingRegressor` | `RandomForestRegressor` | Same defaults; tune `learning_rate`, `max_iter`, `max_leaf_nodes` |
| **Need calibrated probabilities** for thresholding / decision theory | `LogisticRegression` (already calibrated) or wrap in `CalibratedClassifierCV(method="temperature")` | `CalibratedClassifierCV(method="isotonic")` | Temperature scaling is new and stable in 1.8 |
| **Need a fast, explainable linear baseline** | `LogisticRegression(penalty="l2")` or `Ridge` | `LogisticRegression(penalty="l1")` for sparsity | Always pair with `StandardScaler` |
| **High-cardinality categorical** features | `HistGradientBoostingClassifier(categorical_features="from_dtype")` or `TargetEncoder` + linear/boosting | `OneHotEncoder(min_frequency=..., max_categories=...)` | Avoid OHE on > 50 cardinality without `min_frequency` |
| **Very wide sparse** features (text, OHE) | `LogisticRegression(solver="saga")` | `LinearSVC` | Use `solver="saga"` for L1/elastic-net on sparse |
| **Sequence / image / text** | — | Outside skill scope | Switch to `pytorch` |
| **Strict-budget hyperparameter search** | `HalvingRandomSearchCV` | `RandomizedSearchCV` | 5–10× faster than full grid on the same budget |
| **Clustering**, no `k` known | `HDBSCAN` | `DBSCAN` | `HDBSCAN` ships with sklearn since 1.3 — no extra dep |
| **Clustering**, `k` known | `KMeans(n_init="auto")` | `MiniBatchKMeans` for > 100k rows | `n_init="auto"` is the modern default |
| **Anomaly detection** | `IsolationForest` | `LocalOutlierFactor` | Tune `contamination` to expected rate |

## Quick-start canonical pipeline

```python
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import (
    train_test_split, StratifiedKFold, RandomizedSearchCV
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

num = ["age", "income"]
cat = ["country", "plan"]

prep = ColumnTransformer(
    [
        ("num", Pipeline([("imp", SimpleImputer()), ("sc", StandardScaler())]), num),
        ("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=20), cat),
    ],
    remainder="drop",
    verbose_feature_names_out=False,
)

pipe = Pipeline([("prep", prep), ("model", HistGradientBoostingClassifier(random_state=42))])

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
search = RandomizedSearchCV(
    pipe,
    param_distributions={
        "model__learning_rate": [0.01, 0.03, 0.1],
        "model__max_iter": [200, 500],
        "model__max_leaf_nodes": [15, 31, 63],
    },
    n_iter=20, cv=cv, scoring="roc_auc", n_jobs=-1, random_state=42, refit=True,
)
search.fit(X_train, y_train)
print(search.best_score_, search.best_params_)
print("test:", search.score(X_test, y_test))
```

Every other reference file expands one box in this pipeline.
