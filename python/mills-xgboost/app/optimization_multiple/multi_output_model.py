import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.multioutput import MultiOutputRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
import optuna
import logging
from typing import Dict, List, Tuple, Optional
import sys
import os

# Add the database directory to sys.path to import database connector
database_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database')
sys.path.append(database_path)
from db_connector import MillsDataConnector

logger = logging.getLogger(__name__)

class MultiOutputMillModel:
    """
    Single XGBoost model that predicts all targets (CVs + Quality) from MotorAmp MV
    Uses real database data from Mill 8
    """
    
    def __init__(self, mill_number: int = 8):
        self.mill_number = mill_number
        self.model = None
        self.scaler_X = StandardScaler()
        self.scaler_y = StandardScaler()
        
        # Define features and targets based on mills-parameters.ts
        self.feature_names = ['MotorAmp']  # Primary MV we can control
        self.target_names = ['PulpHC', 'DensityHC', 'PressureHC', 'PSI200']  # CVs + Quality
        
        # Define bounds from mills-parameters.ts
        self.mv_bounds = {
            'MotorAmp': (150, 250)  # Amperes
        }
        
        self.cv_constraints = {
            'PulpHC': (400, 600),      # m³/h
            'DensityHC': (1200, 2000), # kg/m³
            'PressureHC': (0.0, 0.6),  # bar
            'PSI200': (10, 40)         # % (quality target)
        }
        
    def load_data_from_database(self, db_connector: MillsDataConnector, 
                               days_back: int = 30) -> pd.DataFrame:
        """
        Load real data from database for the specified mill
        """
        try:
            logger.info(f"Loading data for Mill {self.mill_number} from last {days_back} days")
            
            # Get mill data
            mill_data = db_connector.get_mill_data(
                mill_number=self.mill_number,
                days_back=days_back
            )
            
            if mill_data.empty:
                raise ValueError(f"No mill data found for Mill {self.mill_number}")
            
            # Get ore quality data
            ore_data = db_connector.get_ore_quality_data(days_back=days_back)
            
            # Join datasets on timestamp
            if not ore_data.empty:
                combined_data = db_connector.join_dataframes_on_timestamp(
                    mill_data, ore_data
                )
            else:
                combined_data = mill_data
                logger.warning("No ore quality data found, using mill data only")
            
            logger.info(f"Loaded {len(combined_data)} data points")
            return combined_data
            
        except Exception as e:
            logger.error(f"Error loading data from database: {e}")
            raise
    
    def prepare_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare input (MV) and output (CVs + Quality) data
        """
        # Check if required columns exist
        missing_features = [col for col in self.feature_names if col not in df.columns]
        missing_targets = [col for col in self.target_names if col not in df.columns]
        
        if missing_features:
            raise ValueError(f"Missing feature columns: {missing_features}")
        if missing_targets:
            raise ValueError(f"Missing target columns: {missing_targets}")
        
        # Extract features and targets
        X = df[self.feature_names].values
        y = df[self.target_names].values
        
        # Remove rows with NaN values
        mask = ~(np.isnan(X).any(axis=1) | np.isnan(y).any(axis=1))
        X = X[mask]
        y = y[mask]
        
        logger.info(f"Prepared data: {X.shape[0]} samples, {X.shape[1]} features, {y.shape[1]} targets")
        return X, y
    
    def train(self, df: pd.DataFrame) -> Dict:
        """
        Train multi-output XGBoost model
        """
        X, y = self.prepare_data(df)
        
        if len(X) < 100:
            raise ValueError(f"Insufficient data for training: {len(X)} samples")
        
        # Train-test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features and targets
        X_train_scaled = self.scaler_X.fit_transform(X_train)
        X_test_scaled = self.scaler_X.transform(X_test)
        y_train_scaled = self.scaler_y.fit_transform(y_train)
        y_test_scaled = self.scaler_y.transform(y_test)
        
        # Create multi-output XGBoost model
        base_model = xgb.XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42
        )
        self.model = MultiOutputRegressor(base_model)
        
        # Train model
        logger.info("Training multi-output XGBoost model...")
        self.model.fit(X_train_scaled, y_train_scaled)
        
        # Evaluate
        y_pred_scaled = self.model.predict(X_test_scaled)
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled)
        
        # Calculate metrics for each target
        metrics = {}
        logger.info("Model Performance:")
        logger.info("-" * 50)
        
        for i, target_name in enumerate(self.target_names):
            r2 = r2_score(y_test[:, i], y_pred[:, i])
            rmse = np.sqrt(mean_squared_error(y_test[:, i], y_pred[:, i]))
            metrics[target_name] = {'r2': r2, 'rmse': rmse}
            logger.info(f"{target_name:15s}: R² = {r2:.3f}, RMSE = {rmse:.3f}")
        
        # Overall performance
        overall_r2 = np.mean([metrics[target]['r2'] for target in self.target_names])
        metrics['overall_r2'] = overall_r2
        logger.info(f"Overall R²: {overall_r2:.3f}")
        
        return metrics
    
    def predict(self, motor_amp: float) -> Dict[str, float]:
        """
        Predict all targets from MotorAmp value
        
        Args:
            motor_amp: Motor amperage value (150-250A)
        
        Returns:
            Dictionary with predicted CVs and quality
        """
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        # Validate input bounds
        min_amp, max_amp = self.mv_bounds['MotorAmp']
        if not (min_amp <= motor_amp <= max_amp):
            raise ValueError(f"MotorAmp {motor_amp} outside bounds [{min_amp}, {max_amp}]")
        
        # Prepare input
        X = np.array([[motor_amp]])
        X_scaled = self.scaler_X.transform(X)
        
        # Predict scaled outputs
        predictions_scaled = self.model.predict(X_scaled)
        
        # Inverse scale predictions
        predictions = self.scaler_y.inverse_transform(predictions_scaled)
        
        # Return as dictionary
        result = {}
        for i, target_name in enumerate(self.target_names):
            result[target_name] = float(predictions[0, i])
        
        return result
    
    def optimize(self, n_trials: int = 1000) -> Dict:
        """
        Optimize MotorAmp to minimize PSI200 while keeping CVs within constraints
        """
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        def objective(trial):
            # Sample MotorAmp (this is what Optuna will optimize)
            motor_amp = trial.suggest_float('MotorAmp', *self.mv_bounds['MotorAmp'])
            
            # Predict all targets
            predictions = self.predict(motor_amp)
            
            # Check CV constraints (reject if infeasible)
            for cv_name in ['PulpHC', 'DensityHC', 'PressureHC']:
                min_val, max_val = self.cv_constraints[cv_name]
                if not (min_val <= predictions[cv_name] <= max_val):
                    return 100.0  # High penalty for infeasible solutions
            
            # Return PSI200 (minimize +200 micron fraction for better fineness)
            return predictions['PSI200']
        
        # Create optimization study
        study = optuna.create_study(direction='minimize')
        study.optimize(objective, n_trials=n_trials)
        
        # Get best result
        best_params = study.best_params
        best_value = study.best_value
        
        # Predict all targets with optimal parameters
        optimal_predictions = self.predict(best_params['MotorAmp'])
        
        result = {
            'best_motor_amp': best_params['MotorAmp'],
            'best_psi200': best_value,
            'predictions': optimal_predictions,
            'feasible': all(
                self.cv_constraints[cv][0] <= optimal_predictions[cv] <= self.cv_constraints[cv][1]
                for cv in ['PulpHC', 'DensityHC', 'PressureHC']
            )
        }
        
        logger.info(f"Optimization Results:")
        logger.info(f"Best MotorAmp: {result['best_motor_amp']:.2f}A")
        logger.info(f"Best PSI200: {result['best_psi200']:.2f}%")
        logger.info(f"Feasible: {result['feasible']}")
        
        return result
