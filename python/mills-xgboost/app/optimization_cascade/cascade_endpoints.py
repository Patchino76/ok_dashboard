"""
FastAPI Endpoints for Cascade Optimization

Database-only cascade optimization system for mill process control.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
import pandas as pd
import os
from datetime import datetime

from .cascade_models import CascadeModelManager
from .gpr_cascade_models import GPRCascadeModelManager
from .simple_cascade_optimizer import SimpleCascadeOptimizer, OptimizationRequest, OptimizationResult
from .gpr_cascade_optimizer import GPRCascadeOptimizer, GPROptimizationRequest, GPROptimizationResult
from .target_driven_optimizer import TargetDrivenCascadeOptimizer, TargetOptimizationRequest, TargetOptimizationResult

# Import variable classifier with error handling
try:
    from .variable_classifier import VariableClassifier
except ImportError:
    # Fallback: create a minimal classifier if import fails
    class VariableClassifier:
        def get_mvs(self):
            return []
        def get_cvs(self):
            return []

# Import database and settings
try:
    from ..database.db_connector import MillsDataConnector
    from ...config.settings import settings
except ImportError:
    # Fallback for direct testing
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'database'))
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'config'))
    from db_connector import MillsDataConnector
    from settings import Settings
    settings = Settings()

# Create router with clean prefix for direct integration
cascade_router = APIRouter(prefix="", tags=["cascade_optimization"])

# Global instances
classifier = VariableClassifier()
model_manager: Optional[CascadeModelManager] = None
gpr_model_manager: Optional[GPRCascadeModelManager] = None

# Request models
class PredictionRequest(BaseModel):
    mv_values: Dict[str, float] = Field(..., description="Manipulated variable values")
    dv_values: Dict[str, float] = Field(default_factory=dict, description="Disturbance variable values")
    model_type: str = Field("xgb", description="Model type: 'xgb' or 'gpr'")
    return_uncertainty: bool = Field(False, description="Return uncertainty (GPR only)")

class TrainingRequest(BaseModel):
    mill_number: int = Field(8, description="Mill number (6, 7, 8, 9, 10, etc.)")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    test_size: float = Field(0.2, description="Test set fraction")
    resample_freq: str = Field("1min", description="Resampling frequency")
    model_suffix: Optional[str] = Field(None, description="Optional model name suffix for versioning")
    # Feature selection fields
    mv_features: Optional[List[str]] = Field(None, description="Selected manipulated variables")
    cv_features: Optional[List[str]] = Field(None, description="Selected controlled variables")
    dv_features: Optional[List[str]] = Field(None, description="Selected disturbance variables")
    target_variable: Optional[str] = Field(None, description="Selected target variable")
    # Stage 1: Bounds filtering (existing)
    mv_bounds: Optional[Dict[str, tuple]] = Field(None, description="Optional MV bounds as {name: [min, max]} for data filtering")
    cv_bounds: Optional[Dict[str, tuple]] = Field(None, description="Optional CV bounds as {name: [min, max]} for data filtering")
    target_bounds: Optional[Dict[str, tuple]] = Field(None, description="Optional target bounds as {name: [min, max]} for data filtering")

class CascadeOptimizationRequest(BaseModel):
    mv_bounds: Dict[str, tuple] = Field(..., description="MV bounds as {name: [min, max]}")
    cv_bounds: Dict[str, tuple] = Field(..., description="CV bounds as {name: [min, max]}")
    dv_values: Dict[str, float] = Field(..., description="Fixed DV values")
    target_variable: str = Field("PSI200", description="Target variable to optimize")
    maximize: bool = Field(False, description="True to maximize, False to minimize")
    n_trials: int = Field(100, description="Number of optimization trials")
    model_type: str = Field("xgb", description="Model type: 'xgb' or 'gpr'")
    use_uncertainty: bool = Field(False, description="Use uncertainty-aware optimization (GPR only)")
    uncertainty_weight: float = Field(1.0, description="Weight for uncertainty penalty (GPR only)")

class TargetDrivenOptimizationRequest(BaseModel):
    target_value: float = Field(..., description="Desired target value to achieve")
    target_variable: str = Field("PSI200", description="Target variable name")
    tolerance: float = Field(0.01, description="Tolerance as fraction (±1% = 0.01)")
    mv_bounds: Dict[str, tuple] = Field(..., description="MV bounds as {name: [min, max]}")
    cv_bounds: Dict[str, tuple] = Field(..., description="CV bounds as {name: [min, max]}")
    dv_values: Dict[str, float] = Field(..., description="Fixed DV values")
    n_trials: int = Field(500, description="Number of optimization trials")
    confidence_level: float = Field(0.90, description="Confidence level for distributions (0.90 = 90%)")

# API Endpoints

@cascade_router.get("/info")
async def get_cascade_info():
    """Get information about the cascade optimization system"""
    return {
        "system": "Cascade Optimization for Mills-AI",
        "version": "1.0.0",
        "description": "Database-driven cascade optimization using MV→CV→Target approach",
        "model_status": {
            "models_trained": bool(model_manager and model_manager.process_models and model_manager.quality_model)
        },
        "endpoints": {
            "training": "/api/v1/cascade/train",
            "prediction": "/api/v1/cascade/predict",
            "optimization": "/api/v1/cascade/optimize",
            "target_optimization": "/api/v1/cascade/optimize-target",
            "models": "/api/v1/cascade/models",
            "load_model": "/api/v1/cascade/models/{mill_number}/load",
            "model_info": "/api/v1/cascade/models/{mill_number}"
        }
    }

@cascade_router.post("/train")
async def train_models(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train cascade models with database data"""
    global model_manager
    
    try:
        # Initialize model manager with mill-specific path
        base_model_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_model_path = os.path.abspath(base_model_path)
        model_manager = CascadeModelManager(base_model_path, mill_number=request.mill_number)
        
        # Configure features if provided by user
        if any([request.mv_features, request.cv_features, request.dv_features, request.target_variable]):
            print(f"🎯 Configuring custom features for training:")
            print(f"   MVs: {request.mv_features}")
            print(f"   CVs: {request.cv_features}")
            print(f"   DVs: {request.dv_features}")
            print(f"   Target: {request.target_variable}")
            
            model_manager.configure_features(
                mv_features=request.mv_features,
                cv_features=request.cv_features,
                dv_features=request.dv_features,
                target_variable=request.target_variable
            )
        else:
            print(f"📋 Using default feature classification from VariableClassifier")
        
        # Get data from database
        df = await _get_database_training_data(
            mill_number=request.mill_number,
            start_date=request.start_date,
            end_date=request.end_date,
            resample_freq=request.resample_freq
        )
        
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail=f"No data found for Mill {request.mill_number}")
        
        # Apply bounds filtering if provided
        if any([request.mv_bounds, request.cv_bounds, request.target_bounds]):
            print(f"🔍 Applying bounds filtering to training data")
            print(f"   Original data shape: {df.shape}")
            df = model_manager.filter_data_by_bounds(
                df=df,
                mv_bounds=request.mv_bounds,
                cv_bounds=request.cv_bounds,
                target_bounds=request.target_bounds
            )
            print(f"   Filtered data shape: {df.shape}")
            
            if df.empty:
                raise HTTPException(status_code=400, detail="No data remaining after bounds filtering")
        
        # Validate data
        try:
            model_manager.prepare_training_data(df)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Data validation failed: {str(e)}")
        
        # Train models in background with proper error handling
        def train_background():
            try:
                print(f"🚀 Starting background training for Mill {request.mill_number}")
                print(f"   Data shape: {df.shape}")
                print(f"   Test size: {request.test_size}")
                # Train all models (with optional steady-state extraction)
                results = model_manager.train_all_models(
                    df, 
                    test_size=request.test_size
                )
                
                print(f"✅ Training completed successfully for Mill {request.mill_number}")
                print(f"   Process models: {len(results.get('process_models', {}))}")
                print(f"   Quality model trained: {results.get('quality_model') is not None}")
                print(f"   Models saved to: {model_manager.model_save_path}")
                
                # ⭐ AUTO-RELOAD THE MODELS AFTER TRAINING
                # This ensures the in-memory model_manager uses the latest trained models
                print(f"🔄 Reloading models into memory...")
                model_manager.load_models()
                print(f"✅ Models reloaded successfully - ready for predictions")
                
            except Exception as e:
                print(f"❌ TRAINING FAILED for Mill {request.mill_number}")
                print(f"   Error: {str(e)}")
                import traceback
                traceback.print_exc()
                
                # Save error to file for debugging
                error_path = os.path.join(model_manager.model_save_path, "training_error.txt")
                with open(error_path, 'w') as f:
                    f.write(f"Training failed at {datetime.now().isoformat()}\n")
                    f.write(f"Error: {str(e)}\n\n")
                    f.write(traceback.format_exc())
                print(f"   Error details saved to: {error_path}")
        
        background_tasks.add_task(train_background)
        
        return {
            "status": "training_started",
            "message": f"Model training started for Mill {request.mill_number}",
            "data_shape": df.shape,
            "mill_number": request.mill_number,
            "date_range": f"{request.start_date} to {request.end_date}",
            "model_save_path": model_manager.model_save_path,
            "model_suffix": request.model_suffix,
            "feature_configuration": {
                "mv_features": request.mv_features,
                "cv_features": request.cv_features,
                "dv_features": request.dv_features,
                "target_variable": request.target_variable,
                "using_custom_features": any([request.mv_features, request.cv_features, request.dv_features, request.target_variable])
            },
            "bounds_filtering": {
                "mv_bounds": request.mv_bounds,
                "cv_bounds": request.cv_bounds,
                "target_bounds": request.target_bounds,
                "bounds_applied": any([request.mv_bounds, request.cv_bounds, request.target_bounds])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.get("/training/status")
async def get_training_status():
    """Get current training status"""
    if not model_manager:
        return {"status": "not_started"}
    
    models_trained = bool(model_manager.process_models and model_manager.quality_model)
    
    if models_trained:
        summary = model_manager.get_model_summary()
        return {
            "status": "completed", 
            "message": f"Models trained successfully for Mill {model_manager.mill_number}",
            "mill_number": model_manager.mill_number,
            "model_path": model_manager.model_save_path,
            "summary": summary
        }
    else:
        return {
            "status": "in_progress",
            "mill_number": model_manager.mill_number if model_manager else None
        }

@cascade_router.post("/predict")
async def predict_cascade(request: PredictionRequest):
    """Make cascade prediction: MV → CV → Target"""
    # Select model manager based on model_type
    if request.model_type == "gpr":
        if not gpr_model_manager or not gpr_model_manager.process_models:
            raise HTTPException(status_code=400, detail="GPR models not loaded")
        current_manager = gpr_model_manager
    else:
        if not model_manager or not model_manager.process_models:
            raise HTTPException(status_code=400, detail="XGBoost models not trained")
        current_manager = model_manager
    
    try:
        print(f"🎯 Cascade prediction: Mill {current_manager.mill_number}, Model: {request.model_type.upper()}")
        
        # Call predict with appropriate parameters
        if request.model_type == "gpr":
            result = current_manager.predict_cascade(
                request.mv_values, 
                request.dv_values,
                return_uncertainty=request.return_uncertainty
            )
        else:
            result = current_manager.predict_cascade(request.mv_values, request.dv_values)
        # Convert numpy types to Python native types for JSON serialization
        def convert_numpy_types(obj):
            """Convert numpy types to Python native types"""
            if hasattr(obj, 'item'):  # numpy scalar
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            else:
                return obj
        
        response = {
            "predicted_target": convert_numpy_types(result['predicted_target']),
            "predicted_cvs": convert_numpy_types(result['predicted_cvs']),
            "is_feasible": bool(result['is_feasible']),
            "mill_number": int(current_manager.mill_number),
            "model_type": request.model_type,
            "constraint_violations": convert_numpy_types(result.get('constraint_violations', []))
        }
        
        # Add uncertainty if GPR and requested
        if request.model_type == "gpr" and request.return_uncertainty:
            response["cv_uncertainties"] = convert_numpy_types(result.get('cv_uncertainties', {}))
            response["target_uncertainty"] = convert_numpy_types(result.get('target_uncertainty', 0.0))
        
        return response
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@cascade_router.post("/optimize")
async def optimize_cascade(request: CascadeOptimizationRequest):
    """Run Bayesian optimization to find optimal MV values"""
    # Select model manager based on model_type
    if request.model_type == "gpr":
        if not gpr_model_manager or not gpr_model_manager.process_models:
            raise HTTPException(status_code=400, detail="GPR models not loaded")
        current_manager = gpr_model_manager
    else:
        if not model_manager or not model_manager.process_models:
            raise HTTPException(status_code=400, detail="XGBoost models not trained")
        current_manager = model_manager
    
    try:
        # Log optimization start
        uncertainty_info = f", Uncertainty-aware: {request.use_uncertainty}" if request.model_type == "gpr" else ""
        print(f"🎯 Cascade optimization: Mill {current_manager.mill_number}, Model: {request.model_type.upper()}, Target: {request.target_variable}, Trials: {request.n_trials}{uncertainty_info}")
        
        # Convert tuple bounds to proper format
        mv_bounds = {k: tuple(v) for k, v in request.mv_bounds.items()}
        cv_bounds = {k: tuple(v) for k, v in request.cv_bounds.items()}
        opt_request = OptimizationRequest(
            mv_bounds=mv_bounds,
            cv_bounds=cv_bounds,
            dv_values=request.dv_values,
            target_variable=request.target_variable,
            maximize=request.maximize,
            n_trials=request.n_trials
        )
        
        # Run optimization with appropriate optimizer
        if request.model_type == "gpr":
            # Use GPR optimizer
            gpr_opt_request = GPROptimizationRequest(
                mv_bounds=mv_bounds,
                cv_bounds=cv_bounds,
                dv_values=request.dv_values,
                target_variable=request.target_variable,
                maximize=request.maximize,
                n_trials=request.n_trials,
                use_uncertainty=request.use_uncertainty,
                uncertainty_weight=request.uncertainty_weight
            )
            optimizer = GPRCascadeOptimizer(current_manager)
            result = optimizer.optimize(gpr_opt_request)
            print(f"✅ Optimization completed: Best target = {result.best_target_value:.4f}, Trial {result.best_trial_number}/{request.n_trials}, Time: {result.optimization_time:.1f}s")
        else:
            # Use XGBoost optimizer
            optimizer = SimpleCascadeOptimizer(current_manager)
            result = optimizer.optimize(opt_request)
            print(f"✅ Optimization completed: Best target = {result.best_target_value:.4f}, Trial {result.best_trial_number}/{request.n_trials}")
        
        # Convert numpy types to Python native types for JSON serialization
        def convert_numpy_types(obj):
            """Convert numpy types to Python native types"""
            if hasattr(obj, 'item'):  # numpy scalar
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            else:
                return obj
        
        response = {
            "status": "success",
            "best_mv_values": convert_numpy_types(result.best_mv_values),
            "best_cv_values": convert_numpy_types(result.best_cv_values),
            "best_target_value": convert_numpy_types(result.best_target_value),
            "is_feasible": bool(result.is_feasible),
            "n_trials": int(result.n_trials),
            "best_trial_number": int(result.best_trial_number),
            "mill_number": int(current_manager.mill_number),
            "model_type": request.model_type,
            "optimization_config": {
                "target_variable": str(request.target_variable),
                "maximize": bool(request.maximize),
                "n_trials": int(request.n_trials),
                "model_type": request.model_type
            }
        }
        
        # Add uncertainty info if GPR
        if request.model_type == "gpr" and hasattr(result, 'best_target_uncertainty'):
            response["best_target_uncertainty"] = convert_numpy_types(result.best_target_uncertainty)
            response["optimization_config"]["use_uncertainty"] = request.use_uncertainty
            response["optimization_config"]["uncertainty_weight"] = request.uncertainty_weight
        
        return response
        
    except Exception as e:
        print(f"❌ Optimization error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@cascade_router.post("/optimize-target")
async def optimize_for_target(request: TargetDrivenOptimizationRequest):
    """Run target-driven optimization to find parameter distributions that achieve a specific target value"""
    if not model_manager or not model_manager.process_models:
        raise HTTPException(status_code=400, detail="Models not trained. Load or train models first.")
    
    try:
        # Add debug logging
        print(f"🎯 Target-driven optimization request received")
        print(f"   Target value: {request.target_value}")
        print(f"   Target variable: {request.target_variable}")
        print(f"   Tolerance: ±{request.tolerance*100:.1f}%")
        print(f"   Trials: {request.n_trials}")
        print(f"   Confidence level: {request.confidence_level*100:.0f}%")
        
        # Convert tuple bounds to proper format
        print(f"   Converting bounds...")
        mv_bounds = {k: tuple(v) for k, v in request.mv_bounds.items()}
        cv_bounds = {k: tuple(v) for k, v in request.cv_bounds.items()}
        print(f"   MV bounds converted: {mv_bounds}")
        print(f"   CV bounds converted: {cv_bounds}")
        
        # Create target optimization request
        print(f"   Creating target optimization request...")
        target_opt_request = TargetOptimizationRequest(
            target_value=request.target_value,
            target_variable=request.target_variable,
            tolerance=request.tolerance,
            mv_bounds=mv_bounds,
            cv_bounds=cv_bounds,
            dv_values=request.dv_values,
            n_trials=request.n_trials,
            confidence_level=request.confidence_level
        )
        
        # Run target-driven optimization
        print(f"   Starting target-driven optimization...")
        optimizer = TargetDrivenCascadeOptimizer(model_manager)
        result = optimizer.optimize_for_target(target_opt_request)
        print(f"   Target optimization completed successfully!")
        
        # Convert numpy types to Python native types for JSON serialization
        def convert_numpy_types(obj):
            """Convert numpy types to Python native types"""
            if hasattr(obj, 'item'):  # numpy scalar
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            else:
                return obj
        
        # Convert distributions to JSON-serializable format
        def convert_distribution(dist):
            """Convert ParameterDistribution to dict"""
            return {
                "mean": float(dist.mean),
                "std": float(dist.std),
                "median": float(dist.median),
                "percentiles": {k: float(v) for k, v in dist.percentiles.items()},
                "min_value": float(dist.min_value),
                "max_value": float(dist.max_value),
                "sample_count": int(dist.sample_count)
            }
        
        # Convert distributions
        mv_distributions = {k: convert_distribution(v) for k, v in result.mv_distributions.items()}
        cv_distributions = {k: convert_distribution(v) for k, v in result.cv_distributions.items()}
        
        return {
            "status": "completed",
            "target_achieved": bool(result.target_achieved),
            "best_distance": float(result.best_distance),
            "worst_distance": float(result.worst_distance),
            "target_value": float(result.target_value),
            "tolerance": float(result.tolerance),
            "best_mv_values": convert_numpy_types(result.best_mv_values),
            "best_cv_values": convert_numpy_types(result.best_cv_values),
            "best_target_value": float(result.best_target_value),
            "mv_distributions": mv_distributions,
            "cv_distributions": cv_distributions,
            "successful_trials": int(result.successful_trials),
            "total_trials": int(result.total_trials),
            "success_rate": float(result.success_rate),
            "confidence_level": float(result.confidence_level),
            "optimization_time": float(result.optimization_time),
            "mill_number": int(model_manager.mill_number),
            "optimization_config": {
                "target_variable": str(request.target_variable),
                "target_value": float(request.target_value),
                "tolerance": float(request.tolerance),
                "n_trials": int(request.n_trials),
                "confidence_level": float(request.confidence_level)
            }
        }
        
    except Exception as e:
        print(f"❌ Target optimization error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Target optimization failed: {str(e)}")

async def _get_database_training_data(
    mill_number: int = 8,
    start_date: str = None,
    end_date: str = None,
    resample_freq: str = "1min"
) -> Optional[pd.DataFrame]:
    """Get training data from database using common db_connector approach"""
    try:
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        return db_connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq=resample_freq,
            save_to_logs=True,
            no_interpolation=False
        )
        
    except Exception as e:
        print(f"Database error: {e}")
        return None

# New endpoints for mill model management
@cascade_router.get("/models")
async def list_mill_models(model_type: str = "xgb"):
    """List all available mill models"""
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        
        if model_type == "gpr":
            mill_models = GPRCascadeModelManager.list_mill_models(base_path)
        else:
            mill_models = CascadeModelManager.list_mill_models(base_path)
            # Additional sanitization to ensure JSON compliance
            temp_manager = CascadeModelManager()
            mill_models = temp_manager.sanitize_json_data(mill_models)
        
        return {
            "status": "success",
            "model_type": model_type,
            "mill_models": mill_models,
            "total_mills": len(mill_models)
        }
    except Exception as e:
        import traceback
        print(f"Error in list_mill_models: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.get("/models/{mill_number}")
async def get_mill_model_info(mill_number: int, model_type: str = "xgb"):
    """Get detailed information about a specific mill's models including feature classification"""
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        
        if model_type == "gpr":
            mill_models = GPRCascadeModelManager.list_mill_models(base_path)
        else:
            mill_models = CascadeModelManager.list_mill_models(base_path)
        
        if mill_number not in mill_models:
            raise HTTPException(status_code=404, detail=f"No models found for Mill {mill_number}")
        
        # Get basic model info
        model_info = mill_models[mill_number]
        
        # Load the model manager to get detailed metadata and feature classification
        try:
            if model_type == "gpr":
                temp_manager = GPRCascadeModelManager(base_path, mill_number=mill_number)
            else:
                temp_manager = CascadeModelManager(base_path, mill_number=mill_number)
            metadata = temp_manager.load_metadata()
            
            if metadata:
                # For GPR models, features are in metadata.features
                # For XGBoost models, check training_config.configured_features
                if model_type == "gpr":
                    features = metadata.get("features", {})
                    mvs = features.get("mv_features", [])
                    cvs = features.get("cv_features", [])
                    dvs = features.get("dv_features", [])
                    targets = [features.get("target_variable")] if features.get("target_variable") else []
                    print(f"🎯 Using GPR features from metadata for Mill {mill_number}")
                else:
                    # XGBoost: Check if custom features were configured during training
                    configured_features = metadata.get("training_config", {}).get("configured_features", {})
                    
                    if configured_features.get("using_custom_features", False):
                        # Use configured features from training
                        mvs = configured_features.get("mv_features", [])
                        cvs = configured_features.get("cv_features", [])
                        dvs = configured_features.get("dv_features", [])
                        targets = [configured_features.get("target_variable")] if configured_features.get("target_variable") else []
                        print(f"🎯 Using custom features from training metadata for Mill {mill_number}")
                    else:
                        # Fall back to classifier defaults
                        mvs = [mv.id for mv in temp_manager.classifier.get_mvs()]
                        cvs = [cv.id for cv in temp_manager.classifier.get_cvs()]
                        dvs = [dv.id for dv in temp_manager.classifier.get_dvs()]
                        targets = [target.id for target in temp_manager.classifier.get_targets()]
                        print(f"📋 Using default classifier features for Mill {mill_number}")
                
                # Add feature classification to model info
                model_info["feature_classification"] = {
                    "mv_features": mvs,
                    "cv_features": cvs,
                    "dv_features": dvs,
                    "target_features": targets
                }
                
                # Add training configuration info
                if "configured_features" in metadata.get("training_config", {}):
                    model_info["training_feature_config"] = configured_features
                
                # Add model performance and training info
                if "model_performance" in metadata:
                    model_info["performance"] = metadata["model_performance"]
                
                if "training_config" in metadata:
                    model_info["training_config"] = metadata["training_config"]
                
                if "data_info" in metadata:
                    model_info["data_info"] = metadata["data_info"]
                    
                # Add all features list for easy access
                all_features = list(set(mvs + cvs + dvs))
                model_info["all_features"] = all_features
                model_info["target_variable"] = targets[0] if targets else "PSI200"
                
        except Exception as e:
            print(f"Warning: Could not load detailed metadata for Mill {mill_number}: {e}")
            # Fallback to basic info only
            pass
        
        # Sanitize the response to handle any remaining NaN/Infinity values (XGBoost only)
        if model_type == "xgb":
            temp_manager_sanitize = CascadeModelManager()
            model_info = temp_manager_sanitize.sanitize_json_data(model_info)
        
        return {
            "status": "success",
            "mill_number": mill_number,
            "model_type": model_type,
            "model_info": model_info
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.post("/models/{mill_number}/load")
async def load_mill_model(mill_number: int, model_type: str = "xgb"):
    """Load models for a specific mill"""
    global model_manager, gpr_model_manager
    
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        
        # Check if mill models exist
        if model_type == "gpr":
            mill_models = GPRCascadeModelManager.list_mill_models(base_path)
            if mill_number not in mill_models:
                raise HTTPException(status_code=404, detail=f"No GPR models found for Mill {mill_number}")
            
            # Initialize GPR model manager and load models
            gpr_model_manager = GPRCascadeModelManager(base_path, mill_number=mill_number)
            success = gpr_model_manager.load_models()
            current_manager = gpr_model_manager
        else:
            mill_models = CascadeModelManager.list_mill_models(base_path)
            if mill_number not in mill_models:
                raise HTTPException(status_code=404, detail=f"No XGBoost models found for Mill {mill_number}")
            
            # Initialize XGBoost model manager and load models
            model_manager = CascadeModelManager(base_path, mill_number=mill_number)
            success = model_manager.load_models()
            current_manager = model_manager
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to load {model_type.upper()} models for Mill {mill_number}")
        
        summary = current_manager.get_model_summary()
        return {
            "status": "success",
            "message": f"{model_type.upper()} models loaded successfully for Mill {mill_number}",
            "mill_number": mill_number,
            "model_type": model_type,
            "summary": summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check
@cascade_router.get("/health")
async def health_check():
    """Health check endpoint"""
    from datetime import datetime
    
    # Get available mill models
    try:
        base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        base_path = os.path.abspath(base_path)
        mill_models = CascadeModelManager.list_mill_models(base_path)
        available_mills = list(mill_models.keys())
    except Exception:
        available_mills = []
    
    # Get GPR models
    try:
        gpr_mill_models = GPRCascadeModelManager.list_mill_models(base_path)
        available_gpr_mills = list(gpr_mill_models.keys())
    except Exception:
        available_gpr_mills = []
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "classifier": "ready",
            "xgb_model_manager": "ready" if model_manager else "not_initialized",
            "gpr_model_manager": "ready" if gpr_model_manager else "not_initialized",
            "current_xgb_mill": model_manager.mill_number if model_manager else None,
            "current_gpr_mill": gpr_model_manager.mill_number if gpr_model_manager else None
        },
        "available_xgb_mills": available_mills,
        "available_gpr_mills": available_gpr_mills,
        "total_xgb_models": len(available_mills),
        "total_gpr_models": len(available_gpr_mills)
    }
