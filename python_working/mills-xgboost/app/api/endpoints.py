from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Tuple
from datetime import datetime
import os
import json
import uuid
import logging
import optuna
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import joblib

from ..database.db_connector import MillsDataConnector
from ..models.xgboost_model import MillsXGBoostModel
from ..models.data_processor import DataProcessor
# Import optimization functionality
from ..optimization.optuna_optimizer import (
    BlackBoxFunction as OptunaBlackBoxFunction,
    optimize_with_optuna,
    export_study_to_csv,
    plot_optimization_results
)
from .schemas import (
    TrainingRequest, TrainingResponse, 
    PredictionRequest, PredictionResponse,
    OptimizationRequest, OptimizationResponse,
    ParameterRecommendation
)

# Configure logging
logger = logging.getLogger(__name__)


# Use the BlackBoxFunction from the optimization module
# This eliminates code duplication and centralizes optimization logic


# Create router
router = APIRouter()

# Storage for models and related objects
# In a production environment, this should be replaced with a proper database or storage system
models_store = {}

@router.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest):
    """Train a new XGBoost model with the specified parameters"""
    try:
        logger.info(f"=== TRAINING REQUEST RECEIVED ===")
        logger.info(f"DEBUG: Full training request: {request.dict()}")
        
        # Generate a unique ID for this model
        model_id = str(uuid.uuid4())
        logger.info(f"DEBUG: Generated model_id: {model_id}")
        
        # Create database connector
        logger.info(f"DEBUG: Creating database connector with host: {request.db_config.host}")
        db_connector = MillsDataConnector(
            host=request.db_config.host,
            port=request.db_config.port,
            dbname=request.db_config.dbname,
            user=request.db_config.user,
            password=request.db_config.password
        )
        logger.info(f"DEBUG: Database connector created successfully")
        
        # Get combined data
        logger.info(f"=== STARTING DATA RETRIEVAL ===")
        logger.info(f"Fetching data for mill {request.mill_number} from {request.start_date} to {request.end_date}")
        
        # Handle Mill 8 data gap - extend end date to include post-gap data
        end_date_adjusted = request.end_date
        if request.mill_number == 8:
            # Mill 8 has data gap from 2025-08-12 to 2025-08-18, extend to current time
            current_time = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.000Z')
            end_date_adjusted = current_time
            logger.info(f"DEBUG: Mill 8 detected - adjusting end_date from {request.end_date} to {end_date_adjusted}")
        
        df = db_connector.get_combined_data(
            mill_number=request.mill_number,
            start_date=request.start_date,
            end_date=end_date_adjusted,
            resample_freq='1min'  # For 1-minute intervals as mentioned in the memory
        )
        logger.info(f"=== DATA RETRIEVAL COMPLETED ===")
        
        if df is not None and not df.empty:
            logger.info(f"DEBUG: Retrieved dataframe shape: {df.shape}")
            logger.info(f"DEBUG: Retrieved dataframe columns: {list(df.columns)}")
            logger.info(f"DEBUG: Retrieved dataframe date range: {df.index.min()} to {df.index.max()}")
        else:
            logger.error(f"DEBUG: No data retrieved - df is None or empty")
        
        if df is None or df.empty:
            logger.error(f"DEBUG: No data found - raising 400 error")
            raise HTTPException(status_code=400, detail="No data found for the specified parameters")
        
        # Set features if not provided
        features = request.features or [
            'Ore', 'WaterMill', 'WaterZumpf', 'PressureHC', 
            'DensityHC', 'MotorAmp', 'Shisti', 'Daiki'
        ]
        logger.info(f"DEBUG: Using features: {features}")
        logger.info(f"DEBUG: Target column: {request.target_col}")
        
        # Process data
        logger.info(f"=== STARTING DATA PROCESSING ===")
        data_processor = DataProcessor()
        try:
            # Convert filter_ranges from Pydantic models to dict if provided
            filter_ranges_dict = None
            if request.filter_ranges:
                filter_ranges_dict = {}
                for col_name, filter_range in request.filter_ranges.items():
                    filter_ranges_dict[col_name] = {
                        "min_value": filter_range.min_value,
                        "max_value": filter_range.max_value
                    }
                logger.info(f"DEBUG: Using filter ranges: {filter_ranges_dict}")
            
            X_scaled, y, scaler = data_processor.preprocess(df, features, request.target_col, filter_data=True, filter_ranges=filter_ranges_dict)
            logger.info(f"DEBUG: Data preprocessing completed - X_scaled shape: {X_scaled.shape}, y shape: {y.shape}")
        except Exception as e:
            logger.error(f"DEBUG: Data preprocessing failed: {e}")
            import traceback
            logger.error(f"DEBUG: Preprocessing traceback: {traceback.format_exc()}")
            raise
        
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
        from datetime import datetime as dt
        models_store[model_id] = {
            "model": xgb_model,
            "file_paths": save_results,
            "created_at": dt.now().isoformat(),
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
        logger.error(f"=== TRAINING ERROR OCCURRED ===")
        logger.error(f"ERROR: {str(e)}")
        import traceback
        logger.error(f"FULL TRACEBACK: {traceback.format_exc()}")
        logger.error(f"=== END TRAINING ERROR ===")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@router.post("/predict", response_model=PredictionResponse) 
async def predict(request: PredictionRequest):
    """Make predictions using a trained model (no caching - always loads fresh)"""
    try:
        # Always load model fresh from disk (no caching)
        logger.info(f"Loading model {request.model_id} fresh from disk")
        
        # Import the model class
        from ..models.xgboost_model import MillsXGBoostModel
        import os
        import glob
        
        # Create an instance and load the model
        model = MillsXGBoostModel()
        
        # Use the full model name as provided
        model_id = request.model_id
        
        # Use absolute path to mills-xgboost/models directory
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        base_dir = os.path.join(project_root, 'models')
        
        # Check if the directory exists
        if not os.path.exists(base_dir):
            logger.error(f"Models directory does not exist: {base_dir}")
            raise FileNotFoundError(f"Models directory not found: {base_dir}")
        
        # Log the directory we're using
        logger.info(f"Using models directory: {base_dir}")
        
        # Clean the model_id by removing any extension or existing suffix
        base_model_id = model_id.replace('.json', '').replace('_model', '').replace('_metadata', '').replace('_scaler', '')
        logger.info(f"Using base model ID: {base_model_id}")
        
        # Construct paths with standardized suffixes
        model_path = os.path.join(base_dir, f"{base_model_id}_model.json")
        scaler_path = os.path.join(base_dir, f"{base_model_id}_scaler.pkl")
        metadata_path = os.path.join(base_dir, f"{base_model_id}_metadata.json")
        
        # Verify model file exists
        if not os.path.exists(model_path):
            logger.error(f"Model file not found: {model_path}")
            
            # Try to find matching model files in case there's a different naming pattern
            all_model_files = glob.glob(os.path.join(base_dir, "*.json"))
            matching_files = [f for f in all_model_files if base_model_id in os.path.basename(f)]
            
            if matching_files:
                model_path = matching_files[0]
                logger.info(f"Found alternate model file: {model_path}")
                # Update other paths based on the found file
                file_base = os.path.basename(model_path).replace('.json', '')
                scaler_path = os.path.join(base_dir, f"{file_base.replace('_model', '')}_scaler.pkl")
                metadata_path = os.path.join(base_dir, f"{file_base.replace('_model', '')}_metadata.json")
            else:
                raise FileNotFoundError(f"No model file found for {base_model_id}")
        
        # Log the files we're using
        logger.info(f"Using model files:")
        logger.info(f"- Model:    {os.path.basename(model_path)}")
        logger.info(f"- Scaler:   {os.path.basename(scaler_path)}")
        logger.info(f"- Metadata: {os.path.basename(metadata_path)}")
        
        # Load model with paths
        model.load_model(model_path, scaler_path, metadata_path)
        
        # Debug logging to verify features
        logger.info(f"Model loaded with features: {model.features}")
        
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
    """Optimize XGBoost hyperparameters using Bayesian Optimization"""
    try:
        # Log optimization request
        logger.info(f"Optimization request received for model {request.model_id}")
        
        # Check if model exists in memory
        if request.model_id not in models_store:
            # Try to load from disk
            try:
                logger.info(f"Model {request.model_id} not found in memory, attempting to load from disk")
                # Create an instance and load the model
                black_box = OptunaBlackBoxFunction(model_id=request.model_id, maximize=request.maximize)
                
                # Store in memory for future use
                models_store[request.model_id] = {
                    "model": black_box.xgb_model,
                    "target_col": black_box.target_col,
                    "features": black_box.features
                }
                logger.info(f"Successfully loaded model {request.model_id} from disk")
            except Exception as e:
                logger.error(f"Failed to load model from disk: {str(e)}")
                raise HTTPException(status_code=404, detail="Model not found")
        
        # Get model
        model_info = models_store[request.model_id]
        model = model_info["model"]
        target_col = model_info.get("target_col", "PSI80")
        
        # Create black box function with the loaded model using the imported class
        black_box = OptunaBlackBoxFunction(
            model_id=request.model_id,
            maximize=request.maximize
        )
        
        # Set parameter bounds
        if not request.parameter_bounds:
            # Use default bounds if not provided
            logger.warning(f"No parameter bounds provided, using default bounds")
            parameter_bounds = {
                "Ore": [150.0, 200.0],
                "WaterMill": [10.0, 20.0],
                "WaterZumpf": [180.0, 250.0],
                "PressureHC": [70.0, 90.0],
                "DensityHC": [1.5, 1.9],
                "MotorAmp": [30.0, 50.0],
                "Shisti": [0.05, 0.2],
                "Daiki": [0.2, 0.5]
            }
        else:
            parameter_bounds = request.parameter_bounds
        
        black_box.set_parameter_bounds(parameter_bounds)
        
        # Configure optimization parameters
        n_trials = request.n_iter if request.n_iter else 25
        init_points = request.init_points if request.init_points else 5
        
        logger.info(f"Starting optimization with {n_trials} trials")
        
        # Run optimization
        best_params, best_value, study = optimize_with_optuna(
            black_box_func=black_box,
            n_trials=n_trials
        )
        
        # Use raw value from Optuna - no negation needed
        # best_value = study.best_value (already assigned above)
            
        # Generate recommendations from top trials
        recommendations = []
        for trial in sorted(study.trials, key=lambda t: t.value, reverse=request.maximize)[:5]:
            value = trial.value
            recommendations.append({
                "params": trial.params,
                "predicted_value": float(value)
            })
        
        # Create results directory to save optimization artifacts
        current_dir = os.path.dirname(os.path.abspath(__file__))
        results_dir = os.path.join(current_dir, '..', 'optimization', 'optimization_results')
        os.makedirs(results_dir, exist_ok=True)
        
        # Export study trials to CSV using the imported function
        csv_file = os.path.join(results_dir, f"optuna_trials_{request.model_id}.csv")
        trials_df = export_study_to_csv(study, csv_file)
        logger.info(f"Exported {len(trials_df)} trials to {csv_file}")
        
        # Generate optimization plots
        try:
            plot_optimization_results(study, black_box)
            logger.info("Generated optimization plots")
        except Exception as plot_error:
            logger.warning(f"Failed to generate plots: {plot_error}")
            
        # Return optimized parameters
        return OptimizationResponse(
            best_params=best_params,
            best_target=float(best_value),
            target_col=target_col,
            maximize=request.maximize,
            recommendations=recommendations,
            model_id=request.model_id
        )
        
    except Exception as e:
        logger.error(f"Error during optimization: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@router.get("/models", response_model=Dict[str, Any])
async def list_models():
    """List all available models by scanning the models directory"""
    try:
        import os
        import glob
        import json
        from datetime import datetime
        
        # Use absolute path to mills-xgboost/models directory
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        models_dir = os.path.join(project_root, 'models')
        
        # Check if directory exists
        if not os.path.exists(models_dir):
            logger.error(f"Models directory does not exist: {models_dir}")
            return {"error": "Models directory not found"}
        
        # Find all metadata files
        metadata_files = glob.glob(os.path.join(models_dir, '*_metadata.json'))
        logger.info(f"Found {len(metadata_files)} model metadata files")
        
        result = {}
        for metadata_file in metadata_files:
            try:
                # Extract model ID from filename
                filename = os.path.basename(metadata_file)
                model_id = filename.replace('_metadata.json', '')
                
                # Read metadata
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                # Check if corresponding model and scaler files exist
                model_file = os.path.join(models_dir, f"{model_id}_model.json")
                scaler_file = os.path.join(models_dir, f"{model_id}_scaler.pkl")
                
                files_exist = os.path.exists(model_file) and os.path.exists(scaler_file)
                
                # Get file modification time as a proxy for creation date
                try:
                    mod_time = os.path.getmtime(metadata_file)
                    mod_time_str = datetime.fromtimestamp(mod_time).isoformat()
                except:
                    mod_time_str = "Unknown"
                
                # Get required information
                result[model_id] = {
                    "name": model_id,
                    "features": metadata.get("features", []),
                    "target_col": metadata.get("target_col", ""),
                    "last_trained": metadata.get("last_trained", mod_time_str),
                    "files_complete": files_exist
                }
            except Exception as e:
                logger.error(f"Error processing metadata file {metadata_file}: {str(e)}")
                # Continue with next file
        
        return result
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")
