"""
Gaussian Process Regression Cascade Model Manager

Handles loading, prediction, and management of GPR cascade models.
Compatible with XGBoost cascade structure but uses GPR models with uncertainty quantification.
"""

import numpy as np
import pandas as pd
import pickle
from typing import Dict, List, Optional, Any
from sklearn.preprocessing import StandardScaler
import os
import json
from datetime import datetime


class GPRCascadeModelManager:
    """
    Manages Gaussian Process Regression cascade models for process optimization:
    - Individual process models (MV → CV) with uncertainty
    - Quality model (CV + DV → Target) with uncertainty
    """
    
    def __init__(self, model_save_path: str = "cascade_models", mill_number: Optional[int] = None):
        self.base_model_path = model_save_path
        self.mill_number = mill_number
        self.process_models = {}  # MV → CV models (GPR)
        self.quality_model = None  # CV + DV → Target model (GPR)
        self.scalers = {}
        
        # Set mill-specific model save path (mill_gp_XX format)
        if mill_number:
            self.model_save_path = os.path.join(model_save_path, f"mill_gp_{mill_number:02d}")
        else:
            self.model_save_path = model_save_path
            
        # Initialize metadata
        self.metadata = {
            "mill_number": mill_number,
            "model_type": "Gaussian Process Regression",
            "created_at": None,
            "model_version": "1.0.0",
            "features": {},
            "training_config": {},
            "model_performance": {}
        }
    
    def load_models(self) -> bool:
        """Load trained GPR models from disk"""
        try:
            print(f"🔍 Loading GPR models from {self.model_save_path}")
            
            # Load metadata first (critical for feature order)
            loaded_metadata = self.load_metadata()
            if loaded_metadata:
                self.metadata = loaded_metadata
                print(f"✅ Metadata loaded from {self.model_save_path}")
            else:
                print(f"⚠️ No metadata found at {self.model_save_path}")
                return False
            
            # Get CV features from metadata
            features = self.metadata.get("features", {})
            cvs = features.get("cv_features", [])
            
            if not cvs:
                print(f"❌ No CV features found in metadata")
                return False
            
            # Load process models (MV → CV)
            for cv_id in cvs:
                model_path = os.path.join(self.model_save_path, f"process_model_{cv_id}.pkl")
                scaler_path = os.path.join(self.model_save_path, f"process_model_{cv_id}_scaler.pkl")
                
                if os.path.exists(model_path) and os.path.exists(scaler_path):
                    with open(model_path, 'rb') as f:
                        self.process_models[cv_id] = pickle.load(f)
                    with open(scaler_path, 'rb') as f:
                        self.scalers[f"process_model_{cv_id}"] = pickle.load(f)
                    print(f"  ✅ Loaded process model: {cv_id}")
                else:
                    print(f"  ⚠️ Missing files for process model: {cv_id}")
            
            # Load quality model (CV + DV → Target)
            quality_model_path = os.path.join(self.model_save_path, "quality_model.pkl")
            quality_scaler_path = os.path.join(self.model_save_path, "quality_model_scaler.pkl")
            
            if os.path.exists(quality_model_path) and os.path.exists(quality_scaler_path):
                with open(quality_model_path, 'rb') as f:
                    self.quality_model = pickle.load(f)
                with open(quality_scaler_path, 'rb') as f:
                    self.scalers['quality_model'] = pickle.load(f)
                print(f"  ✅ Loaded quality model")
            else:
                print(f"  ⚠️ Missing quality model files")
                return False
            
            print(f"✅ GPR models loaded successfully from {self.model_save_path}")
            print(f"   Process models: {len(self.process_models)}")
            print(f"   Quality model: {'Yes' if self.quality_model else 'No'}")
            return True
            
        except Exception as e:
            print(f"❌ Error loading GPR models: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def predict_cascade(
        self, 
        mv_values: Dict[str, float], 
        dv_values: Dict[str, float],
        return_uncertainty: bool = False
    ) -> Dict[str, Any]:
        """
        Complete cascade prediction: MVs → CVs → Target with uncertainty quantification
        
        Args:
            mv_values: Dictionary of manipulated variable values
            dv_values: Dictionary of disturbance variable values
            return_uncertainty: If True, include uncertainty (std) in results
            
        Returns:
            Dictionary containing predicted CVs, target, feasibility, and optionally uncertainties
        """
        print(f"🔍 GPR predict_cascade called with:")
        print(f"   mv_values: {mv_values}")
        print(f"   dv_values: {dv_values}")
        print(f"   return_uncertainty: {return_uncertainty}")
        
        if not self.process_models or not self.quality_model:
            raise ValueError("GPR models not loaded. Call load_models() first.")
        
        # Get features from metadata
        features = self.metadata.get("features", {})
        mvs = features.get("mv_features", [])
        cvs = features.get("cv_features", [])
        dvs = features.get("dv_features", [])
        
        print(f"   Expected MVs from model: {mvs}")
        print(f"   Expected CVs from model: {cvs}")
        print(f"   Expected DVs from model: {dvs}")
        
        # Step 1: Predict CVs from MVs using process models
        try:
            mv_df = pd.DataFrame([[mv_values[mv_id] for mv_id in mvs]], columns=mvs)
        except KeyError as e:
            print(f"❌ Prediction error: {e}")
            print(f"   Available MV keys in request: {list(mv_values.keys())}")
            print(f"   Required MV keys from model: {mvs}")
            raise
        
        predicted_cvs = {}
        cv_uncertainties = {}
        
        for cv_id in cvs:
            if cv_id in self.process_models:
                # Scale input using DataFrame with feature names
                scaler = self.scalers[f"process_model_{cv_id}"]
                mv_scaled = scaler.transform(mv_df)
                
                # Predict with uncertainty
                gp_model = self.process_models[cv_id]
                cv_pred, cv_std = gp_model.predict(mv_scaled, return_std=True)
                
                predicted_cvs[cv_id] = float(cv_pred[0])
                cv_uncertainties[cv_id] = float(cv_std[0])
        
        # Step 2: Check CV constraints (feasibility) - not implemented yet, assume feasible
        is_feasible = True
        constraint_violations = []
        
        # Step 3: Predict target quality
        # Get the exact feature order from metadata
        model_performance = self.metadata.get("model_performance", {})
        quality_model_info = model_performance.get("quality_model", {})
        feature_cols = quality_model_info.get("input_features", cvs + dvs)
        
        # Build feature dictionary
        feature_dict = {}
        feature_dict.update(predicted_cvs)
        feature_dict.update(dv_values)
        
        print(f"🔍 Debug - Feature cols from metadata: {feature_cols}")
        print(f"🔍 Debug - Feature dict keys: {list(feature_dict.keys())}")
        
        # Create DataFrame with features in the exact order from training
        quality_features = [feature_dict[col] for col in feature_cols]
        quality_df = pd.DataFrame([quality_features], columns=feature_cols)
        
        print(f"✅ Quality model features (in order): {feature_cols}")
        print(f"   Feature values: {dict(zip(feature_cols, quality_features))}")
        
        # Scale and predict with uncertainty
        quality_scaler = self.scalers['quality_model']
        quality_scaled = quality_scaler.transform(quality_df)
        
        target_pred, target_std = self.quality_model.predict(quality_scaled, return_std=True)
        predicted_target = float(target_pred[0])
        target_uncertainty = float(target_std[0])
        
        # Build result
        result = {
            'predicted_cvs': predicted_cvs,
            'predicted_target': predicted_target,
            'is_feasible': is_feasible,
            'constraint_violations': constraint_violations,
            'mv_inputs': mv_values,
            'dv_inputs': dv_values
        }
        
        # Add uncertainties if requested
        if return_uncertainty:
            result['cv_uncertainties'] = cv_uncertainties
            result['target_uncertainty'] = target_uncertainty
        
        return result
    
    def load_metadata(self) -> Optional[Dict[str, Any]]:
        """Load model metadata from JSON file"""
        metadata_path = os.path.join(self.model_save_path, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                return json.load(f)
        return None
    
    def get_model_summary(self) -> Dict[str, Any]:
        """Get summary of trained GPR models"""
        metadata = self.load_metadata()
        summary = {
            'mill_number': self.mill_number,
            'model_type': 'Gaussian Process Regression',
            'process_models': list(self.process_models.keys()),
            'quality_model_trained': self.quality_model is not None,
            'scalers': list(self.scalers.keys()),
            'model_save_path': self.model_save_path,
            'metadata': metadata,
            'supports_uncertainty': True
        }
        return summary
    
    @classmethod
    def list_mill_models(cls, base_path: str = "cascade_models") -> Dict[int, Dict[str, Any]]:
        """List all available GPR mill models with their metadata"""
        mill_models = {}
        
        if not os.path.exists(base_path):
            return mill_models
            
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            # Look for mill_gp_XX directories
            if os.path.isdir(item_path) and item.startswith("mill_gp_"):
                try:
                    # Extract mill number from mill_gp_08 format
                    mill_number = int(item.split("_")[2])
                    metadata_path = os.path.join(item_path, "metadata.json")
                    
                    if os.path.exists(metadata_path):
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                        
                        # Check for model files
                        model_files = [f for f in os.listdir(item_path) if f.endswith('.pkl')]
                        
                        mill_models[mill_number] = {
                            "path": item_path,
                            "metadata": metadata,
                            "model_files": model_files,
                            "model_type": "gpr",
                            "has_complete_cascade": (
                                len([f for f in model_files if f.startswith('process_model_') and not f.endswith('_scaler.pkl')]) > 0 
                                and 'quality_model.pkl' in model_files
                            )
                        }
                except (ValueError, json.JSONDecodeError) as e:
                    print(f"Error processing GPR mill folder {item}: {e}")
                    continue
        
        return mill_models
