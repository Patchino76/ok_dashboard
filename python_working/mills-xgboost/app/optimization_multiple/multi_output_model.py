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
        self.feature_names = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']  # All MVs we can control
        # self.target_names = ['PulpHC', 'DensityHC', 'PressureHC']  # CVs + Quality
        self.target_names = ['PulpHC', 'DensityHC', 'PressureHC', 'PSI200'] 
        
        # Define bounds from mills-parameters.ts
        self.mv_bounds = {
            'Ore': (140, 240),        # t/h - Ore feed rate
            'WaterMill': (5, 25),     # m³/h - Mill water flow
            'WaterZumpf': (140, 250), # m³/h - Sump water flow
            'MotorAmp': (150, 250)    # A - Motor amperage
        }
        
        self.cv_constraints = {
            'PulpHC': (350, 600),      # m³/h
            'DensityHC': (1600, 1900), # kg/m³
            'PressureHC': (0.3, 0.5),  # bar
            'PSI200': (0.18, 0.36)         # % (quality target)
        }
        
    def load_data_from_database(self, db_connector: MillsDataConnector, 
                               start_date: str = "2025-06-21", end_date: str = "2025-09-02",
                               ) -> pd.DataFrame:
        """
        Load real data from database for the specified mill
        
        Args:
            db_connector: Database connector instance
            start_date: Start date in 'YYYY-MM-DD' format
            end_date: End date in 'YYYY-MM-DD' format
        """
        try:
            logger.info(f"Loading data for Mill {self.mill_number} from {start_date} to {end_date}")
            
            # Get mill data
            mill_data = db_connector.get_mill_data(
                mill_number=self.mill_number,
                start_date=start_date,
                end_date=end_date
            )
            
            if mill_data.empty:
                raise ValueError(f"No mill data found for Mill {self.mill_number}")
            
            # Get ore quality data with same date range
            ore_data = db_connector.get_ore_quality(start_date=start_date, end_date=end_date)
            
            # Process ore quality data to remove duplicates and handle timestamps
            if not ore_data.empty:
                ore_data = db_connector.process_dataframe(
                    ore_data, 
                    start_date=start_date, 
                    end_date=end_date,
                    resample_freq='1min',
                    no_interpolation=True
                )
            
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
        # Filter PSI200 values to be between 18 and 36
        df = df[(df['PSI200'] >= 18) & (df['PSI200'] >= 36)]
        
        # Remove rows with NaN values
        df = df.dropna(subset=self.feature_names + self.target_names)
        
        # Extract features and targets
        X = df[self.feature_names].values
        y = df[self.target_names].values
        
        return X, y
    
    def train(self, df: pd.DataFrame) -> Dict:
        """
        Train multi-output XGBoost model
        """
        X, y = self.prepare_data(df)
        
        if len(X) < 100:
            raise ValueError(f"Insufficient data for training: {len(X)} samples")
        
        # Train-test split without shuffling (80/20 split)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Scale features and targets
        X_train_scaled = self.scaler_X.fit_transform(X_train)
        X_test_scaled = self.scaler_X.transform(X_test)
        y_train_scaled = self.scaler_y.fit_transform(y_train)
        y_test_scaled = self.scaler_y.transform(y_test)
        
        # Create multi-output XGBoost model
        base_model = xgb.XGBRegressor(
            objective = 'reg:squarederror',
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
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
    
    def predict(self, mv_values: Dict[str, float]) -> Dict[str, float]:
        """
        Predict all targets from MV values
        
        Args:
            mv_values: Dictionary with MV values {'Ore': 180, 'WaterMill': 15, 'WaterZumpf': 200, 'MotorAmp': 200}
        
        Returns:
            Dictionary with predicted CVs and quality
        """
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        # Validate all MV inputs
        for mv_name in self.feature_names:
            if mv_name not in mv_values:
                raise ValueError(f"Missing MV value for {mv_name}")
            
            min_val, max_val = self.mv_bounds[mv_name]
            value = mv_values[mv_name]
            if not (min_val <= value <= max_val):
                raise ValueError(f"{mv_name} {value} outside bounds [{min_val}, {max_val}]")
        
        # Prepare input in correct order
        X = np.array([[mv_values[name] for name in self.feature_names]])
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
        Optimize all MVs to minimize PSI200 while keeping CVs within constraints
        """
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        def objective(trial):
            # Sample all MVs (these are what Optuna will optimize)
            mv_values = {}
            for mv_name in self.feature_names:
                min_val, max_val = self.mv_bounds[mv_name]
                mv_values[mv_name] = trial.suggest_float(mv_name, min_val, max_val)
            
            # Predict all targets
            predictions = self.predict(mv_values)
            
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
        optimal_predictions = self.predict(best_params)
        
        result = {
            'best_mv_values': best_params,
            'best_psi200': best_value,
            'predictions': optimal_predictions,
            'feasible': all(
                self.cv_constraints[cv][0] <= optimal_predictions[cv] <= self.cv_constraints[cv][1]
                for cv in ['PulpHC', 'DensityHC', 'PressureHC']
            )
        }
        
        logger.info(f"Optimization Results:")
        for mv_name, value in best_params.items():
            logger.info(f"Best {mv_name}: {value:.2f}")
        logger.info(f"Best PSI200: {result['best_psi200']:.2f}%")
        logger.info(f"Feasible: {result['feasible']}")
        
        return result
