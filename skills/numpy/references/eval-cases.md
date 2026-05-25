# Eval Cases — Routing Tests

Prompts that should route to the `numpy` skill (positive) and prompts that should NOT (negative). Use these to validate the skill description and sibling-skill disambiguation.

## Positive — should load `numpy`

Direct triggers — explicit NumPy mention:

1. "How do I create a numpy array of zeros with shape (3, 4)?"
2. "Convert this Python list to an ndarray with float32 dtype."
3. "I'm getting `ValueError: operands could not be broadcast together with shapes (3,4) (5,)` — what does this mean?"
4. "What's the difference between `np.dot` and `np.matmul`?"
5. "How do I solve a linear system `Ax = b` in NumPy?"
6. "Use `np.linalg.eigh` to compute eigenvalues of a symmetric matrix."
7. "Generate 1000 normally-distributed random numbers, seeded for reproducibility."
8. "Why does `np.in1d` raise `AttributeError`?"
9. "What replaced `np.int` and `np.float` in NumPy 2.0?"
10. "Explain NEP 50 dtype promotion."
11. "How do I write a multi-tensor contraction with `np.einsum`?"
12. "Why is my `np.vectorize` function slow?"
13. "When does basic slicing return a view versus a copy?"
14. "Use `np.memmap` to work with a 100 GB array that doesn't fit in RAM."
15. "Bridge a NumPy array to a PyTorch tensor without copying."
16. "What's the right way to seed random numbers in NumPy 2.x?"
17. "Replace `np.random.seed` with the Generator API."
18. "How do I make a contiguous copy of a transposed array?"
19. "Why does `np.linalg.inv(A) @ b` give a different result than `np.linalg.solve(A, b)`?"
20. "Compute the 95th percentile along axis 0 of a 2D array, skipping NaNs."

Implicit triggers — NumPy-flavored questions without the word "numpy":

21. "Element-wise multiply two arrays of different shapes."
22. "Broadcasting rules for `(N, 1)` and `(1, M)` arrays."
23. "Vectorize this nested Python loop over a 2D array."
24. "Save an ndarray to disk in a binary format."
25. "What does `arr.strides` mean and when should I worry about it?"

## Negative — should NOT load `numpy`

These should route to sibling/parent skills:

### pandas — DataFrame-shaped questions

1. "How do I group by a column and compute the mean per group?" → **pandas**
2. "Merge two DataFrames on a key column." → **pandas**
3. "Read a CSV file with header and convert dates." → **pandas**
4. "Filter rows where `col > 5`." → **pandas**
5. "Pivot a long-format table to wide." → **pandas**

### polars — lazy/streaming DataFrame

6. "Process a 50 GB CSV with lazy evaluation." → **polars**
7. "Use the Polars expression API with `pl.col`." → **polars**

### scikit-learn — ML estimators

8. "Train a logistic regression on this dataset." → **scikit-learn**
9. "Cross-validate a random forest with GridSearchCV." → **scikit-learn**
10. "Build a Pipeline with StandardScaler and SVM." → **scikit-learn**

### pytorch — neural nets, autograd

11. "Train a transformer with PyTorch." → **pytorch**
12. "Compute gradients of a loss with autograd." → **pytorch**
13. "Move a tensor to GPU with `.to('cuda')`." → **pytorch**

### cuda-python — GPU compute (CuPy)

14. "Run NumPy code on the GPU." → **cuda-python** (CuPy)
15. "Convert NumPy code to CuPy." → **cuda-python**

### python — pure language

16. "How do type hints work for generic classes?" → **python**
17. "What's `asyncio.TaskGroup`?" → **python**
18. "Set up `pyproject.toml` and uv." → **python**

### postgresql — SQL aggregation

19. "Aggregate sales by region directly in the database." → **postgresql**

## Ambiguous cases — both skills could apply

Cases where the user might want **numpy** OR a downstream skill — these should be evaluated by which is more idiomatic for the verb:

| Prompt | Preferred route | Why |
|---|---|---|
| "Compute the mean of a column" | pandas (if there's a DataFrame); numpy (if there's an ndarray) | DataFrame implies pandas verbs |
| "Reshape a 2D array to 3D" | numpy | Pure ndarray manipulation |
| "Convert a pandas DataFrame to a numpy array" | numpy (the conversion step); pandas (for the IO source) | Mention of `.to_numpy()` makes numpy primary |
| "Standardize features (subtract mean, divide by std)" | scikit-learn (StandardScaler) OR numpy (direct) | ML context → sklearn; raw math → numpy |
| "Generate a random covariance matrix" | numpy (`rng.standard_normal(...) @ ...`) | No ML estimator involved |

## Routing health check

A correct routing decision means: prompt 1–25 loads `numpy`, prompts 1–19 from "Negative" route elsewhere. If any positive prompt fails to load `numpy`, audit the SKILL.md description for missing trigger terms.
