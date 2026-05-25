# Regression

## Default baseline

```python
from sklearn.ensemble import HistGradientBoostingRegressor

reg = HistGradientBoostingRegressor(
    loss="squared_error",                # or "absolute_error", "poisson", "gamma", "quantile"
    learning_rate=0.1,
    max_iter=200,
    max_leaf_nodes=31,
    min_samples_leaf=20,
    l2_regularization=0.0,
    categorical_features="from_dtype",
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=10,
    random_state=42,
)
```

Native NaN handling, native categorical support, early stopping. The same baseline rules from classification apply.

## Estimator zoo

### Linear

```python
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet, RidgeCV, LassoCV

LinearRegression()                                              # no regularization
Ridge(alpha=1.0, solver="auto", random_state=42)                # L2; default for "small p, lots of n"
Lasso(alpha=1.0, max_iter=10000, random_state=42)               # L1; sparse coefficients
ElasticNet(alpha=1.0, l1_ratio=0.5, max_iter=10000, random_state=42)  # combo
```

1.8 ships **gap-safe screening** for Lasso/ElasticNet coordinate descent — up to 10× speedup on regularization paths, especially in the `*CV` variants (`LassoCV`, `ElasticNetCV`). No code change needed; you just get a faster fit.

Pair every linear regressor with `StandardScaler` (so the regularization penalty is on a comparable scale across features). `LinearRegression` without regularization tolerates unscaled features but always check the condition number.

### Tree ensembles

```python
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor
from sklearn.tree import DecisionTreeRegressor

RandomForestRegressor(
    n_estimators=300,
    max_depth=None,
    min_samples_leaf=1,
    max_features=1.0,                # regression default
    n_jobs=-1,
    random_state=42,
)
```

1.8 ships a **10–100× speedup** for `DecisionTreeRegressor(criterion="absolute_error")` (O(n log n) instead of O(n²)) — MAE-trained trees now scale to millions of rows. If you were avoiding `criterion="absolute_error"` for performance, revisit.

### Support vector

```python
from sklearn.svm import SVR, LinearSVR

SVR(C=1.0, kernel="rbf", gamma="scale", epsilon=0.1)
```

Same caveats as SVC — scale inputs, quadratic-to-cubic complexity, fine below ~50k rows.

### Nearest neighbors

```python
from sklearn.neighbors import KNeighborsRegressor

KNeighborsRegressor(n_neighbors=5, weights="distance", n_jobs=-1)
```

### Neural net

```python
from sklearn.neural_network import MLPRegressor

MLPRegressor(
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

## Robust to outliers

When the target has heavy tails:

| Need | Estimator | Loss |
|---|---|---|
| L1 loss everywhere | `HistGradientBoostingRegressor(loss="absolute_error")` | MAE |
| Linear, L1 loss | `linear_model.QuantileRegressor(quantile=0.5, alpha=0.0)` | Pinball at 0.5 = MAE |
| Huber loss | `linear_model.HuberRegressor()` | Huber |
| Random sample consensus | `linear_model.RANSACRegressor()` | Robust via consensus |

## Quantile regression

Predict any quantile (not just the conditional mean):

```python
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import QuantileRegressor

# tree-based
HistGradientBoostingRegressor(loss="quantile", quantile=0.1, random_state=42)
HistGradientBoostingRegressor(loss="quantile", quantile=0.9, random_state=42)

# linear
QuantileRegressor(quantile=0.5, alpha=0.0, solver="highs")
```

Train one model per quantile to get prediction intervals (10%/50%/90%, say). Score with `mean_pinball_loss(y, y_pred, alpha=quantile)`.

## Count / non-negative targets

`HistGradientBoostingRegressor(loss="poisson")` for counts.
`HistGradientBoostingRegressor(loss="gamma")` for strictly positive heavy-tailed.

Linear analogs: `PoissonRegressor`, `GammaRegressor`, `TweedieRegressor`.

## Multi-output regression

Native support in `LinearRegression`, `Ridge`, `RandomForestRegressor`, `KNeighborsRegressor`, `MLPRegressor`.

For estimators that don't, wrap:

```python
from sklearn.multioutput import MultiOutputRegressor, RegressorChain

MultiOutputRegressor(HistGradientBoostingRegressor())   # one model per target
RegressorChain(HistGradientBoostingRegressor(), order=[0, 1, 2])   # each target sees prior predictions
```

## Target transformation

Skewed target? Don't transform `y` in place — wrap so inverse transform happens at predict time:

```python
from sklearn.compose import TransformedTargetRegressor
import numpy as np

TransformedTargetRegressor(
    regressor=HistGradientBoostingRegressor(),
    func=np.log1p, inverse_func=np.expm1,
)
```

`.fit(X, y)` calls `func(y)` internally; `.predict(X)` applies `inverse_func`. Metrics live in original units.

## Defaults summary

| Aspect | Default |
|---|---|
| Strong baseline | `HistGradientBoostingRegressor(random_state=42, early_stopping=True)` |
| CV | `KFold(n_splits=5, shuffle=True, random_state=42)` |
| Scoring | `neg_root_mean_squared_error` or `r2` |
| Robust loss | `loss="absolute_error"` (fast in 1.8) |
| Heavy-tailed `y` | `TransformedTargetRegressor(func=np.log1p, inverse_func=np.expm1)` |
| Intervals | One quantile model per quantile |
