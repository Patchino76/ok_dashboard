from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Optional
import logging
import os
from datetime import datetime

from .multi_output_model import MultiOutputMillModel

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/ml/multi-output", tags=["Multi-Output Optimization"])

# Request/Response models
class MultiOutputTrainRequest(BaseModel):
    mill_number: int = Field(default=8, ge=1, le=12, description="Mill number (1-12)")
    days_back: int = Field(default=30, ge=7, le=90, description="Days of historical data to use")

class MultiOutputPredictRequest(BaseModel):
    motor_amp: float = Field(..., ge=150, le=250, description="Motor amperage (150-250A)")

class MultiOutputOptimizeRequest(BaseModel):
    n_trials: int = Field(default=1000, ge=100, le=5000, description="Number of optimization trials")

class MultiOutputPredictResponse(BaseModel):
    motor_amp: float
    predictions: Dict[str, float]
    timestamp: datetime

class MultiOutputOptimizeResponse(BaseModel):
    best_motor_amp: float
    best_psi200: float
    predictions: Dict[str, float]
    feasible: bool
    timestamp: datetime

class MultiOutputTrainResponse(BaseModel):
    mill_number: int
    data_points: int
    metrics: Dict[str, Dict[str, float]]
    overall_r2: float
    timestamp: datetime

# Global model instance
_model_instance: Optional[MultiOutputMillModel] = None

def get_db_connector():
    """Get database connector from environment variables"""
    try:
        # Import MillsDataConnector with proper path handling
        import sys
        import os
        database_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database')
        if database_path not in sys.path:
            sys.path.append(database_path)
        from db_connector import MillsDataConnector
        
        host = os.getenv('DB_HOST', 'localhost')
        port = int(os.getenv('DB_PORT', '5432'))
        dbname = os.getenv('DB_NAME', 'mills_db')
        user = os.getenv('DB_USER', 'postgres')
        password = os.getenv('DB_PASSWORD', '')
        
        return MillsDataConnector(host, port, dbname, user, password)
    except Exception as e:
        logger.error(f"Failed to create database connector: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@router.post("/train", response_model=MultiOutputTrainResponse)
async def train_multi_output_model(
    request: MultiOutputTrainRequest,
    db_connector: MillsDataConnector = Depends(get_db_connector)
):
    """
    Train multi-output model using real database data
    """
    global _model_instance
    
    try:
        logger.info(f"Training multi-output model for Mill {request.mill_number}")
        
        # Create model instance
        model = MultiOutputMillModel(mill_number=request.mill_number)
        
        # Load data from database
        df = model.load_data_from_database(db_connector, days_back=request.days_back)
        
        if len(df) < 100:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: {len(df)} samples (minimum 100 required)"
            )
        
        # Train model
        metrics = model.train(df)
        
        # Store trained model globally
        _model_instance = model
        
        return MultiOutputTrainResponse(
            mill_number=request.mill_number,
            data_points=len(df),
            metrics=metrics,
            overall_r2=metrics['overall_r2'],
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@router.post("/predict", response_model=MultiOutputPredictResponse)
async def predict_multi_output(request: MultiOutputPredictRequest):
    """
    Predict all targets (CVs + Quality) from MotorAmp value
    """
    global _model_instance
    
    if _model_instance is None:
        raise HTTPException(
            status_code=400, 
            detail="Model not trained. Call /train endpoint first."
        )
    
    try:
        predictions = _model_instance.predict(request.motor_amp)
        
        return MultiOutputPredictResponse(
            motor_amp=request.motor_amp,
            predictions=predictions,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@router.post("/optimize", response_model=MultiOutputOptimizeResponse)
async def optimize_multi_output(request: MultiOutputOptimizeRequest):
    """
    Optimize MotorAmp to minimize PSI200 while keeping CVs within constraints
    """
    global _model_instance
    
    if _model_instance is None:
        raise HTTPException(
            status_code=400, 
            detail="Model not trained. Call /train endpoint first."
        )
    
    try:
        logger.info(f"Starting optimization with {request.n_trials} trials")
        
        result = _model_instance.optimize(n_trials=request.n_trials)
        
        return MultiOutputOptimizeResponse(
            best_motor_amp=result['best_motor_amp'],
            best_psi200=result['best_psi200'],
            predictions=result['predictions'],
            feasible=result['feasible'],
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Optimization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@router.get("/info")
async def get_multi_output_info():
    """
    Get information about the multi-output optimization system
    """
    global _model_instance
    
    info = {
        "description": "Multi-output XGBoost model for mill optimization",
        "features": ["MotorAmp"],
        "targets": ["PulpHC", "DensityHC", "PressureHC", "PSI200"],
        "mv_bounds": {"MotorAmp": [150, 250]},
        "cv_constraints": {
            "PulpHC": [400, 600],
            "DensityHC": [1200, 2000], 
            "PressureHC": [0.0, 0.6],
            "PSI200": [10, 40]
        },
        "model_trained": _model_instance is not None,
        "mill_number": _model_instance.mill_number if _model_instance else None,
        "optimization_objective": "Minimize PSI200 (+200 micron fraction) for better fineness"
    }
    
    return info

@router.get("/status")
async def get_status():
    """
    Get current status of the multi-output optimization system
    """
    global _model_instance
    
    return {
        "status": "ready" if _model_instance is not None else "not_trained",
        "model_trained": _model_instance is not None,
        "mill_number": _model_instance.mill_number if _model_instance else None,
        "timestamp": datetime.now()
    }
