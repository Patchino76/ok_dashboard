# Train/Test Splitting Guide for Premium Training Data

## The Problem with Sequential Data

### ❌ Sequential Stacking (Bad for ML)

```
File: phase2_premium_training_data.csv (Sequential)

Index 0-4999:     [Consensus Motif Samples]
Index 5000-64999: [Normal Samples............]
```

**What happens with naive split:**
```python
from sklearn.model_selection import train_test_split

# Load sequential data
data = pd.read_csv('phase2_premium_training_data.csv')
X = data[features]
y = data[target]

# Simple split (80/20)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
```

**Result:**
- **Train set**: Indices 0-51999 (80%)
  - Contains: ALL consensus motifs + 80% of normal data
  
- **Test set**: Indices 52000-64999 (20%)
  - Contains: ONLY normal data (NO consensus motifs!)

**Problems:**
1. ❌ Test set not representative of full data distribution
2. ❌ Can't evaluate model performance on consensus patterns
3. ❌ Biased evaluation (only testing on normal data)
4. ❌ Model might overfit to consensus patterns without detection

## ✅ Solution: Use Shuffled Data

### Critical: Group-Level Shuffling

**IMPORTANT**: We shuffle **groups**, not individual rows!

**Why?** Each consensus motif is a **240-minute temporal pattern**. If we shuffle individual rows, we destroy the pattern:

```
❌ WRONG (row-level shuffle):
Row 1: Consensus Motif 3, minute 45
Row 2: Normal data point
Row 3: Consensus Motif 1, minute 180
Row 4: Consensus Motif 2, minute 12
→ Temporal patterns destroyed!

✅ CORRECT (group-level shuffle):
Rows 1-240:   Consensus Motif 3 (all 240 minutes intact)
Rows 241-480: Consensus Motif 1 (all 240 minutes intact)
Rows 481-720: Consensus Motif 2 (all 240 minutes intact)
Rows 721+:    Normal data (shuffled individually)
→ Temporal patterns preserved!
```

**Implementation:**
1. Shuffle consensus motif **IDs** (not rows)
2. Keep each motif's 240-minute window **intact**
3. Shuffle normal data **individually** (they're independent)
4. Concatenate shuffled groups

### Two Files Provided

1. **`phase2_premium_training_data.csv`** (Sequential)
   - Use for: Inspection, analysis, visualization
   - Consensus motifs grouped together
   - Easy to see patterns

2. **`phase2_premium_training_data_shuffled.csv`** (Shuffled) ⭐ **RECOMMENDED**
   - Use for: ML training, train/test splitting
   - **Consensus motifs shuffled by group** (each 240-min window stays intact)
   - **Normal data shuffled individually** (independent samples)
   - Seed=42 for reproducibility

### Correct Usage

```python
from sklearn.model_selection import train_test_split

# Load SHUFFLED data (recommended!)
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')

X = data[['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp', 'PulpHC', 'DensityHC', 'PressureHC']]
y = data['target_feature']

# Simple split now works correctly
X_train, X_test, y_train, y_test = train_test_split(
    X, y, 
    test_size=0.2,
    random_state=42
)
```

**Result:**
- **Train set**: 80% of data
  - Contains: ~80% of consensus motifs + ~80% of normal data
  
- **Test set**: 20% of data
  - Contains: ~20% of consensus motifs + ~20% of normal data

**Benefits:**
- ✅ Test set is representative
- ✅ Can evaluate on both consensus and normal patterns
- ✅ Unbiased performance metrics
- ✅ Proper generalization testing

## Advanced: Stratified Splitting

For even better distribution, use **stratified splitting** to maintain exact quality ratios:

```python
from sklearn.model_selection import train_test_split

# Load shuffled data
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')

X = data[features]
y = data[target]

# Stratified split maintains consensus/normal ratio
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    stratify=data['data_quality'],  # Maintain 8% consensus, 92% normal in both sets
    random_state=42
)

# Verify distribution
print("Train set quality distribution:")
print(data.iloc[X_train.index]['data_quality'].value_counts(normalize=True))

print("\nTest set quality distribution:")
print(data.iloc[X_test.index]['data_quality'].value_counts(normalize=True))
```

**Output:**
```
Train set quality distribution:
normal             0.92
consensus_motif    0.08

Test set quality distribution:
normal             0.92
consensus_motif    0.08
```

Perfect! Both sets have the same quality distribution.

## Time-Based Splitting (Alternative)

If you want to test on **future data**, use the sequential file with time-based split:

```python
# Load sequential data (has original timestamps)
data = pd.read_csv('phase2_premium_training_data.csv')

# Sort by timestamp (already sorted, but just to be sure)
data = data.sort_values('original_timestamp')

# Split: First 80% for training, last 20% for testing
split_idx = int(len(data) * 0.8)

train_data = data.iloc[:split_idx]
test_data = data.iloc[split_idx:]

X_train = train_data[features]
y_train = train_data[target]
X_test = test_data[features]
y_test = test_data[target]
```

**Use case**: Simulating real-world deployment where you train on past data and predict future.

**Caveat**: Test set might have different quality distribution than train set.

## Cross-Validation

For robust evaluation, use k-fold cross-validation with shuffled data:

```python
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestRegressor

# Load shuffled data
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')

X = data[features]
y = data[target]

# Stratified K-Fold (maintains quality distribution in each fold)
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

model = RandomForestRegressor(n_estimators=100, random_state=42)

# Cross-validation scores
scores = cross_val_score(
    model, X, y,
    cv=skf,
    scoring='r2',
    groups=data['data_quality']  # Stratify by quality
)

print(f"Cross-validation R² scores: {scores}")
print(f"Mean R²: {scores.mean():.3f} (+/- {scores.std():.3f})")
```

## Weighted Training with Shuffled Data

You can still weight consensus motifs higher even with shuffled data:

```python
# Load shuffled data
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')

X = data[features]
y = data[target]

# Create sample weights (consensus = 2x, normal = 1x)
weights = data['data_quality'].map({
    'consensus_motif': 2.0,
    'normal': 1.0
})

# Split with weights
X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
    X, y, weights,
    test_size=0.2,
    stratify=data['data_quality'],
    random_state=42
)

# Train with weights
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train, sample_weight=w_train)

# Evaluate (optionally with weights)
train_score = model.score(X_train, y_train, sample_weight=w_train)
test_score = model.score(X_test, y_test, sample_weight=w_test)

print(f"Weighted Train R²: {train_score:.3f}")
print(f"Weighted Test R²: {test_score:.3f}")
```

## Comparison: Sequential vs Shuffled

### Sequential File (`phase2_premium_training_data.csv`)

**Pros:**
- ✅ Easy to inspect patterns
- ✅ Consensus motifs grouped together
- ✅ Good for time-based splitting
- ✅ Good for visualization

**Cons:**
- ❌ Bad for random train/test split
- ❌ Naive split creates biased sets
- ❌ Requires careful splitting logic

**Best for:**
- Data inspection
- Pattern analysis
- Time-series forecasting
- Visualization

### Shuffled File (`phase2_premium_training_data_shuffled.csv`)

**Pros:**
- ✅ Perfect for random train/test split
- ✅ Works with sklearn's train_test_split
- ✅ Unbiased evaluation
- ✅ Proper cross-validation

**Cons:**
- ❌ Harder to inspect patterns visually
- ❌ Not suitable for time-based analysis

**Best for:**
- ML model training
- Train/test splitting
- Cross-validation
- Performance evaluation

## Recommendations

### 1. For Standard ML Training
```python
# Use shuffled file
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
```

### 2. For Time-Series Forecasting
```python
# Use sequential file
data = pd.read_csv('phase2_premium_training_data.csv')
# Time-based split: train on past, test on future
```

### 3. For Pattern Analysis
```python
# Use sequential file
data = pd.read_csv('phase2_premium_training_data.csv')
# Analyze consensus motifs separately
consensus = data[data['data_quality'] == 'consensus_motif']
```

### 4. For Production Model
```python
# Train on ALL shuffled data (no split)
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')
X = data[features]
y = data[target]
model.fit(X, y)  # Use all data for final model
```

## Example: Complete Training Pipeline

```python
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error

# 1. Load shuffled data (RECOMMENDED)
data = pd.read_csv('phase2_premium_training_data_shuffled.csv')

# 2. Define features
MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
TARGET = 'PulpHC'  # Example

X = data[MV_FEATURES + CV_FEATURES]
y = data[TARGET]

# 3. Create sample weights (optional - emphasize consensus)
weights = data['data_quality'].map({
    'consensus_motif': 2.0,
    'normal': 1.0
})

# 4. Stratified split (maintains quality distribution)
X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
    X, y, weights,
    test_size=0.2,
    stratify=data['data_quality'],
    random_state=42
)

# 5. Train model with weights
model = RandomForestRegressor(
    n_estimators=100,
    max_depth=10,
    min_samples_split=5,
    random_state=42
)
model.fit(X_train, y_train, sample_weight=w_train)

# 6. Evaluate
train_r2 = model.score(X_train, y_train, sample_weight=w_train)
test_r2 = model.score(X_test, y_test, sample_weight=w_test)

y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred, sample_weight=w_test)

print(f"Train R²: {train_r2:.3f}")
print(f"Test R²: {test_r2:.3f}")
print(f"Test MAE: {mae:.2f}")

# 7. Cross-validation for robustness
cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
print(f"CV R²: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

# 8. Analyze performance by quality
test_data = data.iloc[X_test.index]
consensus_test = test_data[test_data['data_quality'] == 'consensus_motif']
normal_test = test_data[test_data['data_quality'] == 'normal']

if len(consensus_test) > 0:
    consensus_r2 = model.score(
        consensus_test[MV_FEATURES + CV_FEATURES],
        consensus_test[TARGET]
    )
    print(f"Consensus Motif Test R²: {consensus_r2:.3f}")

if len(normal_test) > 0:
    normal_r2 = model.score(
        normal_test[MV_FEATURES + CV_FEATURES],
        normal_test[TARGET]
    )
    print(f"Normal Data Test R²: {normal_r2:.3f}")
```

## Summary

| Task | File to Use | Splitting Method |
|------|-------------|------------------|
| **ML Training** | `shuffled.csv` ⭐ | `train_test_split()` |
| **Cross-Validation** | `shuffled.csv` | `StratifiedKFold` |
| **Time-Series** | `sequential.csv` | Time-based split |
| **Pattern Analysis** | `sequential.csv` | Group by quality |
| **Visualization** | `sequential.csv` | Plot by motif_id |
| **Production Model** | `shuffled.csv` | Train on all data |

**Golden Rule**: For standard ML workflows, **always use the shuffled file** with stratified splitting!
