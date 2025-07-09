"""
Test script to diagnose mills-xgboost import issues
"""
import sys
import os
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_ml_router")

# Set up the path
MILLS_XGBOOST_PATH = Path(__file__).parent / "mills-xgboost"
logger.info(f"mills-xgboost path: {MILLS_XGBOOST_PATH}")
logger.info(f"Directory exists: {os.path.exists(MILLS_XGBOOST_PATH)}")

# Add to Python path
if str(MILLS_XGBOOST_PATH) not in sys.path:
    sys.path.insert(0, str(MILLS_XGBOOST_PATH))
    logger.info(f"Added to sys.path: {MILLS_XGBOOST_PATH}")

# Try to import modules one by one
try:
    logger.info("Testing config imports...")
    try:
        # First try importing the settings module
        import config.settings
        logger.info("✅ Successfully imported config.settings")
        logger.info(f"Settings object: {config.settings.settings}")
    except ImportError as e:
        logger.error(f"❌ Failed to import config.settings: {e}")
        # Try an alternative approach
        logger.info("Trying direct import via importlib...")
        import importlib.util
        settings_path = MILLS_XGBOOST_PATH / "config" / "settings.py"
        try:
            spec = importlib.util.spec_from_file_location("mills_settings", settings_path)
            mills_settings_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mills_settings_module)
            logger.info("✅ Successfully imported settings via importlib")
            logger.info(f"Settings object: {mills_settings_module.settings}")
        except Exception as e:
            logger.error(f"❌ Failed to import settings via importlib: {e}")

    logger.info("\nTesting app.api imports...")
    try:
        # Try importing the endpoints module
        from app.api import endpoints
        logger.info("✅ Successfully imported app.api.endpoints")
        logger.info(f"Router exists: {hasattr(endpoints, 'router')}")
        if hasattr(endpoints, 'router'):
            router = endpoints.router
            logger.info(f"Router routes: {[route.path for route in router.routes]}")
    except ImportError as e:
        logger.error(f"❌ Failed to import app.api.endpoints: {e}")
        logger.info("Trying absolute imports...")
        try:
            # Add parent directory to path and try absolute imports
            sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from mills_xgboost.app.api import endpoints
            logger.info("✅ Successfully imported mills_xgboost.app.api.endpoints")
        except ImportError as e:
            logger.error(f"❌ Failed absolute import: {e}")

    logger.info("\nTesting database imports...")
    try:
        from app.database import db_connector
        logger.info("✅ Successfully imported app.database.db_connector")
    except ImportError as e:
        logger.error(f"❌ Failed to import app.database.db_connector: {e}")

    logger.info("\nTesting models imports...")
    try:
        from app.models import xgboost_model
        logger.info("✅ Successfully imported app.models.xgboost_model")
    except ImportError as e:
        logger.error(f"❌ Failed to import app.models.xgboost_model: {e}")

    logger.info("\nTesting optimization imports...")
    try:
        from app.optimization import bayesian_opt
        logger.info("✅ Successfully imported app.optimization.bayesian_opt")
    except ImportError as e:
        logger.error(f"❌ Failed to import app.optimization.bayesian_opt: {e}")

except Exception as e:
    logger.error(f"Unexpected error: {e}")

logger.info("Test script complete")
