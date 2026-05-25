# Model Persistence

Three real options, picked by trust boundary and consumer.

| Format | Trust model | Cross-runtime | When to pick |
|---|---|---|---|
| **ONNX** | Safe — interpreted, no code execution | Yes (Python, C++, JS, Java, .NET, Rust) | Production inference, mobile/edge, long-term forward compat |
| **`skops.io`** | Safe-ish — explicit `trusted=` whitelist | Python only | Model file crosses an untrusted boundary; you still need Python at the consumer |
| **`joblib` / `pickle` / `cloudpickle`** | UNSAFE — arbitrary code execution on load | Python only, often Python-version-locked | Trusted internal: same team, same environment, pinned versions |

## joblib (default for sklearn)

```python
import joblib

joblib.dump(pipe, "model.joblib", compress=3)
pipe = joblib.load("model.joblib")
```

`compress=3` is a sensible default (zlib level 3 — small enough, fast enough). Use `compress=("xz", 3)` for smaller files at the cost of compression time.

joblib is `pickle` underneath, optimized for NumPy arrays. **Loading executes arbitrary code in the file** — never load from untrusted sources.

Version pinning is non-optional. Save the manifest alongside the model:

```python
import joblib, sklearn, numpy, sys, json

manifest = {
    "sklearn": sklearn.__version__,
    "numpy": numpy.__version__,
    "python": sys.version.split()[0],
    "feature_names_in_": list(getattr(pipe, "feature_names_in_", []) or []),
    "classes_": getattr(pipe[-1], "classes_", None).tolist()
        if hasattr(pipe[-1], "classes_") else None,
}
with open("model.manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

joblib.dump(pipe, "model.joblib", compress=3)
```

At load time, validate the loader environment against the manifest before serving traffic. A sklearn major-version mismatch is allowed to fail.

## skops.io — safer Python persistence

Same Python objects, no arbitrary code execution on load:

```python
import skops.io as sio

sio.dump(pipe, "model.skops")

# at load: inspect first
unknown_types = sio.get_untrusted_types(file="model.skops")
# whitelist or refuse
pipe = sio.load("model.skops", trusted=unknown_types)
```

`get_untrusted_types` returns every non-sklearn type that needs explicit trust (numpy types are auto-trusted). Inspect the list; if it contains anything you don't recognize, refuse to load.

This is the right choice when:
- The model is published as a HuggingFace artifact or downloaded from a registry you don't fully control
- You're loading user-uploaded models in a multi-tenant service

## ONNX export

For cross-runtime production inference:

```python
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

initial_type = [("input", FloatTensorType([None, X_train.shape[1]]))]
onnx_model = convert_sklearn(pipe, initial_types=initial_type, target_opset=18)
with open("model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())
```

Inference with `onnxruntime`:

```python
import onnxruntime as ort
sess = ort.InferenceSession("model.onnx", providers=["CPUExecutionProvider"])
preds = sess.run(None, {"input": X_test.astype("float32")})[0]
```

Caveats:
- Not every sklearn estimator and transformer has an ONNX converter — check `skl2onnx`'s coverage page before committing.
- `TargetEncoder`, `IterativeImputer`, `HDBSCAN`, and exotic custom estimators often lack converters.
- ONNX inputs are typed and shaped — `FloatTensorType`, `StringTensorType`, etc. Pipelines with `ColumnTransformer` typically need one tensor input per dtype group.

When ONNX works, it's the lowest-friction option for shipping inference outside the Python world.

## Schema validation at load

A fitted Pipeline carries `feature_names_in_` (top-level) and step-by-step. Validate against the production payload:

```python
def predict_with_validation(pipe, manifest, payload_df):
    expected = manifest["feature_names_in_"]
    got = list(payload_df.columns)
    if got != expected:
        missing = set(expected) - set(got)
        extra = set(got) - set(expected)
        raise ValueError(f"feature mismatch — missing: {missing}, extra: {extra}")
    return pipe.predict(payload_df[expected])
```

For classification, also check `pipe.classes_` against an expected label set and document the meaning of each class outside the model file.

## Versioning policy

- **Patch** (1.7.1 → 1.7.2): joblib-loadable; safe.
- **Minor** (1.7 → 1.8): joblib-loadable in most cases, but warnings expected. Re-fit when convenient.
- **Major** (1.x → 2.x): assume incompatibility. Re-fit on the new version before serving.

Always run a smoke test on every load: predict on a fixed reference batch, compare to a stored reference output. A silent change in output shape or class order is the classic deployment bug.

## Common mistakes

- **`joblib.load` on an untrusted file** — arbitrary code execution.
- **No version pinning** — model loads on Python 3.14 / sklearn 1.8 but raises `AttributeError` on 1.10 in 18 months.
- **Saving the bare estimator, not the Pipeline** — you'll re-implement preprocessing wrong somewhere.
- **Trusting `skops.io` blindly with `trusted=True`** — defeats the security model. Inspect the type list.
- **Forgetting `classes_` at load** — your output column order may have flipped vs. training.
