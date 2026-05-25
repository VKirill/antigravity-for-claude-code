# Wrong vs Right

Five textbook traps in scikit-learn code. For each: what people write, why it's broken, what to write instead.

## 1. Fitting a transformer on the full dataset before splitting

### Wrong

```python
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

scaler = StandardScaler().fit(X)        # uses test rows!
X_scaled = scaler.transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, stratify=y)

clf = LogisticRegression().fit(X_train, y_train)
print(clf.score(X_test, y_test))         # optimistically biased
```

The scaler's mean and std are computed using the test rows. Information leaked from the test set into the training-time pipeline. Reported score will be a few points too high; production performance will not match.

### Right

```python
from sklearn.pipeline import Pipeline

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

The Pipeline fits the scaler **only** on training rows and reuses the fitted scaler for `predict`/`score` on test rows.

## 2. Accuracy on imbalanced data

### Wrong

```python
# y has 98% class 0, 2% class 1
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import cross_val_score

clf = HistGradientBoostingClassifier(random_state=42)
print(cross_val_score(clf, X, y, cv=5, scoring="accuracy").mean())   # ~0.98
```

A constant-predict-0 baseline already scores 0.98. You learned nothing from this number, and downstream stakeholders will trust a worthless model.

### Right

```python
from sklearn.model_selection import StratifiedKFold, cross_validate

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
clf = HistGradientBoostingClassifier(class_weight="balanced", random_state=42)

scores = cross_validate(
    clf, X, y, cv=cv,
    scoring=["roc_auc", "average_precision", "balanced_accuracy"],
    n_jobs=-1,
)
for k in ("test_roc_auc", "test_average_precision", "test_balanced_accuracy"):
    print(k, scores[k].mean(), "±", scores[k].std())
```

Stratified folds, balanced class weights, threshold-free metrics (`roc_auc`, `average_precision`) plus a class-aware summary (`balanced_accuracy`).

## 3. Manual cross-validation loop with preprocessing outside the loop

### Wrong

```python
from sklearn.preprocessing import OneHotEncoder
from sklearn.model_selection import KFold

ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False).fit(X[cat_cols])
X_enc = ohe.transform(X[cat_cols])     # fitted on full data: leakage
X_full = np.hstack([X[num_cols].to_numpy(), X_enc])

scores = []
for tr, te in KFold(n_splits=5, shuffle=True, random_state=42).split(X_full):
    m = LogisticRegression(max_iter=1000).fit(X_full[tr], y[tr])
    scores.append(m.score(X_full[te], y[te]))
```

`OneHotEncoder` was fit before the loop on all of `X`. Test rows influence the encoding (which categories exist, in what order). Even using `KFold` per-row, the preprocessing isn't fold-aware.

### Right

```python
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import cross_validate

prep = ColumnTransformer([
    ("num", StandardScaler(), num_cols),
    ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
])
pipe = Pipeline([("prep", prep), ("clf", LogisticRegression(max_iter=1000))])

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_validate(pipe, X, y, cv=cv, scoring="roc_auc", n_jobs=-1)
print(scores["test_score"].mean(), scores["test_score"].std())
```

Now every fold fits the encoder on training rows only.

## 4. Reporting `.feature_importances_` to stakeholders

### Wrong

```python
import pandas as pd

clf = RandomForestClassifier(n_estimators=300, random_state=42).fit(X_train, y_train)
imp = pd.Series(clf.feature_importances_, index=X_train.columns).sort_values(ascending=False)
print(imp.head(10))     # "user_id" is the most important feature
```

`.feature_importances_` from a tree ensemble is biased toward high-cardinality and continuous features. A useless ID column with thousands of unique values reliably ranks at the top.

### Right

```python
from sklearn.inspection import permutation_importance

pi = permutation_importance(
    pipe, X_val, y_val,
    n_repeats=10, random_state=42,
    scoring="roc_auc", n_jobs=-1,
)
order = pi.importances_mean.argsort()[::-1]
for i in order[:10]:
    print(f"{X_val.columns[i]:30s} {pi.importances_mean[i]:+.4f} ± {pi.importances_std[i]:.4f}")
```

`permutation_importance` measures "how much does shuffling this column hurt the model's score?" — unbiased, model-agnostic, comparable across feature types.

## 5. Ignoring `class_weight` and threshold on imbalanced data

### Wrong

```python
clf = LogisticRegression(max_iter=1000).fit(X_train, y_train)
y_pred = clf.predict(X_test)        # threshold = 0.5
print(classification_report(y_test, y_pred))   # recall on positive class = 0.04
```

98/2 class split + a calibrated probabilistic classifier + default threshold 0.5 = essentially no positive predictions. The model is fine; the deployment is wrong.

### Right

```python
from sklearn.model_selection import TunedThresholdClassifierCV

pipe = Pipeline([
    ("prep", prep),
    ("clf", LogisticRegression(class_weight="balanced", max_iter=1000)),
])

tuned = TunedThresholdClassifierCV(
    estimator=pipe,
    scoring="balanced_accuracy",   # or a domain-specific make_scorer
    cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
).fit(X_train, y_train)

print("threshold:", tuned.best_threshold_)
print(classification_report(y_test, tuned.predict(X_test)))
```

`class_weight="balanced"` adjusts the loss; `TunedThresholdClassifierCV` adjusts the decision threshold to whatever metric encodes the business cost. The pair handles imbalance properly without resampling.

## Pattern: every "wrong" above shares one root cause

Preprocessing or evaluation done **outside** the sklearn composition primitives (`Pipeline`, `ColumnTransformer`, `cross_validate`, `*SearchCV`, `TunedThresholdClassifierCV`). The fix is always the same: move the step inside the primitive that knows about train/test boundaries.
