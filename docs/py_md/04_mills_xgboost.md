# Mills XGBoost — ML Subsystem

**Directory:** `python/mills-xgboost/`
**API Prefix:** `/api/v1/ml` (mounted via `mills_ml_router.py`)

## Overview

XGBoost-based machine learning subsystem for mill process optimization. Provides model training, prediction, and optimization capabilities for individual mill parameters, cascade multi-variable optimization, and multi-output prediction.

## Directory Structure

```
mills-xgboost/
├── app/
│   ├── api/
│   │   ├── endpoints.py          # FastAPI endpoints (train, predict, optimize, models)
│   │   └── schemas.py            # Pydantic request/response schemas
│   ├── database/
│   │   └── db_connector.py       # MillsDataConnector (PostgreSQL)
│   ├── models/
│   │   ├── data_processor.py     # Data preprocessing pipeline
│   │   └── xgboost_model.py      # XGBoost model wrapper
│   ├── optimization/
│   │   └── optuna_optimizer.py   # Optuna-based parameter optimization
│   ├── optimization_cascade/
│   │   ├── cascade_endpoints.py  # Cascade optimization API endpoints
│   │   ├── cascade_models.py     # Cascade XGBoost models
│   │   ├── cascade_training_with_steady_state.py
│   │   ├── gpr_cascade_models.py # Gaussian Process cascade models
│   │   ├── gpr_cascade_optimizer.py
│   │   ├── simple_cascade_optimizer.py
│   │   ├── target_driven_optimizer.py
│   │   ├── variable_classifier.py # MV/CV/DV classification
│   │   └── steady_state_extraction/
│   │       ├── data_preparation.py
│   │       ├── matrix_profile.py
│   │       ├── motif_analysis.py
│   │       ├── motif_discovery.py
│   │       └── steady_state_extractor.py
│   ├── optimization_multiple/
│   │   ├── multi_output_model.py  # Multi-output XGBoost
│   │   └── optimization_router.py
│   └── main.py                    # Standalone FastAPI app
├── config/
│   └── settings.py                # Database & model settings
├── models/                        # Saved model files (.json)
└── cascade_models/                # Saved cascade model files
```

## Core ML Endpoints

Mounted at `/api/v1/ml` via `mills_ml_router.py`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/train` | Train XGBoost model for a target variable |
| POST | `/predict` | Predict target from feature values |
| POST | `/optimize` | Optimize features to reach target setpoint |
| GET | `/models` | List available trained models |
| GET | `/info` | System info and available models |

### Training

- Fetches data from PostgreSQL via `MillsDataConnector`
- Preprocesses with `DataProcessor` (resampling, cleaning, feature engineering)
- Trains XGBoost model with configurable hyperparameters
- Saves model + metadata to `models/` directory

### Prediction

- Loads trained model from disk (no caching — always fresh from disk)
- Accepts feature values as input
- Returns predicted target value

### Optimization

- Uses Optuna to find optimal feature values
- Supports parameter bounds constraints
- Objective: minimize/maximize target within feasible region

## Cascade Optimization

Mounted at `/api/v1/ml/cascade`:

### Concept

Cascade optimization models the multi-variable control problem:

- **MV (Manipulated Variables):** Ore, WaterMill, WaterZumpf, MotorAmp — operator-controlled
- **CV (Controlled Variables):** PressureHC, DensityHC, PulpHC — process responses
- **DV (Disturbance Variables):** FE, Shisti, Daiki, Grano — external factors

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/info` | Cascade system information |
| POST | `/train` | Train cascade models |
| POST | `/predict` | Predict CVs from MV + DV values |
| POST | `/optimize` | Optimize MVs for target CV values |
| GET | `/models` | List trained cascade models |
| GET | `/status` | Training status |

### Steady-State Extraction

The `steady_state_extraction/` module identifies steady-state operating periods from time-series data using matrix profile analysis and motif discovery. This filters out transient data for more robust model training.

### Variable Classification

`variable_classifier.py` categorizes mill parameters into MV, CV, and DV based on process engineering knowledge.

## Database Connector

**File:** `app/database/db_connector.py`

`MillsDataConnector` connects to PostgreSQL and provides:
- Mill data loading from `mills.MILL_XX` tables
- Ore quality data from `mills.ore_quality`
- Data joining on timestamps with duplicate handling
- Configurable date range and resampling

### Connection (from `config/settings.py`)

| Setting | Default |
|---------|---------|
| `DB_HOST` | `em-m-db4.ellatzite-med.com` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `em_pulse_data` |
| `DB_USER` | from environment |
| `DB_PASSWORD` | from environment |

## Multi-Output Optimization

**Files:** `app/optimization_multiple/`

Trains a single XGBoost model with multiple outputs:
- **Feature:** MotorAmp
- **Targets:** PulpHC, DensityHC, PressureHC, PSI200
- **Objective:** Minimize PSI200 (particle fineness) while keeping CVs within constraints

Endpoints are defined directly in `api.py` at `/api/v1/ml/multi-output`.
