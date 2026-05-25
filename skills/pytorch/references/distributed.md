# Distributed training

Two main paths:

- **DDP** (`DistributedDataParallel`) — full replica per GPU; gradients all-reduced after each backward. Use when the model fits on one GPU.
- **FSDP2** (`fully_shard`) — parameters, gradients, and optimizer state sharded across GPUs. Use when the model is too big for one GPU.

Both run with one process per GPU. Launch with `torchrun`.

## DDP — the canonical pattern

```python
# train.py
import os
import torch
import torch.distributed as dist
import torch.nn as nn
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler

def main():
    dist.init_process_group(backend="nccl")
    local_rank = int(os.environ["LOCAL_RANK"])
    rank = int(os.environ["RANK"])
    world_size = int(os.environ["WORLD_SIZE"])

    torch.cuda.set_device(local_rank)
    device = torch.device(f"cuda:{local_rank}")

    model = MyModel().to(device)
    model = DDP(model, device_ids=[local_rank])

    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
    loss_fn = nn.CrossEntropyLoss()

    sampler = DistributedSampler(train_ds, num_replicas=world_size, rank=rank, shuffle=True)
    loader = DataLoader(train_ds, batch_size=64, sampler=sampler, num_workers=4, pin_memory=True)

    for epoch in range(num_epochs):
        sampler.set_epoch(epoch)               # different shuffle each epoch
        model.train()
        for x, y in loader:
            x = x.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(x), y)
            loss.backward()
            optimizer.step()

        if rank == 0:
            torch.save(model.module.state_dict(), f"ckpt_e{epoch}.pt")

    dist.destroy_process_group()

if __name__ == "__main__":
    main()
```

Launch:

```bash
# Single host, 4 GPUs
torchrun --nproc_per_node=4 train.py

# Multi-host, 4 GPUs each, 2 hosts
# On rank-0 host (master):
torchrun --nproc_per_node=4 --nnodes=2 --node_rank=0 \
         --master_addr=10.0.0.1 --master_port=29500 train.py
# On rank-1 host:
torchrun --nproc_per_node=4 --nnodes=2 --node_rank=1 \
         --master_addr=10.0.0.1 --master_port=29500 train.py
```

`torchrun` injects env vars: `RANK`, `LOCAL_RANK`, `WORLD_SIZE`, `LOCAL_WORLD_SIZE`, `MASTER_ADDR`, `MASTER_PORT`.

## Key DDP rules

- `dist.init_process_group(backend="nccl")` before anything CUDA on the rank — `nccl` for GPU, `gloo` for CPU-only
- `torch.cuda.set_device(local_rank)` so each process owns one GPU
- `DistributedSampler` shuffles uniquely per rank; call `sampler.set_epoch(epoch)` for proper shuffling
- Effective batch size = `batch_size * world_size`; if you want to keep total batch constant, divide
- Access the raw model via `model.module` (not `model.state_dict()` directly — that includes the DDP wrapper prefix)
- Only rank 0 writes logs, checkpoints, and to wandb/tensorboard; gate with `if rank == 0:`
- Use `dist.barrier()` to sync ranks (e.g., after rank 0 finishes writing a checkpoint)

## DDP gradient bucketing

DDP overlaps gradient all-reduce with backward by bucketing gradients. Defaults are sensible. To tune:

```python
model = DDP(model, device_ids=[local_rank], bucket_cap_mb=25)
```

Larger bucket = fewer collectives = better bandwidth but worse overlap.

## find_unused_parameters

```python
model = DDP(model, device_ids=[local_rank], find_unused_parameters=True)
```

Set to True when the forward conditionally skips parameters (e.g., MoE gating, multi-task heads). Otherwise leave False (faster). When True, DDP scans the autograd graph for params with no grad and handles them.

## FSDP2 — `fully_shard`

For models too large for one GPU. FSDP2 (introduced in 2.4+, refined since) is the modern API; the original FSDP wrapper is being phased out.

```python
import torch
from torch.distributed.fsdp import fully_shard, MixedPrecisionPolicy
from torch.distributed.device_mesh import init_device_mesh

dist.init_process_group(backend="nccl")
local_rank = int(os.environ["LOCAL_RANK"])
torch.cuda.set_device(local_rank)

mesh = init_device_mesh("cuda", (int(os.environ["WORLD_SIZE"]),))

model = MyLargeModel()                       # on meta or CPU first
# Apply sharding to each transformer block, then the whole model
for block in model.blocks:
    fully_shard(block, mesh=mesh)
fully_shard(model, mesh=mesh)

# Move to device after sharding
model.to_empty(device="cuda")
# init params here, then ready

optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
```

Mixed precision in FSDP2:

```python
mp = MixedPrecisionPolicy(
    param_dtype=torch.bfloat16,
    reduce_dtype=torch.float32,
)
fully_shard(model, mesh=mesh, mp_policy=mp)
```

## When to choose what

| Model fits on one GPU? | Use |
|---|---|
| Yes, plenty of headroom | DDP |
| Yes, but barely (small batch only) | DDP + gradient accumulation, or FSDP |
| No, but fits in CPU RAM | FSDP with `offload_policy=CPUOffloadPolicy()` |
| No, even with FSDP | Tensor parallelism / pipeline parallelism (advanced — out of scope here) |

## Saving and loading

DDP:

```python
if rank == 0:
    torch.save(model.module.state_dict(), "ckpt.pt")
dist.barrier()
```

FSDP2 — use `torch.distributed.checkpoint` (DCP) for sharded checkpoints that don't require gathering on rank 0:

```python
import torch.distributed.checkpoint as dcp
dcp.save({"model": model.state_dict()}, checkpoint_id="ckpt/")
```

## Common errors

- `RuntimeError: Address already in use` — kill stale processes, change `MASTER_PORT`
- Hangs at `init_process_group` — firewall blocking master port, or `MASTER_ADDR` unreachable
- `NCCL error: unhandled cuda error` — version mismatch between PyTorch and NCCL; check `nvidia-smi` and reinstall consistent wheels
- One rank dies silently, others hang — set `NCCL_DEBUG=INFO` or use the `flight_recorder` to diagnose
- `find_unused_parameters` triggered when not needed — remove it (`find_unused_parameters=False`) for speedup

## Environment knobs

```bash
export NCCL_DEBUG=INFO                 # verbose NCCL logs
export NCCL_SOCKET_IFNAME=eth0         # force a network interface
export NCCL_P2P_DISABLE=1              # disable P2P if it's broken
export TORCH_NCCL_BLOCKING_WAIT=1      # surface NCCL errors instead of hanging
export TORCH_NCCL_ASYNC_ERROR_HANDLING=1
```

## Single-host shortcuts

For one-host multi-GPU, `accelerate` (`pip install accelerate`) hides DDP boilerplate:

```bash
accelerate config
accelerate launch train.py
```

Don't reach for it unless your team already uses it. Vanilla `torchrun` + DDP is well-understood and portable.
