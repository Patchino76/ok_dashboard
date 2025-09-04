"""
Cascade Router - Integration adapter for cascade optimization with main API
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
import sys
import os
import logging
from pathlib import Path

# Configure logging
logger = logging.getLogger('cascade_router')

# Create router
router = APIRouter()

# Path to mills-xgboost directory
MILLS_XGBOOST_PATH = Path(__file__).parent / "mills-xgboost"

# Ensure mills-xgboost is in the path
if str(MILLS_XGBOOST_PATH) not in sys.path:
    sys.path.insert(0, str(MILLS_XGBOOST_PATH))

# Add the app directory to path as well
MILLS_APP_PATH = MILLS_XGBOOST_PATH / "app"
if str(MILLS_APP_PATH) not in sys.path:
    sys.path.insert(0, str(MILLS_APP_PATH))

# Import the cascade endpoints router
try:
    from optimization_cascade.cascade_endpoints import cascade_router as original_cascade_router
    
    # Copy all routes from the original cascade router
    for route in original_cascade_router.routes:
        router.routes.append(route)
    
    logger.info(f"Successfully imported cascade endpoints with {len(router.routes)} routes")
    
    # Log all loaded routes for debugging
    for route in router.routes:
        logger.info(f"Added cascade route: {route.path} [{','.join(route.methods)}]")
        
    CASCADE_AVAILABLE = True
    
except ImportError as e:
    logger.error(f"Failed to import cascade endpoints: {e}")
    CASCADE_AVAILABLE = False
    
    # Add a fallback info endpoint
    @router.get("/info")
    async def cascade_not_available():
        return {
            "available": False,
            "error": "Cascade optimization system not available",
            "reason": str(e)
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
