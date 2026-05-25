# Troubleshooting

Symptom → cause → fix. The top entries are the ones I see in real code reviews most weeks.

## 1. Suspiciously good CV score, then bad test score

**Cause:** Target leakage. Common culprits:

- Fitted a scaler / encoder / imputer on the full dataset before `train_test_split`.
- Computed a feature using the target (e.g., `mean_purchase_per_user`) on the full dataset.
- `cross_val_predict` results used as features for a second model on the same data.
- A grouped row leaked into both folds (same user / same patient on both sides of split).

**Fix:**

- Move all preprocessing inside a `Pipeline` and pass the Pipeline to CV — sklearn enforces "fit only on training fold".
- Use `GroupKFold` / `GroupShuffleSplit` when rows share identity.
- For time series, use `TimeSeriesSplit`, not `KFold`.

## 2. `NotFittedError: This <Estimator> instance is not fitted yet`

**Cause:** Called `.predict` / `.transform` before `.fit`. Inside a Pipeline, this usually means a `clone` happened (e.g., during `GridSearchCV`) and the clone wasn't refit.

**Fix:** Always `fit` (or use `refit=True` in `GridSearchCV`, which is the default) before predict. In tests, use `check_is_fitted(estimator)` to fail fast.

## 3. `ValueError: Found unknown categories ['X'] in column N during transform`

**Cause:** `OneHotEncoder` / `OrdinalEncoder` saw a category at predict time it didn't see during fit.

**Fix:**

```python
OneHotEncoder(handle_unknown="ignore")
OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
```

For ordinal encoders feeding into a tree model, `unknown_value=-1` is fine; for linear models, prefer one-hot with `handle_unknown="ignore"`.

## 4. NaN propagating through the pipeline

**Cause:** A transformer in the chain doesn't handle NaN, but the upstream produces NaN. Common spots: `StandardScaler` (handles NaN since 0.20 via `with_mean`/`with_std` but careful with sparse), `PCA` (no NaN support).

**Fix:** Add `SimpleImputer` (or `KNNImputer` / `IterativeImputer`) **before** the offending transformer in the Pipeline. Or — if your model is `HistGradientBoostingClassifier` / `Regressor` or a recent `RandomForest*` — skip imputation entirely.

Quick check:

```python
import numpy as np
np.isnan(pipe[:-1].transform(X_train)).any()
```

If `True`, your imputation is missing or out of order.

## 5. `ConvergenceWarning: lbfgs failed to converge`

**Cause:** `LogisticRegression` / `LinearSVC` / `MLP*` ran out of iterations.

**Fix:**

1. Make sure features are scaled (`StandardScaler` upstream).
2. Increase `max_iter`: `LogisticRegression(max_iter=5000)`.
3. Increase regularization (`C` smaller in `LogisticRegression`, `alpha` larger in linear models).
4. Switch solver: `solver="saga"` for L1/elastic-net on sparse, `solver="newton-cholesky"` on wide-tall dense.

A warning isn't necessarily wrong, but a model that didn't converge can give unstable coefficients across CV folds.

## 6. Accuracy looks great but the model only predicts the majority class

**Cause:** Class imbalance + `accuracy_score`. With 95% class 0, predicting `0` always gives 95% accuracy and zero useful behavior.

**Fix:**

1. Switch metric: `balanced_accuracy_score`, `roc_auc_score`, `average_precision_score`, or per-class `f1_score`.
2. Use `class_weight="balanced"` on the model.
3. Tune the decision threshold with `TunedThresholdClassifierCV`.
4. As a last resort, resample with `imbalanced-learn`.

## 7. `cross_val_score` and `score(X_test, y_test)` give very different numbers

**Cause:** Either the CV estimate is biased (small folds, no stratify) or you didn't `refit=True` and the "best" model wasn't actually refit on full training data.

**Fix:**

- Use `StratifiedKFold(shuffle=True, random_state=42)` with at least 5 folds.
- `RepeatedStratifiedKFold` to reduce variance.
- Confirm `refit=True` is set in `GridSearchCV` / `RandomizedSearchCV` (it's the default).
- If your test set is small, even an unbiased estimator will have wide error bars — report a bootstrap CI.

## 8. `GridSearchCV` is excruciatingly slow

**Cause:** Combinatoric grid × CV folds × per-fit cost.

**Fix:**

1. `n_jobs=-1`.
2. Switch to `RandomizedSearchCV` (`n_iter=` bounds the budget).
3. Switch to `HalvingRandomSearchCV` (5–10× faster again).
4. Add `Pipeline(memory=...)` to cache expensive transforms.
5. Subsample for the search, refit on full data after.

## 9. `ColumnTransformer` complains about dtype / unknown columns

Symptoms: `KeyError`, dtype-cast warnings, "columns ['x'] not found".

**Cause:** Column selector evaluated at fit doesn't match predict-time columns.

**Fix:** Use `make_column_selector(dtype_include=...)` instead of hardcoded lists. Confirm your incoming payload has the same dtypes (especially `object` vs `category`, `int64` vs `Int64` nullable).

## 10. Sparse matrix densified somewhere and OOM'd

**Cause:** A downstream estimator doesn't support sparse and silently called `X.toarray()` (or `ColumnTransformer` returned a dense block above its `sparse_threshold=0.3`).

**Fix:**

- `ColumnTransformer(sparse_threshold=0)` to force dense (and accept the RAM), or stay sparse and pick a sparse-friendly estimator (`LogisticRegression(solver="saga")`, tree ensembles).
- Cap `OneHotEncoder` cardinality with `min_frequency` / `max_categories`.

## 11. `predict_proba` is unavailable

**Cause:** Some estimators don't expose probabilities (`SVC(probability=False)`, `RidgeClassifier`, `Perceptron`).

**Fix:**

- `SVC(probability=True)` — adds internal CV, expensive.
- Wrap in `CalibratedClassifierCV(method="temperature")` — gives well-calibrated probabilities even for non-probabilistic base.
- Use `decision_function(X)` and threshold manually.

## 12. `random_state` set on the model but results still vary

**Cause:** You forgot it on the splitter, the search, or the OS-level random number generator. `train_test_split(random_state=42)` + `StratifiedKFold(random_state=42)` + `RandomizedSearchCV(random_state=42)` + `Estimator(random_state=42)`. All four matter.

For full determinism on multicore: also set `joblib`'s threading + numpy / OpenBLAS thread counts. Many estimators use `n_jobs=-1` which is non-deterministic in floating-point order across runs.

## 13. Feature names lost after `ColumnTransformer`

**Cause:** Default `verbose_feature_names_out=True` prefixes everything (`num__age`). Or you piped through a NumPy-only step.

**Fix:**

- `verbose_feature_names_out=False` (raises on collision, which is usually what you want).
- `pipe.get_feature_names_out()` after fit.
- `pipe.set_output(transform="pandas")` keeps names through every step.

## 14. Pickled model from 6 months ago no longer loads

**Cause:** sklearn version drift. Even patch versions occasionally break unpickling of obscure attributes.

**Fix:** Pin versions at save time, store the manifest, refit on major-version bumps. For long-term serving, ship ONNX.
