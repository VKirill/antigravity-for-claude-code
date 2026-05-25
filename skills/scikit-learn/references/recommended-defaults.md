# Recommended Defaults

Single source of truth for the knobs every sklearn project tunes. Override when you have a reason; otherwise reach for these.

## Reproducibility

| Knob | Default |
|---|---|
| `random_state` (estimator) | `42` everywhere (or any fixed int — be consistent) |
| `random_state` (splitter) | `42` |
| `random_state` (search) | `42` |
| `shuffle` (KFold/StratifiedKFold) | `True` |
| `n_jobs` | `-1` for parallelism; accept that floating-point order may vary across runs |

Set all four. Setting `random_state` only on the model is the #1 source of "I can't reproduce my own results."

## Splitting

| Problem | Default splitter |
|---|---|
| Classification, i.i.d. rows | `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` |
| Regression, i.i.d. rows | `KFold(n_splits=5, shuffle=True, random_state=42)` |
| Grouped (same entity in multiple rows) | `GroupKFold(n_splits=5)` (no shuffle/random_state — deterministic by group hash) |
| Classification + grouped | `StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)` |
| Time series | `TimeSeriesSplit(n_splits=5, gap=<lead-time>)` |
| Tiny data (< 200 rows) | `RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)` |

| Knob | Default |
|---|---|
| `test_size` in `train_test_split` | `0.2` for n > 5000; `0.25` for smaller |
| `stratify` | `=y` for classification, always |
| CV folds | `5` (rarely `10` for very small data, never `< 3`) |

## Baseline models

| Task | Default first reach |
|---|---|
| Tabular classification | `HistGradientBoostingClassifier(random_state=42, early_stopping=True)` |
| Tabular regression | `HistGradientBoostingRegressor(random_state=42, early_stopping=True)` |
| Linear baseline (classification) | `LogisticRegression(max_iter=1000, random_state=42)` with `StandardScaler` |
| Linear baseline (regression) | `Ridge(alpha=1.0, random_state=42)` with `StandardScaler` |
| Clustering, k known | `KMeans(n_clusters=k, n_init="auto", random_state=42)` |
| Clustering, k unknown | `HDBSCAN(min_cluster_size=15)` |

`HistGradientBoosting*` is the default tabular baseline because of native NaN handling, native categorical handling, early stopping, and competitive accuracy. Beat it before switching.

## Hyperparameter search

| Knob | Default |
|---|---|
| Search class | `RandomizedSearchCV` (or `HalvingRandomSearchCV` for tight budgets) |
| `n_iter` (RandomizedSearchCV) | `40` |
| `factor` (Halving) | `3` |
| `cv` | same splitter as the rest of the project |
| `n_jobs` | `-1` |
| `refit` | `True` (the default; on multi-metric, set `refit="<primary metric>"`) |
| `random_state` | `42` |

`GridSearchCV` only when the total combinatoric count is `<= 50`.

## Scoring

| Problem | Primary metric |
|---|---|
| Balanced binary classification | `roc_auc` |
| Imbalanced binary (< 20%) | `average_precision` |
| Severely imbalanced (< 5%) | `average_precision` + per-class `recall` |
| Multi-class | `f1_macro` or `roc_auc_ovr` |
| Probability-quality (calibration) | `neg_log_loss` |
| Regression | `neg_root_mean_squared_error` (primary) + `neg_mean_absolute_error` (robust check) |
| Quantile regression | `neg_mean_pinball_loss` at the trained quantile |

Always cross-validate **multiple** metrics with `cross_validate(scoring=[...])` and report all of them — picking the best one post hoc is selection bias.

## Class imbalance

| Severity | Default treatment |
|---|---|
| Mild (5–20%) | `class_weight="balanced"` on the model |
| Moderate (1–5%) | `class_weight="balanced"` + threshold tuning via `TunedThresholdClassifierCV` |
| Severe (< 1%) | All of the above + reconsider the problem framing (ranking? anomaly detection?) |

Resampling (SMOTE etc.) is a last resort, not a first reach.

## Preprocessing

| Family | Default |
|---|---|
| Numeric scaling (linear / SVM / KNN / NN) | `StandardScaler()` |
| Numeric scaling (tree ensembles) | none — waste of cycles |
| Numeric imputation | `SimpleImputer(strategy="median", add_indicator=True)` for linear; **skip** for HistGradientBoosting/RandomForest |
| Categorical encoding (low cardinality, < 50) | `OneHotEncoder(handle_unknown="ignore", min_frequency=10)` |
| Categorical encoding (high cardinality) | `TargetEncoder(smooth="auto", cv=5, random_state=42)` for linear/boosting |
| Categorical for `HistGradientBoosting*` | `categorical_features="from_dtype"` — let it handle natively |
| Output container | `set_output(transform="pandas")` for readable debugging |

## HistGradientBoosting parameters worth tuning

| Parameter | Search range |
|---|---|
| `learning_rate` | `loguniform(1e-3, 3e-1)` — most impactful |
| `max_iter` | `[200, 500, 1000]` (with `early_stopping=True`) |
| `max_leaf_nodes` | `[15, 31, 63, 127]` |
| `min_samples_leaf` | `[5, 20, 50, 100]` |
| `l2_regularization` | `loguniform(1e-3, 10)` |

Leave `early_stopping=True`, `validation_fraction=0.1`, `n_iter_no_change=10` at defaults unless you have a reason.

## Inspection

| Need | Default |
|---|---|
| Feature importance | `permutation_importance(model, X_val, y_val, n_repeats=10, random_state=42)` — never `.feature_importances_` for reporting |
| Partial dependence | `PartialDependenceDisplay.from_estimator(model, X_val, features=[...])` |

## Persistence

| Boundary | Default |
|---|---|
| Trusted internal (same team, pinned versions) | `joblib.dump(pipe, "model.joblib", compress=3)` + manifest JSON |
| Untrusted source / multi-tenant | `skops.io.dump` + `get_untrusted_types` whitelist on load |
| Cross-runtime / long-term | ONNX via `skl2onnx.convert_sklearn` |

Always store `{sklearn, numpy, python}` versions and `feature_names_in_` next to the model file.
