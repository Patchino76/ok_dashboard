"""
Fixed Cascade Router - Integration adapter for cascade optimization with main API
"""
import sys
import os
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('cascade_router')

# Create router
router = APIRouter()

# Path to the optimization_cascade directory
CASCADE_DIR = Path(__file__).parent / "mills-xgboost" / "app" / "optimization_cascade"

# Add the cascade directory to Python path
if str(CASCADE_DIR.parent) not in sys.path:
    sys.path.insert(0, str(CASCADE_DIR.parent))

# Try to import the cascade endpoints
try:
    logger.info(f"Attempting to import cascade_endpoints from: {CASCADE_DIR}")
    from optimization_cascade.cascade_endpoints import router as cascade_router
    
    # Copy all routes from the cascade_router to our main router
    for route in cascade_router.routes:
        router.routes.append(route)
        logger.info(f"Added route: {route.path} [{', '.join(route.methods)}]")
    
    CASCADE_AVAILABLE = True
    logger.info(f"Successfully loaded {len(router.routes)} cascade routes")
    
except ImportError as e:
    logger.error(f"Failed to import cascade_endpoints: {e}")
    CASCADE_AVAILABLE = False
    
    # Create a dummy router for when cascade is not available
    @router.get("/info")
    async def cascade_not_available():
        return {
            "status": "error",
            "message": "Cascade optimization system not available",
            "error": str(e)
        }

# Add status endpoint
@router.get("/status")
async def get_cascade_status():
    """Get cascade system status"""
    return {
        "available": CASCADE_AVAILABLE,
        "routes_count": len(router.routes),
        "system": "Cascade Optimization"
    }

# Log final status
if CASCADE_AVAILABLE:
    logger.info("Cascade optimization system is available")
else:
    logger.warning("Cascade optimization system is NOT available")
