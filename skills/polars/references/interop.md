# Interop

Polars sits on Arrow, which makes most conversions zero-copy or near-zero-copy.

## pandas

```python
df_pd = df.to_pandas()              # uses pyarrow extension dtypes by default
df_pd = df.to_pandas(use_pyarrow_extension_array=False)  # NumPy-backed (slower, larger memory)

df = pl.from_pandas(df_pd)
df = pl.from_pandas(df_pd, schema_overrides={"id": pl.Int64})
```

Notes:
- pandas `object` columns of mixed types convert to `pl.Object` (the only column type that defeats Polars parallelism).
- pandas `category` → `pl.Categorical`.
- pandas tz-naive `datetime64[ns]` → naive `pl.Datetime("ns")`.

## Apache Arrow

```python
tbl = df.to_arrow()                 # pyarrow.Table — zero-copy
df  = pl.from_arrow(tbl)            # also zero-copy when possible
```

Use Arrow as the **lingua franca** between Polars, DuckDB, pandas (PyArrow-backed), Datafusion, Apache Iceberg, Delta Lake.

## NumPy

```python
arr = df.to_numpy()                 # whole frame → 2D NumPy array
arr = df["x"].to_numpy()            # Series → 1D
df  = pl.DataFrame({"x": np.arange(1000)})

# Zero-copy when types are NumPy-native (Int*, Float*, Boolean)
arr = df["x"].to_numpy(zero_copy_only=True)
```

`to_numpy(zero_copy_only=True)` raises if a copy would be required — useful as a guard in performance-critical paths.

## DuckDB

DuckDB reads and writes Polars natively:

```python
import duckdb

# DuckDB → Polars
df = duckdb.sql("SELECT * FROM read_parquet('events.parquet') WHERE ts >= '2026-01-01'").pl()

# Polars → DuckDB
duckdb.sql("SELECT symbol, sum(qty) FROM df GROUP BY symbol").show()
# (df is a Polars frame in the Python namespace; DuckDB sees it via Arrow)
```

When SQL is more natural than the expression API (heavy aggregations, complex joins), reach for DuckDB and round-trip through Arrow.

## PyTorch

For ML training, the typical path is Polars → Arrow → NumPy → torch.Tensor:

```python
import torch

X = torch.from_numpy(df.select(features).to_numpy())
y = torch.from_numpy(df["target"].to_numpy())
```

For batched dataloading from a large Parquet dataset:

```python
from torch.utils.data import IterableDataset

class PolarsParquetDataset(IterableDataset):
    def __init__(self, path, features, target, batch_size=1024):
        self.path = path
        self.features = features
        self.target = target
        self.batch_size = batch_size

    def __iter__(self):
        lf = pl.scan_parquet(self.path)
        for batch in lf.collect(engine="streaming").iter_slices(self.batch_size):
            X = torch.from_numpy(batch.select(self.features).to_numpy())
            y = torch.from_numpy(batch[self.target].to_numpy())
            yield X, y
```

For Arrow-native loaders (Lance, NVIDIA DALI), pass `df.to_arrow()` and let them slice.

## scikit-learn

scikit-learn (1.4+) accepts Polars frames directly when `set_output(transform="polars")` is configured on a transformer. For older code, convert at the boundary:

```python
X = df.select(features).to_pandas()    # sklearn happiest with pandas
y = df["target"].to_pandas()
```

## Numba / Cython

Numba and Cython don't see Polars frames. Drop to NumPy at the boundary:

```python
@numba.njit
def custom_metric(x: np.ndarray, y: np.ndarray) -> float:
    ...

result = custom_metric(df["x"].to_numpy(), df["y"].to_numpy())
```

If the function is amenable to vectorization in Polars expressions, prefer that — it parallelizes for free.

## Polars Series ↔ Python list

```python
xs = df["x"].to_list()
s  = pl.Series("x", [1, 2, 3])
```

## Polars LazyFrame ↔ Arrow Dataset

For very large multi-file datasets, pyarrow's `Dataset` API + Polars `scan_pyarrow_dataset` lets you push filters into pyarrow:

```python
import pyarrow.dataset as ds

dataset = ds.dataset("events/", format="parquet", partitioning="hive")
lf = pl.scan_pyarrow_dataset(dataset)
out = lf.filter(pl.col("year") == 2026).collect()
```

## Polars ↔ Polars Rust / Polars JS / SQL

The same Arrow/IPC files round-trip across the Polars language bindings without conversion. For SQL-style consumption inside Python:

```python
ctx = pl.SQLContext(trades=df, quotes=df2)
ctx.execute("SELECT symbol, AVG(price) FROM trades GROUP BY symbol").collect()
```

## Performance notes

- `to_pandas()` with `use_pyarrow_extension_array=True` (default) is fastest and preserves nullable types.
- `to_numpy()` copies for non-contiguous columns; use `zero_copy_only=True` to enforce.
- For large round-trips, prefer Arrow (`to_arrow` / `from_arrow`) over NumPy — Arrow preserves type information and is the actual underlying memory layout.
