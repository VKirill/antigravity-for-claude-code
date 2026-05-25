---
name: scikit-learn
description: "scikit-learn 1.8 — classical machine learning in Python. Estimator API, Pipeline + ColumnTransformer, cross-validation, GridSearchCV/RandomizedSearchCV/HalvingGridSearchCV, classification/regression/clustering, preprocessing, metrics. Use when: scikit-learn, sklearn, classical ml, machine learning, tabular ml, classification, regression, clustering, Pipeline, ColumnTransformer, GridSearchCV, RandomizedSearchCV, train_test_split, cross_val_score, cross_validation, RandomForest, HistGradientBoosting, LogisticRegression, OneHotEncoder, StandardScaler, fit, predict, score, set_output polars, metadata routing. SKIP: deep learning (→pytorch), transformer/LLM fine-tuning, GPU compute (→cuda-python), large-scale gradient boosting (→xgboost/lightgbm)."
stacks:
  - scikit-learn
  - Python
tags:
  - scikit-learn
  - ml
  - classical-ml
  - data-science
packages:
  - scikit-learn
  - joblib
manifests:
  - pyproject.toml
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- scikit-learn: `1.8.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Use this skill when

- Building a tabular **classification** or **regression** model where rows = samples and columns = features
- Setting up a **preprocessing + model Pipeline** with `ColumnTransformer` for heterogenous (numeric + categorical) data
- Running **cross-validation** (`cross_val_score`, `cross_validate`, `KFold`, `StratifiedKFold`, `GroupKFold`, `TimeSeriesSplit`)
- **Hyperparameter search** via `GridSearchCV`, `RandomizedSearchCV`, or successive halving (`HalvingGridSearchCV`)
- Selecting a strong **baseline model** for tabular data (defaults to `HistGradientBoosting*`)
- **Unsupervised** problems — `KMeans`, `DBSCAN`, `HDBSCAN`, `GaussianMixture`, dimensionality reduction (`PCA`, `TruncatedSVD`)
- **Feature selection** (`SelectKBest`, `RFE`, `RFECV`, `SelectFromModel`, `permutation_importance`)
- Persisting a fitted estimator for production inference (`joblib`, `skops.io`, or `ONNX` export)

## Do not use this skill when

- The task is **deep learning** — neural nets on images/text/audio → use `pytorch`
- The task is **transformer or LLM fine-tuning** → use the transformers cascade, not sklearn's MLPClassifier
- The workload needs **GPU compute** for tensor math → use `cuda-python`
- You need **distributed training** across nodes — sklearn is single-machine; use PyTorch DDP or Ray
- You need **gradient boosting at very large scale** — XGBoost / LightGBM / CatBoost have a sklearn-compatible API but live outside this skill
- The user is loading or wrangling tabular data — that is upstream (use the dataframe library directly); this skill begins once you have an `X, y` ready

## Purpose

scikit-learn is the default first reach for any **tabular** machine learning task in Python — supervised (classification/regression) or unsupervised (clustering, decomposition). Before going to deep learning, you should almost always try a sklearn baseline: a `Pipeline` wrapping a `ColumnTransformer` for preprocessing and a `HistGradientBoostingClassifier`/`Regressor` as the model, evaluated with cross-validation. For most rows-and-columns problems this baseline is within 1–3% of the state of the art and is one to two orders of magnitude cheaper to train and serve.

The library is held together by one idea — the **estimator API**: every model, transformer, and meta-estimator shares the same `fit(X, y)` / `predict(X)` / `transform(X)` / `score(X, y)` surface, so they compose into `Pipeline` and `ColumnTransformer` objects that prevent the most common ML bug (train/test leakage). 1.8 adds free-threaded CPython 3.14 wheels, broad Array API support, a 10–100× speedup for `DecisionTreeRegressor(criterion="absolute_error")`, gap-safe screening for Lasso/ElasticNet on regularization paths, temperature scaling for `CalibratedClassifierCV`, and continues to mature `set_output(transform="pandas"|"polars")` plus metadata routing (`set_fit_request`, `set_score_request`).

## Capabilities

### Estimator API and custom estimators

Every sklearn object implements a small fixed surface: `fit`, `predict`, `transform`, `fit_transform`, `score`, `get_params`, `set_params`. Custom estimators subclass `BaseEstimator` plus a mixin (`ClassifierMixin`, `RegressorMixin`, `TransformerMixin`, `ClusterMixin`) and pass `check_estimator` for the contract test. `set_output(transform="pandas"|"polars")` switches transformer output containers without rewriting the pipeline. Metadata routing (`set_fit_request`, `set_score_request`) lets `sample_weight`, `groups`, and arbitrary keys flow correctly through meta-estimators when `sklearn.set_config(enable_metadata_routing=True)` is on. See [references/estimator-api.md](references/estimator-api.md).

### Pipelines and ColumnTransformer

A `Pipeline([("prep", ...), ("model", ...)])` makes preprocessing part of the estimator, so `fit` only sees train data and `predict` reuses the same fitted transforms. `ColumnTransformer` applies different transformers to different column subsets in parallel (numeric → scaler, categorical → encoder) and combines the results. `make_pipeline` / `make_column_transformer` skip naming; `remainder="passthrough"` keeps unselected columns; `verbose_feature_names_out=False` keeps original feature names when there's no collision. Caching via `Pipeline(memory=...)` skips re-fitting expensive transformers during hyperparameter search. See [references/pipelines.md](references/pipelines.md).

### Data preparation and preprocessing

Numeric: `StandardScaler`, `MinMaxScaler`, `RobustScaler`, `MaxAbsScaler` (1.8 adds `clip=True` for out-of-range), `PowerTransformer`, `QuantileTransformer`, `KBinsDiscretizer`. Categorical: `OneHotEncoder` (with `handle_unknown="ignore"`, `min_frequency`, `max_categories`), `OrdinalEncoder`, `TargetEncoder` (cross-fitted, leak-safe). Missing values: `SimpleImputer`, `IterativeImputer`, `KNNImputer`. Splitting: `train_test_split(..., stratify=y)` for classification — never split without stratify on imbalanced labels. See [references/data-prep.md](references/data-prep.md).

### Model selection — splitters, CV, hyperparameter search

Splitters: `KFold`, `StratifiedKFold` (default for classification), `GroupKFold` and `StratifiedGroupKFold` (no entity leakage across folds), `TimeSeriesSplit` (forward-only chronological). Scoring loops: `cross_val_score`, `cross_validate` (multi-metric, returns timings), `cross_val_predict` (only for stacking, never for performance reporting). Search: `GridSearchCV` (exhaustive), `RandomizedSearchCV` (budget-bounded), `HalvingGridSearchCV` / `HalvingRandomSearchCV` (successive halving, 5–10× faster on the same budget). Diagnostics: `learning_curve`, `validation_curve`. See [references/model-selection.md](references/model-selection.md).

### Classification, regression, clustering

Tabular baseline: `HistGradientBoostingClassifier` / `HistGradientBoostingRegressor` — native missing-value handling, categorical support via `categorical_features=`, built-in `early_stopping`. Linear: `LogisticRegression`, `Ridge`, `Lasso`, `ElasticNet` (gap-safe screening in 1.8). Tree ensembles: `RandomForestClassifier/Regressor`, `ExtraTreesClassifier/Regressor`. Margin: `SVC`, `SVR` (scale features first). Neighbors: `KNeighborsClassifier/Regressor`. Probabilistic: `CalibratedClassifierCV(method="temperature")` for production probability calibration. Clustering: `KMeans` (use `n_init="auto"`), `DBSCAN`, `HDBSCAN`, `AgglomerativeClustering`, `GaussianMixture`. See [references/classification.md](references/classification.md), [references/regression.md](references/regression.md), and [references/clustering.md](references/clustering.md).

### Metrics, feature selection, and inspection

Use `make_scorer` to convert any metric into a scoring object for CV. Classification: `accuracy_score` (only on balanced), `balanced_accuracy_score`, `roc_auc_score(average="macro"|"weighted")`, `log_loss`, `f1_score(average=...)`, `classification_report`, `confusion_matrix`. Regression: `mean_squared_error`, `root_mean_squared_error`, `mean_absolute_error`, `mean_absolute_percentage_error`, `r2_score`. Feature selection: `SelectKBest`, `RFECV`, `SelectFromModel`, `mutual_info_classif/regression`. Inspection: prefer `permutation_importance` over `.feature_importances_` (the latter is biased toward high-cardinality features). See [references/metrics.md](references/metrics.md) and [references/feature-selection.md](references/feature-selection.md).

### Model persistence

Choose by trust boundary: **ONNX** if the consumer is non-Python or you want long-term forward compatibility; **`skops.io`** if you control the consumer but the model file may travel across an untrusted boundary (no arbitrary code execution on load); **`joblib`** (or `pickle`) when both producer and consumer are trusted Python with pinned versions. Always pin `scikit-learn` version + Python version + NumPy version in the deployment manifest — fitted estimators are not forward-compatible across majors. See [references/model-persistence.md](references/model-persistence.md).

## Behavioral Traits

- Wraps **every** preprocessing step inside `Pipeline` / `ColumnTransformer` — never `fit_transform`s before splitting
- Uses `train_test_split(..., stratify=y, random_state=...)` for every classification problem
- Sets `random_state=` on every estimator, splitter, and search that supports it — reproducibility is non-negotiable
- Defaults to `HistGradientBoostingClassifier` / `HistGradientBoostingRegressor` as the strong tabular baseline before reaching for anything fancier
- Defaults to `StratifiedKFold(n_splits=5, shuffle=True, random_state=...)` for classification CV; `KFold` for regression; `GroupKFold` whenever rows share a meaningful group key
- Uses `permutation_importance` for feature importance (model-agnostic, unbiased), not `.feature_importances_`
- Reports **multiple** metrics from `cross_validate(..., scoring=[...])` rather than a single number
- Calls `RandomizedSearchCV` or `HalvingRandomSearchCV` before `GridSearchCV` — the search space is almost never small enough for exhaustive
- Uses `Pipeline(memory=...)` when CV-tuning a model with an expensive transformer (e.g., `IterativeImputer`)
- Picks persistence by trust boundary: **ONNX** → cross-runtime, **skops.io** → untrusted source, **joblib** → trusted internal

## Important Constraints

- **NEVER** fit a transformer on the full dataset before `train_test_split` — that's textbook target leakage; the transformer goes inside the `Pipeline`
- **NEVER** mix train + test data inside cross-validation — every fold's preprocessing must be fit only on that fold's training rows (`Pipeline` enforces this; manual loops typically do not)
- **NEVER** report `accuracy_score` on imbalanced classification — use `balanced_accuracy_score`, `roc_auc_score`, `average_precision_score`, or per-class `f1_score` instead
- **NEVER** call `.predict` / `.transform` before `.fit` — sklearn raises `NotFittedError`; catch this in tests, not in production
- **NEVER** pickle or `joblib.dump` a model without recording `sklearn.__version__`, `numpy.__version__`, and Python version — fitted estimators are not version-portable
- **NEVER** load an `.skops` / pickle / joblib file from an untrusted source without inspection — pickle-based formats allow arbitrary code execution; `skops.io` requires explicit `trusted=` whitelisting
- **NEVER** use `cross_val_predict` results to report model performance — its design is for stacking; use `cross_validate` for performance estimates
- **ALWAYS** stratify the train/test split for classification; **ALWAYS** stratify the CV splitter for classification; **ALWAYS** set `random_state` for any reproducible result

## Related Skills

### Language and data
- `python` — Python 3.14 foundation (type hints, packaging, asyncio); sklearn runs on top of this
- `pandas` — primary dataframe library for feature engineering before `X, y = df[features], df[target]`
- `polars` — faster columnar alternative; sklearn supports `set_output(transform="polars")` end-to-end
- `cuda-python` — for the rare Array-API sklearn estimator on GPU (or to switch to GPU libs downstream)

### Deep-learning escape hatch
- `pytorch` — when the tabular baseline isn't enough (sequences, images, text, very large feature spaces)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Capability map, model-selection decision matrix, when to open which doc | [references/REFERENCE.md](references/REFERENCE.md) |
| Estimator API: fit/predict/transform/score, get_params/set_params, BaseEstimator + mixins, set_output, metadata routing | [references/estimator-api.md](references/estimator-api.md) |
| Pipeline, make_pipeline, FeatureUnion, ColumnTransformer, named steps, `__` syntax, memory caching | [references/pipelines.md](references/pipelines.md) |
| Scalers, encoders, imputers, train_test_split with stratify | [references/data-prep.md](references/data-prep.md) |
| Splitters (KFold/Stratified/Group/TimeSeries), GridSearchCV, RandomizedSearchCV, HalvingGridSearchCV, learning_curve, nested CV | [references/model-selection.md](references/model-selection.md) |
| Classification estimators: LogisticRegression, RandomForest, HistGradientBoosting, SVC, KNN, MLP; class_weight; multi-class | [references/classification.md](references/classification.md) |
| Regression estimators: LinearRegression, Ridge, Lasso, ElasticNet, RandomForest, HistGradientBoosting, SVR, quantile | [references/regression.md](references/regression.md) |
| Clustering: KMeans, DBSCAN, HDBSCAN, AgglomerativeClustering, GaussianMixture; silhouette, Davies-Bouldin | [references/clustering.md](references/clustering.md) |
| Metrics: classification, regression, custom via make_scorer, classification_report, confusion_matrix | [references/metrics.md](references/metrics.md) |
| Feature selection: SelectKBest, RFE/RFECV, SelectFromModel, mutual_info, variance_threshold, permutation_importance | [references/feature-selection.md](references/feature-selection.md) |
| Model persistence: joblib vs pickle vs skops vs ONNX; version pinning; schema validation on load | [references/model-persistence.md](references/model-persistence.md) |
| Troubleshooting: target leakage, NaN propagation, ConvergenceWarning, class imbalance, ColumnTransformer dtype mismatches | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults: CV folds, random_state policy, baseline model, search budget, scoring | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right code pairs: scaling before split, accuracy on imbalanced, manual fold loops, ignoring class_weight | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases (positive/negative routing prompts) | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file before writing code. Don't read everything — read what the task needs.
