# scikit-learn skill — Changelog

All notable changes to this skill (not to scikit-learn itself).

## 1.0.0 — initial release

Pinned to scikit-learn `1.8.x` (latest 1.8.0).

### Highlights of scikit-learn 1.8 reflected in this skill

- **Free-threaded CPython 3.14 wheels** — sklearn ships GIL-free wheels for Python 3.14; embarrassingly-parallel `n_jobs` workloads benefit without code changes.
- **Array API expansion** — `StandardScaler`, `RidgeCV`, `RidgeClassifier`, `cross_val_predict`, `confusion_matrix`, `roc_curve`, `precision_recall_curve`, `balanced_accuracy_score`, `cohen_kappa_score`, `calinski_harabasz_score`, `GaussianMixture`, `PolynomialFeatures`, `LabelBinarizer`, `CalibratedClassifierCV(method="temperature")` are now Array API compatible — drop-in support for CuPy / PyTorch tensors via Array API.
- **`DecisionTreeRegressor(criterion="absolute_error")` 10–100× faster** — O(n log n) vs old O(n²). MAE-trained trees scale to millions of rows.
- **Gap-safe screening for Lasso / ElasticNet** — coordinate descent up to 10× faster on regularization paths, especially in `LassoCV` / `ElasticNetCV`. No code change.
- **`CalibratedClassifierCV(method="temperature")`** — stable temperature scaling for probability calibration; recommended over `"isotonic"` for modern boosted models.
- **`SplineTransformer(handle_missing=...)`** — splines now tolerate NaN.
- **`MaxAbsScaler(clip=True)`** — clip out-of-range values at transform time.
- **`QuadraticDiscriminantAnalysis`** — adds `solver`, `covariance_estimator`, `shrinkage` parameters.
- **`ClassicalMDS`** — new estimator: classical multidimensional scaling via eigendecomposition.
- **Metadata routing maturity** — fixed long-standing `sample_weight` routing bug in `Pipeline` + `GridSearchCV`. Routing API (`set_fit_request`, `set_score_request`, `set_split_request`) is now production-ready.
- **`d2_brier_score`, `confusion_matrix_at_thresholds`** — new metrics.
- **Deprecations:** `PassiveAggressiveClassifier/Regressor` (→ `SGDClassifier/Regressor` with `learning_rate="pa1"`/`"pa2"`), `LogisticRegression` `penalty` parameter (→ `l1_ratio`), `utils.extmath.stable_cumsum`.

### Skill structure

Pattern 2 (medium-stakes risk) layout with 14 references:

- `REFERENCE.md` — capability map + decision matrix
- `estimator-api.md` — fit/predict/transform contract, custom estimators, `set_output`, metadata routing
- `pipelines.md` — Pipeline + ColumnTransformer composition
- `data-prep.md` — scalers, encoders, imputers, splitting
- `model-selection.md` — splitters, GridSearch/RandomizedSearch/Halving, learning curves, nested CV
- `classification.md` — classifier zoo + imbalance handling + calibration
- `regression.md` — regressor zoo + quantile + robust losses + target transform
- `clustering.md` — KMeans / DBSCAN / HDBSCAN / GMM + cluster validity
- `metrics.md` — classification + regression metrics, `make_scorer`, multi-metric
- `feature-selection.md` — filter / wrapper / embedded + `permutation_importance`
- `model-persistence.md` — joblib vs skops vs ONNX trust matrix
- `troubleshooting.md` — 14 common production failure modes
- `recommended-defaults.md` — single source of truth for project-wide knobs
- `wrong-vs-right.md` — five textbook traps with paired wrong/right code
- `eval-cases.md` — positive + negative routing prompts for description testing
