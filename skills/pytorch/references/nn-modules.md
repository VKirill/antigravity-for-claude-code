# nn.Module pattern

`nn.Module` is the base class for every layer, every loss, every model. It tracks submodules, parameters, buffers, and provides serialization and device-movement plumbing.

## Minimal custom module

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MLP(nn.Module):
    def __init__(self, in_dim: int, hidden: int, out_dim: int, dropout: float = 0.1):
        super().__init__()  # ALWAYS call first
        self.fc1 = nn.Linear(in_dim, hidden)
        self.fc2 = nn.Linear(hidden, out_dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        return self.fc2(x)
```

Rules:

- `super().__init__()` first, always
- Submodules assigned as attributes are auto-tracked: they appear in `.parameters()`, move with `.to(device)`, save via `state_dict()`
- Implement `forward()` — but **call the module**, not `model.forward(x)`. `model(x)` runs hooks and JIT integration
- Use `nn.functional` (`F.relu`, `F.softmax`) for stateless ops; use `nn.Module` versions (`nn.ReLU`, `nn.Softmax`) when you want them to appear in the module tree

## Parameter vs buffer

```python
class LayerWithStats(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(dim))     # trainable
        self.register_buffer("running_mean", torch.zeros(dim))  # NOT trainable, moves with .to(device)
        self.register_buffer("count", torch.zeros(1, dtype=torch.long), persistent=False)
```

- `nn.Parameter` — gradients computed, included in `model.parameters()`, in state_dict
- Buffer registered with `register_buffer(name, tensor)` — no gradients, in state_dict by default, moves with `.to(device)`
- `persistent=False` excludes from state_dict (useful for transient state)

## Sequential and ModuleList / ModuleDict

```python
# Sequential — applies modules in order
model = nn.Sequential(
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Dropout(0.1),
    nn.Linear(256, 10),
)

# ModuleList — list-like, you handle iteration
class MultiHead(nn.Module):
    def __init__(self, n_heads: int, dim: int):
        super().__init__()
        self.heads = nn.ModuleList([nn.Linear(dim, dim) for _ in range(n_heads)])
    def forward(self, x):
        return torch.stack([h(x) for h in self.heads], dim=1)

# ModuleDict — name-keyed
self.activations = nn.ModuleDict({"relu": nn.ReLU(), "gelu": nn.GELU()})
```

WRONG: a plain Python list `self.heads = [nn.Linear(...) for _ in range(N)]` — the submodules are not tracked, no params, won't move with `.to(device)`.

## train() vs eval()

```python
model.train()    # dropout active, batchnorm uses batch stats
model.eval()     # dropout off, batchnorm uses running stats
```

Forgetting `model.eval()` before validation is one of the top-3 silent bugs in PyTorch code — your val loss looks higher than train loss because dropout is still firing on val.

```python
# Right pattern — wrap eval phase
model.eval()
with torch.inference_mode():
    for x, y in val_loader:
        ...
model.train()
```

## Common layers cheatsheet

| Layer | Notes |
|---|---|
| `nn.Linear(in, out)` | dense layer; weight shape `(out, in)` |
| `nn.Conv2d(in_c, out_c, k, stride=1, padding=0)` | NCHW; padding="same" valid in 2.x |
| `nn.BatchNorm2d(num_features)` | tracks running stats; sensitive to small batch |
| `nn.LayerNorm(shape)` | per-sample norm; preferred in transformers |
| `nn.GroupNorm(groups, channels)` | works well with small batch |
| `nn.Dropout(p)` | stateless at inference |
| `nn.Embedding(num, dim)` | lookup table; use `padding_idx=` if applicable |
| `nn.MultiheadAttention(embed_dim, num_heads, batch_first=True)` | use `batch_first=True` for `(B, T, D)` |
| `nn.TransformerEncoderLayer(d_model, nhead, batch_first=True)` | one transformer block |
| `nn.Flatten(start_dim=1)` | end of conv, start of head |

## Initialization

PyTorch picks sensible defaults (Kaiming uniform for `Linear`/`Conv`), but you can override:

```python
def init_weights(m):
    if isinstance(m, nn.Linear):
        nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
        if m.bias is not None:
            nn.init.zeros_(m.bias)

model.apply(init_weights)
```

## Common losses

```python
nn.CrossEntropyLoss()           # logits in, integer labels in; combines log_softmax + NLL
nn.BCEWithLogitsLoss()          # logits in, binary; more stable than BCE+sigmoid
nn.MSELoss()                    # regression
nn.L1Loss()                     # robust regression
nn.SmoothL1Loss()               # Huber loss
nn.HuberLoss(delta=1.0)         # explicit delta
```

Always feed **logits** to `CrossEntropyLoss` / `BCEWithLogitsLoss` — they apply log_softmax / sigmoid internally with better numeric stability than doing it yourself.

## Inspecting a model

```python
print(model)                              # tree representation
sum(p.numel() for p in model.parameters() if p.requires_grad)  # trainable param count

for name, p in model.named_parameters():
    print(name, tuple(p.shape), p.requires_grad)
```

For nicer summaries, `torchinfo` (`pip install torchinfo`) gives shape-flow tables.

## Freezing parameters

```python
for p in model.encoder.parameters():
    p.requires_grad = False
```

Then pass only trainable params to the optimizer:

```python
optimizer = torch.optim.AdamW(
    (p for p in model.parameters() if p.requires_grad),
    lr=3e-4,
)
```

## Custom forward shape gotcha

Many bugs come from silent broadcasting. If you expect `(B, T, D)` and get `(B, D)` from a layer that squeezed a singleton dim, downstream computation may still "work" but produce garbage. Add shape assertions early:

```python
def forward(self, x):
    B, T, D = x.shape   # raises if not 3D
    ...
```
