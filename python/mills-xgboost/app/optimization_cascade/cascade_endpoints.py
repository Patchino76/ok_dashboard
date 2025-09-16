"""
FastAPI Endpoints for Cascade Optimization

Database-only cascade optimization system for mill process control.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Optional
import pandas as pd
import os

from .variable_classifier import VariableClassifier
from .cascade_models import CascadeModelManager

# Import database and settings
try:
    from ..database.db_connector import MillsDataConnector
    from ...config.settings import settings
except ImportError:
    # Fallback for direct testing
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'database'))
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'config'))
    from db_connector import MillsDataConnector
    from settings import Settings
    settings = Settings()

# Create router
cascade_router = APIRouter(prefix="/api/v1/cascade", tags=["cascade_optimization"])

# Global instances
classifier = VariableClassifier()
model_manager: Optional[CascadeModelManager] = None

# Request models
class PredictionRequest(BaseModel):
    mv_values: Dict[str, float] = Field(..., description="Manipulated variable values")
    dv_values: Dict[str, float] = Field(..., description="Disturbance variable values")

class TrainingRequest(BaseModel):
    mill_number: int = Field(8, description="Mill number (6, 7, or 8)")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    test_size: float = Field(0.2, description="Test set fraction")
    resample_freq: str = Field("1min", description="Resampling frequency")

# API Endpoints

@cascade_router.get("/info")
async def get_cascade_info():
    """Get information about the cascade optimization system"""
    return {
        "system": "Cascade Optimization for Mills-AI",
        "version": "1.0.0",
        "description": "Database-driven cascade optimization using MV→CV→Target approach",
        "model_status": {
            "models_trained": bool(model_manager and model_manager.process_models and model_manager.quality_model)
        },
        "endpoints": {
            "training": "/train",
            "prediction": "/predict"
        }
    }

@cascade_router.post("/train")
async def train_models(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train cascade models with database data"""
    global model_manager
    
    try:
        # Initialize model manager
        model_save_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        model_save_path = os.path.abspath(model_save_path)
        model_manager = CascadeModelManager(model_save_path)
        
        # Get data from database
        df = await _get_database_training_data(
            mill_number=request.mill_number,
            start_date=request.start_date,
            end_date=request.end_date,
            resample_freq=request.resample_freq
        )
        
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail=f"No data found for Mill {request.mill_number}")
        
        # Validate data
        try:
            model_manager.prepare_training_data(df)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Data validation failed: {str(e)}")
        
        # Train models in background
        def train_background():
            try:
                model_manager.train_all_models(df, test_size=request.test_size)
            except Exception:
                pass
        
        background_tasks.add_task(train_background)
        
        return {
            "status": "training_started",
            "message": "Model training started",
            "data_shape": df.shape,
            "mill_number": request.mill_number,
            "date_range": f"{request.start_date} to {request.end_date}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.get("/training/status")
async def get_training_status():
    """Get current training status"""
    if not model_manager:
        return {"status": "not_started"}
    
    models_trained = bool(model_manager.process_models and model_manager.quality_model)
    
    if models_trained:
        return {"status": "completed", "message": "Models trained successfully"}
    else:
        return {"status": "in_progress"}

@cascade_router.post("/predict")
async def predict_cascade(request: PredictionRequest):
    """Make cascade prediction: MV → CV → Target"""
    if not model_manager or not model_manager.process_models:
        raise HTTPException(status_code=400, detail="Models not trained")
    
    try:
        result = model_manager.predict_cascade(request.mv_values, request.dv_values)
        return {
            "predicted_target": result['predicted_target'],
            "predicted_cvs": result['predicted_cvs'],
            "is_feasible": result['is_feasible']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _get_database_training_data(
    mill_number: int = 8,
    start_date: str = None,
    end_date: str = None,
    resample_freq: str = "1min"
) -> Optional[pd.DataFrame]:
    """Get training data from database using common db_connector approach"""
    try:
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        return db_connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq=resample_freq,
            save_to_logs=True,
            no_interpolation=False
        )
        
    except Exception as e:
        print(f"Database error: {e}")
        return None

# Health check
@cascade_router.get("/health")
async def health_check():
    """Health check endpoint"""
    from datetime import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "classifier": "ready",
            "model_manager": "ready" if model_manager else "not_initialized"
        }
    }
