# `datasets` — data loading and preprocessing

The `datasets` library (separate `pip install datasets`) is HuggingFace's data pipeline — backed by Apache Arrow, memory-mapped, streaming-capable.

## Loading

```python
from datasets import load_dataset

# From the Hub
ds = load_dataset("imdb")
print(ds)
# DatasetDict({
#   train: Dataset({features: ['text', 'label'], num_rows: 25000})
#   test:  Dataset({...})
# })

# Specific split
train = load_dataset("imdb", split="train")
half = load_dataset("imdb", split="train[:50%]")

# Local files
ds = load_dataset("csv", data_files={"train": "train.csv", "test": "test.csv"})
ds = load_dataset("json", data_files="data.jsonl")
ds = load_dataset("parquet", data_files="data.parquet")
ds = load_dataset("imagefolder", data_dir="./images")   # one subdir per class
ds = load_dataset("audiofolder", data_dir="./audio")
```

## Inspecting

```python
ds["train"][0]                  # first example
ds["train"][:5]                 # first 5 (returns columns dict)
ds["train"].features            # schema
ds["train"].column_names
len(ds["train"])
```

## `map` — the main transformation

```python
def tokenize(batch):
    return tok(batch["text"], truncation=True, max_length=256)

# batched is ~100x faster than per-example
tokenized = ds.map(
    tokenize,
    batched=True,
    batch_size=1000,
    remove_columns=["text"],         # drop raw text after tokenization
    num_proc=4,                       # parallel CPU workers (process pool)
    load_from_cache_file=True,        # default; reuse if same fn signature
)
```

Caching: the result is cached on disk keyed by the function bytes and input dataset hash. Modifying the function busts the cache automatically.

## `filter`, `select`, `shuffle`

```python
short = ds["train"].filter(lambda x: len(x["text"]) < 500)
subset = ds["train"].select(range(1000))
shuffled = ds["train"].shuffle(seed=42)
```

## Splitting

```python
parts = ds["train"].train_test_split(test_size=0.1, seed=42)
# DatasetDict({train: ..., test: ...})
```

## Setting format

For consumption with PyTorch / Trainer:

```python
tokenized.set_format("torch", columns=["input_ids", "attention_mask", "label"])
# Now indexing returns torch tensors
```

`set_format("numpy")`, `set_format("pandas")`, `set_format("polars")` also work.

## Streaming — datasets larger than disk

```python
ds = load_dataset("c4", "en", split="train", streaming=True)
# IterableDataset — can't index, can't len
for example in ds.take(5):
    print(example["text"][:80])

# .map / .filter / .shuffle (buffered) all work on streaming
ds = ds.map(tokenize).shuffle(seed=42, buffer_size=10_000)
```

Use streaming for: web-scale corpora, Common Crawl, anything not fitting on disk. Trade-off: no random access, slower per-example.

## Push to Hub

```python
# Public
ds.push_to_hub("yourname/my-dataset")

# Private
ds.push_to_hub("yourname/my-dataset", private=True)

# Specific split / config
ds["train"].push_to_hub("yourname/my-dataset", config_name="default", split="train")
```

Requires `hf auth login` or `HF_TOKEN`.

## Audio / image columns

```python
from datasets import load_dataset, Audio, Image

ds = load_dataset("audiofolder", data_dir="./audio")
ds = ds.cast_column("audio", Audio(sampling_rate=16000))   # auto-resamples on access
example = ds["train"][0]
example["audio"]
# {'array': np.ndarray, 'sampling_rate': 16000, 'path': '...'}

ds = ds.cast_column("image", Image(decode=True))   # returns PIL.Image
```

## Concatenating / interleaving

```python
from datasets import concatenate_datasets, interleave_datasets

combined = concatenate_datasets([ds_a, ds_b])             # stack rows
mixed = interleave_datasets([ds_a, ds_b], probabilities=[0.7, 0.3], seed=42)
```

## Working with Trainer

`Trainer` accepts a `Dataset` or `DatasetDict` directly. The columns the model expects (e.g., `input_ids`, `attention_mask`, `labels`) must exist; any extras are auto-removed unless `remove_unused_columns=False` (needed for vision/audio raw data).

```python
trainer = Trainer(
    model=model,
    args=args,
    train_dataset=tokenized["train"],
    eval_dataset=tokenized["test"],
    processing_class=tok,
    data_collator=DataCollatorWithPadding(tok),
)
```

For multi-modal datasets (image / audio with raw arrays), set `remove_unused_columns=False` in `TrainingArguments`.

## Tips

- `batched=True` in `.map` is almost always faster — your tokenize function receives lists, not single strings
- `num_proc=N` for CPU-bound preprocessing (tokenization, image resizing); skip for GPU steps
- `.with_format("torch")` is non-destructive (returns a view); `.set_format` mutates in place
- Cached files live under `HF_DATASETS_CACHE` (default `~/.cache/huggingface/datasets`)
- `Dataset.from_dict({...})` / `Dataset.from_pandas(df)` / `Dataset.from_generator(gen)` for ad-hoc data
