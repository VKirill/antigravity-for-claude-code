# Eval Cases

Positive (skill should load) and negative (skill should NOT load) routing prompts. Use these as smoke tests when refactoring the description.

## Positive cases — skill MUST load

| # | Prompt | Why this skill |
|---|---|---|
| 1 | "Train a RandomForestClassifier on this CSV with 5-fold cross-validation" | Direct sklearn API |
| 2 | "Build a Pipeline with StandardScaler + LogisticRegression" | `Pipeline` + `StandardScaler` triggers |
| 3 | "I have mixed numeric and categorical columns — set up a ColumnTransformer" | `ColumnTransformer` trigger |
| 4 | "Tune hyperparameters of my HistGradientBoosting model with GridSearchCV" | `GridSearchCV` + `HistGradientBoosting` triggers |
| 5 | "Use RandomizedSearchCV with a log-uniform distribution for learning rate" | `RandomizedSearchCV` trigger |
| 6 | "How do I stratify train_test_split for imbalanced classes?" | `train_test_split` + classification |
| 7 | "Compute classification_report and confusion_matrix on the test set" | metric triggers |
| 8 | "Cluster these embeddings with HDBSCAN" | clustering + `HDBSCAN` trigger |
| 9 | "What's the difference between OneHotEncoder and TargetEncoder for high-cardinality?" | preprocessing triggers |
| 10 | "Build a classical ML baseline for this tabular dataset" | "classical ml", "tabular ml" |
| 11 | "I want to use set_output('polars') on my pipeline so I keep DataFrame output" | `set_output polars` trigger |
| 12 | "Configure metadata routing so sample_weight reaches LogisticRegression in GridSearchCV" | `metadata routing` trigger |
| 13 | "Add permutation_importance to my model evaluation" | inspection trigger |
| 14 | "Calibrate my classifier's probabilities with temperature scaling" | calibration / 1.8 feature |
| 15 | "Save my fitted sklearn Pipeline to disk safely — joblib or skops?" | persistence trigger |
| 16 | "fit/predict on my data with KNeighborsClassifier" | core API |
| 17 | "Run StratifiedKFold cross_val_score on this classifier" | CV triggers |

## Negative cases — skill MUST NOT load

| # | Prompt | Correct skill |
|---|---|---|
| 1 | "Build a transformer model in PyTorch with multi-head attention" | `pytorch` — DL, not classical |
| 2 | "Fine-tune Llama 3 on my dataset" | transformers cascade — LLM, not sklearn |
| 3 | "Read a CSV with pandas and compute group means" | `pandas` — pure data wrangling |
| 4 | "Use polars to lazily aggregate 50GB of parquet files" | `polars` — pure data wrangling |
| 5 | "Write a CUDA kernel to multiply two matrices on GPU" | `cuda-python` — GPU compute |
| 6 | "How do I distribute training across 8 GPUs with DDP?" | `pytorch` — distributed DL |
| 7 | "Set up XGBoost early stopping with validation" | XGBoost cascade — explicit other lib |
| 8 | "Write a SQL query that aggregates customer events by month" | `postgresql` — DB layer |
| 9 | "Configure type hints with Pydantic for an API schema" | python / fastapi |
| 10 | "Build a FastAPI service that returns predictions" | `fastapi` — serving layer (sklearn model loading is fine on either side, but the question is about API plumbing) |

## Borderline — judgment call

| # | Prompt | Decision |
|---|---|---|
| B1 | "Serve a fitted sklearn Pipeline behind FastAPI" | Both skills may help — `scikit-learn` for the model side, `fastapi` for the HTTP side. If only one loads, prefer the side the question is *actually* about (read full context). |
| B2 | "How do I one-hot-encode a pandas column?" | Light bias toward `pandas` (`pd.get_dummies`) for one-off transforms; `scikit-learn` (`OneHotEncoder`) if part of a model pipeline. |
| B3 | "Cross-validate an XGBoost model" | `scikit-learn` — XGBoost's sklearn-compatible API uses `cross_val_score` etc., even though XGBoost itself is a different library. |
| B4 | "Replace my scikit-learn RandomForest with LightGBM" | Both — sklearn for the current API; LightGBM cascade for the swap target. |

## Description self-check

After any edit to the SKILL.md frontmatter description:

1. Run cases 1–17 mentally: does the description contain a substring of each prompt?
2. Run cases N1–N10 mentally: does the description's SKIP clause clearly route them away?
3. If a positive case has no obvious trigger word in the description, add it.
4. If a negative case lacks a SKIP edge, add it.

This is the routing-quality bar. Skills don't get loaded by vibes — they get loaded by keyword overlap with the user's prompt.
