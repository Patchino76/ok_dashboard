"""
Mills ML Router - Integration adapter for mills-xgboost with main API
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Optional
import sys
import os
import logging
from pathlib import Path
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

# Import the PredictionRequest and PredictionResponse schema
from app.api.schemas import PredictionRequest, PredictionResponse

# Import the mills-xgboost model class
from app.models.xgboost_model import MillsXGBoostModel

# Storage for models and related objects
models_store = {}

@router.get("/info", response_model=Dict[str, Any])
async def get_ml_info():
    """Get information about the ML system"""
    try:
        # Get list of available models
        models_dir = MILLS_XGBOOST_PATH / "models"
        model_files = list(models_dir.glob("*.json"))
        
        # Extract model names
        model_names = [file.stem for file in model_files]
        
        return {
            "status": "available",
            "models": model_names,
            "models_dir": str(models_dir),
            "endpoints": ["/train", "/predict", "/optimize", "/models"]
        }
    except Exception as e:
        logger.error(f"Error getting ML info: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.post("/predict", response_model=Dict[str, Any])
async def predict(request: Dict[str, Any]):
    """Make predictions using a trained model"""
    try:
        model_name = request.get("model_name", "xgboost_PSI80_mill8")
        parameters = request.get("parameters", {})
        
        # Check if parameters are valid
        if not parameters or not isinstance(parameters, dict):
            raise HTTPException(status_code=400, detail="Invalid parameters format")
        
        # Check if model exists in memory
        if model_name not in models_store:
            # Try to load from disk
            try:
                logger.info(f"Model {model_name} not found in memory, attempting to load from disk")
                
                # Create an instance and load the model
                model = MillsXGBoostModel()
                
                # Use the full model name as provided
                # Construct paths for model files
                project_root = str(MILLS_XGBOOST_PATH)
                base_dir = os.path.join(project_root, 'models')
                
                # Log the directory we're using
                logger.info(f"Using models directory: {base_dir}")
                
                # Determine target column (PSI80, PSI200, etc.) from the model_name
                # Extract it from the model_name or default to PSI80
                target_col = "PSI80"  # Default
                if "_PSI" in model_name:
                    target_col = model_name.split("_")[1]
                
                # Construct paths for model, scaler, and metadata
                model_path = os.path.join(base_dir, f"{model_name}.json")
                scaler_path = os.path.join(base_dir, f"xgboost_{target_col}_scaler.pkl")
                metadata_path = os.path.join(base_dir, f"xgboost_{target_col}_metadata.json")
                
                logger.info(f"Loading model from path: {model_path}")
                logger.info(f"Loading scaler from path: {scaler_path}")
                logger.info(f"Loading metadata from path: {metadata_path}")
                
                # Load model with paths
                model.load_model(model_path, scaler_path, metadata_path)
                
                # Read metadata directly from file to get additional info
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                
                # Store in memory for future use
                models_store[model_name] = {
                    "model": model,
                    "target_col": model.target_col,
                    "metadata": metadata
                }
                logger.info(f"Successfully loaded model {model_name} from disk")
            except Exception as e:
                logger.error(f"Failed to load model from disk: {str(e)}")
                raise HTTPException(status_code=404, detail=f"Model not found: {str(e)}")
        
        # Get model
        model_info = models_store[model_name]
        model = model_info["model"]
        
        # Make prediction
        prediction = model.predict(parameters)[0]
        
        return {
            "prediction": float(prediction),
            "model_name": model_name,
            "target_col": model.target_col,
            "input_parameters": parameters
        }
        
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@router.get("/models", response_model=Dict[str, Any])
async def list_models():
    """List all available models"""
    try:
        # Get list of available models from disk
        models_dir = MILLS_XGBOOST_PATH / "models"
        model_files = list(models_dir.glob("*.json"))
        
        # Extract model information
        models_info = {}
        for file in model_files:
            model_name = file.stem
            metadata_path = models_dir / f"{model_name.replace('xgboost_', 'xgboost_')}_metadata.json"
            
            # Try to read metadata if it exists
            metadata = {}
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    try:
                        metadata = json.load(f)
                    except:
                        pass
            
            # Add model info
            models_info[model_name] = {
                "file_path": str(file),
                "created": file.stat().st_mtime,
                "metadata": metadata
            }
        
        # Add models from memory
        for model_id, info in models_store.items():
            if model_id not in models_info:
                models_info[model_id] = {
                    "in_memory": True,
                    "target_col": info.get("target_col", "unknown"),
                    "metadata": info.get("metadata", {})
                }
        
        return {"models": models_info}
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")
