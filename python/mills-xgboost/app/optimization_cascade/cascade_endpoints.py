"""
FastAPI Endpoints for Cascade Optimization

Database-only cascade optimization system for mill process control.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Optional
import pandas as pd
import os

from .variable_classifier import VariableClassifier
from .cascade_models import CascadeModelManager

# Import database and settings
try:
    from ..database.db_connector import MillsDataConnector
    from ..config.settings import settings
except ImportError:
    import sys
    mills_app_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'mills-xgboost', 'app')
    if mills_app_path not in sys.path:
        sys.path.insert(0, mills_app_path)
    from database.db_connector import MillsDataConnector
    from config.settings import settings

# Create router
cascade_router = APIRouter(prefix="/api/v1/cascade", tags=["cascade_optimization"])

# Global instances
classifier = VariableClassifier()
model_manager: Optional[CascadeModelManager] = None

# Request models
class PredictionRequest(BaseModel):
    mv_values: Dict[str, float] = Field(..., description="Manipulated variable values")
    dv_values: Dict[str, float] = Field(..., description="Disturbance variable values")

class TrainingRequest(BaseModel):
    mill_number: int = Field(8, description="Mill number (6, 7, or 8)")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    test_size: float = Field(0.2, description="Test set fraction")
    resample_freq: str = Field("1min", description="Resampling frequency")

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
            "training": "/train",
            "prediction": "/predict"
        }
    }

@cascade_router.post("/train")
async def train_models(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train cascade models with database data"""
    global model_manager
    
    try:
        # Initialize model manager
        model_save_path = os.path.join(os.path.dirname(__file__), "cascade_models")
        model_save_path = os.path.abspath(model_save_path)
        model_manager = CascadeModelManager(model_save_path)
        
        # Get data from database
        df = await _get_database_training_data(
            mill_number=request.mill_number,
            start_date=request.start_date,
            end_date=request.end_date,
            resample_freq=request.resample_freq
        )
        
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail=f"No data found for Mill {request.mill_number}")
        
        # Validate data
        try:
            model_manager.prepare_training_data(df)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Data validation failed: {str(e)}")
        
        # Train models in background
        def train_background():
            try:
                model_manager.train_all_models(df, test_size=request.test_size)
            except Exception:
                pass
        
        background_tasks.add_task(train_background)
        
        return {
            "status": "training_started",
            "message": "Model training started",
            "data_shape": df.shape,
            "mill_number": request.mill_number,
            "date_range": f"{request.start_date} to {request.end_date}"
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
        return {"status": "completed", "message": "Models trained successfully"}
    else:
        return {"status": "in_progress"}

@cascade_router.post("/predict")
async def predict_cascade(request: PredictionRequest):
    """Make cascade prediction: MV → CV → Target"""
    if not model_manager or not model_manager.process_models:
        raise HTTPException(status_code=400, detail="Models not trained")
    
    try:
        result = model_manager.predict_cascade(request.mv_values, request.dv_values)
        return {
            "predicted_target": result['predicted_target'],
            "predicted_cvs": result['predicted_cvs'],
            "is_feasible": result['is_feasible']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _get_database_training_data(
    mill_number: int = 8,
    start_date: str = None,
    end_date: str = None,
    resample_freq: str = "1min"
) -> Optional[pd.DataFrame]:
    """Get training data from database"""
    try:
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        df = db_connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq=resample_freq,
            save_to_logs=True,
            no_interpolation=False
        )
        
        return df
        
    except Exception:
        return None
    
    try:
        result = optimizer.optimize_robust(
            dv_scenarios=request.dv_scenarios,
            n_trials=request.n_trials,
            timeout=request.timeout,
            feasibility_threshold=request.feasibility_threshold
        )
        
        return {
            "status": "completed",
            "optimization_type": "robust",
            "best_robust_value": result['best_robust_value'],
            "best_mv_parameters": result['best_mv_parameters'],
            "scenario_results": result['scenario_results'],
            "feasibility_threshold": result['feasibility_threshold'],
            "n_scenarios": result['n_scenarios'],
            "n_trials": result['n_trials']
        }
        
    except Exception as e:
        logger.error(f"Robust optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.post("/validate")
async def validate_models(request: ValidationRequest, background_tasks: BackgroundTasks):
    """Run model validation"""
    if not validator:
        raise HTTPException(status_code=400, detail="Validator not initialized. Train models first.")
    
    try:
        # Generate validation data (in production, use real data)
        df = _generate_synthetic_data(1000)
        
        def validate_background():
            try:
                results = {}
                
                if "individual" in request.validation_types:
                    results['individual_models'] = validator.validate_individual_models(df, request.test_size)
                
                if "quality" in request.validation_types:
                    results['quality_model'] = validator.validate_quality_model(df, request.test_size)
                
                if "cascade" in request.validation_types:
                    results['complete_cascade'] = validator.validate_complete_cascade(df, request.n_samples)
                
                if "cross_validation" in request.validation_types:
                    results['cross_validation'] = validator.cross_validate_models(df, request.n_folds)
                
                # Store results
                validator.validation_results.update(results)
                logger.info("Validation completed successfully")
                
            except Exception as e:
                logger.error(f"Background validation failed: {e}")
        
        background_tasks.add_task(validate_background)
        
        return {
            "status": "validation_started",
            "message": "Model validation started in background",
            "validation_types": request.validation_types,
            "estimated_time": "1-3 minutes"
        }
        
    except Exception as e:
        logger.error(f"Validation initiation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.get("/validate/status")
async def get_validation_status():
    """Get validation status and results"""
    if not validator:
        return {"status": "not_initialized", "message": "Validator not initialized"}
    
    if validator.validation_results:
        summary = validator.get_validation_summary()
        return {
            "status": "completed",
            "message": "Validation completed",
            "summary": summary,
            "detailed_results": validator.validation_results
        }
    else:
        return {
            "status": "not_started",
            "message": "Validation not started"
        }

@cascade_router.get("/results")
async def get_optimization_results():
    """Get all optimization results"""
    if not optimizer:
        return {"message": "Optimizer not initialized"}
    
    summary = optimizer.get_optimization_summary()
    return {
        "summary": summary,
        "detailed_results": optimizer.optimization_results
    }

@cascade_router.get("/results/export")
async def export_results():
    """Export all results to files"""
    if not optimizer:
        raise HTTPException(status_code=400, detail="No results to export")
    
    try:
        # Save optimization results
        results_file = optimizer.save_optimization_results("cascade_exports")
        
        # Generate validation report if available
        report_file = None
        if validator and validator.validation_results:
            report = validator.generate_validation_report()
            report_file = f"cascade_exports/validation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            with open(report_file, 'w') as f:
                f.write(report)
        
        return {
            "status": "exported",
            "files": {
                "optimization_results": results_file,
                "validation_report": report_file
            }
        }
        
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.post("/implementation/plan")
async def create_implementation_plan(
    current_mv_values: Dict[str, float],
    optimal_mv_values: Dict[str, float],
    n_steps: int = 5
):
    """Create gradual implementation plan"""
    if not optimizer:
        raise HTTPException(status_code=400, detail="Optimizer not initialized")
    
    try:
        plan = optimizer.create_implementation_plan(
            current_mv_values=current_mv_values,
            optimal_mv_values=optimal_mv_values,
            n_steps=n_steps
        )
        
        return {
            "status": "plan_created",
            "implementation_plan": plan
        }
        
    except Exception as e:
        logger.error(f"Implementation plan creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

def _generate_synthetic_data(n_samples: int) -> pd.DataFrame:
    """Generate synthetic mill data for testing"""
    np.random.seed(42)
    
    # Get variable information
    mvs = classifier.get_mvs()
    cvs = classifier.get_cvs()
    dvs = classifier.get_dvs()
    
    data = {}
    
    # Generate MVs
    for mv in mvs:
        if mv.id == 'Ore':
            data[mv.id] = np.random.normal(190, 20, n_samples)
        elif mv.id == 'WaterMill':
            data[mv.id] = np.random.normal(15, 3, n_samples)
        elif mv.id == 'WaterZumpf':
            data[mv.id] = np.random.normal(195, 25, n_samples)
        elif mv.id == 'MotorAmp':
            data[mv.id] = 180 + 0.3 * data.get('Ore', 190) + np.random.normal(0, 10, n_samples)
        
        data[mv.id] = np.clip(data[mv.id], mv.min_bound, mv.max_bound)
    
    # Generate CVs (dependent on MVs)
    for cv in cvs:
        if cv.id == 'PulpHC':
            data[cv.id] = 400 + 0.5 * data['Ore'] + 2.0 * data['WaterZumpf'] + np.random.normal(0, 20, n_samples)
        elif cv.id == 'DensityHC':
            water_total = data['WaterMill'] + data['WaterZumpf']
            ore_water_ratio = data['Ore'] / water_total
            data[cv.id] = 1400 + 200 * ore_water_ratio + np.random.normal(0, 50, n_samples)
        elif cv.id == 'PressureHC':
            data[cv.id] = 0.1 + 0.0005 * data['PulpHC'] + 0.0001 * data['DensityHC'] + np.random.normal(0, 0.05, n_samples)
        elif cv.id == 'PumpRPM':
            data[cv.id] = 200 + 0.8 * data['PulpHC'] + np.random.normal(0, 30, n_samples)
        
        data[cv.id] = np.clip(data[cv.id], cv.min_bound, cv.max_bound)
    
    # Generate DVs
    for dv in dvs:
        if dv.id in ['Shisti', 'Daiki']:
            data[dv.id] = np.random.beta(2, 5, n_samples) * 100
        elif dv.id == 'Class_15':
            data[dv.id] = np.random.normal(25, 8, n_samples)
        elif dv.id == 'FE':
            data[dv.id] = np.random.normal(0.15, 0.05, n_samples)
        
        data[dv.id] = np.clip(data[dv.id], dv.min_bound, dv.max_bound)
    
    # Generate target
    density_effect = -0.01 * (data['DensityHC'] - 1500)
    pressure_effect = -20 * (data['PressureHC'] - 0.3)
    ore_hardness_effect = 0.3 * data['Shisti'] + 0.2 * data['Daiki']
    motor_effect = -0.05 * (data['MotorAmp'] - 200)
    
    data['PSI200'] = (25 + density_effect + pressure_effect + 
                     ore_hardness_effect + motor_effect + 
                     np.random.normal(0, 3, n_samples))
    data['PSI200'] = np.clip(data['PSI200'], 10, 40)
    
    return pd.DataFrame(data)

async def _get_database_training_data(
    mill_number: int = 8,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    resample_freq: str = "1min"
) -> Optional[pd.DataFrame]:
    """Get training data from database for cascade model training"""
    try:
        logger.info(f"Retrieving database training data for Mill {mill_number}")
        logger.info(f"Database settings - Host: {settings.DB_HOST}, Port: {settings.DB_PORT}, DB: {settings.DB_NAME}")
        
        # Initialize database connector with enhanced error handling
        try:
            db_connector = MillsDataConnector(
                host=settings.DB_HOST,
                port=settings.DB_PORT,
                dbname=settings.DB_NAME,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD
            )
            logger.info("Database connector initialized successfully")
        except Exception as db_init_error:
            logger.error(f"Failed to initialize database connector: {db_init_error}")
            raise
        
        # Get combined mill and ore quality data
        try:
            df = db_connector.get_combined_data(
                mill_number=mill_number,
                start_date=start_date,
                end_date=end_date,
                resample_freq=resample_freq,
                save_to_logs=True,
                no_interpolation=False  # Use interpolation for training data
            )
            logger.info("Database query executed successfully")
        except Exception as query_error:
            logger.error(f"Database query failed: {query_error}")
            raise
        
        if df is None:
            logger.error(f"Database query returned None for Mill {mill_number}")
            return None
        elif df.empty:
            logger.error(f"Database query returned empty DataFrame for Mill {mill_number}")
            return None
        
        logger.info(f"Database training data retrieved: {df.shape[0]} rows, {df.shape[1]} columns")
        logger.info(f"Date range: {df.index.min()} to {df.index.max()}")
        logger.info(f"Available columns: {list(df.columns)}")
        
        # Validate required columns for cascade training
        classifier = VariableClassifier()
        required_vars = []
        for var_type in [VariableType.MV, VariableType.CV, VariableType.DV, VariableType.TARGET]:
            vars_of_type = [var.id for var in classifier.get_variables_by_type(var_type)]
            required_vars.extend(vars_of_type)
        
        missing_vars = [var for var in required_vars if var not in df.columns]
        available_vars = [var for var in required_vars if var in df.columns]
        
        logger.info(f"Required variables: {required_vars}")
        logger.info(f"Available variables: {available_vars}")
        
        if missing_vars:
            logger.warning(f"Missing variables in database data: {missing_vars}")
            # Check if we have enough variables to proceed
            if len(available_vars) < len(required_vars) * 0.5:  # Less than 50% of required variables
                logger.error(f"Too many missing variables ({len(missing_vars)}/{len(required_vars)}). Cannot proceed with training.")
                return None
        
        return df
        
    except Exception as e:
        logger.error(f"Error retrieving database training data: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return None

# Error handlers removed - FastAPI APIRouter doesn't support exception_handler
# Exception handling is done within individual endpoints

# Health check
@cascade_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "classifier": "ready",
            "model_manager": "ready" if model_manager else "not_initialized",
            "optimizer": "ready" if optimizer else "not_initialized",
            "validator": "ready" if validator else "not_initialized"
        }
    }
