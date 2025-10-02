"""
Simplified Cascade Model Manager

Uses the same database approach as regular optimization endpoints.
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from typing import Dict, List, Optional, Any
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import joblib
import os
import json
import math
from datetime import datetime

from .variable_classifier import VariableClassifier, VariableType

class CascadeModelManager:
    """
    Manages the cascade of models for process optimization:
    - Individual process models (MV → CV)
    - Quality model (CV + DV → Target)
    """
    
    def __init__(self, model_save_path: str = "cascade_models", mill_number: Optional[int] = None):
        self.classifier = VariableClassifier()
        self.base_model_path = model_save_path
        self.mill_number = mill_number
        self.process_models = {}  # MV → CV models
        self.quality_model = None  # CV + DV → Target model
        self.scalers = {}
        
        # Feature configuration overrides
        self.configured_features = {
            'mvs': None,
            'cvs': None,
            'dvs': None,
            'target': None
        }
        
        # Set mill-specific model save path
        if mill_number:
            self.model_save_path = os.path.join(model_save_path, f"mill_{mill_number}")
        else:
            self.model_save_path = model_save_path
            
        # Create model save directory
        os.makedirs(self.model_save_path, exist_ok=True)
        
        # Initialize metadata
        self.metadata = {
            "mill_number": mill_number,
            "created_at": datetime.now().isoformat(),
            "model_version": "1.0.0",
            "training_config": {},
            "model_performance": {},
            "data_info": {}
        }
        
        # Simplified model configuration
        self.model_config = {
            'n_estimators': 200,
            'max_depth': 6,
            'learning_rate': 0.1,
            'random_state': 42
        }
    
    def configure_features(self, mv_features: Optional[List[str]] = None, 
                          cv_features: Optional[List[str]] = None,
                          dv_features: Optional[List[str]] = None,
                          target_variable: Optional[str] = None):
        """
        Configure specific features to use for training instead of classifier defaults
        
        Args:
            mv_features: List of manipulated variable names to use
            cv_features: List of controlled variable names to use  
            dv_features: List of disturbance variable names to use
            target_variable: Target variable name to use
        """
        if mv_features is not None:
            self.configured_features['mvs'] = mv_features
            print(f"Configured MVs: {mv_features}")
        
        if cv_features is not None:
            self.configured_features['cvs'] = cv_features
            print(f"Configured CVs: {cv_features}")
            
        if dv_features is not None:
            self.configured_features['dvs'] = dv_features
            print(f"Configured DVs: {dv_features}")
            
        if target_variable is not None:
            self.configured_features['target'] = target_variable
            print(f"Configured Target: {target_variable}")
    
    def prepare_training_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Prepare training data by separating MVs, CVs, DVs, and targets
        Uses configured features if available, otherwise falls back to classifier defaults
        """
        # Use configured features if available, otherwise use classifier defaults
        mvs = self.configured_features['mvs'] or [mv.id for mv in self.classifier.get_mvs()]
        cvs = self.configured_features['cvs'] or [cv.id for cv in self.classifier.get_cvs()]
        dvs = self.configured_features['dvs'] or [dv.id for dv in self.classifier.get_dvs()]
        targets = [self.configured_features['target']] if self.configured_features['target'] else [target.id for target in self.classifier.get_targets()]
        
        # Filter to only include columns that exist in the data
        available_mvs = [col for col in mvs if col in df.columns]
        available_cvs = [col for col in cvs if col in df.columns]
        available_dvs = [col for col in dvs if col in df.columns]
        available_targets = [col for col in targets if col in df.columns]
        
        # Check if we have minimum required variables
        missing_mvs = [col for col in mvs if col not in df.columns]
        missing_cvs = [col for col in cvs if col not in df.columns]
        missing_dvs = [col for col in dvs if col not in df.columns]
        missing_targets = [col for col in targets if col not in df.columns]
        
        print(f"Available MVs: {available_mvs} (missing: {missing_mvs})")
        print(f"Available CVs: {available_cvs} (missing: {missing_cvs})")
        print(f"Available DVs: {available_dvs} (missing: {missing_dvs})")
        print(f"Available Targets: {available_targets} (missing: {missing_targets})")
        
        # Require at least some variables of each type
        if len(available_mvs) == 0:
            raise ValueError(f"No manipulated variables (MVs) found in data. Required: {mvs}")
        if len(available_cvs) == 0:
            raise ValueError(f"No controlled variables (CVs) found in data. Required: {cvs}")
        if len(available_targets) == 0:
            raise ValueError(f"No target variables found in data. Required: {targets}")
        
        # DVs are optional for some models
        if len(available_dvs) == 0:
            print("Warning: No disturbance variables (DVs) found. Quality model will use only CVs.")
        
        return {
            'mvs': available_mvs,
            'cvs': available_cvs, 
            'dvs': available_dvs,
            'targets': available_targets,
            'mv_data': df[available_mvs] if available_mvs else pd.DataFrame(),
            'cv_data': df[available_cvs] if available_cvs else pd.DataFrame(),
            'dv_data': df[available_dvs] if available_dvs else pd.DataFrame(),
            'target_data': df[available_targets] if available_targets else pd.DataFrame()
        }
    
    def train_process_models(self, df: pd.DataFrame, test_size: float = 0.2) -> Dict[str, Any]:
        """
        Train individual process models: MV → CV
        Each CV gets its own model predicting from MVs
        """
        print("=== TRAINING PROCESS MODELS (MV → CV) ===")
        
        data = self.prepare_training_data(df)
        mvs = data['mvs']
        cvs = data['cvs']
        
        results = {}
        
        for cv_id in cvs:
            print(f"\nTraining model: MVs → {cv_id}")
            
            # Prepare features and target
            X = data['mv_data']  # All MVs as features
            y = df[cv_id]  # Current CV as target
            
            # Train-test split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            model = xgb.XGBRegressor(**self.model_config)
            model.fit(X_train_scaled, y_train)
            
            # Evaluate
            y_pred = model.predict(X_test_scaled)
            r2 = r2_score(y_test, y_pred)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            
            # Store model and scaler
            self.process_models[cv_id] = model
            self.scalers[f"mv_to_{cv_id}"] = scaler
            
            # Store results
            results[cv_id] = {
                'r2_score': r2,
                'rmse': rmse,
                'feature_importance': dict(zip(mvs, model.feature_importances_)),
                'model_type': 'process_model',
                'input_vars': mvs,
                'output_var': cv_id
            }
            
            print(f"  R² Score: {r2:.4f}")
            print(f"  RMSE: {rmse:.4f}")
            
            # Save model
            model_path = os.path.join(self.model_save_path, f"process_model_{cv_id}.pkl")
            scaler_path = os.path.join(self.model_save_path, f"scaler_mv_to_{cv_id}.pkl")
            joblib.dump(model, model_path)
            joblib.dump(scaler, scaler_path)
            
            # Update metadata with actual features used (configured or default)
            actual_mvs = self.configured_features['mvs'] or mvs
            self.metadata["model_performance"][f"process_model_{cv_id}"] = {
                "r2_score": float(r2),
                "rmse": float(rmse),
                "feature_importance": {k: float(v) for k, v in results[cv_id]["feature_importance"].items()},
                "input_vars": actual_mvs,  # Use actual configured features
                "output_var": cv_id
            }
        
        print(f"\nProcess models training completed. {len(results)} models trained.")
        return results
    
    def train_quality_model(self, df: pd.DataFrame, test_size: float = 0.2) -> Dict[str, Any]:
        """
        Train quality model: CV + DV → Target
        Uses REAL measured CVs and DVs to predict target quality
        """
        print("\n=== TRAINING QUALITY MODEL (CV + DV → Target) ===")
        
        data = self.prepare_training_data(df)
        cvs = data['cvs']
        dvs = data['dvs']
        targets = data['targets']
        
        # Use primary target (PSI200)
        primary_target = 'PSI200'
        if primary_target not in targets:
            raise ValueError(f"Primary target {primary_target} not found in targets")
        
        print(f"Training quality model: CVs + DVs → {primary_target}")
        
        # Prepare features (CVs + DVs) and target
        feature_cols = cvs + dvs
        X = df[feature_cols]  # Real measured CVs + DVs
        y = df[primary_target]  # Target quality
        
        # Train-test split - no shuffling for time series data
        test_size = int(len(X) * test_size)
        X_train, X_test = X[:-test_size], X[-test_size:]
        y_train, y_test = y[:-test_size], y[-test_size:]
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = xgb.XGBRegressor(**self.model_config)
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test_scaled)
        r2 = r2_score(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        
        # Store model and scaler
        self.quality_model = model
        self.scalers['quality_model'] = scaler
        
        # Feature importance
        feature_importance = dict(zip(feature_cols, model.feature_importances_))
        
        results = {
            'r2_score': r2,
            'rmse': rmse,
            'feature_importance': feature_importance,
            'model_type': 'quality_model',
            'input_vars': feature_cols,
            'output_var': primary_target,
            'cv_vars': cvs,
            'dv_vars': dvs
        }
        
        print(f"Quality Model R² Score: {r2:.4f}")
        print(f"Quality Model RMSE: {rmse:.4f}")
        print("\nFeature Importance:")
        for feature, importance in sorted(feature_importance.items(), key=lambda x: x[1], reverse=True):
            print(f"  {feature}: {importance:.4f}")
        
        # Save model
        model_path = os.path.join(self.model_save_path, "quality_model.pkl")
        scaler_path = os.path.join(self.model_save_path, "scaler_quality_model.pkl")
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        
        # Update metadata with actual features used (configured or default)
        actual_cvs = self.configured_features['cvs'] or cvs
        actual_dvs = self.configured_features['dvs'] or dvs  
        actual_target = self.configured_features['target'] or primary_target
        
        self.metadata["model_performance"]["quality_model"] = {
            "r2_score": float(r2),
            "rmse": float(rmse),
            "feature_importance": {k: float(v) for k, v in feature_importance.items()},
            "input_vars": feature_cols,  # Actual features used in training
            "output_var": actual_target,  # Use configured target
            "cv_vars": actual_cvs,  # Use configured CVs
            "dv_vars": actual_dvs   # Use configured DVs (may be empty)
        }
        
        return results
    
    def filter_data_by_bounds(
        self, 
        df: pd.DataFrame,
        mv_bounds: Optional[Dict[str, tuple]] = None,
        cv_bounds: Optional[Dict[str, tuple]] = None,
        target_bounds: Optional[Dict[str, tuple]] = None
    ) -> pd.DataFrame:
        """
        Filter training data based on provided bounds for MV, CV, and target features.
        Only rows where all values fall within specified bounds are kept.
        
        Args:
            df: Input dataframe to filter
            mv_bounds: Dictionary of MV bounds as {name: (min, max)}
            cv_bounds: Dictionary of CV bounds as {name: (min, max)}
            target_bounds: Dictionary of target bounds as {name: (min, max)}
            
        Returns:
            Filtered dataframe
        """
        df_filtered = df.copy()
        initial_count = len(df_filtered)
        
        print(f"\n=== FILTERING DATA BY BOUNDS ===")
        print(f"Initial data shape: {df_filtered.shape}")
        
        # Apply MV bounds filtering
        if mv_bounds:
            print(f"\nApplying MV bounds:")
            for feature, bounds in mv_bounds.items():
                if feature in df_filtered.columns:
                    min_val, max_val = bounds
                    before_count = len(df_filtered)
                    df_filtered = df_filtered[
                        (df_filtered[feature] >= min_val) & 
                        (df_filtered[feature] <= max_val)
                    ]
                    after_count = len(df_filtered)
                    removed = before_count - after_count
                    print(f"  {feature}: [{min_val}, {max_val}] - Removed {removed} rows")
                else:
                    print(f"  Warning: {feature} not found in dataframe")
        
        # Apply CV bounds filtering
        if cv_bounds:
            print(f"\nApplying CV bounds:")
            for feature, bounds in cv_bounds.items():
                if feature in df_filtered.columns:
                    min_val, max_val = bounds
                    before_count = len(df_filtered)
                    df_filtered = df_filtered[
                        (df_filtered[feature] >= min_val) & 
                        (df_filtered[feature] <= max_val)
                    ]
                    after_count = len(df_filtered)
                    removed = before_count - after_count
                    print(f"  {feature}: [{min_val}, {max_val}] - Removed {removed} rows")
                else:
                    print(f"  Warning: {feature} not found in dataframe")
        
        # Apply target bounds filtering
        if target_bounds:
            print(f"\nApplying Target bounds:")
            for feature, bounds in target_bounds.items():
                if feature in df_filtered.columns:
                    min_val, max_val = bounds
                    before_count = len(df_filtered)
                    df_filtered = df_filtered[
                        (df_filtered[feature] >= min_val) & 
                        (df_filtered[feature] <= max_val)
                    ]
                    after_count = len(df_filtered)
                    removed = before_count - after_count
                    print(f"  {feature}: [{min_val}, {max_val}] - Removed {removed} rows")
                else:
                    print(f"  Warning: {feature} not found in dataframe")
        
        final_count = len(df_filtered)
        total_removed = initial_count - final_count
        removal_percentage = (total_removed / initial_count * 100) if initial_count > 0 else 0
        
        print(f"\nFiltering summary:")
        print(f"  Initial rows: {initial_count}")
        print(f"  Final rows: {final_count}")
        print(f"  Removed: {total_removed} ({removal_percentage:.1f}%)")
        print(f"  Final shape: {df_filtered.shape}")
        
        return df_filtered
    
    def sanitize_json_data(self, obj):
        """
        Recursively sanitize data to ensure JSON compliance.
        Converts NaN, Infinity, and other non-JSON-compliant values to None.
        """
        if isinstance(obj, dict):
            return {key: self.sanitize_json_data(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self.sanitize_json_data(item) for item in obj]
        elif isinstance(obj, np.ndarray):
            # Convert numpy array to list and sanitize each element
            return [self.sanitize_json_data(item) for item in obj.tolist()]
        elif isinstance(obj, (np.floating, float)):
            # Handle numpy float types and regular floats
            if math.isnan(obj) or math.isinf(obj):
                return None
            return float(obj)
        elif isinstance(obj, (np.integer, int)):
            return int(obj)
        elif obj is None:
            return None
        else:
            return obj
    
    def _convert_for_json(self, obj):
        """Convert numpy types to native Python types for JSON serialization with sanitization"""
        return self.sanitize_json_data(obj)
    
    def train_all_models(
        self, 
        df: pd.DataFrame, 
        test_size: float = 0.2,
        use_steady_state: bool = False,
        steady_state_config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Train complete cascade: process models + quality model
        
        Args:
            df: Input dataframe (already filtered by bounds if needed)
            test_size: Test split ratio
            use_steady_state: If True, extract only steady-state samples before training
            steady_state_config: Configuration for steady-state detection
                - window_minutes: Window size for stability check (default: 60)
                - buffer_minutes: Buffer for temporal continuity (default: 30)
                - save_diagnostics: Save diagnostic reports (default: False)
        
        Note: Data filtering by bounds should be done before calling this method.
              Steady-state extraction (if enabled) happens after bounds filtering.
        """
        print("=== TRAINING COMPLETE CASCADE MODEL SYSTEM ===")
        
        # Optional: Steady-state extraction (Phase 1 & 2)
        if use_steady_state:
            from ..database.steady_state_processor import process_to_steady_state_with_diagnostics
            from ..database.steady_state_config import SteadyStateConfig
            
            print("\n" + "="*60)
            print("APPLYING STEADY-STATE EXTRACTION")
            print("="*60)
            print(f"Input data (after bounds filtering): {len(df)} rows")
            
            # Create config from parameters
            config_params = steady_state_config or {}
            ss_config = SteadyStateConfig(
                window_minutes=config_params.get('window_minutes', 60),
                buffer_minutes=config_params.get('buffer_minutes', 30),
                min_samples_per_window=config_params.get('min_samples_per_window', 30),
                enable_quality_filters=config_params.get('enable_quality_filters', True)
            )
            
            # Get variable classification from configured features or defaults
            variable_classification = {
                'mvs': self.configured_features['mvs'] or [mv.id for mv in self.classifier.get_mvs()],
                'cvs': self.configured_features['cvs'] or [cv.id for cv in self.classifier.get_cvs()],
                'dvs': self.configured_features['dvs'] or [dv.id for dv in self.classifier.get_dvs()],
                'targets': [self.configured_features['target']] if self.configured_features['target'] 
                          else [target.id for target in self.classifier.get_targets()]
            }
            
            # Process to steady-state
            df_processed, ss_diagnostics = process_to_steady_state_with_diagnostics(
                df=df,
                config=ss_config,
                variable_classification=variable_classification,
                save_diagnostics=config_params.get('save_diagnostics', False)
            )
            
            print(f"\n✅ Steady-state extraction complete:")
            print(f"   {len(df)} → {len(df_processed)} samples "
                  f"({len(df_processed)/len(df)*100:.1f}% retained)")
            print(f"   Mean stability score: {ss_diagnostics['extraction']['mean_stability_score']:.3f}")
            print("="*60 + "\n")
            
            # Use processed data for training
            df = df_processed
            
            # Store diagnostics in metadata
            self.metadata["steady_state_processing"] = {
                "enabled": True,
                "input_rows": ss_diagnostics['pipeline']['input_rows'],
                "output_samples": ss_diagnostics['pipeline']['output_samples'],
                "data_reduction_ratio": ss_diagnostics['pipeline']['data_reduction_ratio'],
                "mean_stability_score": ss_diagnostics['extraction']['mean_stability_score'],
                "config": {
                    "window_minutes": ss_config.window_minutes,
                    "buffer_minutes": ss_config.buffer_minutes,
                    "total_window_minutes": ss_config.total_window_minutes
                }
            }
        else:
            print("Steady-state extraction: DISABLED (using raw time-series data)")
            self.metadata["steady_state_processing"] = {"enabled": False}
        
        # Enhanced data cleaning
        print(f"\nOriginal data shape: {df.shape}")
        
        # Step 1: Drop columns that are entirely NaN
        df_clean = df.dropna(axis=1, how='all')
        print(f"After dropping empty columns: {df_clean.shape}")
        
        # Step 2: Drop rows with any remaining NaN values
        df_clean = df_clean.dropna(axis=0)
        print(f"After removing rows with NaN: {df_clean.shape}")
        
        # Step 3: Remove infinite values
        numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
        inf_mask = np.isinf(df_clean[numeric_cols]).any(axis=1)
        if inf_mask.any():
            print(f"Removing {inf_mask.sum()} rows with infinite values")
            df_clean = df_clean[~inf_mask]
            print(f"After removing infinite values: {df_clean.shape}")
        
        # Step 4: Check for duplicate timestamps (if index is datetime)
        if isinstance(df_clean.index, pd.DatetimeIndex):
            duplicates = df_clean.index.duplicated()
            if duplicates.any():
                print(f"Warning: Found {duplicates.sum()} duplicate timestamps, keeping first occurrence")
                df_clean = df_clean[~duplicates]
                print(f"After removing duplicates: {df_clean.shape}")
        
        # Step 5: Validate we have enough data
        if len(df_clean) < 100:
            raise ValueError(f"Insufficient data after cleaning: {len(df_clean)} rows (minimum 100 required)")
        
        print(f"✅ Data cleaning completed: {df_clean.shape}")
        
        # Train process models
        process_results = self.train_process_models(df_clean, test_size)
        
        # Train quality model
        quality_results = self.train_quality_model(df_clean, test_size)
        
        # Validate complete chain with error handling
        try:
            chain_results = self.validate_complete_chain(df_clean)
        except Exception as e:
            print(f"Warning: Chain validation failed: {e}")
            # Create dummy chain results so training can complete
            chain_results = {
                'r2_score': 0.0,
                'rmse': 999.0,
                'mae': 999.0,
                'n_samples': 0,
                'n_requested': 200,
                'predictions': [],
                'actuals': [],
                'validation_error': str(e)
            }
        
        # Update metadata with training information
        self.metadata["training_config"] = {
            "test_size": test_size,
            "data_shape": df_clean.shape,
            "training_timestamp": datetime.now().isoformat(),
            "configured_features": {
                "mv_features": self.configured_features['mvs'],
                "cv_features": self.configured_features['cvs'], 
                "dv_features": self.configured_features['dvs'],
                "target_variable": self.configured_features['target'],
                "using_custom_features": any([self.configured_features['mvs'], self.configured_features['cvs'], 
                                            self.configured_features['dvs'], self.configured_features['target']])
            }
        }
        self.metadata["data_info"] = {
            "original_shape": df.shape,
            "cleaned_shape": df_clean.shape,
            "rows_removed": df.shape[0] - df_clean.shape[0],
            "data_reduction": f"{((df.shape[0] - df_clean.shape[0]) / df.shape[0] * 100):.1f}%"
        }
        self.metadata["model_performance"]["chain_validation"] = {
            "r2_score": float(chain_results['r2_score']),
            "rmse": float(chain_results['rmse']),
            "mae": float(chain_results['mae']),
            "n_samples": int(chain_results['n_samples']),
            "n_requested": int(chain_results.get('n_requested', 200)),
            "validation_error": chain_results.get('validation_error', None)
        }
        
        # Save metadata
        self._save_metadata()
        
        # Compile results
        results = {
            'process_models': process_results,
            'quality_model': quality_results,
            'chain_validation': chain_results,
            'training_timestamp': datetime.now().isoformat(),
            'data_shape': df_clean.shape,
            'model_save_path': self.model_save_path,
            'mill_number': self.mill_number,
            'feature_configuration': {
                'mv_features': self.configured_features['mvs'],
                'cv_features': self.configured_features['cvs'],
                'dv_features': self.configured_features['dvs'],
                'target_variable': self.configured_features['target'],
                'using_custom_features': any([self.configured_features['mvs'], self.configured_features['cvs'], 
                                            self.configured_features['dvs'], self.configured_features['target']])
            }
        }
        
        # Save training results
        results_path = os.path.join(self.model_save_path, "training_results.json")
        with open(results_path, 'w') as f:
            # Convert numpy types to native Python types for JSON serialization
            json_results = self._convert_for_json(results)
            json.dump(json_results, f, indent=2)
        
        print(f"\n=== TRAINING COMPLETED ===")
        print(f"Process models: {len(process_results)} trained")
        print(f"Quality model: trained")
        print(f"Chain validation R²: {chain_results['r2_score']:.4f}")
        print(f"Results saved to: {results_path}")
        
        return results
    
    def predict_cascade(self, mv_values: Dict[str, float], dv_values: Dict[str, float]) -> Dict[str, Any]:
        """
        Complete cascade prediction: MVs → CVs → Target
        
        Args:
            mv_values: Dictionary of manipulated variable values
            dv_values: Dictionary of disturbance variable values
            
        Returns:
            Dictionary containing predicted CVs, target, and feasibility
        """
        if not self.process_models or not self.quality_model:
            raise ValueError("Models not trained. Call train_all_models() first.")
        
        # Use configured features if available, otherwise fall back to classifier defaults
        mvs = self.configured_features['mvs'] or [mv.id for mv in self.classifier.get_mvs()]
        cvs = self.configured_features['cvs'] or [cv.id for cv in self.classifier.get_cvs()]
        dvs = self.configured_features['dvs'] or [dv.id for dv in self.classifier.get_dvs()]
        
        # Step 1: Predict CVs from MVs using process models
        # Create DataFrame with proper feature names to avoid sklearn warnings
        mv_df = pd.DataFrame([[mv_values[mv_id] for mv_id in mvs]], columns=mvs)
        predicted_cvs = {}
        
        for cv_id in cvs:
            if cv_id in self.process_models:
                # Scale input using DataFrame with feature names
                scaler = self.scalers[f"mv_to_{cv_id}"]
                mv_scaled = scaler.transform(mv_df)
                
                # Predict
                cv_pred = self.process_models[cv_id].predict(mv_scaled)[0]
                predicted_cvs[cv_id] = cv_pred
        
        # Step 2: Check CV constraints (feasibility)
        cv_constraints = self.classifier.get_cv_constraints()
        is_feasible = True
        constraint_violations = []
        
        for cv_id, cv_value in predicted_cvs.items():
            if cv_id in cv_constraints:
                min_val, max_val = cv_constraints[cv_id]
                if not (min_val <= cv_value <= max_val):
                    is_feasible = False
                    constraint_violations.append({
                        'variable': cv_id,
                        'value': cv_value,
                        'constraint': (min_val, max_val)
                    })
        
        # Step 3: Predict target quality if feasible
        if is_feasible:
            # Combine CVs and DVs for quality prediction
            quality_features = []
            for cv_id in cvs:
                quality_features.append(predicted_cvs[cv_id])
            for dv_id in dvs:
                quality_features.append(dv_values[dv_id])
            
            # Scale and predict using DataFrame with feature names
            feature_cols = cvs + dvs
            quality_df = pd.DataFrame([quality_features], columns=feature_cols)
            quality_scaler = self.scalers['quality_model']
            quality_scaled = quality_scaler.transform(quality_df)
            
            predicted_target = self.quality_model.predict(quality_scaled)[0]
        else:
            predicted_target = 999.0  # High penalty for infeasible solutions
        
        return {
            'predicted_cvs': predicted_cvs,
            'predicted_target': predicted_target,
            'is_feasible': is_feasible,
            'constraint_violations': constraint_violations,
            'mv_inputs': mv_values,
            'dv_inputs': dv_values
        }
    
    def validate_complete_chain(self, df: pd.DataFrame, n_samples: int = 200) -> Dict[str, Any]:
        """
        Validate the complete MV → CV → Target prediction chain
        """
        print(f"\n=== VALIDATING COMPLETE CHAIN (n={n_samples}) ===")
        
        if not self.process_models or not self.quality_model:
            raise ValueError("Models not trained. Call train_all_models() first.")
        
        data = self.prepare_training_data(df)
        mvs = data['mvs']
        dvs = data['dvs']
        
        # Select random samples
        n_samples = min(n_samples, len(df))
        test_indices = np.random.choice(len(df), n_samples, replace=False)
        test_data = df.iloc[test_indices]
        
        predictions = []
        actuals = []
        
        for idx, row in test_data.iterrows():
            try:
                # Get actual MV and DV values
                mv_values = {mv_id: row[mv_id] for mv_id in mvs}
                dv_values = {dv_id: row[dv_id] for dv_id in dvs}  # Empty dict if no DVs
                
                # Predict using cascade
                result = self.predict_cascade(mv_values, dv_values)
                
                predictions.append(result['predicted_target'])
                actuals.append(row['PSI200'])  # Primary target
            except Exception as e:
                print(f"Warning: Validation failed for sample {idx}: {e}")
                # Skip this sample and continue
                continue
        
        # Calculate chain performance (only if we have predictions)
        if len(predictions) == 0:
            print("Warning: No successful predictions in chain validation")
            r2, rmse, mae = 0.0, 999.0, 999.0
        else:
            r2 = r2_score(actuals, predictions)
            rmse = np.sqrt(mean_squared_error(actuals, predictions))
            mae = np.mean(np.abs(np.array(actuals) - np.array(predictions)))
            print(f"Chain validation completed with {len(predictions)} successful predictions")
        
        results = {
            'r2_score': r2,
            'rmse': rmse,
            'mae': mae,
            'n_samples': len(predictions),  # Actual successful samples
            'n_requested': n_samples,  # Originally requested samples
            'predictions': predictions,
            'actuals': actuals
        }
        
        print(f"Complete Chain Validation:")
        print(f"  R² Score: {r2:.4f}")
        print(f"  RMSE: {rmse:.2f}%")
        print(f"  MAE: {mae:.2f}%")
        
        return results
    
    
    def load_models(self) -> bool:
        """Load trained models from disk"""
        try:
            cvs = [cv.id for cv in self.classifier.get_cvs()]
            
            # Load process models
            for cv_id in cvs:
                model_path = os.path.join(self.model_save_path, f"process_model_{cv_id}.pkl")
                scaler_path = os.path.join(self.model_save_path, f"scaler_mv_to_{cv_id}.pkl")
                
                if os.path.exists(model_path) and os.path.exists(scaler_path):
                    self.process_models[cv_id] = joblib.load(model_path)
                    self.scalers[f"mv_to_{cv_id}"] = joblib.load(scaler_path)
            
            # Load quality model
            quality_model_path = os.path.join(self.model_save_path, "quality_model.pkl")
            quality_scaler_path = os.path.join(self.model_save_path, "scaler_quality_model.pkl")
            
            if os.path.exists(quality_model_path) and os.path.exists(quality_scaler_path):
                self.quality_model = joblib.load(quality_model_path)
                self.scalers['quality_model'] = joblib.load(quality_scaler_path)
            
            print(f"Models loaded successfully from {self.model_save_path}")
            return True
            
        except Exception as e:
            print(f"Error loading models: {e}")
            return False
    
    def _save_metadata(self):
        """Save model metadata to JSON file"""
        metadata_path = os.path.join(self.model_save_path, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)
        print(f"Metadata saved to: {metadata_path}")
    
    def load_metadata(self) -> Optional[Dict[str, Any]]:
        """Load model metadata from JSON file"""
        metadata_path = os.path.join(self.model_save_path, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                return json.load(f)
        return None
    
    def get_model_summary(self) -> Dict[str, Any]:
        """Get summary of trained models"""
        metadata = self.load_metadata()
        summary = {
            'mill_number': self.mill_number,
            'process_models': list(self.process_models.keys()),
            'quality_model_trained': self.quality_model is not None,
            'scalers': list(self.scalers.keys()),
            'model_save_path': self.model_save_path,
            'cascade_structure': self.classifier.get_cascade_structure(),
            'metadata': metadata
        }
        return summary
    
    @classmethod
    def list_mill_models(cls, base_path: str = "cascade_models") -> Dict[int, Dict[str, Any]]:
        """List all available mill models with their metadata"""
        mill_models = {}
        
        if not os.path.exists(base_path):
            return mill_models
            
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            if os.path.isdir(item_path) and item.startswith("mill_"):
                try:
                    mill_number = int(item.split("_")[1])
                    metadata_path = os.path.join(item_path, "metadata.json")
                    
                    if os.path.exists(metadata_path):
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                        
                        # Sanitize metadata to handle NaN/Infinity values
                        temp_manager = cls()  # Create temporary instance for sanitization
                        sanitized_metadata = temp_manager.sanitize_json_data(metadata)
                        
                        # Check for model files
                        model_files = [f for f in os.listdir(item_path) if f.endswith('.pkl')]
                        
                        mill_models[mill_number] = {
                            "path": item_path,
                            "metadata": sanitized_metadata,
                            "model_files": model_files,
                            "has_complete_cascade": len([f for f in model_files if f.startswith('process_model_')]) > 0 and 'quality_model.pkl' in model_files
                        }
                except (ValueError, json.JSONDecodeError) as e:
                    print(f"Error processing mill folder {item}: {e}")
                    # Include mills with failed metadata but with error information
                    mill_models[mill_number] = {
                        "path": item_path,
                        "metadata": {"error": f"Failed to load metadata: {e}"},
                        "model_files": [],
                        "has_complete_cascade": False
                    }
                    continue
        
        return mill_models
