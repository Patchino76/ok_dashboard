"""
FastAPI Endpoints for Cascade Optimization

Database-only cascade optimization system for mill process control.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Optional
import pandas as pd
import os

from .old_files_to_delete.variable_classifier import VariableClassifier
from .cascade_models import CascadeModelManager
from .simple_cascade_optimizer import SimpleCascadeOptimizer, OptimizationRequest, OptimizationResult

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

# Create router with clean prefix for direct integration
cascade_router = APIRouter(prefix="/api/v1/cascade", tags=["cascade_optimization"])

# Global instances
classifier = VariableClassifier()
model_manager: Optional[CascadeModelManager] = None

# Request models
class PredictionRequest(BaseModel):
    mv_values: Dict[str, float] = Field(..., description="Manipulated variable values")
    dv_values: Dict[str, float] = Field(..., description="Disturbance variable values")

class TrainingRequest(BaseModel):
    mill_number: int = Field(8, description="Mill number (6, 7, 8, 9, 10, etc.)")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    test_size: float = Field(0.2, description="Test set fraction")
    resample_freq: str = Field("1min", description="Resampling frequency")
    model_suffix: Optional[str] = Field(None, description="Optional model name suffix for versioning")

class CascadeOptimizationRequest(BaseModel):
    mv_bounds: Dict[str, tuple] = Field(..., description="MV bounds as {name: [min, max]}")
    cv_bounds: Dict[str, tuple] = Field(..., description="CV bounds as {name: [min, max]}")
    dv_values: Dict[str, float] = Field(..., description="Fixed DV values")
    target_variable: str = Field("PSI200", description="Target variable to optimize")
    maximize: bool = Field(False, description="True to maximize, False to minimize")
    n_trials: int = Field(100, description="Number of optimization trials")

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
            "training": "/api/v1/cascade/train",
            "prediction": "/api/v1/cascade/predict",
            "optimization": "/api/v1/cascade/optimize",
            "models": "/api/v1/cascade/models",
            "load_model": "/api/v1/cascade/models/{mill_number}/load",
            "model_info": "/api/v1/cascade/models/{mill_number}"
        }
    }

@cascade_router.post("/train")
async def train_models(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train cascade models with database data"""
    global model_manager
    
    try:
        # Initialize model manager with mill-specific path
        base_model_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_model_path = os.path.abspath(base_model_path)
        model_manager = CascadeModelManager(base_model_path, mill_number=request.mill_number)
        
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
            "message": f"Model training started for Mill {request.mill_number}",
            "data_shape": df.shape,
            "mill_number": request.mill_number,
            "date_range": f"{request.start_date} to {request.end_date}",
            "model_save_path": model_manager.model_save_path,
            "model_suffix": request.model_suffix
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
        summary = model_manager.get_model_summary()
        return {
            "status": "completed", 
            "message": f"Models trained successfully for Mill {model_manager.mill_number}",
            "mill_number": model_manager.mill_number,
            "model_path": model_manager.model_save_path,
            "summary": summary
        }
    else:
        return {
            "status": "in_progress",
            "mill_number": model_manager.mill_number if model_manager else None
        }

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
            "is_feasible": result['is_feasible'],
            "mill_number": model_manager.mill_number,
            "constraint_violations": result.get('constraint_violations', [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.post("/optimize")
async def optimize_cascade(request: CascadeOptimizationRequest):
    """Run Bayesian optimization to find optimal MV values"""
    if not model_manager or not model_manager.process_models:
        raise HTTPException(status_code=400, detail="Models not trained. Load or train models first.")
    
    try:
        # Convert tuple bounds to proper format
        mv_bounds = {k: tuple(v) for k, v in request.mv_bounds.items()}
        cv_bounds = {k: tuple(v) for k, v in request.cv_bounds.items()}
        
        # Create optimization request
        opt_request = OptimizationRequest(
            mv_bounds=mv_bounds,
            cv_bounds=cv_bounds,
            dv_values=request.dv_values,
            target_variable=request.target_variable,
            maximize=request.maximize,
            n_trials=request.n_trials
        )
        
        # Run optimization
        optimizer = SimpleCascadeOptimizer(model_manager)
        result = optimizer.optimize(opt_request)
        
        return {
            "status": "success",
            "best_mv_values": result.best_mv_values,
            "best_cv_values": result.best_cv_values,
            "best_target_value": result.best_target_value,
            "is_feasible": result.is_feasible,
            "n_trials": result.n_trials,
            "best_trial_number": result.best_trial_number,
            "mill_number": model_manager.mill_number,
            "optimization_config": {
                "target_variable": request.target_variable,
                "maximize": request.maximize,
                "n_trials": request.n_trials
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

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

# New endpoints for mill model management
@cascade_router.get("/models")
async def list_mill_models():
    """List all available mill models"""
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        mill_models = CascadeModelManager.list_mill_models(base_path)
        
        return {
            "status": "success",
            "mill_models": mill_models,
            "total_mills": len(mill_models)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.get("/models/{mill_number}")
async def get_mill_model_info(mill_number: int):
    """Get detailed information about a specific mill's models"""
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        mill_models = CascadeModelManager.list_mill_models(base_path)
        
        if mill_number not in mill_models:
            raise HTTPException(status_code=404, detail=f"No models found for Mill {mill_number}")
        
        return {
            "status": "success",
            "mill_number": mill_number,
            "model_info": mill_models[mill_number]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.post("/models/{mill_number}/load")
async def load_mill_model(mill_number: int):
    """Load models for a specific mill"""
    global model_manager
    
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        
        # Check if mill models exist
        mill_models = CascadeModelManager.list_mill_models(base_path)
        if mill_number not in mill_models:
            raise HTTPException(status_code=404, detail=f"No models found for Mill {mill_number}")
        
        # Initialize model manager and load models
        model_manager = CascadeModelManager(base_path, mill_number=mill_number)
        success = model_manager.load_models()
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to load models for Mill {mill_number}")
        
        summary = model_manager.get_model_summary()
        return {
            "status": "success",
            "message": f"Models loaded successfully for Mill {mill_number}",
            "mill_number": mill_number,
            "summary": summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check
@cascade_router.get("/health")
async def health_check():
    """Health check endpoint"""
    from datetime import datetime
    
    # Get available mill models
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        mill_models = CascadeModelManager.list_mill_models(base_path)
        available_mills = list(mill_models.keys())
    except Exception:
        available_mills = []
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "classifier": "ready",
            "model_manager": "ready" if model_manager else "not_initialized",
            "current_mill": model_manager.mill_number if model_manager else None
        },
        "available_mills": available_mills,
        "total_mill_models": len(available_mills)
    }
