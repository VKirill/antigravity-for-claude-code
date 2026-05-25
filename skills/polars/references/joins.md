# Joins

## Basic syntax

```python
out = trades.join(
    quotes,
    on="symbol",            # or left_on=/right_on= for different names
    how="inner",            # 'inner' | 'left' | 'right' | 'full' | 'cross' | 'semi' | 'anti'
    suffix="_q",            # suffix for overlapping right-side columns
    validate="m:1",         # optional cardinality check
    coalesce=None,          # whether to coalesce join keys after FULL
)
```

## `how=` modes

| `how` | Result |
|---|---|
| `inner` | Rows with key present in both |
| `left` | All left rows; right cols are Null where unmatched |
| `right` | All right rows; left cols are Null where unmatched |
| `full` | All rows from both; non-matching side is Null |
| `cross` | Cartesian product; no `on=` |
| `semi` | Left rows whose key is in right (no right cols) |
| `anti` | Left rows whose key is NOT in right |

`semi` / `anti` are first-class — you don't need to build them manually.

## Multi-key joins

```python
trades.join(positions, on=["account_id", "symbol"], how="left")
trades.join(positions, left_on=["acct", "sym"], right_on=["account_id", "symbol"])
```

## `validate=` — assert cardinality

| Value | Asserts |
|---|---|
| `"1:1"` | One-to-one — both sides unique on key |
| `"1:m"` | Left unique, right may repeat |
| `"m:1"` | Right unique, left may repeat |
| `"m:m"` | Default — no assertion |

`validate="m:1"` is the most useful — it catches the classic "I thought this was a dimension table" bug.

## `coalesce=` — what happens to join keys

By default Polars keeps both `key` and `key_right` after a join when `left_on`/`right_on` differ. `coalesce=True` collapses them into a single column. For `how="full"`, the join key from the unmatched side is Null on those rows.

## `join_asof` — time-aligned merges

The single biggest reason finance / IoT teams move to Polars. Aligns two sorted frames by nearest preceding (or following) key — no Cartesian explosion, no `merge_asof` quirks.

```python
out = trades.sort("ts").join_asof(
    quotes.sort("ts"),
    on="ts",
    by="symbol",              # within-group asof
    strategy="backward",      # 'backward' | 'forward' | 'nearest'
    tolerance="1m",           # max gap; None = unlimited
    suffix="_q",
)
```

Requirements:
- Both frames sorted on the `on=` key.
- `by=` (optional) partitions the asof — typically the entity (`symbol`, `device_id`).
- For numeric keys, `tolerance` is a number. For temporal keys, a duration string.

## `cross` join

```python
parameters.join(grid, how="cross")
# No `on=` allowed. Materializes |L| * |R| rows — explosive on large frames.
```

Useful for parameter grids and small lookup expansions.

## Lazy joins and the planner

Both sides can be `LazyFrame`. The planner reorders join branches (it estimates which side is smaller) and chooses **hash join** by default. For two pre-sorted frames on the join key, it can pick **sort-merge join** which is memory-friendlier — observable via `.explain()`.

```python
(
    pl.scan_parquet("trades.parquet")
      .join(pl.scan_parquet("ref.parquet"), on="symbol", how="left")
      .filter(pl.col("price") > 0)
      .collect()
)
```

Filters are pushed down across joins where safe.

## Common pitfalls

- **`how="outer"`** — was renamed to **`how="full"`** in 1.x. Use `full`.
- **Suffix collisions** — Polars 1.x raises if both sides have overlapping non-key columns and you don't pass a unique `suffix=`.
- **Null keys** — by default Polars **does not** match Null to Null in `inner`/`left`/`right`. Pass `nulls_equal=True` if you need pandas-style behavior.
- **Unsorted `join_asof`** — silently produces wrong results. Always `.sort(on_key)` both sides first.
- **`join_asof` with `by=`** — both frames must be sorted **within** each `by` group. `.sort("symbol", "ts")` is the safe pattern.
- **Memory explosion** — accidentally doing an `m:m` join on a key that should be `m:1`. Pass `validate="m:1"` to fail fast.
