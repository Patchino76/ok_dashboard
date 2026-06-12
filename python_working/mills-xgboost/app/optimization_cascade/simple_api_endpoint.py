"""
Simplified API endpoint that uses the working direct approach
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
import sys
import os

# Add app path for imports
sys.path.append(os.path.join(os.path.dirname(__file__)))

# Simple router
simple_router = APIRouter(prefix="/api/v1/simple", tags=["simple_optimization"])

class SimpleOptRequest(BaseModel):
    mv_bounds: Dict[str, list]  # {"Ore": [140, 240], ...}
    cv_bounds: Dict[str, list]  # {"PulpHC": [400, 600], ...}
    dv_values: Dict[str, float]  # {"Shisti": 50.0, ...}
    target_variable: str = "PSI200"
    maximize: bool = False
    n_trials: int = 50
    mill_number: int = 8

@simple_router.post("/optimize")
async def simple_optimize(request: SimpleOptRequest):
    """Simple optimization using the working direct approach"""
    try:
        print(f"🔍 Simple optimization request received")
        print(f"   Mill: {request.mill_number}")
        print(f"   Target: {request.target_variable}")
        print(f"   Trials: {request.n_trials}")
        
        # Import the working components directly
        from cascade_models import CascadeModelManager
        from simple_cascade_optimizer import optimize_cascade
        
        # Load models
        print(f"   Loading models...")
        model_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        model_manager = CascadeModelManager(model_path, mill_number=request.mill_number)
        
        if not model_manager.load_models():
            raise HTTPException(status_code=400, detail=f"Failed to load models for Mill {request.mill_number}")
        
        print(f"   Models loaded successfully")
        
        # Convert bounds
        print(f"   Converting bounds...")
        mv_bounds = {k: tuple(v) for k, v in request.mv_bounds.items()}
        cv_bounds = {k: tuple(v) for k, v in request.cv_bounds.items()}
        
        print(f"   Starting optimization...")
        
        # Run optimization using the working direct approach
        result = optimize_cascade(
            model_manager=model_manager,
            mv_bounds=mv_bounds,
            cv_bounds=cv_bounds,
            dv_values=request.dv_values,
            target_variable=request.target_variable,
            maximize=request.maximize,
            n_trials=request.n_trials
        )
        
        print(f"   Optimization completed successfully!")
        
        return {
            "status": "success",
            "best_mv_values": result.best_mv_values,
            "best_cv_values": result.best_cv_values,
            "best_target_value": result.best_target_value,
            "is_feasible": result.is_feasible,
            "n_trials": result.n_trials,
            "best_trial_number": result.best_trial_number,
            "mill_number": request.mill_number,
            "optimization_config": {
                "target_variable": request.target_variable,
                "maximize": request.maximize,
                "n_trials": request.n_trials
            }
        }
        
    except Exception as e:
        print(f"❌ Simple optimization error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Simple optimization failed: {str(e)}")

@simple_router.get("/health")
async def simple_health():
    """Simple health check"""
    return {
        "status": "healthy",
        "message": "Simple optimization endpoint ready",
        "endpoint": "/api/v1/simple/optimize"
    }
