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
import pandas as pd

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
                model_path = os.path.join(base_dir, f"{model_name}_model.json")
                scaler_path = os.path.join(base_dir, f"{model_name}_scaler.pkl")
                metadata_path = os.path.join(base_dir, f"{model_name}_metadata.json")
                
                # Log the file paths we're trying to load
                logger.info(f"Looking for files with these patterns:")
                logger.info(f"  Model: {model_path}")
                logger.info(f"  Scaler: {scaler_path}")
                logger.info(f"  Metadata: {metadata_path}")
                
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

@router.post("/train", response_model=Dict[str, Any])
async def train_model(request: Dict[str, Any]):
    """Train a new model with provided data or fetch data from database"""
    try:
        # Extract common parameters from the request
        target_col = request.get("target_col", "PSI80")
        model_name = request.get("model_name", f"xgboost_{target_col}_custom")
        features = request.get("features", [])
        params = request.get("params", {})
        test_size = request.get("test_size", 0.2)
        
        logger.info(f"Training new model: {model_name} for target {target_col}")
        logger.info(f"Features: {features}")
        
        # Determine data source - DB or direct training data
        db_config = request.get("db_config", {})
        training_data = request.get("training_data", [])
        
        if db_config and isinstance(db_config, dict) and all(k in db_config for k in ["host", "port", "dbname", "user", "password"]):
            # Fetch data from database
            logger.info("Using database configuration to fetch training data")
            mill_number = request.get("mill_number", 8)
            start_date = request.get("start_date")
            end_date = request.get("end_date")
            
            if not start_date or not end_date:
                raise HTTPException(status_code=400, detail="Missing start_date or end_date for database query")
                
            logger.info(f"Fetching data for mill {mill_number} from {start_date} to {end_date}")
            
            try:
                # Import necessary modules for DB connection
                import psycopg2
                from psycopg2.extras import RealDictCursor
                from datetime import datetime
                
                # Connect to the database
                conn = psycopg2.connect(
                    host=db_config["host"],
                    port=db_config["port"],
                    dbname=db_config["dbname"],
                    user=db_config["user"],
                    password=db_config["password"]
                )
                
                # Create a cursor
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                # Build query to fetch mill data
                # Adjust the query according to your database schema
                query = f"""
                SELECT 
                    *
                FROM 
                    mill_data 
                WHERE 
                    mill_number = {mill_number} AND
                    timestamp BETWEEN '{start_date}' AND '{end_date}'
                """
                
                # Execute query
                cur.execute(query)
                
                # Fetch all results
                results = cur.fetchall()
                
                # Convert to list of dictionaries for DataFrame
                training_data = [dict(row) for row in results]
                
                # Close connections
                cur.close()
                conn.close()
                
                logger.info(f"Successfully fetched {len(training_data)} records from database")
                
            except Exception as e:
                logger.error(f"Database connection error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to fetch data from database: {str(e)}")
        else:
            # Use provided training data
            logger.info(f"Using provided training data with {len(training_data)} samples")
        
        # Validate input data
        if not training_data or not isinstance(training_data, list):
            raise HTTPException(status_code=400, detail="Invalid or missing training data")
        
        if not features or not isinstance(features, list):
            raise HTTPException(status_code=400, detail="Invalid or missing features list")
        
        # Create DataFrame from training data
        try:
            df = pd.DataFrame(training_data)
            logger.info(f"DataFrame created with shape: {df.shape}")
        except Exception as e:
            logger.error(f"Failed to create DataFrame: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid training data format: {str(e)}")
        
        # Create model instance
        model = MillsXGBoostModel()
        
        # Train the model
        try:
            model.train(
                df=df,
                target_col=target_col,
                features=features,
                test_size=test_size,
                params=params
            )
            logger.info("Model training completed successfully")
        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")
        
        # Save model
        try:
            base_dir = os.path.join(str(MILLS_XGBOOST_PATH), 'models')
            os.makedirs(base_dir, exist_ok=True)
            
            model_path = os.path.join(base_dir, f"{model_name}_model.json")
            scaler_path = os.path.join(base_dir, f"{model_name}_scaler.pkl")
            metadata_path = os.path.join(base_dir, f"{model_name}_metadata.json")
            
            model.save_model(model_path, scaler_path, metadata_path)
            logger.info(f"Model saved as {model_name}")
        except Exception as e:
            logger.error(f"Failed to save model: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to save model: {str(e)}")
        
        # Store in memory for immediate use
        models_store[model_name] = {
            "model": model,
            "target_col": target_col,
            "metadata": {
                "features": features,
                "params": params
            }
        }
        
        return {
            "status": "success",
            "model_name": model_name,
            "target_col": target_col,
            "features": features,
            "samples": len(training_data),
            "model_path": model_path
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error during model training: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

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
