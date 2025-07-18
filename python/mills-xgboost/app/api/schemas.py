from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Union, Any, Annotated
from datetime import datetime

class DatabaseConfig(BaseModel):
    """Database connection configuration"""
    host: str = "em-m-db4.ellatzite-med.com"
    port: int = 5432
    dbname: str = "em_pulse_data"
    user: str = "s.lyubenov"
    password: str = "tP9uB7sH7mK6zA7t"

class TrainingParameters(BaseModel):
    """XGBoost model training parameters"""
    n_estimators: int = 300
    learning_rate: float = 0.05
    max_depth: int = 6
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    early_stopping_rounds: int = 30
    objective: str = "reg:squarederror"

class TrainingRequest(BaseModel):
    """Request model for training an XGBoost model"""
    db_config: DatabaseConfig = Field(default_factory=DatabaseConfig)
    mill_number: int = 6
    start_date: datetime = Field(default_factory=lambda: datetime.now() - timedelta(days=30))
    end_date: datetime = Field(default_factory=lambda: datetime.now())
    features: List[str] = [
        "Ore", "WaterMill", "WaterZumpf", "PressureHC", 
        "DensityHC", "MotorAmp", "Shisti", "Daiki"
    ]
    target_col: str = "PSI80"
    test_size: float = 0.2
    params: Optional[TrainingParameters] = Field(default_factory=TrainingParameters)

class ModelMetrics(BaseModel):
    """Model performance metrics"""
    mae: float
    mse: float
    rmse: float
    r2: float

class TrainingResponse(BaseModel):
    """Response model for training results"""
    model_id: str
    train_metrics: ModelMetrics
    test_metrics: ModelMetrics
    feature_importance: Dict[str, Any]
    training_duration: float
    best_iteration: int
    best_score: float

class PredictionRequest(BaseModel):
    """Request model for making predictions"""
    model_id: str
    data: Dict[str, float]

class PredictionResponse(BaseModel):
    """Response model for predictions"""
    prediction: float
    model_id: str
    target_col: str
    timestamp: datetime

class OptimizationRequest(BaseModel):
    """Request model for parameter optimization"""
    model_id: str
    parameter_bounds: Optional[Dict[str, List[float]]] = None
    init_points: int = 5
    n_iter: int = 25
    maximize: bool = True
    
class ParameterRecommendation(BaseModel):
    """Parameter recommendation from optimization"""
    params: Dict[str, float]
    predicted_value: float

class OptimizationResponse(BaseModel):
    """Response model for optimization results"""
    best_params: Dict[str, float]
    best_target: float
    target_col: str
    maximize: bool
    recommendations: List[ParameterRecommendation]
    model_id: str
