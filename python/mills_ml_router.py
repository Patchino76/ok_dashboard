"""
Mills ML Router - Integration adapter for mills-xgboost with main API
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, List, Any, Optional
import sys
import os
import logging
from pathlib import Path
import importlib
import json

# Configure logging
logger = logging.getLogger('mills_ml_router')

# Create router
router = APIRouter()

# Path to mills-xgboost directory
MILLS_XGBOOST_PATH = Path(__file__).parent / "mills-xgboost"

# Ensure mills-xgboost is in the path
if str(MILLS_XGBOOST_PATH) not in sys.path:
    sys.path.insert(0, str(MILLS_XGBOOST_PATH))

# Import the API router from mills-xgboost
try:
    # Import the endpoints router
    from app.api.endpoints import router as mills_endpoints_router
    
    # Import schemas for type validation
    from app.api.schemas import (
        TrainingRequest, TrainingResponse, 
        PredictionRequest, PredictionResponse,
        OptimizationRequest, OptimizationResponse
    )
    
    # Log successful imports
    logger.info(f"Successfully imported mills-xgboost endpoints with {len(mills_endpoints_router.routes)} routes")
    
    # Add all the endpoints from the mills-xgboost router to our router
    for route in mills_endpoints_router.routes:
        router.routes.append(route)
        logger.info(f"Added route: {route.path} [{','.join(route.methods)}]")
    
    # Import cascade endpoints and add them under /cascade prefix
    try:
        from app.optimization_cascade.cascade_endpoints import cascade_router
        
        # Add cascade routes under /cascade prefix
        for route in cascade_router.routes:
            # Update route path to remove the /api/v1/cascade prefix and add /cascade
            new_path = route.path.replace("/api/v1/cascade", "/cascade")
            route.path = new_path
            router.routes.append(route)
            logger.info(f"Added cascade route: {new_path} [{','.join(route.methods)}]")
            
    except Exception as cascade_error:
        logger.warning(f"Failed to import cascade endpoints: {cascade_error}")
    
    ML_AVAILABLE = True
except Exception as e:
    logger.error(f"Failed to import mills-xgboost endpoints: {str(e)}")
    ML_AVAILABLE = False

# Storage for models and related objects (used by the router)
models_store = {}

@router.get("/info", response_model=Dict[str, Any])
async def get_ml_info():
    """Get information about the ML system"""
    try:
        if not ML_AVAILABLE:
            return {
                "status": "unavailable",
                "message": "ML system failed to load"
            }
            
        # Get list of available models
        models_dir = MILLS_XGBOOST_PATH / "models"
        model_files = list(models_dir.glob("*.json"))
        
        # Extract model names
        model_names = [file.stem for file in model_files]
        
        return {
            "status": "available",
            "models": model_names,
            "models_dir": str(models_dir),
            "endpoints": ["/train", "/predict", "/optimize", "/models"],
            "version": "1.0"
        }
    except Exception as e:
        logger.error(f"Error getting ML info: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

# All ML endpoints are now handled by the mills-xgboost router directly
# The only custom endpoint is the info endpoint which provides integration-specific information
