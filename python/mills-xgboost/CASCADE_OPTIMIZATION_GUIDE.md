# Simple Cascade Optimization with Optuna

## Overview

This guide explains how to use the **simple Bayesian optimization** system for cascade models using Optuna. The system accepts MV/CV/DV limits and returns optimal MV values that maximize or minimize the target variable.

## Key Features

- ✅ **Simple API**: Minimal parameters, maximum results
- ✅ **Bayesian Optimization**: Uses Optuna for intelligent parameter search
- ✅ **Constraint Handling**: Respects CV bounds with penalty functions
- ✅ **Cascade Models**: Full MV → CV → Target prediction chain
- ✅ **Fast Results**: Typically 50-100 trials for good optimization

## API Endpoints

### 1. Optimization Endpoint
```
POST /api/v1/cascade/optimize
```

**Request Body:**
```json
{
  "mv_bounds": {
    "Ore": [140, 240],
    "WaterMill": [5, 25],
    "WaterZumpf": [140, 250],
    "MotorAmp": [150, 250]
  },
  "cv_bounds": {
    "PulpHC": [400, 600],
    "DensityHC": [1200, 2000],
    "PressureHC": [0.0, 0.6]
  },
  "dv_values": {
    "Shisti": 50.0,
    "Daiki": 40.0,
    "Grano": 60.0,
    "Class_12": 45.0,
    "Class_15": 35.0,
    "FE": 0.2
  },
  "target_variable": "PSI200",
  "maximize": false,
  "n_trials": 100
}
```

**Response:**
```json
{
  "status": "success",
  "best_mv_values": {
    "Ore": 185.2,
    "WaterMill": 15.8,
    "WaterZumpf": 195.4,
    "MotorAmp": 210.1
  },
  "best_cv_values": {
    "PulpHC": 520.3,
    "DensityHC": 1650.7,
    "PressureHC": 0.35
  },
  "best_target_value": 18.5,
  "is_feasible": true,
  "n_trials": 100,
  "best_trial_number": 67,
  "mill_number": 8
}
```

### 2. Model Management
```
GET /api/v1/cascade/models           # List available mill models
POST /api/v1/cascade/models/8/load   # Load models for Mill 8
GET /api/v1/cascade/models/8         # Get Mill 8 model info
```

### 3. Health Check
```
GET /api/v1/cascade/health           # System status
```

## Python Usage Examples

### Basic Optimization
```python
from app.optimization_cascade.simple_cascade_optimizer import optimize_cascade, get_default_bounds
from app.optimization_cascade.cascade_models import CascadeModelManager

# Load models
model_manager = CascadeModelManager("cascade_models", mill_number=8)
model_manager.load_models()

# Get default bounds
mv_bounds, cv_bounds, default_dv_values = get_default_bounds()

# Run optimization
result = optimize_cascade(
    model_manager=model_manager,
    mv_bounds=mv_bounds,
    cv_bounds=cv_bounds,
    dv_values=default_dv_values,
    target_variable="PSI200",
    maximize=False,  # Minimize PSI200
    n_trials=50
)

print(f"Optimal target: {result.best_target_value:.2f}")
print(f"Best MVs: {result.best_mv_values}")
```

### Custom Bounds
```python
# Tighter MV constraints
custom_mv_bounds = {
    "Ore": (160, 200),      # Narrower range
    "WaterMill": (10, 20),  # Specific operating window
    "WaterZumpf": (180, 220),
    "MotorAmp": (180, 220)
}

result = optimize_cascade(
    model_manager=model_manager,
    mv_bounds=custom_mv_bounds,
    cv_bounds=cv_bounds,
    dv_values=default_dv_values,
    maximize=False,
    n_trials=30
)
```

### Different Ore Types
```python
# Hard ore scenario
hard_ore_dvs = {
    "Shisti": 80.0,  # High hardness
    "Daiki": 70.0,
    "Grano": 20.0,
    "Class_12": 60.0,
    "Class_15": 50.0,
    "FE": 0.3
}

# Soft ore scenario  
soft_ore_dvs = {
    "Shisti": 20.0,  # Low hardness
    "Daiki": 15.0,
    "Grano": 80.0,
    "Class_12": 30.0,
    "Class_15": 25.0,
    "FE": 0.1
}

# Compare optimization results
hard_result = optimize_cascade(..., dv_values=hard_ore_dvs)
soft_result = optimize_cascade(..., dv_values=soft_ore_dvs)
```

## Variable Types

### Manipulated Variables (MVs) - What We Control
- **Ore**: Ore feed rate (t/h) [140-240]
- **WaterMill**: Mill water flow (m³/h) [5-25]  
- **WaterZumpf**: Sump water flow (m³/h) [140-250]
- **MotorAmp**: Motor current (A) [150-250]

### Controlled Variables (CVs) - What We Measure
- **PulpHC**: Hydrocyclone pulp flow (m³/h) [400-600]
- **DensityHC**: Hydrocyclone density (kg/m³) [1200-2000]
- **PressureHC**: Hydrocyclone pressure (bar) [0.0-0.6]

### Disturbance Variables (DVs) - External Factors
- **Shisti**: Shale content (%) [0-100]
- **Daiki**: Dyke content (%) [0-100]
- **Grano**: Granodiorite content (%) [0-100]
- **Class_12**: +12mm fraction (%) [0-100]
- **Class_15**: +15mm fraction (%) [0-100]
- **FE**: Iron content (%) [0-0.6]

### Target Variables
- **PSI200**: +200μm fraction (%) [10-40] - **Primary optimization target**
- **PSI80**: -80μm fraction (%) [40-60]

## Optimization Strategy

### How It Works
1. **Optuna Sampling**: Intelligently samples MV values within bounds
2. **Cascade Prediction**: MVs → CVs → Target using trained models
3. **Constraint Checking**: Penalizes CV violations with quadratic penalty
4. **Bayesian Learning**: Uses trial history to improve next samples
5. **Best Result**: Returns feasible solution with optimal target value

### Penalty Function
```python
penalty = 1000.0 * (violation_amount)²
```
- Large penalty for CV constraint violations
- Encourages feasible solutions
- Quadratic penalty increases with violation severity

### Typical Performance
- **50 trials**: Good results for simple problems
- **100 trials**: Recommended for most cases
- **200+ trials**: For complex constraints or high precision

## Troubleshooting

### Common Issues

**1. "Models not trained" Error**
```bash
# Solution: Load or train models first
POST /api/v1/cascade/models/8/load
```

**2. "No feasible solutions" Warning**
```bash
# Solution: Relax CV bounds or check MV bounds
# CV bounds might be too tight for the given MV ranges
```

**3. Poor Optimization Results**
```bash
# Solution: Increase n_trials or check model quality
# Try n_trials=200 for better exploration
```

### Best Practices

1. **Start Simple**: Use default bounds first, then customize
2. **Check Feasibility**: Ensure CV bounds are achievable with MV ranges
3. **Appropriate Trials**: 50-100 trials for most problems
4. **Validate Results**: Check that optimal MVs make physical sense
5. **Multiple Runs**: Run optimization several times to verify consistency

## Integration with Frontend

The optimization endpoint is designed to integrate seamlessly with the Mills-AI dashboard:

```typescript
// Frontend integration example
const optimizationRequest = {
  mv_bounds: mvBounds,
  cv_bounds: cvBounds, 
  dv_values: currentDvValues,
  target_variable: "PSI200",
  maximize: false,
  n_trials: 100
};

const response = await fetch('/api/v1/cascade/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(optimizationRequest)
});

const result = await response.json();
// Update UI with result.best_mv_values
```

## Performance Notes

- **Fast Execution**: ~1-5 seconds for 50-100 trials
- **Memory Efficient**: No model caching, loads fresh each time
- **Scalable**: Can handle multiple concurrent optimization requests
- **Robust**: Handles constraint violations gracefully with penalties

---

**Next Steps**: This simple system provides a solid foundation. Future enhancements could include:
- Multi-objective optimization (quality + efficiency)
- Uncertainty quantification
- Historical performance tracking
- Real-time constraint adaptation
