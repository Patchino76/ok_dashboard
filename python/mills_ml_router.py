"""
Mills ML Router - Integration adapter for mills-xgboost FastAPI endpoints

This module provides a clean integration layer between the main API and the mills-xgboost
machine learning system, maintaining separation of concerns and clean architecture.
"""

import sys
import os
import logging
from pathlib import Path

# Add the mills-xgboost directory to Python path
MILLS_XGBOOST_PATH = Path(__file__).parent / "mills-xgboost"
if str(MILLS_XGBOOST_PATH) not in sys.path:
    sys.path.insert(0, str(MILLS_XGBOOST_PATH))

try:
    # Import the mills-xgboost router
    from app.api.endpoints import router as mills_ml_api_router
    
    # Import settings to configure paths (using absolute path to avoid conflict)
    import importlib.util
    
    # Load the mills-xgboost settings module directly
    settings_path = MILLS_XGBOOST_PATH / "config" / "settings.py"
    spec = importlib.util.spec_from_file_location("mills_settings", settings_path)
    mills_settings_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mills_settings_module)
    mills_settings = mills_settings_module.settings
    
    # Ensure required directories exist
    os.makedirs(mills_settings.MODELS_DIR, exist_ok=True)
    os.makedirs(mills_settings.LOGS_DIR, exist_ok=True)
    os.makedirs("optimization_results", exist_ok=True)
    
    ML_ROUTER_AVAILABLE = True
    
except ImportError as e:
    # Graceful degradation if mills-xgboost is not available
    logging.warning(f"Mills ML router not available: {e}")
    from fastapi import APIRouter
    
    # Create a dummy router for graceful degradation
    mills_ml_api_router = APIRouter()
    
    @mills_ml_api_router.get("/status")
    async def ml_status():
        return {
            "status": "unavailable",
            "message": "Mills ML system not properly configured",
            "available_endpoints": []
        }
    
    ML_ROUTER_AVAILABLE = False

# Configure logging for the ML module
logger = logging.getLogger(__name__)

def get_mills_ml_router():
    """
    Get the mills ML FastAPI router
    
    Returns:
        APIRouter: The configured mills ML router
    """
    if ML_ROUTER_AVAILABLE:
        logger.info("Mills ML router loaded successfully")
    else:
        logger.warning("Mills ML router running in degraded mode")
    
    return mills_ml_api_router

def get_ml_system_info():
    """
    Get information about the ML system status
    
    Returns:
        dict: System information and status
    """
    return {
        "available": ML_ROUTER_AVAILABLE,
        "endpoints": [
            "/train - Train XGBoost models",
            "/predict - Make predictions", 
            "/optimize - Bayesian parameter optimization",
            "/models - List available models"
        ] if ML_ROUTER_AVAILABLE else ["/status - Check ML system status"],
        "models_dir": getattr(mills_settings, 'MODELS_DIR', 'models') if ML_ROUTER_AVAILABLE else None,
        "logs_dir": getattr(mills_settings, 'LOGS_DIR', 'logs') if ML_ROUTER_AVAILABLE else None
    }
