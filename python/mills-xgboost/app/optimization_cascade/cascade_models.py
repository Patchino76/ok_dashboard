"""
Cascade Model Manager for Multi-Model Optimization

Implements the multi-model cascade approach:
1. Process Models: MV → CV (predict how controls affect measurements)
2. Quality Model: CV + DV → Target (predict how measurements + disturbances affect quality)
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from typing import Dict, List, Tuple, Optional, Any
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import joblib
import os
from datetime import datetime

from .variable_classifier import VariableClassifier, VariableType

class CascadeModelManager:
    """
    Manages the cascade of models for process optimization:
    - Individual process models (MV → CV)
    - Quality model (CV + DV → Target)
    """
    
    def __init__(self, model_save_path: str = "cascade_models"):
        self.classifier = VariableClassifier()
        self.model_save_path = model_save_path
        self.process_models = {}  # MV → CV models
        self.quality_model = None  # CV + DV → Target model
        self.scalers = {}
        
        # Create model save directory
        os.makedirs(model_save_path, exist_ok=True)
        
        # Model configurations
        self.process_model_config = {
            'n_estimators': 200,
            'max_depth': 6,
            'learning_rate': 0.1,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'random_state': 42
        }
        
        self.quality_model_config = {
            'n_estimators': 500,  # More complex for quality prediction
            'max_depth': 8,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'reg_alpha': 0.1,
            'reg_lambda': 0.1,
            'random_state': 42
        }
    
    def prepare_training_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Prepare training data by separating MVs, CVs, DVs, and targets
        """
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        cvs = [cv.id for cv in self.classifier.get_cvs()]
        dvs = [dv.id for dv in self.classifier.get_dvs()]
        targets = [target.id for target in self.classifier.get_targets()]
        
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
            model = xgb.XGBRegressor(**self.process_model_config)
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
        
        # Train-test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = xgb.XGBRegressor(**self.quality_model_config)
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
        
        return results
    
    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean training data by handling missing values and outliers
        """
        df_clean = df.copy()
        
        # Get all variable columns
        all_vars = []
        for var_type in [VariableType.MV, VariableType.CV, VariableType.DV, VariableType.TARGET]:
            vars_of_type = [var.id for var in self.classifier.get_variables_by_type(var_type)]
            all_vars.extend(vars_of_type)
        
        # Filter to only include relevant columns (MVs, CVs, DVs, Targets) plus datetime index
        relevant_columns = all_vars
        available_columns = [col for col in relevant_columns if col in df_clean.columns]
        
        print(f"Original columns: {len(df_clean.columns)}")
        print(f"Relevant columns found: {available_columns}")
        
        # Keep only relevant columns
        df_clean = df_clean[available_columns]
        print(f"After filtering to relevant columns: {df_clean.shape}")
        
        # Handle missing values first
        print(df_clean.info())
        df_clean = df_clean.dropna()
        print(f"After removing NaN values: {df_clean.shape}")
        
        # More conservative outlier removal using IQR method
        for col in all_vars:
            if col in df_clean.columns:
                Q1 = df_clean[col].quantile(0.25)
                Q3 = df_clean[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                initial_count = len(df_clean)
                df_clean = df_clean[
                    (df_clean[col] >= lower_bound) & 
                    (df_clean[col] <= upper_bound)
                ]
                removed_count = initial_count - len(df_clean)
                if removed_count > 0:
                    print(f"Removed {removed_count} outliers from {col} (bounds: {lower_bound:.2f} to {upper_bound:.2f})")
        
        print(f"Final cleaned data shape: {df_clean.shape}")
        return df_clean
    
    def _convert_for_json(self, obj):
        """Convert numpy types to native Python types for JSON serialization"""
        if isinstance(obj, dict):
            return {key: self._convert_for_json(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_for_json(item) for item in obj]
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.float32, np.float64)):
            return float(obj)
        elif isinstance(obj, (np.int32, np.int64)):
            return int(obj)
        else:
            return obj
    
    def train_all_models(self, df: pd.DataFrame, test_size: float = 0.2) -> Dict[str, Any]:
        """
        Train complete cascade: process models + quality model
        """
        print("=== TRAINING COMPLETE CASCADE MODEL SYSTEM ===")
        
        # Clean data
        print(f"Original data shape: {df.shape}")
        df_clean = self._clean_data(df)
        print(f"After cleaning: {df_clean.shape}")
        
        # Train process models
        process_results = self.train_process_models(df_clean, test_size)
        
        # Train quality model
        quality_results = self.train_quality_model(df_clean, test_size)
        
        # Validate complete chain
        chain_results = self.validate_complete_chain(df_clean)
        
        # Compile results
        results = {
            'process_models': process_results,
            'quality_model': quality_results,
            'chain_validation': chain_results,
            'training_timestamp': datetime.now().isoformat(),
            'data_shape': df_clean.shape,
            'model_save_path': self.model_save_path
        }
        
        # Save training results
        results_path = os.path.join(self.model_save_path, "training_results.json")
        import json
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
        
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        cvs = [cv.id for cv in self.classifier.get_cvs()]
        dvs = [dv.id for dv in self.classifier.get_dvs()]
        
        # Step 1: Predict CVs from MVs using process models
        mv_array = np.array([mv_values[mv_id] for mv_id in mvs]).reshape(1, -1)
        predicted_cvs = {}
        
        for cv_id in cvs:
            if cv_id in self.process_models:
                # Scale input
                scaler = self.scalers[f"mv_to_{cv_id}"]
                mv_scaled = scaler.transform(mv_array)
                
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
            
            # Scale and predict
            quality_array = np.array(quality_features).reshape(1, -1)
            quality_scaler = self.scalers['quality_model']
            quality_scaled = quality_scaler.transform(quality_array)
            
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
            # Get actual MV and DV values
            mv_values = {mv_id: row[mv_id] for mv_id in mvs}
            dv_values = {dv_id: row[dv_id] for dv_id in dvs}
            
            # Predict using cascade
            result = self.predict_cascade(mv_values, dv_values)
            
            predictions.append(result['predicted_target'])
            actuals.append(row['PSI200'])  # Primary target
        
        # Calculate chain performance
        r2 = r2_score(actuals, predictions)
        rmse = np.sqrt(mean_squared_error(actuals, predictions))
        mae = np.mean(np.abs(np.array(actuals) - np.array(predictions)))
        
        results = {
            'r2_score': r2,
            'rmse': rmse,
            'mae': mae,
            'n_samples': n_samples,
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
    
    def get_model_summary(self) -> Dict[str, Any]:
        """Get summary of trained models"""
        summary = {
            'process_models': list(self.process_models.keys()),
            'quality_model_trained': self.quality_model is not None,
            'scalers': list(self.scalers.keys()),
            'model_save_path': self.model_save_path,
            'cascade_structure': self.classifier.get_cascade_structure()
        }
        return summary
