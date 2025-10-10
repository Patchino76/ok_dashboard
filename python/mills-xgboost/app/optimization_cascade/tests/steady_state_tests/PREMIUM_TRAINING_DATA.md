# Premium Training Data Strategy

## Overview

The **Premium Training Data** (`phase2_premium_training_data.csv`) combines the best of both worlds:
1. **Consensus Motifs** - Gold standard recurring patterns
2. **Normal Windows** - High-quality stable operation data

This creates the highest quality training dataset for machine learning models.

## Data Quality Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│  PREMIUM TRAINING DATA (RECOMMENDED)                    │
│  ├─ Consensus Motifs (Highest Quality)                  │
│  │  • Recurring patterns validated across occurrences   │
│  │  • Low matrix profile distance                       │
│  │  • Cross-mill validated (if multi-mill)              │
│  │                                                       │
│  └─ Normal Windows (High Quality)                       │
│     • Non-discord data (anomalies removed)              │
│     • Stable operating conditions                       │
│     • No overlap with consensus motifs                  │
└─────────────────────────────────────────────────────────┘
```

## Why Premium Training Data?

### Problem with Using Only Normal Windows
- **Large volume** but includes all non-anomalous data
- May contain **mediocre patterns** that are just "not bad"
- No emphasis on **best practices** or optimal patterns

### Problem with Using Only Consensus Motifs
- **Highest quality** but limited volume
- May not cover all operating conditions
- Risk of **overfitting** to specific patterns

### Solution: Premium Training Data
- ✅ **Gold standard patterns** from consensus motifs
- ✅ **Volume and diversity** from normal windows
- ✅ **No duplication** - consensus motifs removed from normal data
- ✅ **Quality tracking** - know which samples are which
- ✅ **Balanced dataset** - best of both worlds

## File Structure

```csv
original_timestamp,mill_id,data_quality,consensus_motif_id,Ore,WaterMill,WaterZumpf,MotorAmp,PulpHC,DensityHC,PressureHC
2024-06-15 10:30:00,8,consensus_motif,1,185.2,22.3,215.4,245.1,520.3,1650.2,0.45
2024-06-15 10:31:00,8,consensus_motif,1,186.1,22.5,216.2,245.8,521.1,1652.3,0.46
2024-06-15 10:32:00,8,consensus_motif,1,187.0,22.7,217.0,246.5,522.0,1654.5,0.47
2024-06-20 14:15:00,7,normal,,190.5,23.1,220.3,248.2,525.4,1665.1,0.48
2024-06-20 14:16:00,7,normal,,191.2,23.2,221.1,248.9,526.1,1666.8,0.49
```

### Key Columns

1. **`original_timestamp`** - Real timestamp from mill operation
2. **`mill_id`** - Which mill this data came from (6, 7, or 8)
3. **`data_quality`** - Quality indicator:
   - `consensus_motif` - Gold standard recurring pattern
   - `normal` - High-quality stable operation
4. **`consensus_motif_id`** - Which consensus motif (1, 2, 3...) or null for normal data
5. **Feature columns** - All MV and CV features for training

## Creation Process

### Step 1: Extract Consensus Motif Windows
```python
for motif_idx, motif_set in enumerate(consensus_motifs):
    for start_idx in motif_set:
        # Extract full window (e.g., 240 minutes)
        consensus_window = full_features.iloc[start_idx:start_idx + window_size]
        consensus_window['data_quality'] = 'consensus_motif'
        consensus_window['consensus_motif_id'] = motif_idx + 1
```

**Result**: ~5-20 consensus motifs × 240 minutes = ~1,200-4,800 samples

### Step 2: Add Non-Overlapping Normal Windows
```python
# Mark all consensus motif indices
consensus_indices_set = {all indices in consensus windows}

# Add normal data that doesn't overlap
for idx in range(len(full_features)):
    if normal_mask[idx] and idx not in consensus_indices_set:
        # This is normal data NOT already in consensus
        normal_data.append(row)
```

**Result**: ~20,000-60,000 additional normal samples (no duplicates)

### Step 3: Combine and Save
```python
premium_data = pd.concat([consensus_data, normal_data])
premium_data.to_csv('phase2_premium_training_data.csv')
```

**Result**: ~21,000-65,000 total high-quality training samples

## Usage Examples

### Basic Training
```python
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

# Load premium data
data = pd.read_csv('phase2_premium_training_data.csv')

# Prepare features and target
MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
TARGET = 'PulpHC'  # Example target

X = data[MV_FEATURES + CV_FEATURES]
y = data[TARGET]

# Train model
model = RandomForestRegressor(n_estimators=100)
model.fit(X, y)
```

### Weighted Training (Emphasize Consensus)
```python
# Give consensus motifs 2x weight
weights = data['data_quality'].map({
    'consensus_motif': 2.0,
    'normal': 1.0
})

model.fit(X, y, sample_weight=weights)
```

**Why?** Consensus motifs are validated patterns - we want the model to learn them better!

### Stratified Split (Preserve Quality Distribution)
```python
from sklearn.model_selection import train_test_split

# Split while maintaining consensus/normal ratio
X_train, X_test, y_train, y_test = train_test_split(
    X, y, 
    test_size=0.2,
    stratify=data['data_quality'],  # Keep same ratio in train/test
    random_state=42
)
```

### Multi-Mill Training
```python
# Option 1: Train universal model (all mills)
model_universal = RandomForestRegressor()
model_universal.fit(X, y)

# Option 2: Include mill_id as feature
X_with_mill = data[MV_FEATURES + CV_FEATURES + ['mill_id']]
model_mill_aware = RandomForestRegressor()
model_mill_aware.fit(X_with_mill, y)

# Option 3: Train per mill, compare
for mill in [6, 7, 8]:
    mill_data = data[data['mill_id'] == mill]
    X_mill = mill_data[MV_FEATURES + CV_FEATURES]
    y_mill = mill_data[TARGET]
    
    model = RandomForestRegressor()
    model.fit(X_mill, y_mill)
    print(f"Mill {mill} model score: {model.score(X_mill, y_mill):.3f}")
```

### Analyze Consensus Patterns
```python
# What do the best patterns look like?
consensus = data[data['data_quality'] == 'consensus_motif']

print("Consensus Pattern Statistics:")
print(consensus[MV_FEATURES + CV_FEATURES].describe())

# Compare to normal data
normal = data[data['data_quality'] == 'normal']
print("\nNormal Data Statistics:")
print(normal[MV_FEATURES + CV_FEATURES].describe())

# Find differences
for feature in MV_FEATURES + CV_FEATURES:
    consensus_mean = consensus[feature].mean()
    normal_mean = normal[feature].mean()
    diff = ((consensus_mean - normal_mean) / normal_mean) * 100
    print(f"{feature}: Consensus {diff:+.1f}% vs Normal")
```

## Expected Results

### Single Mill (Mill 8, 15 days)
```
Total samples: ~25,000
├─ Consensus motifs: ~2,000 (8%)
└─ Normal windows: ~23,000 (92%)

Per-Mill Distribution:
  Mill 8: 25,000 samples (2,000 consensus + 23,000 normal)
```

### Multi-Mill (Mills 6, 7, 8, 15 days each)
```
Total samples: ~65,000
├─ Consensus motifs: ~5,000 (8%)
└─ Normal windows: ~60,000 (92%)

Per-Mill Distribution:
  Mill 6: ~20,000 samples (1,500 consensus + 18,500 normal)
  Mill 7: ~22,000 samples (1,800 consensus + 20,200 normal)
  Mill 8: ~23,000 samples (1,700 consensus + 21,300 normal)
```

## Quality Metrics

### Consensus Motifs
- ✅ **Matrix profile distance** < 0.5 (low = high similarity)
- ✅ **Recurring patterns** (2+ occurrences)
- ✅ **Cross-mill validated** (if multi-mill)
- ✅ **Stable segments** (within steady-state periods)

### Normal Windows
- ✅ **Matrix profile distance** < discord threshold
- ✅ **No anomalies** (discords removed)
- ✅ **Stable operation** (passes all filters)
- ✅ **Non-overlapping** with consensus motifs

## Advantages Over Alternatives

### vs. Using All Data
| Metric | All Data | Premium Data |
|--------|----------|--------------|
| Volume | 100,000+ | 25,000-65,000 |
| Quality | Mixed | High |
| Anomalies | Included | Removed |
| Training Time | Long | Moderate |
| Model Performance | Good | Excellent |

### vs. Using Only Consensus
| Metric | Consensus Only | Premium Data |
|--------|----------------|--------------|
| Volume | 2,000-5,000 | 25,000-65,000 |
| Quality | Excellent | Excellent |
| Diversity | Limited | High |
| Overfitting Risk | High | Low |
| Coverage | Narrow | Broad |

## Best Practices

### 1. Start with Premium Data
Always use `phase2_premium_training_data.csv` as your primary training dataset.

### 2. Weight Consensus Motifs
Give consensus motifs higher weight during training (1.5x - 2x).

### 3. Stratified Splitting
Use `stratify=data['data_quality']` to maintain quality distribution in train/test splits.

### 4. Analyze Patterns
Study consensus motifs to understand what "good operation" looks like.

### 5. Multi-Mill Models
For multi-mill data, consider including `mill_id` as a feature or training mill-specific models.

### 6. Validate on Consensus
Use consensus motifs as a validation set to ensure model learns best practices.

## Troubleshooting

### Too Few Consensus Motifs
**Problem**: Only 1-2 consensus motifs found
**Solution**: 
- Reduce `min_neighbors` in consensus detection
- Increase data collection period
- Adjust filtering criteria

### Imbalanced Data
**Problem**: 95%+ normal, <5% consensus
**Solution**:
- Use sample weights to balance
- Oversample consensus motifs
- Undersample normal data

### Poor Model Performance
**Problem**: Model doesn't learn patterns well
**Solution**:
- Check if consensus motifs are truly high quality
- Verify normal data isn't too noisy
- Try weighting consensus motifs higher
- Analyze feature importance

## Conclusion

The **Premium Training Data** provides the optimal balance of:
- ✅ Quality (consensus motifs)
- ✅ Volume (normal windows)
- ✅ Diversity (multiple mills, conditions)
- ✅ Cleanliness (no anomalies, no duplicates)

**Recommendation**: Always use `phase2_premium_training_data.csv` for training your models. It represents the best quality data available from your steady-state extraction pipeline.
