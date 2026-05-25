# torch.compile

`torch.compile` is a JIT compiler that traces a model with TorchDynamo and lowers to a backend (default: Inductor). Typical speedup: 1.3x–2x for training, often more for inference.

## Minimum usage

```python
import torch

model = MyModel().to(device)
model = torch.compile(model)            # in-place wrapper, returns wrapper
```

Call `model(x)` as usual. The first call triggers compilation (slow); subsequent calls hit the cache.

## Function form

```python
@torch.compile
def step(x, y):
    logits = model(x)
    return loss_fn(logits, y)
```

Decorate top-level functions, not anything you'll later patch / mock.

## Modes

```python
model = torch.compile(model, mode="default")           # general-purpose
model = torch.compile(model, mode="reduce-overhead")   # smaller models, stable shapes
model = torch.compile(model, mode="max-autotune")      # exhaustive autotuning, slow first run
```

Trade-offs:

- `default` — minimal compile time, decent speedup
- `reduce-overhead` — uses CUDA graphs; great for small batch / stable shapes; bigger memory footprint
- `max-autotune` — finds the fastest kernel via autotuning; first compile takes minutes; worth it for long training jobs

## Dynamic shapes

By default, the compiler specializes on the input shape it saw first. If the next batch is a different size, it recompiles (slow). To handle shape variation:

```python
model = torch.compile(model, dynamic=True)
```

The compiler emits a single graph parameterized over the variable dims. Use this when:

- The last batch in an epoch is a different size (drop_last not set)
- Variable sequence lengths in NLP
- Variable image sizes

If shapes don't vary, leave `dynamic=False` (default) — specialized graphs are faster.

## Full graph mode

`fullgraph=True` raises on any graph break (point where TorchDynamo bails to eager):

```python
model = torch.compile(model, fullgraph=True)
```

Use during development to find and fix graph breaks. In production, you can leave `fullgraph=False` — TorchDynamo will run unsupported parts in eager, which is correct just slower.

## Common graph breaks

- Calling `.item()`, `.tolist()`, `.numpy()`, `.cpu()` inside the function
- Python control flow that depends on tensor values (`if loss.item() > 0:`)
- Calling external code TorchDynamo can't trace (custom autograd, certain Python C extensions)
- In-place mutations of dict/list at module level
- Reassigning module attributes inside forward

Fix patterns:

```python
# ❌ Graph break
if loss.item() > threshold:
    do_thing()

# ✅ Use torch.cond or move the check outside compile
loss_val = loss.detach()  # break here is OK, outside compile
if loss_val.item() > threshold:
    do_thing()
```

## Debugging recompilations

Set the env var to log recompilation reasons:

```bash
TORCH_LOGS=recompiles python train.py
```

Most common cause: shape changes — fix with `dynamic=True`. Less common: Python state change (e.g., a boolean flag flipped inside the model).

## torch.compile with DDP / FSDP

Both work. Compile the model **before** wrapping with DDP:

```python
model = MyModel().to(device)
model = torch.compile(model)
model = torch.nn.parallel.DistributedDataParallel(model, device_ids=[local_rank])
```

For FSDP2 (`fully_shard`), the official guidance is to apply `fully_shard` first, then `torch.compile`. Check current docs as the recommended order has shifted between versions.

## Inductor cache

Compiled artifacts are cached under `~/.cache/torch/inductor`. Set `TORCHINDUCTOR_CACHE_DIR` to override. To clear:

```bash
rm -rf ~/.cache/torch/inductor
```

## What does NOT need recompilation

The cache key includes (function bytecode, input shapes, dtypes, devices). Same shape next call → cache hit. Different shape with `dynamic=False` → recompile.

## When NOT to use torch.compile

- Very short training runs (compile overhead > runtime)
- Heavy use of Python control flow inside forward (graph breaks everywhere)
- You're already getting kernel-level perf via TorchScript / custom CUDA — `torch.compile` may not help much
- Debug runs — the traceback is harder to read

## Inference compile

```python
model.eval()
model = torch.compile(model, mode="reduce-overhead")

with torch.inference_mode():
    out = model(x)
```

For deployment, prefer `torch.export` (`torch.export.export(model, args)`) → ahead-of-time IR → portable artifact. `torch.compile` is JIT; useful when the Python process stays alive.

## Profiling compiled code

```python
import torch.profiler as profiler

with profiler.profile(
    activities=[profiler.ProfilerActivity.CPU, profiler.ProfilerActivity.CUDA],
    record_shapes=True,
) as prof:
    for _ in range(5):
        out = model(x)
        out.sum().backward()

print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))
prof.export_chrome_trace("trace.json")    # view in chrome://tracing
```

## Falling back to eager mode at runtime

If compile is causing problems and you want to disable globally:

```python
import torch._dynamo
torch._dynamo.reset()                     # clear cache
torch._dynamo.config.suppress_errors = True   # fall back on errors instead of raising

# Or globally disable:
torch._dynamo.disable()
```

`disable()` returns the model to eager. Useful for diff comparing compile vs eager outputs.
