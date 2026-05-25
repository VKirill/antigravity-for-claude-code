# Aggregations and Reductions

Reductions collapse one or more axes into a single value. Every reduction takes `axis=` and `keepdims=` and has a NaN-aware variant.

## Basic reductions

```python
arr.sum()           # scalar — sum of all elements
arr.sum(axis=0)     # collapse axis 0 → shape drops one dim
arr.sum(axis=1)
arr.sum(axis=(0, 2))   # multi-axis reduction
arr.sum(keepdims=True) # preserve dims as length-1, useful for broadcasting

arr.mean()
arr.std(ddof=0)     # default — population std
arr.std(ddof=1)     # sample std (divide by N-1)
arr.var()
arr.min()
arr.max()
arr.argmin()        # flat index of min
arr.argmax(axis=1)  # index of max along axis 1, per row
arr.prod()
arr.cumsum(axis=0)  # cumulative
arr.cumprod()
arr.ptp()           # peak-to-peak = max - min
```

Each method is mirrored by a top-level function: `np.sum(arr)`, `np.mean(arr)`, etc. They are usually equivalent — `np.sum` is slightly more permissive on input (accepts lists).

## `axis` semantics

The axis being reduced **disappears** from the output shape (unless `keepdims=True`).

```python
arr = np.zeros((3, 4, 5))
arr.sum(axis=0).shape           # (4, 5)
arr.sum(axis=1).shape           # (3, 5)
arr.sum(axis=-1).shape          # (3, 4) — last axis
arr.sum(axis=(0, 2)).shape      # (4,)
arr.sum(axis=0, keepdims=True).shape   # (1, 4, 5)
```

`keepdims=True` is the trick for downstream broadcasting:

```python
# Normalize each row to sum to 1
row_sums = arr.sum(axis=1, keepdims=True)   # shape (3, 1, 5)
arr_normalized = arr / row_sums              # broadcast cleanly
```

## NaN-aware variants

The plain reductions propagate `NaN` — one `NaN` in the input makes the whole reduction `NaN`. Use `nan*` versions to skip:

```python
np.nansum(arr)
np.nanmean(arr)
np.nanstd(arr)
np.nanmin(arr), np.nanmax(arr)
np.nanargmin(arr), np.nanargmax(arr)
np.nanpercentile(arr, 95)
np.nanquantile(arr, [0.25, 0.5, 0.75])
```

If ALL values along an axis are NaN, NaN-reductions emit a `RuntimeWarning` and return NaN. Suppress with `warnings.catch_warnings` if intentional.

## Percentiles and quantiles

```python
np.percentile(arr, 50)                       # median
np.percentile(arr, [25, 50, 75])             # quartiles
np.percentile(arr, 90, axis=0)               # 90th percentile per column

np.quantile(arr, 0.5)                        # same value as percentile(50)
np.quantile(arr, [0.25, 0.5, 0.75])
```

In NumPy 2.x the old `interpolation=` kwarg is removed. Use `method=` instead. Valid values include `'linear'` (default), `'lower'`, `'higher'`, `'nearest'`, `'midpoint'`, `'inverted_cdf'`, `'averaged_inverted_cdf'`, plus several discontinuous-CDF methods.

```python
np.quantile(arr, 0.5, method='nearest')
```

## `np.median`

Same as `np.percentile(arr, 50)`. Also has `np.nanmedian` for NaN-skipping.

## Unique values

```python
np.unique(arr)                          # sorted unique values, flattened
np.unique(arr, axis=0)                  # unique rows

# With companions — preferred in 2.x as `unique_*` named functions
vals, counts = np.unique(arr, return_counts=True)
vals, idx = np.unique(arr, return_index=True)
vals, inv = np.unique(arr, return_inverse=True)
vals, idx, inv, counts = np.unique(
    arr, return_index=True, return_inverse=True, return_counts=True,
)
```

NumPy 2.0+ added Array-API-aligned aliases:
- `np.unique_values(arr)` — just the values
- `np.unique_counts(arr)` — namedtuple `(values, counts)`
- `np.unique_inverse(arr)` — namedtuple `(values, inverse_indices)`
- `np.unique_all(arr)` — namedtuple with values, indices, inverse_indices, counts

Use these when interop with Array-API code matters.

## Boolean / set-like reductions

```python
arr.any()           # is any element truthy?
arr.all()           # are all elements truthy?
np.any(arr, axis=0)
np.all(arr, axis=1)
```

Note: `np.alltrue` and `np.sometrue` aliases are **removed** in 2.x — use `np.all` and `np.any`.

## Counting

```python
np.count_nonzero(arr)             # count of nonzero entries (more reliable than sum on bool)
np.count_nonzero(arr, axis=0)
np.count_nonzero(arr > 5)         # how many entries pass the predicate
np.bincount(int_arr)              # histogram of nonneg ints
np.bincount(int_arr, weights=w)   # weighted
```

## Other useful reductions

```python
np.average(arr, weights=w, axis=0)     # weighted mean
np.histogram(arr, bins=20)             # counts, bin_edges (use np.histogram_bin_edges to precompute bins)
np.searchsorted(sorted_arr, vals)       # binary search; insertion indices
np.digitize(arr, bins)                  # which bin each value falls into
```

## Behavioral notes

- For integer arrays, `arr.mean()` upcasts to `float64` internally to avoid overflow
- `arr.sum(dtype=np.int64)` forces a wider accumulator — useful for very long `int32` arrays that would overflow
- `arr.prod()` on a long array of small floats underflows to 0 — use `np.log(arr).sum()` and `np.exp(...)` for log-space accumulation
- `argmin`/`argmax` return the **first** occurrence of a tie
- The removed `np.cumproduct` alias is now just `np.cumprod`; `np.product` is removed in favor of `np.prod`
