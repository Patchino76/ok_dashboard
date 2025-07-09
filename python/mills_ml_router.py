"""
Mills ML Router - Integration adapter for mills-xgboost FastAPI endpoints

This module provides a clean integration layer between the main API and the mills-xgboost
machine learning system, maintaining separation of concerns and clean architecture.
"""

import os
import sys
import logging
import importlib.util
from pathlib import Path
from fastapi import APIRouter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to mills-xgboost directory
MILLS_XGBOOST_PATH = Path(__file__).parent / "mills-xgboost"
logger.info(f"Mills XGBoost path: {MILLS_XGBOOST_PATH}")

# Create a base router for fallback
mills_ml_api_router = APIRouter()
ML_ROUTER_AVAILABLE = False

# Settings placeholder
mills_settings = None

try:
    # Create necessary __init__.py files for proper package structure
    for pkg_path in [
        MILLS_XGBOOST_PATH / "app" / "__init__.py",
        MILLS_XGBOOST_PATH / "app" / "api" / "__init__.py",
        MILLS_XGBOOST_PATH / "app" / "models" / "__init__.py",
        MILLS_XGBOOST_PATH / "app" / "database" / "__init__.py",
        MILLS_XGBOOST_PATH / "app" / "optimization" / "__init__.py",
        MILLS_XGBOOST_PATH / "config" / "__init__.py"
    ]:
        os.makedirs(os.path.dirname(pkg_path), exist_ok=True)
        if not os.path.exists(pkg_path):
            with open(pkg_path, "w") as f:
                f.write("# Auto-generated package init\n")
                
    # Load settings directly
    settings_path = MILLS_XGBOOST_PATH / "config" / "settings.py"
    if os.path.exists(settings_path):
        logger.info(f"Loading settings from: {settings_path}")
        spec = importlib.util.spec_from_file_location("mills_settings", settings_path)
        mills_settings_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mills_settings_module)
        mills_settings = mills_settings_module.settings
        logger.info(f"Settings loaded: {mills_settings.APP_NAME}")
        
        # Create required directories
        os.makedirs(mills_settings.MODELS_DIR, exist_ok=True)
        os.makedirs(mills_settings.LOGS_DIR, exist_ok=True)
        logger.info(f"Directories created: {mills_settings.MODELS_DIR}, {mills_settings.LOGS_DIR}")
    
    # Temporarily modify sys.path to import the router
    original_path = sys.path.copy()
    sys.path.insert(0, str(MILLS_XGBOOST_PATH))
    try:
        from app.api.endpoints import router as imported_router
        mills_ml_api_router = imported_router
        ML_ROUTER_AVAILABLE = True
        logger.info(f"Successfully loaded ML router with {len(mills_ml_api_router.routes)} routes")
    except Exception as e:
        logger.error(f"Failed to load ML router: {e}")
        
        # Create mock endpoints for graceful degradation
        @mills_ml_api_router.get("/status")
        async def ml_status():
            return {
                "status": "unavailable",
                "message": f"Mills ML system not properly configured: {str(e)}",
                "available_endpoints": ["/status"]
            }
    finally:
        # Restore original path
        sys.path = original_path
    
    # Create optimization results directory
    os.makedirs("optimization_results", exist_ok=True)
    
    # Configure mills-xgboost logging to write to files
    from datetime import datetime
    
    # Ensure logs directory uses absolute path
    if not os.path.isabs(mills_settings.LOGS_DIR):
        logs_dir = os.path.join(MILLS_XGBOOST_PATH, mills_settings.LOGS_DIR)
    else:
        logs_dir = mills_settings.LOGS_DIR
    
    # Create logs directory if it doesn't exist
    os.makedirs(logs_dir, exist_ok=True)
    
    # Use fixed log filename as requested
    log_filename = "mills_xgboost_server.log"
    log_filepath = os.path.join(logs_dir, log_filename)
    
    # Create file and console handlers
    file_handler = logging.FileHandler(log_filepath, mode='w')
    console_handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Configure root logger for basic configuration
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[console_handler],
        force=True  # Override any existing logging configuration
    )
    
    # Import all modules from mills-xgboost to ensure loggers are created
    try:
        # This ensures all modules are loaded so their loggers can be configured
        from app.database import db_connector
        from app.api import endpoints
        from app.models import xgboost_model, data_processor
    except ImportError:
        pass  # Handle gracefully if imports fail
    
    # Reset all loggers and logging configuration
    logging._handlers.clear()
    logging._handlerList.clear()
    
    # Configure root logger to capture ALL logs from any module
    root_logger = logging.getLogger()
    root_logger.handlers = []  # Remove any existing handlers
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    root_logger.setLevel(logging.INFO)
    
    # Override/monkey patch the logging.getLogger function to ensure all new loggers
    # inherit our configuration (this is a bit aggressive but will catch everything)
    original_getLogger = logging.getLogger
    
    def patched_getLogger(name=None):
        logger = original_getLogger(name)
        if not logger.handlers and name and name.startswith(('app', 'mills')):
            # Force our handlers on any app.* or mills* loggers
            logger.handlers = []
            for handler in root_logger.handlers:
                if handler not in logger.handlers:
                    logger.addHandler(handler)
            logger.setLevel(logging.INFO)
            logger.propagate = True
        return logger
    
    logging.getLogger = patched_getLogger
    
    # Log confirmation that mills-xgboost logging is configured
    mills_logger = logging.getLogger('mills_ml_router')
    mills_logger.info(f"Mills XGBoost logging configured - log file: {log_filepath}")
    mills_logger.info(f"Mills XGBoost logs directory: {logs_dir}")
    mills_logger.info("Mills XGBoost logging system initialized successfully")
    
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
        "models_dir": getattr(mills_settings, 'MODELS_DIR', 'models') if mills_settings else None,
        "logs_dir": getattr(mills_settings, 'LOGS_DIR', 'logs') if mills_settings else None
    }
