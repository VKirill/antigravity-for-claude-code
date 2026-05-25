# Metrics and Scoring

Two parallel surfaces:

- **Functions** in `sklearn.metrics` — call directly: `roc_auc_score(y_true, y_score)`.
- **Scorers** — string names or `make_scorer` objects passed via `scoring=` to CV / search.

Always pick the metric **before** training. Reporting the metric that happens to look best is selection bias.

## Classification

### Binary

```python
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score,
    precision_score, recall_score, f1_score, fbeta_score,
    roc_auc_score, average_precision_score, log_loss, brier_score_loss,
    confusion_matrix, classification_report,
)

# threshold-based
accuracy_score(y_true, y_pred)
balanced_accuracy_score(y_true, y_pred)   # macro recall; good for imbalanced
f1_score(y_true, y_pred)
fbeta_score(y_true, y_pred, beta=2.0)     # beta > 1 weights recall

# probability-based
roc_auc_score(y_true, y_score)            # threshold-free; ranking quality
average_precision_score(y_true, y_score)  # area under PR curve; better than ROC on imbalanced
log_loss(y_true, y_proba)                 # punishes overconfident wrong predictions
brier_score_loss(y_true, y_proba_pos)     # MSE of probabilities; calibration-sensitive
```

| Class balance | Pick |
|---|---|
| Balanced | `accuracy_score`, `roc_auc_score` |
| Mild imbalance (5–20%) | `balanced_accuracy_score`, `roc_auc_score`, `f1_score` |
| Severe imbalance (< 5%) | `average_precision_score`, per-class `recall_score`, `f1_score(pos_label=1)` |

### Multi-class

```python
roc_auc_score(y_true, y_score, multi_class="ovr", average="macro")
f1_score(y_true, y_pred, average="macro")        # unweighted mean across classes
f1_score(y_true, y_pred, average="weighted")     # support-weighted
f1_score(y_true, y_pred, average="micro")        # globally aggregated
```

`average="macro"` for "every class matters equally". `average="weighted"` for "scale by class frequency". `average=None` returns per-class scores.

### Confusion matrix and report

```python
confusion_matrix(y_true, y_pred, labels=[0, 1, 2], normalize="true")
print(classification_report(y_true, y_pred, digits=3))
```

`normalize="true"` divides each row by its support — recall along the diagonal. `normalize="pred"` gives precision.

## Regression

```python
from sklearn.metrics import (
    mean_squared_error, root_mean_squared_error,
    mean_absolute_error, mean_absolute_percentage_error,
    median_absolute_error, r2_score, explained_variance_score,
    mean_pinball_loss, d2_pinball_score,
)

mean_squared_error(y_true, y_pred)
root_mean_squared_error(y_true, y_pred)            # 1.4+; avoids deprecated squared=False
mean_absolute_error(y_true, y_pred)
mean_absolute_percentage_error(y_true, y_pred)     # NOT a percent; scale [0, 1+]
r2_score(y_true, y_pred)
mean_pinball_loss(y_true, y_pred, alpha=0.9)       # for quantile regression
```

Default: RMSE for "errors in y units, big errors weighted more" + MAE for "robust median error". Report both.

## Scoring in CV / search

Use the **string name** when there's one:

```python
cross_validate(pipe, X, y, scoring="roc_auc")
cross_validate(pipe, X, y, scoring=["roc_auc", "average_precision", "f1"])
```

Common names: `"accuracy"`, `"balanced_accuracy"`, `"roc_auc"`, `"roc_auc_ovr"`, `"roc_auc_ovo"`, `"average_precision"`, `"f1"`, `"f1_macro"`, `"f1_weighted"`, `"precision"`, `"recall"`, `"neg_log_loss"`, `"neg_brier_score"`, `"r2"`, `"neg_mean_squared_error"`, `"neg_root_mean_squared_error"`, `"neg_mean_absolute_error"`.

Note the `neg_` prefix — sklearn maximizes, so loss metrics are negated.

Full list: `sklearn.metrics.get_scorer_names()`.

## Custom scorers with `make_scorer`

```python
from sklearn.metrics import make_scorer, fbeta_score

f2 = make_scorer(fbeta_score, beta=2, pos_label=1)

cross_validate(pipe, X, y, scoring=f2)
```

For probability- or score-based metrics, declare it:

```python
def expected_profit(y_true, y_proba_pos, *, value_tp=100, cost_fp=10):
    import numpy as np
    y_pred = (y_proba_pos > 0.5).astype(int)
    tp = ((y_pred == 1) & (y_true == 1)).sum()
    fp = ((y_pred == 1) & (y_true == 0)).sum()
    return value_tp * tp - cost_fp * fp

profit_scorer = make_scorer(
    expected_profit,
    response_method="predict_proba",   # tells sklearn to pass proba, not pred
    greater_is_better=True,
)
```

`response_method=` accepts `"predict"`, `"predict_proba"`, `"decision_function"`, or a tuple to try in order.

## Multi-metric scoring

`cross_validate` and `*SearchCV` accept lists or dicts:

```python
cross_validate(
    pipe, X, y, cv=cv,
    scoring={"auc": "roc_auc", "ap": "average_precision", "ll": "neg_log_loss"},
    refit="auc",     # GridSearchCV: which metric to optimize for best_estimator_
)
```

The dict form is the only way to mix string and `make_scorer` scorers.

## Sample weights in metrics

Almost every metric in `sklearn.metrics` accepts `sample_weight=`. When you carry sample weights through `fit` (via metadata routing), the same weights must reach the metric in CV, or the score and the loss disagree:

```python
import sklearn
sklearn.set_config(enable_metadata_routing=True)

f2 = make_scorer(fbeta_score, beta=2).set_score_request(sample_weight=True)
cross_validate(pipe, X, y, cv=cv, scoring=f2, params={"sample_weight": w})
```

## Common mistakes

- **Reporting `accuracy_score` on imbalanced data** — model that predicts the majority class wins.
- **Confusing `roc_auc_score` with `average_precision_score`** — ROC AUC over-promises on imbalanced data because the false-positive rate denominator is huge.
- **Forgetting `neg_` prefix on losses** — `scoring="mean_squared_error"` raises; use `"neg_mean_squared_error"`.
- **Comparing models across CVs with different metrics** — apples to oranges. Fix one primary metric upfront.
- **Custom scorer that takes raw predictions when it needs probabilities** — set `response_method="predict_proba"` in `make_scorer`.
