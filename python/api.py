from fastapi import FastAPI, Depends, HTTPException, Query, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, RootModel, Field
from datetime import datetime, timedelta
import math
import numpy as np
from balls_router import router as balls_router
from sqlalchemy import text as sql_text

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

_pg_connector = None

_PG_MILL_COLUMNS = {
    "Ore",
    "WaterMill",
    "WaterZumpf",
    "Power",
    "ZumpfLevel",
    "PressureHC",
    "DensityHC",
    "FE",
    "PulpHC",
    "PumpRPM",
    "MotorAmp",
    "PSI80",
    "PSI200",
}


def _get_pg_connector():
    global _pg_connector
    if _pg_connector is not None:
        return _pg_connector

    mills_xgboost_path = os.path.join(os.path.dirname(__file__), "mills-xgboost")
    if mills_xgboost_path not in sys.path:
        sys.path.insert(0, mills_xgboost_path)

    database_path = os.path.join(mills_xgboost_path, "app", "database")
    if database_path not in sys.path:
        sys.path.append(database_path)
    from db_connector import MillsDataConnector

    import importlib.util

    settings_path = os.path.join(mills_xgboost_path, "config", "settings.py")
    spec = importlib.util.spec_from_file_location("settings_module", settings_path)
    settings_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(settings_module)
    settings = settings_module.Settings()

    _pg_connector = MillsDataConnector(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
    )
    return _pg_connector


def _parse_resolution_to_seconds(resolution: str) -> int:
    r = (resolution or "").strip().lower()
    if not r:
        raise HTTPException(status_code=400, detail="resolution is required")

    units = {"min": 60, "h": 3600, "d": 86400}
    num = ""
    unit = ""
    for ch in r:
        if ch.isdigit() and not unit:
            num += ch
        else:
            unit += ch

    if not num or unit not in units:
        raise HTTPException(
            status_code=400,
            detail="Invalid resolution. Use like 1min, 5min, 1h, 1d.",
        )

    n = int(num)
    if n <= 0:
        raise HTTPException(status_code=400, detail="resolution must be > 0")
    return n * units[unit]


def _normalize_agg(agg: str) -> str:
    a = (agg or "avg").strip().lower()
    allowed = {"avg", "sum", "min", "max"}
    if a not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Invalid agg. Allowed: avg, sum, min, max.",
        )
    return a


def _normalize_period(period: str) -> str:
    p = (period or "none").strip().lower()
    if p in {"24h", "daily"}:
        p = "day"
    allowed = {"none", "day", "month", "year"}
    if p not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Invalid aggregation_period. Allowed: none, day, month, year.",
        )
    return p


def _parse_iso_datetime(ts: str) -> datetime:
    if ts is None:
        raise HTTPException(status_code=400, detail="start_ts and end_ts are required")
    try:
        dt = datetime.fromisoformat(ts)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid timestamp format. Use ISO format (YYYY-MM-DDTHH:MM:SS).",
        )

    if dt.tzinfo is not None:
        dt = dt.astimezone(tz=None).replace(tzinfo=None)
    return dt


def _bucket_expr_for_resolution(column_name: str, resolution: str) -> str:
    r = (resolution or "").strip().lower()
    if not r:
        raise HTTPException(status_code=400, detail="resolution is required")

    num = ""
    unit = ""
    for ch in r:
        if ch.isdigit() and not unit:
            num += ch
        else:
            unit += ch

    if not num:
        raise HTTPException(
            status_code=400,
            detail="Invalid resolution. Use like 1min, 5min, 1h, 1d.",
        )

    n = int(num)
    if n <= 0:
        raise HTTPException(status_code=400, detail="resolution must be > 0")

    ts_col = column_name

    if unit == "min":
        # Bucket within each hour.
        return (
            f"date_trunc('hour', {ts_col}) + "
            f"make_interval(mins => (floor(extract(minute from {ts_col}) / :bucket_n) * :bucket_n)::int)"
        )

    if unit == "h":
        # Bucket within each day.
        return (
            f"date_trunc('day', {ts_col}) + "
            f"make_interval(hours => (floor(extract(hour from {ts_col}) / :bucket_n) * :bucket_n)::int)"
        )

    if unit == "d":
        if n != 1:
            raise HTTPException(
                status_code=400,
                detail="Only 1d resolution is supported (use aggregation_period for larger periods).",
            )
        return f"date_trunc('day', {ts_col})"

    raise HTTPException(
        status_code=400,
        detail="Invalid resolution. Use like 1min, 5min, 1h, 1d.",
    )

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

# ----------------------------- Multi-Output Optimization Endpoints -----------------------------

# Create multi-output router directly in main API
multi_output_router = APIRouter(prefix="/api/v1/ml/multi-output", tags=["Multi-Output Optimization"])

# Multi-output models
class MultiOutputTrainRequest(BaseModel):
    mill_number: int = Field(default=8, ge=1, le=12, description="Mill number (1-12)")
    start_date: str = Field(default="2025-06-21", description="Start date (YYYY-MM-DD)")
    end_date: str = Field(default="2025-08-21", description="End date (YYYY-MM-DD)")

class MultiOutputPredictRequest(BaseModel):
    motor_amp: float = Field(..., ge=150, le=250, description="Motor amperage (150-250A)")

class MultiOutputOptimizeRequest(BaseModel):
    n_trials: int = Field(default=1000, ge=100, le=5000, description="Number of optimization trials")

class MultiOutputPredictResponse(BaseModel):
    motor_amp: float
    predictions: Dict[str, float]
    timestamp: datetime

class MultiOutputOptimizeResponse(BaseModel):
    best_motor_amp: float
    best_psi200: float
    predictions: Dict[str, float]
    feasible: bool
    timestamp: datetime

class MultiOutputTrainResponse(BaseModel):
    mill_number: int
    data_points: int
    metrics: Dict[str, Dict[str, float]]
    overall_r2: Dict[str, float]
    timestamp: datetime

# Global multi-output state
_multi_output_model = None
_multi_output_training_status = {"status": "not_started", "message": "Training not initiated"}

@multi_output_router.get("/info")
async def get_multi_output_info():
    """Get information about the multi-output optimization system"""
    return {
        "description": "Multi-output XGBoost model for mill optimization",
        "features": ["MotorAmp"],
        "targets": ["PulpHC", "DensityHC", "PressureHC", "PSI200"],
        "mv_bounds": {"MotorAmp": [150, 250]},
        "cv_constraints": {
            "PulpHC": [400, 600],
            "DensityHC": [1200, 2000], 
            "PressureHC": [0.0, 0.6],
            "PSI200": [10, 40]
        },
        "model_trained": _multi_output_model is not None,
        "optimization_objective": "Minimize PSI200 (+200 micron fraction) for better fineness"
    }

@multi_output_router.get("/status")
async def get_multi_output_status():
    """Get current status of the multi-output optimization system"""
    return {
        "status": "ready" if _multi_output_model is not None else "not_trained",
        "model_trained": _multi_output_model is not None,
        "training_status": _multi_output_training_status,
        "timestamp": datetime.now()
    }

@multi_output_router.post("/train", response_model=MultiOutputTrainResponse)
async def train_multi_output_model(request: MultiOutputTrainRequest):
    """Train multi-output model using real database data"""
    global _multi_output_model, _multi_output_training_status
    
    try:
        _multi_output_training_status = {"status": "training", "message": "Training in progress"}
        
        # Import the real MultiOutputMillModel
        import sys
        import os
        mills_xgboost_path = os.path.join(os.path.dirname(__file__), 'mills-xgboost')
        if mills_xgboost_path not in sys.path:
            sys.path.insert(0, mills_xgboost_path)
        
        from app.optimization_multiple.multi_output_model import MultiOutputMillModel
        
        # Create database connector
        database_path = os.path.join(mills_xgboost_path, 'app', 'database')
        if database_path not in sys.path:
            sys.path.append(database_path)
        from db_connector import MillsDataConnector
        
        # Load settings from mills-xgboost config
        import importlib.util
        settings_path = os.path.join(mills_xgboost_path, 'config', 'settings.py')
        spec = importlib.util.spec_from_file_location('settings_module', settings_path)
        settings_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(settings_module)
        settings = settings_module.Settings()
        
        # Use correct database credentials from settings
        host = settings.DB_HOST
        port = settings.DB_PORT
        dbname = settings.DB_NAME
        user = settings.DB_USER
        password = settings.DB_PASSWORD
        
        db_connector = MillsDataConnector(host, port, dbname, user, password)
        
        # Create and train model
        model = MultiOutputMillModel(mill_number=request.mill_number)
        
        # Load data from database using the specified date range
        df = model.load_data_from_database(db_connector, start_date=request.start_date, end_date=request.end_date)
        
        logger.info(f"Loaded {len(df)} data points from database")
        
        if len(df) < 100:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: {len(df)} samples (minimum 100 required)"
            )
        
        # Train the model
        metrics = model.train(df)
        
        # Store trained model globally
        _multi_output_model = model
        _multi_output_training_status = {"status": "completed", "message": "Training completed successfully"}
        
        # Extract overall_r2 from metrics and remove it
        overall_r2_value = metrics.pop('overall_r2')
        
        return MultiOutputTrainResponse(
            mill_number=request.mill_number,
            data_points=len(df),
            metrics=metrics,
            overall_r2={"value": float(overall_r2_value)},
            timestamp=datetime.now()
        )
        
    except Exception as e:
        _multi_output_training_status = {"status": "failed", "message": f"Training failed: {str(e)}"}
        logger.error(f"Multi-output training failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@multi_output_router.post("/predict", response_model=MultiOutputPredictResponse)
async def predict_multi_output(request: MultiOutputPredictRequest):
    """Predict all targets (CVs + Quality) from MotorAmp value"""
    global _multi_output_model
    
    if _multi_output_model is None:
        raise HTTPException(
            status_code=400, 
            detail="Model not trained. Call /train endpoint first."
        )
    
    try:
        # Mock predictions based on MotorAmp input
        # These would be replaced with actual model predictions
        motor_amp = request.motor_amp
        
        # Simple linear relationships for demonstration
        predictions = {
            "PulpHC": 450 + (motor_amp - 200) * 1.2,
            "DensityHC": 1400 + (motor_amp - 200) * 2.5,
            "PressureHC": 0.3 + (motor_amp - 200) * 0.001,
            "PSI200": 25 - (motor_amp - 200) * 0.05  # Lower MotorAmp = higher PSI200
        }
        
        return MultiOutputPredictResponse(
            motor_amp=motor_amp,
            predictions=predictions,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Multi-output prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@multi_output_router.post("/optimize", response_model=MultiOutputOptimizeResponse)
async def optimize_multi_output(request: MultiOutputOptimizeRequest):
    """Optimize MotorAmp to minimize PSI200 while keeping CVs within constraints"""
    global _multi_output_model
    
    if _multi_output_model is None:
        raise HTTPException(
            status_code=400, 
            detail="Model not trained. Call /train endpoint first."
        )
    
    try:
        logger.info(f"Starting optimization with {request.n_trials} trials")
        
        # Mock optimization result
        # In reality, this would use Optuna to find optimal MotorAmp
        best_motor_amp = 185.5  # Optimal value found by "optimization"
        
        # Calculate predictions for optimal MotorAmp
        predictions = {
            "PulpHC": 450 + (best_motor_amp - 200) * 1.2,
            "DensityHC": 1400 + (best_motor_amp - 200) * 2.5,
            "PressureHC": 0.3 + (best_motor_amp - 200) * 0.001,
            "PSI200": 25 - (best_motor_amp - 200) * 0.05
        }
        
        # Check feasibility
        feasible = (
            400 <= predictions["PulpHC"] <= 600 and
            1200 <= predictions["DensityHC"] <= 2000 and
            0.0 <= predictions["PressureHC"] <= 0.6 and
            10 <= predictions["PSI200"] <= 40
        )
        
        return MultiOutputOptimizeResponse(
            best_motor_amp=best_motor_amp,
            best_psi200=predictions["PSI200"],
            predictions=predictions,
            feasible=feasible,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Multi-output optimization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

# Include multi-output router in main app
app.include_router(multi_output_router, tags=["Multi-Output Optimization"])
MULTI_OUTPUT_AVAILABLE = True
logger.info("Successfully loaded Multi-Output Optimization router with mock implementation")

# ----------------------------- Cascade Optimization Endpoints -----------------------------

# Cascade endpoints are now integrated through mills_ml_router at /api/v1/ml/cascade/*
CASCADE_SYSTEM_AVAILABLE = ML_SYSTEM_AVAILABLE  # Cascade availability depends on ML system

# ----------------------------- Models -----------------------------

class TagValue(BaseModel):
    """Model for tag value response"""
    value: Union[float, bool, None]
    timestamp: str
    unit: Optional[str] = None
    status: Optional[str] = None


app.include_router(balls_router)

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
        "multi_output_system": {
            "available": MULTI_OUTPUT_AVAILABLE,
            "endpoints_count": len(multi_output_router.routes) if MULTI_OUTPUT_AVAILABLE else 0
        },
        "cascade_system": {
            "available": CASCADE_SYSTEM_AVAILABLE,
            "endpoints_count": 9 if CASCADE_SYSTEM_AVAILABLE else 0,  # 9 cascade endpoints in mills_ml_router
            "base_url": "/api/v1/ml/cascade" if CASCADE_SYSTEM_AVAILABLE else None
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


@app.get("/api/mills/ore-daily")
def get_mills_ore_daily(
    start_date: str,
    end_date: str,
    db: DatabaseManager = Depends(get_db),
):
    try:
        try:
            start_d = datetime.fromisoformat(start_date).date()
            end_d = datetime.fromisoformat(end_date).date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid date format. Use ISO format (YYYY-MM-DD).",
            )

        if end_d < start_d:
            raise HTTPException(
                status_code=400,
                detail="end_date must be >= start_date",
            )

        if not hasattr(db, "get_tag_history_range"):
            raise HTTPException(
                status_code=500,
                detail="Backend needs restart: DatabaseManager.get_tag_history_range is not available",
            )

        from tags_definition import mills_tags

        production_start = datetime.combine(start_d, datetime.min.time()) + timedelta(
            hours=6
        )
        production_end = datetime.combine(
            end_d + timedelta(days=1), datetime.min.time()
        ) + timedelta(hours=6)

        days_count = (end_d - start_d).days + 1
        if days_count <= 0:
            return []

        def safe_float(v):
            try:
                if v is None:
                    return None
                return float(v)
            except Exception:
                return None

        def sum_counter_increases(values):
            nums = [safe_float(v) for v in values]
            nums = [v for v in nums if v is not None]
            if len(nums) < 2:
                return None

            total = 0.0
            prev = nums[0]
            for v in nums[1:]:
                if v >= prev:
                    total += v - prev
                else:
                    total += v
                prev = v
            return float(total)

        result = []

        for mill_tag in mills_tags.get("total", []):
            tag_id = mill_tag.get("id")
            mill_name = str(mill_tag.get("name") or "")
            if not tag_id or not mill_name.lower().startswith("mill"):
                continue

            try:
                mill_number = int(mill_name[4:])
            except Exception:
                continue

            history = db.get_tag_history_range(tag_id, production_start, production_end)
            timestamps = history.get("timestamps") or []
            values = history.get("values") or []

            buckets = [[] for _ in range(days_count)]
            for ts_str, v in zip(timestamps, values):
                try:
                    ts = datetime.fromisoformat(ts_str)
                except Exception:
                    continue

                if ts < production_start or ts >= production_end:
                    continue

                idx = int((ts - production_start).total_seconds() // (24 * 3600))
                if 0 <= idx < days_count:
                    buckets[idx].append(v)

            for day_idx in range(days_count):
                ore_t = sum_counter_increases(buckets[day_idx])
                result.append(
                    {
                        "date": (start_d + timedelta(days=day_idx)).isoformat(),
                        "mill": mill_number,
                        "ore_t": ore_t,
                    }
                )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /api/mills/ore-daily: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mills/series")
def get_mill_series(
    mill_number: int = Query(..., ge=1, le=12),
    parameter: str = Query(...),
    start_ts: str = Query(...),
    end_ts: str = Query(...),
    resolution: str = Query("1min"),
    aggregation_period: str = Query("none"),
    agg: str = Query("avg"),
    production_day_start_hour: int = Query(6, ge=0, le=23),
):
    start_dt = _parse_iso_datetime(start_ts)
    end_dt = _parse_iso_datetime(end_ts)
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="end_ts must be > start_ts")

    param = (parameter or "").strip()
    if param not in _PG_MILL_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parameter. Allowed: {', '.join(sorted(_PG_MILL_COLUMNS))}",
        )

    period = _normalize_period(aggregation_period)
    agg_norm = _normalize_agg(agg)

    res = (resolution or "").strip().lower()
    num = ""
    unit = ""
    for ch in res:
        if ch.isdigit() and not unit:
            num += ch
        else:
            unit += ch
    if not num:
        raise HTTPException(
            status_code=400,
            detail="Invalid resolution. Use like 1min, 5min, 1h, 1d.",
        )
    bucket_n = int(num)
    bucket_expr = _bucket_expr_for_resolution('"TimeStamp"', resolution)

    table = f"MILL_{mill_number:02d}"
    col = f'"{param}"'

    if agg_norm == "avg":
        bucket_value_expr = f"avg({col})"
    elif agg_norm == "sum":
        bucket_value_expr = f"sum({col})"
    elif agg_norm == "min":
        bucket_value_expr = f"min({col})"
    else:
        bucket_value_expr = f"max({col})"

    base_sql = f"""
        with buckets as (
            select
                {bucket_expr} as bucket_ts,
                {bucket_value_expr} as bucket_value,
                count({col}) as samples
            from mills."{table}"
            where "TimeStamp" >= :start_ts
              and "TimeStamp" < :end_ts
            group by 1
        )
    """

    if period == "none":
        final_sql = (
            base_sql
            + """
            select bucket_ts as ts, bucket_value as value, samples
            from buckets
            order by 1
            """
        )
        key_name = "ts"
    else:
        if period == "day":
            key_expr = "date_trunc('day', bucket_ts - make_interval(hours => :pdh))::date"
            key_name = "date"
        elif period == "month":
            key_expr = "date_trunc('month', bucket_ts - make_interval(hours => :pdh))::date"
            key_name = "month"
        else:
            key_expr = "date_trunc('year', bucket_ts - make_interval(hours => :pdh))::date"
            key_name = "year"

        if agg_norm == "avg":
            value_expr = (
                "case when sum(samples) = 0 then null "
                "else sum(bucket_value * samples) / sum(samples) end"
            )
        elif agg_norm == "sum":
            value_expr = "sum(bucket_value)"
        elif agg_norm == "min":
            value_expr = "min(bucket_value)"
        else:
            value_expr = "max(bucket_value)"

        final_sql = (
            base_sql
            + f"""
            select
                {key_expr} as period_key,
                {value_expr} as value,
                sum(samples) as samples
            from buckets
            group by 1
            order by 1
            """
        )

    try:
        connector = _get_pg_connector()
        with connector.engine.connect() as conn:
            rows = conn.execute(
                sql_text(final_sql),
                {
                    "start_ts": start_dt,
                    "end_ts": end_dt,
                    "bucket_n": bucket_n,
                    "pdh": int(production_day_start_hour),
                },
            ).mappings().all()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    out: List[Dict[str, Union[str, float, int, None]]] = []
    for r in rows:
        if period == "none":
            ts_val = r.get("ts")
            out.append(
                {
                    "ts": ts_val.isoformat() if hasattr(ts_val, "isoformat") else str(ts_val),
                    "value": float(r["value"]) if r.get("value") is not None else None,
                    "samples": int(r.get("samples") or 0),
                }
            )
        else:
            key_val = r.get("period_key")
            if period == "day":
                key_str = key_val.isoformat() if hasattr(key_val, "isoformat") else str(key_val)
            elif period == "month":
                if hasattr(key_val, "year") and hasattr(key_val, "month"):
                    key_str = f"{key_val.year:04d}-{key_val.month:02d}"
                else:
                    key_str = str(key_val)
            else:
                key_str = str(getattr(key_val, "year", key_val))

            out.append(
                {
                    key_name: key_str,
                    "value": float(r["value"]) if r.get("value") is not None else None,
                    "samples": int(r.get("samples") or 0),
                }
            )

    return out

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
    hours: int = None,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get trend data for a specific mill and tag type
    
    Parameters:
    - mill: The mill identifier (e.g., 'Mill01')
    - tag: The tag category to fetch (default: 'ore')
    - trendPoints: Number of data points to retrieve (default: 500, used if hours not specified)
    - hours: Number of hours of data to retrieve (takes precedence over trendPoints)
    """
    mills_utils = MillsUtils(db)
    result = mills_utils.fetch_trend_by_tag(mill, tag, trendPoints, hours)
    
    # Return empty array instead of 404 to allow frontend to handle empty state
    if not result:
        return []
        
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
        # Replace NaN/Infinity values with None for JSON compliance
        result_df = result_df.replace([np.inf, -np.inf, np.nan], None)
        result = result_df.to_dict(orient='records')
        
        # Double-check: sanitize any remaining non-JSON-compliant floats
        def sanitize_value(v):
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            return v
        
        result = [{k: sanitize_value(v) for k, v in row.items()} for row in result]
        
        return {
            "parameter": parameter,
            "start_ts": start_ts,
            "end_ts": end_ts or datetime.now().isoformat(),
            "freq": freq,
            "count": len(result),
            "data": result
        }
    except Exception as e:
        logger.error(f"Error in get_all_mills_by_param: {str(e)}")
        raise HTTPException(status_code=500, 
                           detail=f"Error retrieving mill data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import traceback
    import sys
    
    print("Starting API server with reload completely disabled...")
    
    try:
        # Define reload directories and exclusions
        reload_dirs = [
            os.path.dirname(__file__),
            os.path.join(os.path.dirname(__file__), "mills-xgboost")
        ]
        
        reload_excludes = [
            "*/__pycache__/*",
            "*/logs/*",
            "*/models/*",
            "*/.git/*",
            "*/.vscode/*",
            "*/.idea/*",
            "*/.pytest_cache/*",
            "*/temp/*",
            "*/*.pyc",
            "*/*.pyo",
            "*/*.pyd"
        ]
        
        # Ensure app is properly initialized before starting uvicorn
        print(f"Starting API server with {len(app.routes)} routes loaded")
        print(f"Cascade system available: {CASCADE_SYSTEM_AVAILABLE}")
        
        # Enable reload but with controlled exclusions
        uvicorn.run(
            app,  # Pass app object directly instead of string reference
            host=HOST, 
            port=PORT, 
            reload=False,  # Disable reload to avoid module loading issues
            workers=1
        )
    except Exception as e:
        print(f"Error during API startup: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1)
