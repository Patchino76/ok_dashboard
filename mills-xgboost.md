# Mills-XGBoost Integration Documentation

This document provides a detailed overview of how the mills-xgboost machine learning system is integrated into the main API of the OK Dashboard application.

## Architecture Overview

The integration follows a clean, modular approach with clear separation of concerns:

```
api.py (Main FastAPI Application)
    ↓ includes
mills_ml_router.py (Integration Adapter)
    ↓ imports
mills-xgboost/app/api/endpoints.py (ML Endpoints)
    ↓ uses
mills-xgboost/app/api/schemas.py (Data Models)
mills-xgboost/app/models/xgboost_model.py (ML Logic)
mills-xgboost/app/optimization/bayesian_opt.py (Parameter Optimization)
```

## Integration Mechanism

### 1. Main API Integration Point (api.py)

The main API includes the Mills ML router with just three lines of code:

```python
# Import mills ML router for XGBoost integration
from mills_ml_router import get_mills_ml_router, get_ml_system_info

# Include mills ML router for XGBoost functionality
app.include_router(get_mills_ml_router(), prefix="/api/v1/ml", tags=["Mills ML"])
```

Additionally, the health check endpoint is enhanced to show ML system status:

```python
@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and proxy testing
    """
    ml_info = get_ml_system_info()
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ml_system": {
            "available": ml_info["available"],
            "endpoints_count": len(ml_info["endpoints"])
        }
    }
```

### 2. Integration Adapter (mills_ml_router.py)

The integration adapter serves as a bridge between the main API and the mills-xgboost system:

```python
"""
Mills ML Router - Integration adapter for mills-xgboost FastAPI endpoints
"""

import sys
import os
from pathlib import Path

# Add the mills-xgboost directory to Python path
MILLS_XGBOOST_PATH = Path(__file__).parent / "mills-xgboost"
if str(MILLS_XGBOOST_PATH) not in sys.path:
    sys.path.insert(0, str(MILLS_XGBOOST_PATH))

try:
    # Import the mills-xgboost router
    from app.api.endpoints import router as mills_ml_api_router
    
    # Configure paths and directories
    # ...
    
    ML_ROUTER_AVAILABLE = True
    
except ImportError as e:
    # Graceful degradation if mills-xgboost is not available
    # ...
    ML_ROUTER_AVAILABLE = False

def get_mills_ml_router():
    """Get the mills ML FastAPI router"""
    return mills_ml_api_router

def get_ml_system_info():
    """Get information about the ML system status"""
    return {
        "available": ML_ROUTER_AVAILABLE,
        "endpoints": [
            "/train - Train XGBoost models",
            "/predict - Make predictions", 
            "/optimize - Bayesian parameter optimization",
            "/models - List available models"
        ] if ML_ROUTER_AVAILABLE else ["/status - Check ML system status"],
        # ...
    }
```

Key features of this adapter:
- Adds the mills-xgboost directory to the Python path
- Provides graceful degradation if the ML system is unavailable
- Exposes functions to get the router and system information
- Ensures required directories exist

## Data Flow Overview

### Training Flow

1. Client sends a POST request to `/api/v1/ml/train` with parameters
2. Request is validated against `TrainingRequest` schema
3. Database connector retrieves mill data
4. Data is preprocessed and split into training/testing sets
5. XGBoost model is trained with provided parameters
6. Model is saved and stored in memory
7. Training metrics are returned to the client

```
Client → /api/v1/ml/train → DataConnector → DataProcessor → XGBoostModel → Storage → Response
```

### Prediction Flow

1. Client sends a POST request to `/api/v1/ml/predict` with a model ID and input data
2. Request is validated against `PredictionRequest` schema
3. System retrieves the model from memory
4. Model makes prediction based on input data
5. Prediction is returned to the client

```
Client → /api/v1/ml/predict → ModelRetrieval → Prediction → Response
```

### Optimization Flow

1. Client sends a POST request to `/api/v1/ml/optimize` with a model ID and optimization parameters
2. Request is validated against `OptimizationRequest` schema
3. System retrieves the model from memory
4. Bayesian optimizer runs to find optimal mill parameters
5. Optimization results and recommendations are returned to the client

```
Client → /api/v1/ml/optimize → ModelRetrieval → BayesianOptimizer → Response
```

## API Endpoints in Detail

### 1. Training Endpoint

```python
@router.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest):
    """Train a new XGBoost model with the specified parameters"""
    # Generate unique model ID
    # Connect to database and fetch data
    # Process data and split into training/testing sets
    # Create and train XGBoost model
    # Save model and return training metrics
```

#### Request Schema:

```python
class TrainingRequest(BaseModel):
    """Request model for training an XGBoost model"""
    db_config: DatabaseConfig
    mill_number: int
    start_date: datetime
    end_date: datetime
    features: List[str] = None
    target_col: str = "PSI80"
    test_size: float = 0.2
    params: Optional[TrainingParameters] = None
```

#### Response Schema:

```python
class TrainingResponse(BaseModel):
    """Response model for training results"""
    model_id: str
    train_metrics: ModelMetrics
    test_metrics: ModelMetrics
    feature_importance: Dict[str, Any]
    training_duration: float
    best_iteration: int
    best_score: float
```

### 2. Prediction Endpoint

```python
@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Make predictions using a trained model"""
    # Check if model exists
    # Get model from storage
    # Make prediction with provided data
    # Return prediction
```

#### Request Schema:

```python
class PredictionRequest(BaseModel):
    """Request model for making predictions"""
    model_id: str
    data: Dict[str, float]
```

#### Response Schema:

```python
class PredictionResponse(BaseModel):
    """Response model for predictions"""
    prediction: float
    model_id: str
    target_col: str
    timestamp: datetime
```

### 3. Optimization Endpoint

```python
@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_parameters(request: OptimizationRequest):
    """Optimize mill parameters using Bayesian optimization"""
    # Check if model exists
    # Create optimizer with model
    # Set parameter bounds
    # Run optimization
    # Return best parameters and recommendations
```

#### Request Schema:

```python
class OptimizationRequest(BaseModel):
    """Request model for Bayesian optimization"""
    model_id: str
    parameter_bounds: Optional[Dict[str, List[float]]] = None
    init_points: int = 5
    n_iter: int = 25
    maximize: bool = True
```

#### Response Schema:

```python
class OptimizationResponse(BaseModel):
    """Response model for optimization results"""
    best_params: Dict[str, float]
    best_target: float
    target_col: str
    maximize: bool
    recommendations: List[ParameterRecommendation]
    model_id: str
```

### 4. Models List Endpoint

```python
@router.get("/models", response_model=Dict[str, Any])
async def list_models():
    """List all available models"""
    # Return information about all available models
```

## Error Handling

The integration includes robust error handling:

1. **Graceful Degradation**: If the mills-xgboost system is unavailable, a fallback router is provided
2. **Request Validation**: Pydantic models ensure all requests are properly validated
3. **Exception Handling**: All endpoints include try-except blocks to catch and report errors
4. **Status Endpoint**: The status endpoint allows checking if the ML system is properly configured

## Usage Examples

### Training a New Model

```python
import requests
import json
from datetime import datetime, timedelta

# Prepare training request
training_data = {
    "db_config": {
        "host": "localhost",
        "port": 5432,
        "dbname": "mills_db",
        "user": "user",
        "password": "password"
    },
    "mill_number": 1,
    "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
    "end_date": datetime.now().isoformat(),
    "features": ["Ore", "WaterMill", "PressureHC", "MotorAmp"],
    "target_col": "PSI80",
    "test_size": 0.2
}

# Send request to train endpoint
response = requests.post(
    "http://localhost:8000/api/v1/ml/train",
    json=training_data
)

# Get model ID from response
model_id = response.json()["model_id"]
```

### Making Predictions

```python
# Prepare prediction request
prediction_data = {
    "model_id": model_id,
    "data": {
        "Ore": 120.5,
        "WaterMill": 45.2,
        "PressureHC": 56.7,
        "MotorAmp": 89.3
    }
}

# Send request to predict endpoint
response = requests.post(
    "http://localhost:8000/api/v1/ml/predict",
    json=prediction_data
)

# Get prediction
prediction = response.json()["prediction"]
```

### Optimizing Parameters

```python
# Prepare optimization request
optimization_data = {
    "model_id": model_id,
    "parameter_bounds": {
        "Ore": [100, 150],
        "WaterMill": [30, 60],
        "PressureHC": [40, 70],
        "MotorAmp": [70, 100]
    },
    "init_points": 5,
    "n_iter": 20,
    "maximize": True
}

# Send request to optimize endpoint
response = requests.post(
    "http://localhost:8000/api/v1/ml/optimize",
    json=optimization_data
)

# Get optimization results
best_params = response.json()["best_params"]
recommendations = response.json()["recommendations"]
```

## Conclusion

The mills-xgboost integration follows a clean, modular design that ensures:

1. **Minimal Changes**: Only 3 lines added to the main API
2. **Separation of Concerns**: ML functionality is fully encapsulated
3. **Graceful Degradation**: System works even if ML components are unavailable
4. **Extensibility**: New ML endpoints can be added without modifying the main API

This architecture makes it easy to maintain and extend the ML capabilities of the OK Dashboard while keeping the main API clean and focused.
