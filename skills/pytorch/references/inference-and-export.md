# Inference and export

## Plain inference

```python
import torch

model = MyModel().to(device)
model.load_state_dict(torch.load("ckpt.pt", map_location=device, weights_only=True))
model.eval()

with torch.inference_mode():
    out = model(x)
```

Always:

- `model.eval()` — disables dropout, switches BatchNorm to running stats
- `torch.inference_mode()` — strictly faster than `torch.no_grad()`; tensors produced inside cannot later be used in autograd
- Load with `map_location=device` so a CPU-trained checkpoint loads on GPU and vice versa
- `weights_only=True` for untrusted checkpoints (default in recent versions)

## inference_mode vs no_grad

| | `torch.no_grad()` | `torch.inference_mode()` |
|---|---|---|
| Grad tracking | off | off |
| Version counter | on | off |
| Outputs usable in autograd later | yes | no |
| Speed | normal | faster |

Use `inference_mode` for pure inference paths. Use `no_grad` if you produce tensors that you later attach to an autograd graph (e.g., a frozen encoder feeding a trainable head — though the better pattern is to just leave `requires_grad=False` on the encoder).

## Batched inference at speed

```python
model.eval()
model = torch.compile(model, mode="reduce-overhead")

with torch.inference_mode(), torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16):
    for x in loader:
        x = x.to(device, non_blocking=True)
        out = model(x)
```

Combine: compile + bf16 autocast + `inference_mode` is a strong default for GPU inference.

## ONNX export

ONNX is a portable graph format. Two paths in modern PyTorch.

**Modern (dynamo-based):**

```python
import torch

model.eval()
sample = torch.randn(1, 3, 224, 224, device="cuda")

# torch.onnx.export with dynamo=True (preferred in 2.x)
onnx_program = torch.onnx.export(
    model,
    (sample,),
    "model.onnx",
    dynamo=True,
    input_names=["input"],
    output_names=["logits"],
    dynamic_shapes={"input": {0: torch.export.Dim("batch")}},
)
```

**Legacy (TorchScript trace-based):**

```python
torch.onnx.export(
    model,
    (sample,),
    "model.onnx",
    input_names=["input"],
    output_names=["logits"],
    dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=17,
)
```

Inspect with `onnx`:

```python
import onnx
m = onnx.load("model.onnx")
onnx.checker.check_model(m)
print(onnx.helper.printable_graph(m.graph))
```

Run with ONNX Runtime:

```python
import onnxruntime as ort
sess = ort.InferenceSession("model.onnx", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
out = sess.run(None, {"input": x_np})
```

## torch.export

Modern way to capture a model graph for AOT compilation, serialization, and deployment. Successor to TorchScript.

```python
import torch

model.eval()
sample = torch.randn(1, 3, 224, 224, device="cuda")
ep = torch.export.export(model, (sample,))

# Inspect
print(ep)

# Save
torch.export.save(ep, "model.pt2")

# Load
ep2 = torch.export.load("model.pt2")
out = ep2.module()(sample)
```

For dynamic shapes:

```python
from torch.export import Dim
batch = Dim("batch", min=1, max=128)
ep = torch.export.export(model, (sample,), dynamic_shapes={"x": {0: batch}})
```

## TorchScript — deprecated

`torch.jit.script` / `torch.jit.trace` are deprecated in recent versions. Don't start new projects with them. If you have existing TorchScript code, plan migration to `torch.export` / `torch.compile`.

## ExecuTorch — embedded / mobile

For on-device inference (mobile, embedded), the path is `torch.export` → ExecuTorch runtime. Out of scope here; see <https://pytorch.org/executorch/>.

## Serving patterns

Three common deployment surfaces:

1. **Python service (FastAPI + PyTorch)** — easiest; same Python code as training; latency limited by Python overhead. Use `torch.compile` + inference_mode + AMP.
2. **TorchServe** — official PyTorch serving framework; handles batching, versioning, metrics. Wraps your model in a handler.
3. **ONNX Runtime / TensorRT** — export to ONNX, run in a native serving stack. Lowest latency, most operational work.

Pick the simplest one that meets latency: most teams should start with FastAPI + PyTorch, move to TorchServe or ONNX RT only when latency or throughput requires it.

## Quantization (overview)

`torch.ao.quantization` provides post-training quantization (PTQ) and quantization-aware training (QAT). For LLMs, prefer dedicated stacks (bitsandbytes, GPTQ, AWQ) that have better accuracy preservation. For CV models, the native PTQ flow:

```python
import torch.ao.quantization as quant

model.eval()
model.qconfig = quant.get_default_qconfig("fbgemm")  # x86; "qnnpack" for ARM
quant.prepare(model, inplace=True)
# run calibration data through the model
for x in calib_loader:
    model(x)
quant.convert(model, inplace=True)
```

## Inference correctness checks

After exporting to ONNX / `torch.export` / TorchScript, always run a sanity diff against the original:

```python
import numpy as np

model.eval()
with torch.inference_mode():
    eager_out = model(sample).cpu().numpy()

onnx_out = sess.run(None, {"input": sample.cpu().numpy()})[0]
np.testing.assert_allclose(eager_out, onnx_out, rtol=1e-3, atol=1e-4)
```

If this fails, the export went wrong — investigate before deploying.
