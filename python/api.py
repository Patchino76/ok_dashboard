from fastapi import FastAPI, Depends, HTTPException, Query, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, RootModel, Field
from datetime import datetime, timedelta

# Import the DatabaseManager and configuration first before path modifications
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import DatabaseManager, create_db_manager
from api_utils.mills_utils import MillsUtils
from mills_analysis.mills_fetcher import get_mills_by_param

# Import config variables explicitly with absolute import path
import importlib.util
import os

# Get absolute path to the config.py file in the current directory
config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.py')

# Load the config module from the absolute path
spec = importlib.util.spec_from_file_location('config_local', config_path)
config_local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config_local)

# Get config variables
HOST = config_local.HOST
PORT = config_local.PORT
CORS_ORIGINS = config_local.CORS_ORIGINS

# Import for mills-xgboost integration via adapter module
import logging

# Configure logging
logger = logging.getLogger('api')

# Create directories for models and logs if needed
import os
os.makedirs("models", exist_ok=True)
os.makedirs("logs", exist_ok=True)

app = FastAPI(title="OK Dashboard API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import the mills_ml_router adapter module
try:
    from mills_ml_router import router as mills_ml_router
    app.include_router(mills_ml_router, prefix="/api/v1/ml", tags=["Mills ML"])
    ML_SYSTEM_AVAILABLE = True
    logger.info(f"Successfully loaded Mills ML router with {len(mills_ml_router.routes)} routes")
    
    # Log all loaded routes for debugging
    for route in mills_ml_router.routes:
        logger.info(f"Registered ML route: {route.path} [{','.join(route.methods)}]")
except Exception as e:
    logger.error(f"Failed to load Mills ML router: {e}")
    ML_SYSTEM_AVAILABLE = False

# ----------------------------- Cascade Optimization Endpoints -----------------------------

# Create cascade router directly in main API
cascade_router = APIRouter(prefix="/api/v1/cascade", tags=["cascade_optimization"])

# Simple cascade models
class CascadeTrainingRequest(BaseModel):
    mill_number: int = Field(8, description="Mill number")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    test_size: float = Field(0.2, description="Test set fraction")
    resample_freq: str = Field("1min", description="Data resampling frequency")

class CascadePredictionRequest(BaseModel):
    mv_values: Dict[str, float] = Field(..., description="Manipulated variable values")
    dv_values: Dict[str, float] = Field(..., description="Disturbance variable values")

# Global cascade state
cascade_model_manager = None
cascade_training_status = {"status": "not_started", "message": "Training not initiated"}

@cascade_router.get("/info")
async def get_cascade_info():
    """Get information about the cascade optimization system"""
    return {
        "system": "Database Cascade Optimization",
        "version": "2.0.0",
        "description": "Database-driven MV→CV→Target cascade approach",
        "status": "available",
        "endpoints": {
            "training": "/train",
            "prediction": "/predict",
            "status": "/training/status",
            "health": "/health"
        }
    }

@cascade_router.get("/health")
async def cascade_health_check():
    """Health check for cascade system"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_trained": cascade_model_manager is not None,
        "training_status": cascade_training_status["status"]
    }

@cascade_router.post("/train")
async def train_cascade_models(request: CascadeTrainingRequest, background_tasks: BackgroundTasks):
    """Train cascade models with database data"""
    global cascade_model_manager, cascade_training_status
    
    try:
        # Import cascade components
        import sys
        import os
        mills_path = os.path.join(os.path.dirname(__file__), 'mills-xgboost', 'app')
        if mills_path not in sys.path:
            sys.path.insert(0, mills_path)
        
        from optimization_cascade.cascade_models import CascadeModelManager
        
        # Import database connector from the correct path
        mills_db_path = os.path.join(os.path.dirname(__file__), 'mills-xgboost', 'app', 'database')
        if mills_db_path not in sys.path:
            sys.path.insert(0, mills_db_path)
        from db_connector import MillsDataConnector
        
        # Import settings using absolute path loading
        settings_path = os.path.join(os.path.dirname(__file__), 'mills-xgboost', 'config', 'settings.py')
        spec = importlib.util.spec_from_file_location('settings_module', settings_path)
        settings_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(settings_module)
        settings = settings_module.settings
        
        # Initialize model manager
        model_save_path = os.path.join(os.path.dirname(__file__), "mills-xgboost", "app", "optimization_cascade", "cascade_models")
        model_save_path = os.path.abspath(model_save_path)
        cascade_model_manager = CascadeModelManager(model_save_path)
        
        # Get database data
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        df = db_connector.get_combined_data(
            mill_number=request.mill_number,
            start_date=request.start_date,
            end_date=request.end_date,
            resample_freq=request.resample_freq,
            save_to_logs=True,
            no_interpolation=False
        )
        
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail=f"No data found for Mill {request.mill_number}")
        
        # Prepare training data
        cascade_model_manager.prepare_training_data(df)
        
        # Background training function
        def train_background():
            global cascade_training_status
            try:
                cascade_training_status = {"status": "training", "message": "Training in progress"}
                cascade_model_manager.train_all_models(df, test_size=request.test_size)
                cascade_training_status = {"status": "completed", "message": "Training completed successfully"}
            except Exception as e:
                cascade_training_status = {"status": "failed", "message": f"Training failed: {str(e)}"}
        
        background_tasks.add_task(train_background)
        
        return {
            "status": "training_started",
            "message": "Model training started",
            "data_shape": df.shape,
            "mill_number": request.mill_number,
            "date_range": f"{request.start_date} to {request.end_date}",
            "model_save_path": model_save_path
        }
        
    except Exception as e:
        logger.error(f"Cascade training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@cascade_router.get("/training/status")
async def get_cascade_training_status():
    """Get current training status"""
    return cascade_training_status

@cascade_router.post("/predict")
async def predict_cascade(request: CascadePredictionRequest):
    """Make cascade prediction: MV → CV → Target"""
    if not cascade_model_manager or not cascade_model_manager.process_models:
        raise HTTPException(status_code=400, detail="Models not trained")
    
    try:
        result = cascade_model_manager.predict_cascade(request.mv_values, request.dv_values)
        return {
            "predicted_target": result['predicted_target'],
            "predicted_cvs": result['predicted_cvs'],
            "is_feasible": result['is_feasible'],
            "mv_inputs": request.mv_values,
            "dv_inputs": request.dv_values
        }
    except Exception as e:
        logger.error(f"Cascade prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include cascade router in main app
app.include_router(cascade_router, tags=["Cascade Optimization"])
CASCADE_SYSTEM_AVAILABLE = True
logger.info("Successfully loaded Direct Cascade Optimization router")


# ----------------------------- Models -----------------------------

class TagValue(BaseModel):
    """Model for tag value response"""
    value: Union[float, bool, None]
    timestamp: str
    unit: Optional[str] = None
    status: Optional[str] = None

class TagValueBatch(RootModel):
    """Model for batch tag values response"""
    root: Dict[str, Optional[TagValue]]

class TagTrend(BaseModel):
    """Model for tag trend data"""
    timestamps: List[str]
    values: List[Union[float, bool, None]]

# ----------------------------- Dependencies -----------------------------

# Create a shared database manager instance
db_manager = create_db_manager()

def get_db():
    """Dependency to get database connection"""
    try:
        yield db_manager
    finally:
        # No need to explicitly close connections since the db_manager is reused
        pass

# ----------------------------- API Endpoints -----------------------------

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and proxy testing
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ml_system": {
            "available": ML_SYSTEM_AVAILABLE,
            "endpoints_count": len(mills_ml_router.routes) if ML_SYSTEM_AVAILABLE else 0
        },
        "cascade_system": {
            "available": CASCADE_SYSTEM_AVAILABLE,
            "endpoints_count": len(cascade_router.routes) if CASCADE_SYSTEM_AVAILABLE else 0
        }
    }

@app.get("/api/ml/info")
async def ml_system_info():
    """
    Get information about the Mills ML system capabilities
    """
    if not ML_SYSTEM_AVAILABLE:
        return {
            "available": False,
            "endpoints": [],
            "models_dir": "models",
            "logs_dir": "logs"
        }
    
    # List of endpoints from the router
    endpoints_list = [f"{route.path} - {', '.join(route.methods)}" for route in mills_ml_router.routes]
    
    return {
        "available": True,
        "endpoints": endpoints_list,
        "models_dir": "models",
        "logs_dir": "logs"
    }

@app.get("/api/tag-value/{tag_id}", response_model=TagValue)
async def get_tag_value(tag_id: int, db: DatabaseManager = Depends(get_db)):
    """
    Get the current value of a tag by its ID.
    """
    result = db.get_tag_value(tag_id)
    
    # For development: Always return mock data instead of 404
    if not result:
        # Generate random mock data for development
        import random
        return {
            "value": random.uniform(0, 100),  # Random value between 0-100
            "timestamp": datetime.now().isoformat(),
            "unit": "units",
            "status": "Good"
        }
        
    return result

@app.get("/api/tag-values", response_model=TagValueBatch)
async def get_tag_values(tag_ids: List[int] = Query(...), db: DatabaseManager = Depends(get_db)):
    """
    Get current values for multiple tags by their IDs.
    
    This endpoint accepts a list of tag IDs and returns their current values
    in a batch response.
    """
    result = db.get_tag_values(tag_ids)
    
    # For development: Ensure all requested tags have values
    import random
    
    # Add mock data for any missing tags
    for tag_id in tag_ids:
        if str(tag_id) not in result and tag_id not in result:
            # Generate random mock data
            result[tag_id] = {
                "value": random.uniform(0, 100),
                "timestamp": datetime.now().isoformat(),
                "unit": "units",
                "status": "Good"
            }
    
    # Convert tag_ids to strings to ensure JSON compatibility
    string_keyed_result = {str(tag_id): value for tag_id, value in result.items()}
    
    return TagValueBatch(root=string_keyed_result)

@app.get("/api/tag-trend/{tag_id}", response_model=TagTrend)
async def get_tag_trend(
    tag_id: int, 
    hours: int = 8,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get historical trend data for a tag by its ID.
    
    Parameters:
    - tag_id: The ID of the tag to fetch trend data for
    - hours: Number of hours of historical data to retrieve (default: 8)
    """
    result = db.get_tag_trend(tag_id, hours)
    
    # For development: Return mock trend data instead of 404
    if not result or not result.get("timestamps"):
        # Generate mock trend data
        import random
        from datetime import datetime, timedelta
        
        # Create timestamps for the requested hours
        now = datetime.now()
        timestamps = [(now - timedelta(minutes=i*30)).isoformat() for i in range(hours*2)]
        timestamps.reverse()  # Oldest first
        
        # Generate random values
        values = [random.uniform(40, 60) for _ in range(len(timestamps))]
        
        return {
            "timestamps": timestamps,
            "values": values
        }
    
    return result

@app.get("/api/tag-states", response_model=Dict[str, bool])
async def get_tag_states(
    state_tag_ids: List[int] = Query(...),
    db: DatabaseManager = Depends(get_db)
):
    """
    Get the boolean states for multiple tags.
    
    This endpoint is specifically for fetching boolean state tags that
    control the active/inactive state of analog tags.
    """
    result = db.get_tag_states(state_tag_ids)
    
    # Convert numeric tag_ids to strings for JSON compatibility
    string_keyed_result = {str(tag_id): state for tag_id, state in result.items()}
    
    return string_keyed_result

# For testing/development
# ----------------------------- Mills API Endpoints -----------------------------


@app.get("/api/mills/{mill}/ore") 
def get_ore_by_mill(mill: str, db: DatabaseManager = Depends(get_db)):
    """
    Get the current values for a specific mill across all shifts
    
    Parameters:
    - mill: The mill identifier (e.g., 'Mill01')
    """
    mills_utils = MillsUtils(db)
    result = mills_utils.fetch_ore_totals_by_mill(mill)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No data found for mill {mill}")
        
    return result

@app.get("/api/mills/ore-by-mill")
def get_ore_by_mill_query(mill: str, db: DatabaseManager = Depends(get_db)):
    """
    Alternative endpoint for getting mill ore data using query parameters
    to match frontend expectations
    
    Parameters:
    - mill: The mill identifier (e.g., 'Mill01') as a query parameter
    """
    mills_utils = MillsUtils(db)
    result = mills_utils.fetch_ore_totals_by_mill(mill)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No data found for mill {mill}")
        
    return result

@app.get("/api/mills/trend-by-tag")
async def get_mills_trend_by_tag(
    mill: str, 
    tag: str = "ore",
    trendPoints: int = 500,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get trend data for a specific mill and tag type
    
    Parameters:
    - mill: The mill identifier (e.g., 'Mill01')
    - tag: The tag category to fetch (default: 'ore')
    - trendPoints: Number of data points to retrieve (default: 500)
    """
    mills_utils = MillsUtils(db)
    result = mills_utils.fetch_trend_by_tag(mill, tag, trendPoints)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No trend data found for mill {mill} and tag {tag}")
        
    return result

@app.get("/api/mills/by-parameter")
async def get_mills_by_parameter(
    parameter: str = "ore",
    date: str = None,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get values for all mills for a specific parameter
    
    Parameters:
    - parameter: The parameter to fetch (default: 'ore')
    - date: Date to fetch data for in ISO format (default: current date)
    """
    mills_utils = MillsUtils(db)
    
    selected_date = None
    if date:
        try:
            selected_date = datetime.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {date}. Use ISO format (YYYY-MM-DD).")
    
    result = mills_utils.fetch_all_mills_by_parameter(parameter, selected_date)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No data found for parameter {parameter}")
        
    return result

@app.get("/api/mills/all_mills_by_param")
def get_all_mills_by_param(
    parameter: str, 
    start_ts: str, 
    end_ts: str = None, 
    freq: str = "5min",
    db: DatabaseManager = Depends(get_db)
):
    """
    Get historical data for all mills for a specific parameter within a time range.
    
    Parameters:
    - parameter: The parameter to fetch (e.g., 'Ore', 'Power')
    - start_ts: Start timestamp in ISO format (YYYY-MM-DDTHH:MM:SS)
    - end_ts: End timestamp in ISO format (default: current time)
    - freq: Resampling frequency (default: '5min')
    """
    # Convert string timestamps to datetime
    try:
        start = datetime.fromisoformat(start_ts)
        end = datetime.fromisoformat(end_ts) if end_ts else datetime.now()
    except ValueError:
        raise HTTPException(status_code=400, 
                           detail="Invalid timestamp format. Use ISO format: YYYY-MM-DDTHH:MM:SS")
    
    # Fetch data using our function
    try:
        result_df = get_mills_by_param(parameter=parameter, start_ts=start, end_ts=end, freq=freq)
        
        if result_df.empty:
            return {"message": "No data found for the specified parameters", "data": []}
        
        # Convert DataFrame to JSON-serializable format
        result_df['timestamp'] = result_df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')
        result = result_df.to_dict(orient='records')
        
        return {
            "parameter": parameter,
            "start_ts": start_ts,
            "end_ts": end_ts or datetime.now().isoformat(),
            "freq": freq,
            "count": len(result),
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, 
                           detail=f"Error retrieving mill data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import traceback
    import sys
    
    print("Starting API server with reload completely disabled...")
    
    try:
        # Test that the DB manager can be created with fallback
        print("Testing database connection with fallback...")
        test_db = create_db_manager()
        print(f"Database manager created successfully: {type(test_db).__name__}")
        
        # Start the server with selective reload
        # Only watch main code directories, exclude temp files and folders
        reload_dirs = [".", "./mills-xgboost/app"]
        
        # Configure specific folders to exclude from reload monitoring
        reload_excludes = [
            "*/__pycache__",
            "*/logs/*",
            "*/.git/*",
            "*/models/*",
            "*/.vscode/*",
            "*/.idea/*",
            "*/.pytest_cache/*",
            "*/temp/*",
            "*/*.pyc",
            "*/*.pyo",
            "*/*.pyd"
        ]
        
        # Enable reload but with controlled exclusions
        uvicorn.run(
            "api:app", 
            host=HOST, 
            port=PORT, 
            reload=True, 
            reload_dirs=reload_dirs,
            reload_excludes=reload_excludes,
            workers=1
        )
    except Exception as e:
        print(f"Error during API startup: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1)
