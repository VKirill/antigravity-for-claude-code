# Classification

## Default baseline

For any tabular classification problem, the first model you try is:

```python
from sklearn.ensemble import HistGradientBoostingClassifier

clf = HistGradientBoostingClassifier(
    learning_rate=0.1,
    max_iter=200,
    max_leaf_nodes=31,
    min_samples_leaf=20,
    l2_regularization=0.0,
    max_features=1.0,
    categorical_features="from_dtype",   # use pandas/polars category dtype directly
    early_stopping=True,                 # auto if n_samples > 10000
    validation_fraction=0.1,
    n_iter_no_change=10,
    class_weight=None,                   # set "balanced" for imbalanced
    random_state=42,
)
```

It handles missing values natively, treats `category` dtype columns as proper categoricals, has early stopping, and converges fast. You will rarely beat it by > 1–3% with another tabular model.

## Estimator zoo

### Linear

```python
from sklearn.linear_model import LogisticRegression, RidgeClassifier, SGDClassifier

LogisticRegression(
    penalty="l2",                # "l1", "elasticnet", None
    C=1.0,                       # inverse regularization
    solver="lbfgs",              # "liblinear" for L1 small data, "saga" for L1/EN sparse, "newton-cholesky" wide-tall
    max_iter=1000,
    l1_ratio=None,               # required if penalty="elasticnet"
    class_weight=None,
    multi_class="auto",          # "ovr" or "multinomial"
    n_jobs=-1,
)
```

`LogisticRegression` outputs well-calibrated probabilities under the model assumption — usually the right pick when downstream uses a thresholded probability. Always pair with `StandardScaler` inside a `Pipeline`.

### Trees and forests

```python
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.tree import DecisionTreeClassifier

RandomForestClassifier(
    n_estimators=300,
    max_depth=None,              # or finite for regularization
    min_samples_leaf=1,
    max_features="sqrt",         # classification default
    n_jobs=-1,
    class_weight=None,           # "balanced" or "balanced_subsample"
    random_state=42,
)
```

Robust, parallelizable, easy. Less accurate than `HistGradientBoostingClassifier` on most tabular tasks but better when interpretability via feature importance matters.

### Support vector

```python
from sklearn.svm import SVC, LinearSVC

SVC(
    C=1.0, kernel="rbf", gamma="scale",
    probability=False,           # True needs internal CV; expensive
    class_weight=None,
    decision_function_shape="ovr",
    random_state=42,
)
```

Strong on small-to-medium data with non-trivial decision boundaries. Always scale inputs. Quadratic-to-cubic in `n_samples` — don't use above ~50k rows.

### Nearest neighbors

```python
from sklearn.neighbors import KNeighborsClassifier

KNeighborsClassifier(
    n_neighbors=5,
    weights="distance",          # or "uniform"
    algorithm="auto",
    metric="minkowski", p=2,
    n_jobs=-1,
)
```

Useful as a sanity check or in low-dim metric spaces. Always scale. Curse of dimensionality bites above ~30 features.

### Neural net (small, tabular only)

```python
from sklearn.neural_network import MLPClassifier

MLPClassifier(
    hidden_layer_sizes=(64, 32),
    activation="relu",
    solver="adam",
    alpha=1e-4,
    learning_rate_init=1e-3,
    max_iter=200,
    early_stopping=True,
    validation_fraction=0.1,
    random_state=42,
)
```

In 2026, reach for `MLPClassifier` only when you specifically need a small MLP without bringing in PyTorch. For anything serious, go to `pytorch`.

## Class imbalance

Three knobs in order of preference:

1. **`class_weight="balanced"`** on the model — reweights losses inversely to class frequencies. Free, no resampling.
2. **`sample_weight=`** during `fit` — finer-grained per-row reweighting.
3. **Resampling** (`imbalanced-learn`'s `RandomUnderSampler` / `SMOTE`) — only if 1 and 2 are insufficient.

```python
HistGradientBoostingClassifier(class_weight="balanced", random_state=42)
LogisticRegression(class_weight="balanced", max_iter=1000)
```

For severe imbalance (< 1%), tune the decision threshold with `TunedThresholdClassifierCV` and report `roc_auc_score` + `average_precision_score`, not accuracy.

## Multi-class

sklearn handles multi-class natively in `LogisticRegression(multi_class="multinomial")`, all tree ensembles, SVC (`decision_function_shape="ovr"`), and MLP.

Wrappers when you need them:

```python
from sklearn.multiclass import OneVsRestClassifier, OneVsOneClassifier, OutputCodeClassifier
```

For **multi-label** (each sample has multiple labels): `MultiOutputClassifier` or directly train one binary classifier per label.

## Probability calibration

If you'll threshold the probabilities, calibrate them. `LogisticRegression` is calibrated by construction; trees and SVMs are not.

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated = CalibratedClassifierCV(
    estimator=HistGradientBoostingClassifier(random_state=42),
    method="temperature",        # 1.8+ stable; or "sigmoid" or "isotonic"
    cv=5,
    n_jobs=-1,
).fit(X_train, y_train)
```

`method="temperature"` is new in 1.8 and is the recommended choice for modern probabilistic classifiers — single scalar, no risk of overfit unlike `"isotonic"`.

Inspect with a reliability diagram (`from sklearn.calibration import CalibrationDisplay`).

## Defaults summary

| Aspect | Default |
|---|---|
| Strong baseline | `HistGradientBoostingClassifier(random_state=42, early_stopping=True)` |
| CV | `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` |
| Scoring (imbalanced) | `roc_auc` or `average_precision` |
| Scoring (balanced) | `accuracy` or `balanced_accuracy` |
| Imbalance handling | `class_weight="balanced"` first |
| Probability calibration | `CalibratedClassifierCV(method="temperature")` if thresholding |
