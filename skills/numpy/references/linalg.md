# Linear Algebra — `np.linalg`

`np.linalg` is NumPy's BLAS/LAPACK-backed linear algebra module. Most routines support stacked operations: if input is shape `(..., M, N)`, the leading dims are batch dims and the op runs per matrix.

## Matrix multiplication

```python
A @ B               # preferred — calls np.matmul
np.matmul(A, B)     # same; handles batch dims
np.dot(A, B)        # legacy — different semantics for >2D, prefer matmul
A.dot(B)            # method form

A @ v               # matrix-vector, returns 1D
v @ A               # vector-matrix
v @ v               # inner product = scalar
np.inner(a, b)      # sum-product over last axis
np.outer(a, b)      # outer product, shape (len(a), len(b))
np.cross(a, b)      # 3D cross product
np.kron(a, b)       # Kronecker product
```

`@` and `np.matmul` are the modern default. Avoid `np.dot` for arrays of ndim > 2 — its semantics differ (it sums over the last axis of `a` and second-to-last of `b`).

## Solving linear systems

**Always prefer `solve` over `inv`.** Computing `inv(A) @ b` is slower (O(n^3) for the inverse, then O(n^2) per RHS) and accumulates more floating-point error than `solve(A, b)` (single O(n^3) LU decomposition with backsubstitution).

```python
# Solve A x = b
x = np.linalg.solve(A, b)              # A is (n, n), b is (n,) or (n, k)

# Multiple right-hand sides at once
X = np.linalg.solve(A, B)              # B is (n, k), X is (n, k)

# Batched solve
xs = np.linalg.solve(As, bs)           # As: (..., n, n), bs: (..., n, k)
```

For over/under-determined systems (rectangular `A`), use `lstsq`:

```python
# Min-norm least-squares solution of A x = b
x, residuals, rank, sv = np.linalg.lstsq(A, b, rcond=None)
```

`rcond=None` accepts machine-precision cutoff (current default). Set explicitly to avoid future deprecation warnings.

## Matrix inverse and pseudo-inverse

When you genuinely need an explicit inverse (rare — usually `solve` is what you want):

```python
np.linalg.inv(A)              # A must be square and non-singular; raises LinAlgError otherwise
np.linalg.pinv(A)             # Moore-Penrose pseudo-inverse via SVD, works for any shape
np.linalg.pinv(A, rcond=1e-10)  # tolerance for treating small singular values as zero
```

## Determinant, rank, condition number

```python
np.linalg.det(A)
np.linalg.slogdet(A)          # (sign, logabsdet) — avoids overflow for large matrices
np.linalg.matrix_rank(A)
np.linalg.matrix_rank(A, tol=1e-10)
np.linalg.cond(A)             # 2-norm condition number
np.linalg.cond(A, p='fro')    # Frobenius norm condition
```

For numerical stability checks: `cond(A) > 1/eps` (where `eps = np.finfo(A.dtype).eps`) means `A` is effectively singular for that precision.

## Eigendecomposition

```python
# General — possibly complex eigenvalues even for real A
eigvals, eigvecs = np.linalg.eig(A)

# Hermitian / symmetric — guaranteed real eigenvalues, ~2× faster
eigvals, eigvecs = np.linalg.eigh(A)
eigvals, eigvecs = np.linalg.eigh(A, UPLO='U')   # which triangle to read

# Just eigenvalues, no eigenvectors
eigvals = np.linalg.eigvals(A)
eigvals = np.linalg.eigvalsh(A)
```

**Always use `eigh` for symmetric / Hermitian inputs.** It's faster, more numerically stable, and returns sorted real eigenvalues — `eig` may return complex eigenvalues even for symmetric inputs due to numerical noise.

## Singular Value Decomposition

```python
U, s, Vh = np.linalg.svd(A)              # full_matrices=True by default
U, s, Vh = np.linalg.svd(A, full_matrices=False)  # thin SVD — usually faster
s = np.linalg.svd(A, compute_uv=False)   # just singular values
```

Use `full_matrices=False` for tall/wide matrices — avoids computing zero-padded singular vectors.

## QR and Cholesky

```python
Q, R = np.linalg.qr(A)              # default 'reduced'
Q, R = np.linalg.qr(A, mode='complete')
np.linalg.qr(A, mode='r')           # just R

L = np.linalg.cholesky(A)           # A must be positive-definite, returns lower-triangular L: A = L @ L.T
```

Cholesky is ~2× faster than LU for positive-definite systems. Use when you know `A` is PD (e.g., covariance matrices).

## Norms

```python
np.linalg.norm(v)                   # L2 vector norm
np.linalg.norm(v, ord=1)            # L1
np.linalg.norm(v, ord=np.inf)       # max abs
np.linalg.norm(v, ord=-np.inf)      # min abs

np.linalg.norm(A)                   # Frobenius (matrix default)
np.linalg.norm(A, ord='fro')        # Frobenius (explicit)
np.linalg.norm(A, ord=2)            # spectral (largest singular value)
np.linalg.norm(A, ord='nuc')        # nuclear (sum of singular values)
np.linalg.norm(A, axis=0)           # per-column L2
np.linalg.norm(A, axis=1)           # per-row L2
```

## `einsum` — Einstein summation

The single most expressive tool for tensor contractions. Encodes arbitrary sum-products via index notation.

```python
# Matrix-matrix product: ik = sum_j (ij * jk)
np.einsum('ij,jk->ik', A, B)        # equivalent to A @ B

# Outer product
np.einsum('i,j->ij', u, v)          # equivalent to np.outer(u, v)

# Inner product
np.einsum('i,i->', u, v)            # equivalent to u @ v

# Batched matmul
np.einsum('bij,bjk->bik', A, B)     # A: (B, M, N), B: (B, N, K) → (B, M, K)

# Trace
np.einsum('ii->', A)                # equivalent to np.trace(A)

# Sum
np.einsum('ij->', A)                # equivalent to A.sum()

# Sum over axis 0
np.einsum('ij->j', A)               # equivalent to A.sum(axis=0)

# Transpose
np.einsum('ij->ji', A)              # equivalent to A.T
```

For multi-tensor contractions, use `optimize`:

```python
result = np.einsum('ij,jk,kl->il', A, B, C, optimize='optimal')
```

Different contraction orders have wildly different costs. `optimize='optimal'` (or `True`) finds a good order at small upfront cost. Use `np.einsum_path` to inspect:

```python
path, info = np.einsum_path('ij,jk,kl->il', A, B, C, optimize='optimal')
print(info)   # human-readable contraction plan with flop counts
```

## Best practices summary

- Solve, don't invert — `np.linalg.solve(A, b)` over `np.linalg.inv(A) @ b`
- `eigh` over `eig` for symmetric/Hermitian
- `cholesky` over `solve` when the matrix is known positive-definite
- `np.matmul` / `@` over `np.dot` for ndim > 2
- `np.einsum(..., optimize='optimal')` for multi-tensor contractions
- Always check `cond(A)` before solving ill-conditioned systems — high condition → use `lstsq` with explicit `rcond`
