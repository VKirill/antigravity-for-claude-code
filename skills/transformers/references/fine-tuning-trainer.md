# Fine-tuning with `Trainer`

`Trainer` is HuggingFace's training-loop abstraction — handles data loading, AMP, distributed setup, checkpointing, evaluation, logging, and Hub push. `TrainingArguments` is the config dataclass.

## Minimal example — classification

```python
import numpy as np
from datasets import load_dataset
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    DataCollatorWithPadding, Trainer, TrainingArguments,
)
import evaluate

ckpt = "distilbert-base-uncased"
tok = AutoTokenizer.from_pretrained(ckpt)
model = AutoModelForSequenceClassification.from_pretrained(ckpt, num_labels=2)

ds = load_dataset("imdb")
def tokenize(b): return tok(b["text"], truncation=True, max_length=256)
ds = ds.map(tokenize, batched=True, remove_columns=["text"])

acc = evaluate.load("accuracy")
def compute_metrics(eval_pred):
    preds = np.argmax(eval_pred.predictions, axis=-1)
    return acc.compute(predictions=preds, references=eval_pred.label_ids)

args = TrainingArguments(
    output_dir="imdb-distilbert",
    learning_rate=2e-5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=32,
    num_train_epochs=3,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    bf16=True,
    logging_steps=50,
    push_to_hub=False,
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=ds["train"],
    eval_dataset=ds["test"],
    processing_class=tok,                 # v5 keyword; replaces deprecated tokenizer=
    data_collator=DataCollatorWithPadding(tok),
    compute_metrics=compute_metrics,
)

trainer.train()
trainer.save_model("imdb-distilbert/final")
```

## `TrainingArguments` — common knobs

### Required-ish
| Kwarg | Notes |
|---|---|
| `output_dir` | where checkpoints + logs go |
| `per_device_train_batch_size` | per-GPU batch; effective batch = this × num_gpus × `gradient_accumulation_steps` |
| `learning_rate` | typical: 2e-5 (BERT cls), 1e-4 (LoRA), 1e-5 to 5e-5 (full LM FT) |
| `num_train_epochs` | float OK (0.5, 1.5) |

### Eval / save
| Kwarg | Values |
|---|---|
| `eval_strategy` | `"no"`, `"steps"`, `"epoch"` — **v5 keyword; was `evaluation_strategy` in v4** |
| `eval_steps` | int when `eval_strategy="steps"` |
| `save_strategy` | `"no"`, `"steps"`, `"epoch"` |
| `save_steps`, `save_total_limit` | rotation |
| `load_best_model_at_end` | reload best checkpoint at end of training |
| `metric_for_best_model` | column name from `compute_metrics` output |
| `greater_is_better` | inferred for known metrics, set explicitly otherwise |

### Throughput / memory
| Kwarg | Effect |
|---|---|
| `gradient_accumulation_steps` | trade time for memory |
| `gradient_checkpointing=True` | re-compute activations in backward; ~30% slower, big memory save |
| `bf16=True` | use bf16 mixed precision (Ampere+/Hopper) |
| `fp16=True` | use fp16 mixed precision (older GPUs); needs scaler |
| `dataloader_num_workers` | 4–8 typical |
| `dataloader_pin_memory=True` | enabled by default |
| `tf32=True` | enable TF32 on Ampere matmul (small speedup, fp32 envelope) |

### LR schedule
| Kwarg | Values |
|---|---|
| `lr_scheduler_type` | `"linear"`, `"cosine"`, `"constant"`, `"polynomial"`, `"cosine_with_restarts"` |
| `warmup_steps` or `warmup_ratio` | warmup before decay |
| `weight_decay` | typical 0.01 |
| `max_grad_norm` | clipping; 1.0 default |

### Logging
| Kwarg | Values |
|---|---|
| `logging_steps` | int |
| `report_to` | `"wandb"`, `"tensorboard"`, `"trackio"`, `"mlflow"`, `"none"` |
| `run_name` | label for the run |

### Hub
| Kwarg | Notes |
|---|---|
| `push_to_hub=True` | upload model + tokenizer to the Hub |
| `hub_model_id` | repo name; defaults to output_dir basename |
| `hub_strategy` | `"every_save"`, `"end"`, `"checkpoint"`, `"all_checkpoints"` |
| `hub_token` | usually picked up from `HF_TOKEN` |

### Distributed
| Kwarg | Notes |
|---|---|
| `fsdp` | `"full_shard"`, `"shard_grad_op"`, `"full_shard auto_wrap"`, `""` |
| `fsdp_config` | path to JSON / dict |
| `deepspeed` | path to DeepSpeed JSON config |

## Causal LM fine-tune (full SFT)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments
from transformers import DataCollatorForLanguageModeling

ckpt = "Qwen/Qwen2.5-0.5B"
tok = AutoTokenizer.from_pretrained(ckpt)
tok.pad_token = tok.eos_token  # if missing
model = AutoModelForCausalLM.from_pretrained(ckpt, dtype=torch.bfloat16)

def tokenize(b):
    return tok(b["text"], truncation=True, max_length=1024)

train_ds = load_dataset("imdb", split="train").map(tokenize, batched=True, remove_columns=["text", "label"])

args = TrainingArguments(
    output_dir="qwen-imdb-sft",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,         # effective batch 32
    learning_rate=2e-5,
    num_train_epochs=1,
    bf16=True,
    gradient_checkpointing=True,
    logging_steps=20,
    save_strategy="steps",
    save_steps=500,
    eval_strategy="no",
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=train_ds,
    processing_class=tok,
    data_collator=DataCollatorForLanguageModeling(tok, mlm=False),
)
trainer.train()
```

## Launching distributed runs

```bash
# Single-node, multi-GPU
accelerate launch --num_processes=4 train.py
# or
torchrun --nproc_per_node=4 train.py

# FSDP (shard params + grads + optim states)
accelerate launch --fsdp_full_shard=true --fsdp_auto_wrap_policy=TRANSFORMER_BASED_WRAP train.py
```

`accelerate config` produces a YAML; subsequent `accelerate launch` reads it without flags.

## DeepSpeed

```json
// ds_zero3.json
{
  "bf16": {"enabled": true},
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": {"device": "cpu", "pin_memory": true},
    "offload_param":     {"device": "cpu", "pin_memory": true}
  },
  "gradient_accumulation_steps": "auto",
  "train_batch_size": "auto",
  "train_micro_batch_size_per_gpu": "auto"
}
```

```python
args = TrainingArguments(..., deepspeed="ds_zero3.json")
```

## Resuming

```python
trainer.train(resume_from_checkpoint=True)            # latest in output_dir
trainer.train(resume_from_checkpoint="path/to/ckpt")  # specific
```

## Common Trainer gotchas

- Forgetting `processing_class=tok` → Trainer can't tokenize on the fly during eval. The legacy `tokenizer=tok` keyword is deprecated; `processing_class=` works for tokenizers, image processors, audio processors, and full `AutoProcessor` objects.
- `evaluation_strategy=` → typo / v4 carry-over; the v5 keyword is `eval_strategy=`
- `load_best_model_at_end=True` without matching `eval_strategy` and `save_strategy` → error
- `bf16=True` on a Volta / T4 GPU → not supported; use `fp16=True` instead
- Mixing manual `.to("cuda")` with Trainer → Trainer manages devices, don't pre-move
- Forgetting `pad_token` on causal LMs → DataCollator errors at first batch
