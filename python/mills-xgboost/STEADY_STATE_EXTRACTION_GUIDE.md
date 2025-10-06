# Steady-State Extraction System - Complete Guide

## 🎯 Overview

This system uses **STUMPY** (matrix profile library) to automatically identify steady-state operating regimes in noisy mill process data, extracting clean training data for improved cascade model performance.

## 📋 Table of Contents

1. [Why This Matters](#why-this-matters)
2. [System Architecture](#system-architecture)
3. [Installation](#installation)
4. [Quick Start](#quick-start)
5. [Detailed Usage](#detailed-usage)
6. [Testing](#testing)
7. [Integration with Cascade Training](#integration-with-cascade-training)
8. [Configuration Guide](#configuration-guide)
9. [Troubleshooting](#troubleshooting)

---

## Why This Matters

### The Problem
- **Noisy data**: Mill sensors capture startup, shutdown, transients, and unstable periods
- **Residence time**: Ball mills have 60-90 minute residence time - transient data doesn't represent true cause-effect
- **Model contamination**: Training on all data includes periods that don't reflect steady-state relationships

### The Solution
- **Automatic pattern detection**: STUMPY finds recurring steady-state patterns (motifs)
- **Quality filtering**: Only high-quality, consistent patterns used for training
- **Regime identification**: Discovers different operating modes (optimal, underload, overload)
- **Better models**: Clean data → more reliable predictions

### Expected Benefits
- **10-30% improvement** in model R² scores
- **Reduced RMSE** in predictions
- **Better generalization** to new operating conditions
- **Process insights** from regime identification

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                     │
│                  Mill Data + Ore Quality                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Data Preparation (data_preparation.py)             │
│ • Load from database                                         │
│ • Handle missing values                                      │
│ • Normalize features (StandardScaler)                        │
│ • Resample to 1-min frequency                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Matrix Profile (matrix_profile.py)                 │
│ • Compute multivariate matrix profile (STUMPY)               │
│ • Window size = residence time (60-90 min)                   │
│ • Distance profile shows pattern uniqueness                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Motif Discovery (motif_discovery.py)               │
│ • Extract top-K motifs (recurring patterns)                  │
│ • Find all occurrences of each motif                         │
│ • Calculate quality metrics                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: Motif Analysis (motif_analysis.py)                 │
│ • Analyze feature characteristics                            │
│ • Check correlation consistency                              │
│ • Label operating regimes                                    │
│ • Validate against process knowledge                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: Steady-State Extraction (steady_state_extractor.py)│
│ • Extract windows from high-quality motifs                   │
│ • Aggregate (median) and assign quality scores               │
│ • Create clean training dataset                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              CASCADE MODEL TRAINING                          │
│         (cascade_training_with_steady_state.py)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation

### Prerequisites
```bash
# Python 3.8+
# PostgreSQL database with mill data
```

### Install Dependencies
```bash
# Using your venv
C:\venv\crewai311\Scripts\activate

# Install STUMPY and dependencies
pip install stumpy matplotlib seaborn scikit-learn pandas numpy
```

### Verify Installation
```python
import stumpy
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler

print("✅ All dependencies installed successfully")
```

---

## Quick Start

### 1. Run Phase 1 Test (Data Preparation)
```bash
cd c:\Projects\ok_dashboard\python\mills-xgboost
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_phase1_data_prep.py
```

**Expected Output:**
- `phase1_raw_data.png` - Time series plots
- `phase1_normalized_data.png` - Normalized data
- `phase1_correlation_matrix.png` - Feature correlations
- `phase1_distributions.png` - Feature distributions
- CSV files with prepared data

### 2. Run Phase 2 Test (Matrix Profile)
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_phase2_matrix_profile.py
```

**Expected Output:**
- `phase2_matrix_profile_overview.png` - Matrix profile visualization
- `phase2_mp_histogram.png` - Distance distribution
- `phase2_top_motifs.png` - Recurring patterns
- `phase2_top_discords.png` - Anomalies

### 3. Run Complete Pipeline
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_complete_pipeline.py
```

**Expected Output:**
- Steady-state dataset CSV
- Regime distribution plots
- Quality metrics
- Summary report

### 4. Test Cascade Integration
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_cascade_integration.py
```

**Expected Output:**
- Trained cascade models (with steady-state data)
- Baseline models (all data)
- Performance comparison plots

---

## Detailed Usage

### Using Individual Modules

#### Phase 1: Data Preparation
```python
from database.db_connector import MillsDataConnector
from optimization_cascade.steady_state_extraction import DataPreparation

db_connector = MillsDataConnector(host, port, dbname, user, password)
data_prep = DataPreparation(db_connector)

clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
    mill_number=8,
    start_date='2025-01-01 00:00:00',
    end_date='2025-01-07 23:59:59',
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC'],
    dv_features=['Shisti', 'Daiki', 'Grano'],
    resample_freq='1min'
)
```

#### Phase 2: Matrix Profile
```python
from optimization_cascade.steady_state_extraction import MatrixProfileComputer

mp_computer = MatrixProfileComputer()
mp_results = mp_computer.compute_mp_with_auto_window(
    data=normalized_data,
    residence_time_minutes=60,  # Mill residence time
    sampling_freq_minutes=1
)

# Access results
matrix_profile = mp_results['matrix_profile']
window_size = mp_results['window_size']
statistics = mp_results['statistics']
```

#### Phase 3-5: Complete Extraction
```python
from optimization_cascade.steady_state_extraction import (
    MotifDiscovery,
    MotifAnalyzer,
    SteadyStateExtractor
)

# Discover motifs
motif_discovery = MotifDiscovery()
motifs = motif_discovery.discover_motifs(
    data=normalized_data,
    matrix_profile=mp_results['matrix_profile'],
    matrix_profile_index=mp_results['matrix_profile_index'],
    window_size=mp_results['window_size'],
    k=10  # Number of motifs
)

# Analyze motifs
motif_analyzer = MotifAnalyzer()
analysis = motif_analyzer.analyze_all_motifs(
    motifs=motifs,
    data=normalized_data,
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC']
)

# Extract steady-state data
ss_extractor = SteadyStateExtractor()
steady_state_df = ss_extractor.extract_all_motifs(
    motifs=motifs,
    data=normalized_data,
    original_data=clean_data,
    regime_labels=motif_analyzer.regime_labels,
    quality_threshold=0.5,
    min_occurrences=3
)

# Save results
ss_extractor.save_steady_state_data('steady_state_mill8.csv')
```

---

## Integration with Cascade Training

### Simple Training with Steady-State Data
```python
from optimization_cascade.cascade_training_with_steady_state import CascadeTrainingWithSteadyState

training_system = CascadeTrainingWithSteadyState(db_connector)

# Extract steady-state data
steady_state_df = training_system.extract_steady_state_data(
    mill_number=8,
    start_date='2025-01-01 00:00:00',
    end_date='2025-01-07 23:59:59',
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC'],
    dv_features=['Shisti', 'Daiki', 'Grano']
)

# Train cascade models
results = training_system.train_cascade_models(
    mill_number=8,
    target_variable='PSI200',
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC'],
    dv_features=['Shisti', 'Daiki', 'Grano'],
    model_suffix='steady_state'
)
```

### Training with Comparison
```python
# Train both with and without steady-state extraction
comparison = training_system.train_with_comparison(
    mill_number=8,
    start_date='2025-01-01 00:00:00',
    end_date='2025-01-07 23:59:59',
    target_variable='PSI200',
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC'],
    dv_features=['Shisti', 'Daiki', 'Grano']
)

# View improvement
for metric, improvement in comparison['improvement'].items():
    print(f"{metric}: {improvement:+.2%}")
```

---

## Configuration Guide

### Key Parameters

#### Data Preparation
| Parameter | Default | Description |
|-----------|---------|-------------|
| `resample_freq` | '1min' | Data resampling frequency |
| `mv_features` | Required | Manipulated variables (what you control) |
| `cv_features` | Required | Controlled variables (what you measure) |
| `dv_features` | Optional | Disturbance variables (external factors) |

#### Matrix Profile
| Parameter | Default | Description |
|-----------|---------|-------------|
| `residence_time_minutes` | 60 | Process residence time (60-90 typical for mills) |
| `sampling_freq_minutes` | 1 | Data sampling frequency |

#### Motif Discovery
| Parameter | Default | Description |
|-----------|---------|-------------|
| `k` | 10 | Number of motifs to discover (5-20 typical) |
| `distance_threshold` | 2.0 | Max distance for grouping occurrences |

#### Quality Filtering
| Parameter | Default | Description |
|-----------|---------|-------------|
| `quality_threshold` | 0.5 | Minimum consistency score (0.5-0.7 typical) |
| `min_occurrences` | 3 | Minimum pattern occurrences (3-5 typical) |

### Tuning Guidelines

**For more data (lower quality threshold):**
- Decrease `quality_threshold` to 0.3-0.4
- Decrease `min_occurrences` to 2

**For higher quality (fewer records):**
- Increase `quality_threshold` to 0.7-0.8
- Increase `min_occurrences` to 5-10

**For different process dynamics:**
- Adjust `residence_time_minutes` based on your mill
- Shorter residence time → smaller window → more motifs
- Longer residence time → larger window → fewer motifs

---

## Troubleshooting

### Issue: "No steady-state data extracted"
**Cause**: Quality threshold too high or insufficient motifs
**Solution**:
- Lower `quality_threshold` to 0.3
- Increase `n_motifs` to 15-20
- Check if data has enough stable periods

### Issue: "Matrix profile computation too slow"
**Cause**: Large dataset or long window size
**Solution**:
- Reduce date range (test with 3-5 days first)
- Reduce `residence_time_minutes` if appropriate
- Use fewer features initially

### Issue: "All motifs labeled as 'Unstable'"
**Cause**: Heuristic labeling needs tuning for your process
**Solution**:
- Review `label_motif_regime()` in `motif_analysis.py`
- Adjust thresholds based on your process knowledge
- Add custom labeling logic

### Issue: "Model performance not improving"
**Cause**: Steady-state data may not be significantly different
**Solution**:
- Review regime distribution plots
- Check if extracted data covers different operating modes
- Increase data collection period
- Verify process actually has steady-state periods

---

## Output Files Reference

### Phase 1 Outputs
- `phase1_raw_data.png` - Original time series
- `phase1_normalized_data.png` - Normalized features
- `phase1_correlation_matrix.png` - Feature correlations
- `phase1_distributions.png` - Feature distributions
- `phase1_clean_data.csv` - Processed data
- `phase1_normalized_data.csv` - Normalized data

### Phase 2 Outputs
- `phase2_matrix_profile_overview.png` - MP visualization
- `phase2_mp_histogram.png` - Distance distribution
- `phase2_top_motifs.png` - Recurring patterns
- `phase2_top_discords.png` - Anomalies
- `phase2_matrix_profile.csv` - MP data
- `phase2_motif_indices.csv` - Motif locations

### Complete Pipeline Outputs
- `steady_state_data_mill{N}_{timestamp}.csv` - Final dataset
- `steady_state_data_mill{N}_{timestamp}_metadata.txt` - Extraction info
- `pipeline_steady_state_overview.png` - Data overview
- `pipeline_regime_distribution.png` - Regime analysis
- `pipeline_summary_report.txt` - Complete summary

### Cascade Integration Outputs
- `cascade_models_test/` - Trained models
- `cascade_integration_comparison.png` - Performance comparison
- `cascade_integration_report.txt` - Training report

---

## Next Steps

1. **Run tests** with your mill data
2. **Review visualizations** to understand patterns
3. **Tune parameters** based on results
4. **Compare model performance** with/without steady-state
5. **Deploy to production** if performance improves
6. **Monitor** model performance over time

---

## Support & References

- **STUMPY Documentation**: https://stumpy.readthedocs.io/
- **Matrix Profile**: https://www.cs.ucr.edu/~eamonn/MatrixProfile.html
- **Module README**: `app/optimization_cascade/steady_state_extraction/README.md`

For questions or issues, check the test scripts for working examples.
