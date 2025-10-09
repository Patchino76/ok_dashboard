# Phase 2 Enhanced Testing Guide

## Overview
This guide explains the enhanced motif extraction features implemented in Phase 2 and how to test them.

---

## What We Implemented

### **Step 1: FLUSS Regime Detection**
**What it does:** Automatically detects regime changes (transitions between different operating states) in your mill data.

**Why it's useful:** Instead of manually setting thresholds, FLUSS finds natural breakpoints where the process behavior changes significantly. This helps identify true steady-state periods between transitions.

**Key Parameters:**
- `n_regimes`: Number of regime changes to detect (default: 5)
- `L`: Arc curve subsequence length (default: window_size // 2)

**Output Files:**
- `phase2_regime_changes.csv` - Timestamps and indices of detected regime changes
- `phase2_regime_changes.png` - Visualization showing where regimes change

---

### **Step 2: Steady Segment Extraction**
**What it does:** Extracts continuous segments between regime changes that represent stable operating periods.

**Why it's useful:** These segments are ideal candidates for training data because they represent consistent process behavior without transitions.

**Key Parameters:**
- `min_segment_length`: Minimum length for a segment to be considered (default: window_size)

**Output Files:**
- `phase2_steady_segments.csv` - Start/end indices and timestamps for each steady segment

---

### **Step 3: Consensus Motif Discovery**
**What it does:** Finds patterns that occur multiple times (not just once), ensuring you're capturing truly recurring steady states.

**Why it's useful:** A pattern that appears only once might be noise or a lucky coincidence. Consensus motifs appear 2+ times, indicating genuine steady-state conditions.

**Key Parameters:**
- `k`: Number of consensus motifs to find (default: 3)
- `min_neighbors`: Minimum occurrences required (default: 2)
- `max_distance`: Maximum matrix profile distance threshold

**Output Files:**
- `phase2_consensus_motifs.csv` - All occurrences of each consensus motif
- `phase2_consensus_motifs.png` - Visualization showing overlapped occurrences

---

### **Step 4: Snippet Extraction**
**What it does:** Finds the single most representative pattern for each major operating mode.

**Why it's useful:** Snippets are "golden examples" - the best representatives of your steady states. Perfect for initial model training or validation.

**Key Parameters:**
- `k`: Number of snippets to extract (default: 3)

**Output Files:**
- `phase2_snippets.csv` - Indices and timestamps of snippet patterns

---

### **Step 5: Quality Scoring**
**What it does:** Scores each motif based on multiple quality metrics.

**Why it's useful:** Not all low-distance patterns are equally good for training. Quality scoring considers:
- **MP Distance** (40% weight): Lower is better
- **Stability** (30% weight): Low variance within window
- **Completeness** (20% weight): Full window length
- **Range Coverage** (10% weight): Good feature coverage

---

## How to Test

### **Basic Test Run**

```bash
cd c:\Projects\ok_dashboard\python\mills-xgboost\app\optimization_cascade\tests\steady_state_tests
python test_phase2_matrix_profile.py
```

### **Expected Console Output**

```
================================================================================
PHASE 2: MATRIX PROFILE COMPUTATION
================================================================================
Mill 6 | 2024-XX-XX to 2025-XX-XX | Residence: 60min

[Data Preparation]
Filtered: XXXXX → XXXX rows (Ore>160, DensityHC>1600, WaterMill>10)

[Matrix Profile Computation]
✅ Multivariate MP computed: XXXX profile points

[Step 1: Regime Detection]
[FLUSS] Detecting 5 regimes with L=30...
✅ Detected 5 regime change points
  Regime change 1: index=XXX
  Regime change 2: index=XXX
  ...

[Step 2: Steady Segment Extraction]
[Segment Extraction] Finding steady segments (min length=60)...
  Segment 1: [0:XXX] (length=XXX)
  Segment 2: [XXX:XXX] (length=XXX)
  ...
✅ Found X steady segments

[Step 3: Consensus Motif Discovery]
[Consensus Motifs] Finding 3 consensus motifs...
  Min neighbors: 2
  Max distance: X.XXXX
  Consensus motif 1: X occurrences, avg distance=X.XXXX
  Consensus motif 2: X occurrences, avg distance=X.XXXX
  ...
✅ Found X consensus motifs

[Step 4: Snippet Extraction]
[Snippet Extraction] Finding 3 most representative patterns...
✅ Extracted 3 snippets
  Snippet 1: index=XXX
  Snippet 2: index=XXX
  Snippet 3: index=XXX

[Step 5: Traditional Motif/Discord Detection]
Found 10 motifs, 10 discords

[Generating Visualizations]
...

Enhanced Features Summary:
  - Regime changes detected: 5
  - Steady segments found: X
  - Consensus motifs: X
  - Snippets extracted: 3
  - Traditional motifs: 10
  - Discords: 10
```

---

## Output Files Generated

### **CSV Files (Data)**
1. `phase2_initial_data.csv` - Raw filtered data
2. `phase2_matrix_profile.csv` - Matrix profile values
3. `phase2_regime_changes.csv` - Regime change locations
4. `phase2_steady_segments.csv` - Steady-state segments
5. `phase2_consensus_motifs.csv` - Consensus motif occurrences
6. `phase2_snippets.csv` - Snippet indices
7. `phase2_motif_indices.csv` - Traditional motif indices
8. `phase2_motif_windows.csv` - Full motif window data
9. `phase2_normal_windows.csv` - All normal (non-anomalous) windows

### **PNG Files (Visualizations)**
1. `phase2_matrix_profile_overview.png` - MP overview with thresholds
2. `phase2_mp_histogram.png` - Distance distribution
3. `phase2_regime_changes.png` - **NEW:** Regime change visualization
4. `phase2_consensus_motifs.png` - **NEW:** Consensus motif patterns
5. `phase2_top_motifs.png` - Top 5 traditional motifs
6. `phase2_motif_overlays.png` - Overlapped motif windows
7. `phase2_top_discords.png` - Top 5 anomalies

---

## How to Interpret Results

### **1. Check Regime Changes Plot**
- Red vertical lines show where operating conditions changed
- Segments between lines are potential steady states
- **Good:** 3-7 regime changes (not too many, not too few)
- **Bad:** 20+ changes (data too noisy) or 0-1 changes (no variation)

### **2. Review Steady Segments**
- Look at `phase2_steady_segments.csv`
- **Good:** Segments with length > 2× window_size
- **Bad:** Many short segments (< window_size)
- **Action:** If segments are too short, increase filtering thresholds

### **3. Analyze Consensus Motifs**
- Check `phase2_consensus_motifs.csv`
- **Good:** 3-5 consensus motifs with 3+ occurrences each
- **Bad:** No consensus motifs (patterns don't repeat)
- **Action:** If no consensus, your process might be too variable

### **4. Examine Snippets**
- Snippets are your "golden examples"
- Use these for initial model validation
- **Good:** Snippets from different steady segments
- **Bad:** All snippets from same time period

### **5. Compare with Traditional Motifs**
- Traditional motifs (Step 5) vs Consensus motifs (Step 3)
- Consensus motifs should be a subset with higher quality
- **Good:** Consensus motifs have lower average distance

---

## Recommended Training Data Selection Strategy

### **Strategy 1: Conservative (Highest Quality)**
Use only **snippet indices** for training:
- Pros: Cleanest data, most representative
- Cons: Small dataset, may underfit
- **Use when:** You have limited computational resources

### **Strategy 2: Balanced (Recommended)**
Use **consensus motif occurrences**:
- Pros: Multiple examples of each steady state
- Cons: Slightly more variation
- **Use when:** You want good generalization

### **Strategy 3: Comprehensive**
Use all windows from **steady segments**:
- Pros: Maximum training data
- Cons: May include some transitions
- **Use when:** You have lots of data and want robust models

### **Strategy 4: Hybrid (Best)**
Combine:
1. All snippet windows (golden examples)
2. All consensus motif windows (recurring patterns)
3. Top 50% of windows from steady segments (by quality score)

---

## Troubleshooting

### **Issue: No consensus motifs found**
**Cause:** Patterns don't repeat enough
**Solution:** 
- Reduce `min_neighbors` from 2 to 1
- Increase `max_distance` threshold
- Collect more data

### **Issue: Too many regime changes**
**Cause:** Data is very noisy
**Solution:**
- Increase filtering thresholds (Ore, DensityHC ranges)
- Reduce `n_regimes` parameter
- Apply additional smoothing in Phase 1

### **Issue: Segments too short**
**Cause:** Frequent transitions between states
**Solution:**
- Reduce `min_segment_length`
- Increase data collection period
- Focus on specific operating modes

### **Issue: Snippets all from same period**
**Cause:** One dominant operating mode
**Solution:**
- Increase `k` to extract more snippets
- Manually select from different steady segments
- Collect data from more varied conditions

---

## Next Steps

After Phase 2 completes successfully:

1. **Review all visualizations** in the `output/` directory
2. **Examine CSV files** to understand pattern distribution
3. **Select training data strategy** based on your needs
4. **Proceed to Phase 3** for motif-based model training

---

## Advanced Usage

### **Adjust Regime Detection Sensitivity**
```python
# More sensitive (detects more changes)
cac, regime_locations = mp_computer.detect_regimes(n_regimes=10, L=20)

# Less sensitive (fewer changes)
cac, regime_locations = mp_computer.detect_regimes(n_regimes=3, L=60)
```

### **Custom Quality Scoring**
```python
# Get quality scores for a specific window
window_data = full_features.iloc[start_idx:start_idx + window_size]
mp_distance = mp_results['matrix_profile'][start_idx]
quality_score, component_scores = mp_computer.compute_motif_quality_score(
    window_data, mp_distance
)

print(f"Total quality: {quality_score:.3f}")
print(f"Components: {component_scores}")
```

### **Filter Windows by Quality**
```python
# Only use windows with quality > 0.7
high_quality_windows = []
for idx in candidate_indices:
    window = full_features.iloc[idx:idx + window_size]
    score, _ = mp_computer.compute_motif_quality_score(window, mp_results['matrix_profile'][idx])
    if score > 0.7:
        high_quality_windows.append(idx)
```

---

## Performance Notes

- **FLUSS:** Fast, typically < 5 seconds
- **Consensus Motifs:** Moderate, 10-30 seconds depending on data size
- **Snippets:** Slow, 30-60 seconds for large datasets
- **Total Phase 2 Runtime:** 2-5 minutes for 100k data points

---

## Questions?

If you encounter issues or need clarification:
1. Check the console output for error messages
2. Review the generated visualizations
3. Examine the CSV files for data quality
4. Adjust parameters based on troubleshooting guide above
