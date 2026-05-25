# Eval Cases — Routing Tests

Positive prompts (the skill SHOULD load) and negative prompts (it should NOT load). Use these when auditing the description or rewriting it.

## Positive — should route to `pandas`

1. "Why does `df[mask]['col'] = x` not work in pandas 3.0?"
2. "How do I read a parquet file with predicate pushdown filters?"
3. "Convert all object columns in this DataFrame to PyArrow-backed strings."
4. "Group by region and product, get sum of amount and count of unique users with explicit column names."
5. "Merge orders and users with a left-anti join — show me orders without a matching user."
6. "Resample this DataFrame to 1-hour buckets and compute mean per region."
7. "I'm getting `ValueError: cannot compare tz-naive and tz-aware datetime`."
8. "What's the right way to fill missing values per group?"
9. "Compute a 7-day rolling mean of revenue grouped by user."
10. "Should I use Categorical for this column with 5 unique values across 10M rows?"
11. "How do I do an asof-merge for trades and quotes by timestamp?"
12. "Stack two DataFrames vertically with hierarchical labels from a dict."
13. "Why is my `apply(axis=1)` so slow on 5M rows?"
14. "Migrating a pandas 2.x ETL to 3.0 — what breaks?"
15. "Use `pd.col()` instead of lambda in a chained `assign()`."
16. "How do I select rows in a sorted MultiIndex with IndexSlice?"
17. "DataFrame `set_index` then `sort_index` for time-aware rolling."
18. "Read CSV with explicit dtypes for production reproducibility."
19. "What's the diff between `Int64` and `int64` in pandas?"
20. "Pivot table: revenue by region (rows) and product (columns), fill_value 0."

## Negative — should NOT route to `pandas`

These should route elsewhere or to nothing:

1. "How do I use polars LazyFrame to filter > 10 GB CSV?" → **polars**
2. "Train a RandomForest on this DataFrame." → **scikit-learn**
3. "GROUP BY region in PostgreSQL with HAVING." → **postgresql**
4. "Build a DataLoader for a 1M-row dataset for PyTorch training." → **pytorch** (downstream of pandas, but the question is about PyTorch)
5. "Run k-means clustering on a numpy array." → **scikit-learn** (or numpy)
6. "How do I set up a venv with uv?" → **python**
7. "Use pyarrow.parquet.ParquetWriter directly for streaming writes." → not pandas (raw PyArrow)
8. "Bash one-liner to count rows in a CSV." → not pandas (use `wc -l`)
9. "Read Excel from S3 in a Cloudflare Worker." → not pandas (pandas is CPU+local)
10. "GPU-accelerated pivot table with cuDF / RAPIDS." → cuda-python or RAPIDS (not pandas)

## Edge cases

- "Pandas vs polars for 500 MB CSV" → either, lead with the question of memory/usage pattern. Pandas skill is fine as the entry point.
- "PyArrow Table to pandas DataFrame" → pandas (3.0 has `from_arrow`)
- "How to make a pandas pipeline faster" → pandas (with possible follow-up to polars)
- "DataFrame with 50 columns, half are categorical" → pandas (memory tuning is a pandas topic)

## How to run

These are not automated — they're for human / Claude review. When auditing the description, take a sample of 5 positive + 2 negative and check whether the description has all the trigger terms needed for each positive and any SKIP guidance covering the negatives.

A good description routes ≥18/20 positives correctly and ≥8/10 negatives correctly.
