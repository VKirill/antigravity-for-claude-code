# Clustering

Unsupervised partitioning. Pick the algorithm by what you know about the data, not by what's popular.

## Decision matrix

| Property of your data | First reach | Why |
|---|---|---|
| Roughly spherical clusters; `k` known | `KMeans(n_init="auto")` | Fast, well-understood |
| Roughly spherical; `k` unknown but bounded | `KMeans` over several `k` + silhouette | Standard sweep |
| Arbitrary shapes; **density-based**; `k` unknown | `HDBSCAN` | No `eps`; handles varying density |
| Arbitrary shapes; density-based; uniform density | `DBSCAN` | Lighter than HDBSCAN; needs `eps` |
| Hierarchical structure; dendrogram needed | `AgglomerativeClustering` | Bottom-up; multiple linkage strategies |
| Soft membership; probabilistic | `GaussianMixture` | Each point has membership probabilities |
| Very large `n_samples` | `MiniBatchKMeans` | Stochastic; scales to millions |

## KMeans

```python
from sklearn.cluster import KMeans

km = KMeans(
    n_clusters=8,
    init="k-means++",
    n_init="auto",               # 1.4+ default; 10 for "k-means++", 1 for "random"
    max_iter=300,
    tol=1e-4,
    random_state=42,
    algorithm="lloyd",           # default; "elkan" can be faster on dense low-dim
).fit(X)

km.labels_
km.cluster_centers_
km.inertia_
```

Always scale features first (Euclidean-distance assumption). `n_init="auto"` is the modern default — explicitly set it to silence the FutureWarning in older code.

For `n_samples > 100k`:

```python
from sklearn.cluster import MiniBatchKMeans

mbkm = MiniBatchKMeans(n_clusters=20, batch_size=1024, n_init=10, random_state=42).fit(X)
```

## DBSCAN

```python
from sklearn.cluster import DBSCAN

db = DBSCAN(eps=0.5, min_samples=5, metric="euclidean", n_jobs=-1).fit(X)
db.labels_     # -1 means "noise" (not assigned to any cluster)
```

`eps` is the neighborhood radius; pick it from a k-distance plot. `min_samples` is the minimum cluster size. Sensitive to scale — always scale.

## HDBSCAN (recommended density-based)

Hierarchical DBSCAN — no `eps` to tune. Native in sklearn since 1.3.

```python
from sklearn.cluster import HDBSCAN

hdb = HDBSCAN(
    min_cluster_size=15,
    min_samples=None,            # defaults to min_cluster_size
    cluster_selection_method="eom",
    metric="euclidean",
    n_jobs=-1,
).fit(X)
hdb.labels_
hdb.probabilities_
```

If you don't know `eps`, start here.

## Agglomerative

```python
from sklearn.cluster import AgglomerativeClustering

ac = AgglomerativeClustering(
    n_clusters=8,
    linkage="ward",              # "ward", "complete", "average", "single"
    metric="euclidean",          # ward forces euclidean
    distance_threshold=None,     # set to merge below threshold; then n_clusters must be None
).fit(X)
```

`linkage="ward"` minimizes variance increase per merge — usually best on numeric data. For visualization, set `distance_threshold` and call `scipy.cluster.hierarchy.dendrogram` on the underlying tree.

## Gaussian Mixture

```python
from sklearn.mixture import GaussianMixture

gmm = GaussianMixture(
    n_components=8,
    covariance_type="full",      # "full", "tied", "diag", "spherical"
    n_init=10,
    init_params="kmeans",
    random_state=42,
).fit(X)

labels = gmm.predict(X)
probs = gmm.predict_proba(X)
bic = gmm.bic(X)                # lower is better
aic = gmm.aic(X)
```

Use BIC over a range of `n_components` to pick the count.

## Cluster validity

When you have ground-truth labels (e.g., on a benchmark): `adjusted_rand_score`, `adjusted_mutual_info_score`, `homogeneity_score`, `v_measure_score`.

When you don't (production), internal metrics:

```python
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score

silhouette_score(X, labels)             # ∈ [-1, 1]; higher better
davies_bouldin_score(X, labels)         # lower better
calinski_harabasz_score(X, labels)      # higher better
```

`silhouette_score` is intuitive but O(n²); for large n, sample with `silhouette_samples` on a subset. `davies_bouldin_score` is faster and complementary.

DBSCAN/HDBSCAN: exclude noise points (`labels != -1`) before computing the metric.

## Common mistakes

- **KMeans without scaling** — distance is dominated by the largest-variance column.
- **DBSCAN without scaling** — same.
- **Tuning `eps` without a k-distance plot** — try `sklearn.neighbors.NearestNeighbors`, sort distances, look for the elbow.
- **Reporting silhouette including DBSCAN noise (-1)** — biased downward; filter first.
- **KMeans with default `n_init` in old code** — the FutureWarning is real; set `n_init="auto"`.
- **Using clustering for "soft labels" when you really want a classifier with weak labels** — different problem.
