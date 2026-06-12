# Steady-State Extraction System

## Overview

This system uses **STUMPY** (matrix profile library) to identify steady-state operating regimes and recurring patterns (motifs) in noisy mill process data. The extracted clean steady-state data can be used to train higher-quality cascade models.

## Why This Matters

- **Mill processes have residence time (~60-90 min)**: Transient periods don't represent true cause-effect relationships
- **Noisy data contaminates models**: Training on all data includes startup, shutdown, and unstable periods
- **Steady-state = better models**: Clean data from stable operating regimes produces more reliable predictions

## 5-Phase Pipeline

### Phase 1: Data Preparation
**Module**: `data_preparation.py`

- Loads mill and ore quality data from PostgreSQL via `db_connector`
- Handles missing values (interpolation, forward fill)
- Normalizes features using StandardScaler (critical for matrix profile!)
- Resamples to consistent frequency (1-min or 5-min)

**Key Functions**:
- `prepare_for_stumpy()`: Complete preparation pipeline
- `load_mill_data()`: Load from database
- `normalize_features()`: StandardScaler normalization

### Phase 2: Matrix Profile Computation
**Module**: `matrix_profile.py`

- Computes multivariate matrix profile using STUMPY's `mstump()`
- Window size based on process residence time (60-90 min typical)
- Distance profile shows pattern uniqueness at each timepoint
- Low distances = recurring patterns (motifs)
- High distances = anomalies (discords)

**Key Functions**:
- `compute_mp_with_auto_window()`: Auto-calculate window size and compute MP
- `compute_multivariate_mp()`: Core STUMPY integration
- `find_top_motifs()`: Extract motif candidates
- `find_top_discords()`: Extract anomaly candidates

### Phase 3: Motif Discovery
**Module**: `motif_discovery.py`

- Extracts top-K motifs (K=5-20 typical)
- Finds all occurrences of each motif pattern
- Groups similar patterns together
- Calculates motif quality metrics (consistency, variance)

**Key Functions**:
- `discover_motifs()`: Complete motif discovery pipeline
- `extract_motif_occurrences()`: Find all pattern matches
- `cluster_motifs()`: Group similar motifs using DBSCAN

### Phase 4: Motif Analysis & Validation
**Module**: `motif_analysis.py`

- Analyzes feature characteristics per motif
- Checks correlation consistency within motifs
- Labels motifs by operating regime (Optimal, Underload, Overload, etc.)
- Validates against known process behavior

**Key Functions**:
- `analyze_all_motifs()`: Complete analysis pipeline
- `analyze_motif_features()`: Feature statistics per motif
- `label_motif_regime()`: Assign regime labels

### Phase 5: Steady-State Extraction
**Module**: `steady_state_extractor.py`

- Extracts steady-state windows from high-quality motifs
- Aggregates each window (mean/median)
- Assigns regime labels and quality scores
- Creates clean training dataset

**Key Functions**:
- `extract_all_motifs()`: Extract from all high-quality motifs
- `get_training_data()`: Format for cascade model training
- `save_steady_state_data()`: Save to CSV with metadata

## Usage

### Quick Start

```python
from database.db_connector import MillsDataConnector
from optimization_cascade.steady_state_extraction import (
    DataPreparation,
    MatrixProfileComputer,
    MotifDiscovery,
    MotifAnalyzer,
    SteadyStateExtractor
)

# Initialize
db_connector = MillsDataConnector(host, port, dbname, user, password)

# Phase 1: Prepare data
data_prep = DataPreparation(db_connector)
clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
    mill_number=8,
    start_date='2025-01-01',
    end_date='2025-01-07',
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC'],
    resample_freq='1min'
)

# Phase 2: Compute matrix profile
mp_computer = MatrixProfileComputer()
mp_results = mp_computer.compute_mp_with_auto_window(
    data=normalized_data,
    residence_time_minutes=60
)

# Phase 3: Discover motifs
motif_discovery = MotifDiscovery()
motifs = motif_discovery.discover_motifs(
    data=normalized_data,
    matrix_profile=mp_results['matrix_profile'],
    matrix_profile_index=mp_results['matrix_profile_index'],
    window_size=mp_results['window_size'],
    k=10
)

# Phase 4: Analyze motifs
motif_analyzer = MotifAnalyzer()
analysis = motif_analyzer.analyze_all_motifs(
    motifs=motifs,
    data=normalized_data,
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC']
)

# Phase 5: Extract steady-state data
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

### Running Tests

```bash
# Test Phase 1 only
python app/optimization_cascade/tests/steady_state_tests/test_phase1_data_prep.py

# Test Phase 2 only
python app/optimization_cascade/tests/steady_state_tests/test_phase2_matrix_profile.py

# Test complete pipeline
python app/optimization_cascade/tests/steady_state_tests/test_complete_pipeline.py
```

## Configuration Parameters

### Data Preparation
- `resample_freq`: '1min' or '5min' (match your data frequency)
- `mv_features`: Manipulated variables (what you control)
- `cv_features`: Controlled variables (what you measure)
- `dv_features`: Disturbance variables (external factors)

### Matrix Profile
- `residence_time_minutes`: 60-90 typical for ball mills
- Window size auto-calculated from residence time

### Motif Discovery
- `k`: Number of motifs (5-20 typical)
- `distance_threshold`: Max distance for grouping (2.0 typical)

### Quality Filters
- `quality_threshold`: Min consistency score (0.5-0.7 typical)
- `min_occurrences`: Min pattern occurrences (3-5 typical)

## Output Files

Each test generates:
- **CSV files**: Extracted steady-state data
- **PNG plots**: Visualizations of patterns and regimes
- **Metadata**: Extraction parameters and statistics
- **Summary report**: Complete pipeline results

## Integration with Cascade Training

Use extracted steady-state data for cascade model training:

```python
# Get training data
X, y = ss_extractor.get_training_data(
    mv_features=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'],
    cv_features=['PulpHC', 'DensityHC', 'PressureHC'],
    target_variable='PSI200',
    regime_filter=['Normal_Load_Stable', 'High_Load_Stable']  # Optional
)

# Train cascade models with clean data
cascade_manager = CascadeModelManager()
cascade_manager.train_all_models(X, y)
```

## Key Benefits

1. **Cleaner Training Data**: Only stable operating periods
2. **Regime Identification**: Understand different operating modes
3. **Quality Metrics**: Know which data is most reliable
4. **Better Models**: Improved prediction accuracy and reliability
5. **Process Insights**: Discover recurring patterns and anomalies

## Dependencies

- `stumpy`: Matrix profile computation
- `pandas`: Data manipulation
- `numpy`: Numerical operations
- `scikit-learn`: Normalization and clustering
- `matplotlib`, `seaborn`: Visualization

## References

- STUMPY Documentation: https://stumpy.readthedocs.io/
- Matrix Profile Foundation: https://www.cs.ucr.edu/~eamonn/MatrixProfile.html
- Paper: "Matrix Profile I: All Pairs Similarity Joins for Time Series"
