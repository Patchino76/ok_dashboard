from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any
from datetime import datetime
import os
import json
import uuid
import logging

from ..database.db_connector import MillsDataConnector
from ..models.xgboost_model import MillsXGBoostModel
from ..models.data_processor import DataProcessor
from ..optimization.bayesian_opt import MillBayesianOptimizer
from .schemas import (
    TrainingRequest, TrainingResponse, 
    PredictionRequest, PredictionResponse,
    OptimizationRequest, OptimizationResponse,
    ParameterRecommendation
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Storage for models and related objects
# In a production environment, this should be replaced with a proper database or storage system
models_store = {}

@router.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest):
    """Train a new XGBoost model with the specified parameters"""
    try:
        # Generate a unique ID for this model
        model_id = str(uuid.uuid4())
        
        # Create database connector
        db_connector = MillsDataConnector(
            host=request.db_config.host,
            port=request.db_config.port,
            dbname=request.db_config.dbname,
            user=request.db_config.user,
            password=request.db_config.password
        )
        
        # Get combined data
        logger.info(f"Fetching data for mill {request.mill_number} from {request.start_date} to {request.end_date}")
        df = db_connector.get_combined_data(
            mill_number=request.mill_number,
            start_date=request.start_date,
            end_date=request.end_date,
            resample_freq='1min'  # For 1-minute intervals as mentioned in the memory
        )
        
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="No data found for the specified parameters")
        
        # Set features if not provided
        features = request.features or [
            'Ore', 'WaterMill', 'WaterZumpf', 'PressureHC', 
            'DensityHC', 'MotorAmp', 'Shisti', 'Daiki'
        ]
        
        # Process data
        data_processor = DataProcessor()
        X_scaled, y, scaler = data_processor.preprocess(df, features, request.target_col)
        
        # Split data - use time-ordered split for time series (no shuffling)
        # Calculate the split point for time series data
        split_idx = int(len(X_scaled) * (1 - request.test_size))
        
        # Time-ordered split (training data is earlier, test data is later)
        X_train, X_test = X_scaled[:split_idx], X_scaled[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        logger.info(f"Time-ordered train-test split: {X_train.shape[0]} training samples, {X_test.shape[0]} test samples")
        logger.info(f"Training data time range: earliest {split_idx} records")
        logger.info(f"Test data time range: latest {len(X_scaled) - split_idx} records")
        
        # Create and train model
        xgb_model = MillsXGBoostModel(features=features, target_col=request.target_col)
        
        # Use provided parameters if available
        params = None
        if request.params:
            params = request.params.dict()
        
        # Train the model
        training_results = xgb_model.train(
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            scaler=scaler,
            params=params
        )
        
        # Save the model with mill number in filename
        os.makedirs("models", exist_ok=True)
        save_results = xgb_model.save_model(directory="models", mill_number=request.mill_number)
        
        # Store model in memory
        models_store[model_id] = {
            "model": xgb_model,
            "file_paths": save_results,
            "created_at": datetime.now().isoformat(),
            "features": features,
            "target_col": request.target_col
        }
        
        # Prepare response
        response = {
            "model_id": model_id,
            **training_results
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error during model training: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Make predictions using a trained model"""
    try:
        # Check if model exists in memory
        if request.model_id not in models_store:
            # Try to load from disk
            try:
                logger.info(f"Model {request.model_id} not found in memory, attempting to load from disk")
                # Import the model class
                from ..models.xgboost_model import MillsXGBoostModel
                
                # Create an instance and load the model
                model = MillsXGBoostModel()
                
                # Use the full model name as provided
                model_id = request.model_id
                
                # Construct paths for model files directly without using settings
                import os
                
                # Use absolute path to models directory
                project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
                base_dir = os.path.join(project_root, 'models')
                
                # Log the directory we're using
                logger.info(f"Using models directory: {base_dir}")
                
                # Determine target column (PSI80, PSI200, etc.) from the model_id
                # Extract it from the model_id or default to PSI80
                target_col = "PSI80"  # Default
                if "_PSI" in model_id:
                    target_col = model_id.split("_")[1]
                
                # Construct paths for model, scaler, and metadata
                model_path = os.path.join(base_dir, f"{model_id}.json")
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
                models_store[request.model_id] = {
                    "model": model,
                    "target_col": model.target_col,
                    "metadata": metadata
                }
                logger.info(f"Successfully loaded model {model_id} from disk")
            except Exception as e:
                logger.error(f"Failed to load model from disk: {str(e)}")
                raise HTTPException(status_code=404, detail="Model not found")
        
        # Get model
        model_info = models_store[request.model_id]
        model = model_info["model"]
        
        # Make prediction
        prediction = model.predict(request.data)[0]
        
        return {
            "prediction": float(prediction),
            "model_id": request.model_id,
            "target_col": model.target_col,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_parameters(request: OptimizationRequest):
    """Optimize mill parameters using Bayesian optimization"""
    try:
        # Check if model exists
        if request.model_id not in models_store:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Get model
        model_info = models_store[request.model_id]
        model = model_info["model"]
        
        # Create optimizer
        optimizer = MillBayesianOptimizer(
            xgboost_model=model,
            target_col=model.target_col,
            maximize=request.maximize
        )
        
        # Set parameter bounds
        if request.parameter_bounds:
            optimizer.set_parameter_bounds(request.parameter_bounds)
        else:
            optimizer.set_parameter_bounds()
        
        # Run optimization
        os.makedirs("optimization_results", exist_ok=True)
        opt_results = optimizer.optimize(
            init_points=request.init_points,
            n_iter=request.n_iter,
            save_dir="optimization_results"
        )
        
        # Get recommendations
        recommendations = optimizer.recommend_parameters(n_recommendations=3)
        
        # Store optimization results
        models_store[request.model_id]["last_optimization"] = {
            "results": opt_results,
            "timestamp": datetime.now().isoformat()
        }
        
        # Format recommendations for response
        formatted_recommendations = [
            ParameterRecommendation(
                params=rec["params"],
                predicted_value=rec["predicted_value"]
            )
            for rec in recommendations
        ]
        
        # Prepare response
        response = {
            "best_params": opt_results["best_params"],
            "best_target": opt_results["best_target"],
            "target_col": model.target_col,
            "maximize": request.maximize,
            "recommendations": formatted_recommendations,
            "model_id": request.model_id
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error during optimization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@router.get("/models", response_model=Dict[str, Any])
async def list_models():
    """List all available models"""
    try:
        result = {}
        for model_id, info in models_store.items():
            result[model_id] = {
                "created_at": info["created_at"],
                "features": info["features"],
                "target_col": info["target_col"],
                "file_paths": info["file_paths"]
            }
        return result
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")
