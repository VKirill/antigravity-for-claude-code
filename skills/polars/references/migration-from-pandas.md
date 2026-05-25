# Migration from pandas

The densest single reference in this skill. If you read one file, read this one.

## Core mindset shift

| pandas | polars |
|---|---|
| Imperative: build a frame, mutate in place / reassign | Declarative: build a plan, `.collect()` once |
| Index is central (`.loc`, `.iloc`, `.set_index`) | No index — just columns |
| NaN is the missing sentinel (or `pd.NA` for nullable dtypes) | `Null` is the missing sentinel; NaN is only for float overflow |
| `apply` is the escape hatch | Expressions cover ~everything |
| Method per column | One `with_columns([...])` for many |
| `groupby + apply` for per-group logic | `pl.col(x).agg.over("k")` window expression |

## Imports

```python
# pandas
import pandas as pd
df = pd.read_csv("file.csv")

# polars
import polars as pl
df = pl.read_csv("file.csv")          # eager
lf = pl.scan_csv("file.csv")          # lazy
```

## IO

| pandas | polars (eager) | polars (lazy) |
|---|---|---|
| `pd.read_csv("f.csv")` | `pl.read_csv("f.csv")` | `pl.scan_csv("f.csv")` |
| `pd.read_parquet("f.parquet")` | `pl.read_parquet("f.parquet")` | `pl.scan_parquet("f.parquet")` |
| `pd.read_json("f.json")` | `pl.read_json("f.json")` | — |
| `pd.read_ndjson("f.ndjson")` | `pl.read_ndjson("f.ndjson")` | `pl.scan_ndjson("f.ndjson")` |
| `pd.read_sql(q, conn)` | `pl.read_database(q, conn)` | — (push to SQL server-side) |
| `df.to_csv("f.csv", index=False)` | `df.write_csv("f.csv")` | `lf.sink_csv("f.csv")` |
| `df.to_parquet("f.parquet")` | `df.write_parquet("f.parquet")` | `lf.sink_parquet("f.parquet")` |
| `df.to_sql("t", conn, if_exists="replace")` | `df.write_database("t", conn, if_table_exists="replace")` | — |

## Selection and filtering

```python
# pandas
df[df["qty"] > 0][["ts", "price"]]
df.loc[df["qty"] > 0, ["ts", "price"]]

# polars
df.filter(pl.col("qty") > 0).select("ts", "price")
```

```python
# pandas — by position
df.iloc[0:10]
df.iloc[:, 0:3]

# polars — by position
df.head(10)
df.select(df.columns[:3])
```

## Column creation / mutation

```python
# pandas
df["notional"] = df["price"] * df["qty"]
df = df.assign(notional=df["price"] * df["qty"])

# polars — batched
df = df.with_columns(
    (pl.col("price") * pl.col("qty")).alias("notional"),
    pl.col("ts").dt.year().alias("year"),
)
```

`with_columns([...])` with many expressions is **one** physical plan node — much cheaper than chaining many single-column updates.

## Conditional assignment

```python
# pandas
df["side"] = np.where(df["qty"] > 0, "buy", "sell")

# polars
df = df.with_columns(
    pl.when(pl.col("qty") > 0).then(pl.lit("buy")).otherwise(pl.lit("sell")).alias("side")
)
```

## `apply` → expression

```python
# pandas (slow)
df["upper"] = df["name"].apply(lambda s: s.upper())
df["price_x2"] = df["price"].apply(lambda x: x * 2)

# polars — never .apply / map_elements for this
df = df.with_columns(
    pl.col("name").str.to_uppercase(),
    (pl.col("price") * 2).alias("price_x2"),
)
```

If — and only if — no native expression covers the case:

```python
# Last resort
df.with_columns(pl.col("payload").map_elements(parse_payload, return_dtype=pl.Struct({...})))
```

## groupby and aggregations

```python
# pandas
df.groupby("symbol", as_index=False).agg(
    mean_price=("price", "mean"),
    total_qty=("qty", "sum"),
    n=("ts", "count"),
)

# polars
df.group_by("symbol").agg(
    pl.col("price").mean().alias("mean_price"),
    pl.col("qty").sum().alias("total_qty"),
    pl.col("ts").count().alias("n"),     # .count() ignores nulls — use .len() to include
)
```

## `groupby().apply` → window expression

```python
# pandas
df["share"] = df.groupby("region")["revenue"].transform(lambda s: s / s.sum())

# polars — no transform/apply
df = df.with_columns(
    (pl.col("revenue") / pl.col("revenue").sum().over("region")).alias("share")
)
```

```python
# pandas — running total per group
df["running"] = df.sort_values(["user_id", "ts"]).groupby("user_id")["amount"].cumsum()

# polars
df = df.with_columns(
    pl.col("amount").cum_sum().over("user_id", order_by="ts").alias("running")
)
```

## Rolling / window

```python
# pandas
df["ma10"] = df.groupby("symbol")["price"].rolling(10).mean().reset_index(level=0, drop=True)

# polars
df = df.with_columns(
    pl.col("price").rolling_mean(window_size=10).over("symbol", order_by="ts").alias("ma10")
)
```

For time-anchored rolling:

```python
# pandas
df = df.set_index("ts").groupby("symbol")["price"].rolling("5min").mean().reset_index()

# polars
df = df.with_columns(
    pl.col("price").rolling_mean_by("ts", window_size="5m").over("symbol").alias("ma5m")
)
```

## Merge / join

```python
# pandas
out = pd.merge(left, right, on="symbol", how="left", validate="m:1")

# polars
out = left.join(right, on="symbol", how="left", validate="m:1")
```

```python
# pandas as-of
out = pd.merge_asof(trades.sort_values("ts"), quotes.sort_values("ts"),
                    on="ts", by="symbol", tolerance=pd.Timedelta("1min"))

# polars
out = trades.sort("ts").join_asof(
    quotes.sort("ts"), on="ts", by="symbol", tolerance="1m"
)
```

## Reshape

```python
# pandas
long  = df.melt(id_vars=["id"], value_vars=["a", "b"], var_name="metric", value_name="v")
wide  = long.pivot(index="id", columns="metric", values="v").reset_index()

# polars
long  = df.unpivot(index="id", on=["a", "b"], variable_name="metric", value_name="v")
wide  = long.pivot(values="v", index="id", on="metric")
```

(`melt` is still accepted as alias for `unpivot` in 1.x.)

## Sorting

```python
# pandas
df.sort_values(["country", "amount"], ascending=[True, False])

# polars
df.sort("country", "amount", descending=[False, True])
```

## Drop / fill missing

```python
# pandas
df.dropna(subset=["amount"])
df.fillna({"amount": 0})

# polars
df.drop_nulls(subset=["amount"])
df.fill_null({"amount": 0})
# or per-column
df.with_columns(pl.col("amount").fill_null(0))
```

## Datetime

```python
# pandas
df["ts"].dt.year, df["ts"].dt.floor("h")

# polars
pl.col("ts").dt.year(), pl.col("ts").dt.truncate("1h")
```

Note `truncate` (Polars) vs `floor` (pandas) — same idea, different name.

## String

```python
# pandas
df["name"].str.lower(), df["name"].str.contains("foo", case=False)

# polars
pl.col("name").str.to_lowercase(), pl.col("name").str.contains("(?i)foo")
```

Polars `.str.contains` is regex by default — pass `literal=True` for plain substring.

## Dtypes

| pandas | polars |
|---|---|
| `int64`, `Int64` (nullable) | `pl.Int64` |
| `float64` | `pl.Float64` |
| `object` (Arrow `string` in 3.0) | `pl.String` |
| `bool`, `boolean` | `pl.Boolean` |
| `datetime64[ns]` / `[us]` / `[ms]` | `pl.Datetime("ns"/"us"/"ms")` |
| `datetime64[ns, tz]` | `pl.Datetime("ns", time_zone="UTC")` |
| `timedelta64` | `pl.Duration` |
| `category` | `pl.Categorical` / `pl.Enum` |

## NaN vs Null — the trap

```python
# pandas — NaN and None coalesce silently in object cols
s = pd.Series([1.0, np.nan, None])
s.isna()   # all three caught

# polars — Null and NaN are distinct in Float
s = pl.Series([1.0, None, float("nan")])
s.is_null()  # [False, True, False]
s.is_nan()   # [False, False, True]   (Null is NOT NaN)
```

To unify NaN → Null:
```python
df.with_columns(pl.col(pl.Float64).fill_nan(None))
```

## Index — there is none

```python
# pandas
df = df.set_index("ts")
df.loc["2026-01-01"]

# polars — keep ts as a column, use filter
df.filter(pl.col("ts") == datetime.date(2026, 1, 1))
```

For "index-like" semantics, just sort: `df.sort("ts")`. Polars has no concept of a sorted-index optimization separate from sort metadata, which the planner tracks automatically.

## Iteration

```python
# pandas (slow but tempting)
for _, row in df.iterrows():
    ...

# polars — don't.  Use expressions.  Or, if you really must:
for row in df.iter_rows(named=True):
    ...
```

## Copy semantics

| pandas | polars |
|---|---|
| Copy-on-Write (3.0 default) | Immutable by design — every method returns a new frame |
| `.loc[mask, col] = value` in place | Use `.with_columns(pl.when(mask).then(value).otherwise(pl.col(col)))` |

## Conversions

```python
df_pd = df.to_pandas()              # zero-copy where possible (pyarrow backend)
df    = pl.from_pandas(df_pd)
arr   = df.to_numpy()
tbl   = df.to_arrow()
df    = pl.from_arrow(tbl)
```

## Quick wins when migrating

1. Replace `read_csv` with `scan_csv` + `.collect()` first — instant pushdown wins.
2. Collapse multiple `df["x"] = ...` assignments into one `with_columns([...])`.
3. Replace `groupby().transform` and `groupby().apply` with `.over()`.
4. Replace `merge_asof` with `join_asof`.
5. Add `validate=` to every `join` — surfaces lurking many-to-many bugs.
6. Drop the index. Stop calling `.reset_index()`.

## Things pandas still does better

- Tiny data + scikit-learn / statsmodels — these libraries expect pandas DataFrames or NumPy arrays.
- Notebooks with `df.style.background_gradient(...)` — Polars HTML rendering is plainer.
- Stable, decade-old recipes in StackOverflow answers — pandas has unmatched corpus.
- Some niche stats (e.g., `df.corr()` with custom callable) — Polars has the basics but pandas is more flexible.
