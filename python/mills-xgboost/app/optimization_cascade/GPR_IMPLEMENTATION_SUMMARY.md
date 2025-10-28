# GPR Cascade Model Implementation Summary

## Overview

Successfully implemented Gaussian Process Regression (GPR) model support for cascade optimization endpoints. The system now supports both XGBoost (`xgb`) and GPR (`gpr`) model types with a unified API interface.

## Files Created

### 1. `gpr_cascade_models.py`
**Purpose**: GPR model loading, prediction, and management

**Key Features**:
- Loads GPR models from `cascade_models/mill_gp_XX/` directories
- Supports uncertainty quantification (predictions with standard deviation)
- Compatible with XGBoost cascade structure (MV → CV → Target)
- Uses `pickle` for model serialization and `StandardScaler` for feature scaling

**Key Methods**:
- `load_models()`: Loads GPR models and scalers from disk
- `predict_cascade()`: Makes predictions with optional uncertainty quantification
- `list_mill_models()`: Lists all available GPR mill models
- `get_model_summary()`: Returns model summary with metadata

**Model Structure**:
- Process models: `process_model_{cv_var}.pkl` + `process_model_{cv_var}_scaler.pkl`
- Quality model: `quality_model.pkl` + `quality_model_scaler.pkl`
- Metadata: `metadata.json` (same structure as XGBoost models)

### 2. `gpr_cascade_optimizer.py`
**Purpose**: Optuna-based Bayesian optimization for GPR models

**Key Features**:
- Uses Optuna TPE sampler for efficient optimization
- Supports uncertainty-aware optimization (robust optimization)
- Constraint handling with quadratic penalty functions
- Returns best MV values with predicted CVs and target

**Optimization Modes**:
- **Standard**: Optimize mean prediction only
- **Uncertainty-aware**: Optimize `mean ± k*std` for robust solutions
  - Minimization: `mean + k*std` (prefer low mean and low uncertainty)
  - Maximization: `mean - k*std` (prefer high mean and low uncertainty)

**Key Classes**:
- `GPROptimizationRequest`: Request model with bounds and settings
- `GPROptimizationResult`: Result model with best parameters and uncertainty
- `GPRCascadeOptimizer`: Main optimizer class

### 3. `test_gpr_models.py`
**Purpose**: Test script for GPR model functionality

**Tests**:
1. List available GPR models
2. Load GPR model for a specific mill
3. Test prediction with and without uncertainty

## API Endpoint Updates

### Modified Endpoints

All cascade optimization endpoints now support the `model_type` parameter:

#### 1. **POST `/api/v1/ml/cascade/predict`**
**New Parameters**:
- `model_type`: `"xgb"` (default) or `"gpr"`
- `return_uncertainty`: `bool` (GPR only) - Include uncertainty in response

**Response** (GPR with uncertainty):
```json
{
  "predicted_target": 23.45,
  "predicted_cvs": {"DensityHC": 150.2, "PulpHC": 65.3, ...},
  "is_feasible": true,
  "mill_number": 8,
  "model_type": "gpr",
  "cv_uncertainties": {"DensityHC": 5.2, "PulpHC": 3.1, ...},
  "target_uncertainty": 1.2
}
```

#### 2. **POST `/api/v1/ml/cascade/optimize`**
**New Parameters**:
- `model_type`: `"xgb"` (default) or `"gpr"`
- `use_uncertainty`: `bool` (GPR only) - Enable uncertainty-aware optimization
- `uncertainty_weight`: `float` (GPR only) - Weight for uncertainty penalty (default: 1.0)

**Response** (GPR with uncertainty):
```json
{
  "status": "success",
  "best_mv_values": {"Ore": 210.5, "WaterMill": 24.3, ...},
  "best_cv_values": {"DensityHC": 148.7, "PulpHC": 66.2, ...},
  "best_target_value": 23.12,
  "best_target_uncertainty": 0.95,
  "is_feasible": true,
  "n_trials": 100,
  "best_trial_number": 67,
  "mill_number": 8,
  "model_type": "gpr",
  "optimization_config": {
    "target_variable": "PSI200",
    "maximize": false,
    "n_trials": 100,
    "model_type": "gpr",
    "use_uncertainty": true,
    "uncertainty_weight": 1.0
  }
}
```

#### 3. **GET `/api/v1/ml/cascade/models`**
**New Parameters**:
- `model_type`: `"xgb"` (default) or `"gpr"`

**Response**:
```json
{
  "status": "success",
  "model_type": "gpr",
  "mill_models": {
    "8": {
      "path": "cascade_models/mill_gp_08",
      "metadata": {...},
      "model_files": ["process_model_DensityHC.pkl", ...],
      "model_type": "gpr",
      "has_complete_cascade": true
    }
  },
  "total_mills": 1
}
```

#### 4. **GET `/api/v1/ml/cascade/models/{mill_number}`**
**New Parameters**:
- `model_type`: `"xgb"` (default) or `"gpr"`

Returns detailed model information including features, performance metrics, and metadata.

#### 5. **POST `/api/v1/ml/cascade/models/{mill_number}/load`**
**New Parameters**:
- `model_type`: `"xgb"` (default) or `"gpr"`

Loads the specified model type into memory for predictions and optimization.

#### 6. **GET `/api/v1/ml/cascade/health`**
**Enhanced Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T09:30:00",
  "components": {
    "classifier": "ready",
    "xgb_model_manager": "ready",
    "gpr_model_manager": "ready",
    "current_xgb_mill": 8,
    "current_gpr_mill": 8
  },
  "available_xgb_mills": [7, 8, 9],
  "available_gpr_mills": [8],
  "total_xgb_models": 3,
  "total_gpr_models": 1
}
```

## Directory Structure

```
cascade_models/
├── mill_8/                    # XGBoost models
│   ├── metadata.json
│   ├── process_model_DensityHC.pkl
│   ├── scaler_mv_to_DensityHC.pkl
│   ├── quality_model.pkl
│   └── scaler_quality_model.pkl
│
└── mill_gp_08/                # GPR models
    ├── metadata.json
    ├── process_model_DensityHC.pkl
    ├── process_model_DensityHC_scaler.pkl
    ├── quality_model.pkl
    └── quality_model_scaler.pkl
```

## Key Differences: XGBoost vs GPR

| Feature | XGBoost | GPR |
|---------|---------|-----|
| Model files | `.pkl` (joblib) | `.pkl` (pickle) |
| Scaler naming | `scaler_mv_to_{cv}` | `process_model_{cv}_scaler` |
| Directory pattern | `mill_{number}` | `mill_gp_{number:02d}` |
| Uncertainty | No | Yes (σ with predictions) |
| Optimization | Standard only | Standard + Uncertainty-aware |
| Training | Supported | Not implemented yet |

## Usage Examples

### 1. Load GPR Model
```python
from optimization_cascade.gpr_cascade_models import GPRCascadeModelManager

manager = GPRCascadeModelManager("cascade_models", mill_number=8)
success = manager.load_models()
```

### 2. Predict with Uncertainty
```python
mv_values = {"Ore": 200.0, "WaterMill": 25.0, "WaterZumpf": 200.0}
dv_values = {"Class_15": 50.0, "Daiki": 45.0, "FE": 30.0}

result = manager.predict_cascade(
    mv_values, 
    dv_values, 
    return_uncertainty=True
)

print(f"Target: {result['predicted_target']:.2f} ± {result['target_uncertainty']:.2f}")
```

### 3. Optimize with Uncertainty Awareness
```python
from optimization_cascade.gpr_cascade_optimizer import GPRCascadeOptimizer, GPROptimizationRequest

request = GPROptimizationRequest(
    mv_bounds={"Ore": (150, 250), "WaterMill": (20, 30), "WaterZumpf": (150, 250)},
    cv_bounds={"DensityHC": (100, 200), "PulpHC": (50, 80)},
    dv_values={"Class_15": 50.0, "Daiki": 45.0, "FE": 30.0},
    target_variable="PSI200",
    maximize=False,
    n_trials=100,
    use_uncertainty=True,
    uncertainty_weight=1.0
)

optimizer = GPRCascadeOptimizer(manager)
result = optimizer.optimize(request)
```

### 4. API Request (cURL)
```bash
# Load GPR model
curl -X POST "http://localhost:8000/api/v1/ml/cascade/models/8/load?model_type=gpr"

# Predict with uncertainty
curl -X POST "http://localhost:8000/api/v1/ml/cascade/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "mv_values": {"Ore": 200, "WaterMill": 25, "WaterZumpf": 200},
    "dv_values": {"Class_15": 50, "Daiki": 45, "FE": 30},
    "model_type": "gpr",
    "return_uncertainty": true
  }'

# Optimize with uncertainty awareness
curl -X POST "http://localhost:8000/api/v1/ml/cascade/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "mv_bounds": {"Ore": [150, 250], "WaterMill": [20, 30], "WaterZumpf": [150, 250]},
    "cv_bounds": {"DensityHC": [100, 200], "PulpHC": [50, 80]},
    "dv_values": {"Class_15": 50, "Daiki": 45, "FE": 30},
    "target_variable": "PSI200",
    "maximize": false,
    "n_trials": 100,
    "model_type": "gpr",
    "use_uncertainty": true,
    "uncertainty_weight": 1.0
  }'
```

## Testing

Run the test script to verify GPR functionality:

```bash
cd python/mills-xgboost/app/optimization_cascade
python test_gpr_models.py
```

**Expected Output**:
- ✅ Lists all available GPR models
- ✅ Loads GPR model for Mill 8
- ✅ Makes predictions without uncertainty
- ✅ Makes predictions with uncertainty
- ✅ Shows CV and target uncertainties

## Next Steps (Not Implemented)

1. **Training Endpoint**: Add GPR model training support (currently only XGBoost training is supported)
2. **UI Integration**: Update frontend to support model type selection
3. **Hybrid Optimization**: Combine XGBoost and GPR predictions for ensemble approaches
4. **Advanced Uncertainty**: Implement confidence intervals and prediction intervals

## Notes

- **Backward Compatibility**: Default `model_type="xgb"` ensures existing code continues to work
- **No Training Changes**: Training endpoints remain unchanged (XGBoost only)
- **Metadata Compatibility**: GPR models use the same metadata structure as XGBoost models
- **Uncertainty Quantification**: GPR models provide prediction uncertainty (standard deviation) which can be used for robust optimization
- **Performance**: GPR predictions are slower than XGBoost but provide valuable uncertainty information

## Dependencies

Required Python packages (already in environment):
- `scikit-learn` (for GaussianProcessRegressor and StandardScaler)
- `optuna` (for Bayesian optimization)
- `numpy`, `pandas` (for data handling)
- `pickle` (for model serialization)

## Summary

The implementation provides a clean, unified API for both XGBoost and GPR cascade models:
- ✅ Separate model managers for clean separation of concerns
- ✅ Unified endpoint interface with `model_type` parameter
- ✅ Uncertainty quantification support for GPR models
- ✅ Uncertainty-aware optimization for robust solutions
- ✅ Backward compatible (default to XGBoost)
- ✅ Comprehensive testing script
- ⏳ Training endpoint not modified (as requested)
