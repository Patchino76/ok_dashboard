"""
Cascade Model Manager

Manages the cascade models for the optimization system, including training, prediction,
and model persistence.
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime
from pathlib import Path
import logging
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Import configuration
from config.cascade_config import MODELS_DIR, LOGGING_CONFIG

# Configure logging
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)

class CascadeModelManager:
    """
    Manages cascade models for the optimization system.
    
    The CascadeModelManager handles training, prediction, and persistence of cascade models
    used in the optimization pipeline.
    """
    
    def __init__(self, models_dir: Union[str, Path] = None):
        """
        Initialize the CascadeModelManager.
        
        Args:
            models_dir: Directory to store/load models. If None, uses default from config.
        """
        # Set up models directory
        if models_dir is None:
            self.models_dir = Path(__file__).parent / "cascade_models"
        else:
            self.models_dir = Path(models_dir)
            
        # Create models directory if it doesn't exist
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize model storage
        self.models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict] = {}
        self.current_model_id: Optional[str] = None
        
        logger.info(f"Initialized CascadeModelManager with models directory: {self.models_dir}")
    
    def train_model(
        self,
        model_id: str,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        model_params: Optional[Dict] = None,
        feature_names: Optional[List[str]] = None,
        target_name: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Train a cascade model.
        
        Args:
            model_id: Unique identifier for the model
            X_train: Training features
            y_train: Training target
            model_params: Parameters for the model
            feature_names: List of feature names
            target_name: Name of the target variable
            **kwargs: Additional arguments
            
        Returns:
            Dictionary containing training results and metadata
        """
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_squared_error, r2_score
        import numpy as np
        
        # Set default parameters if not provided
        if model_params is None:
            model_params = {
                'n_estimators': 100,
                'max_depth': 10,
                'random_state': 42
            }
            
        if feature_names is None:
            feature_names = list(X_train.columns) if hasattr(X_train, 'columns') else [f'feature_{i}' for i in range(X_train.shape[1])]
            
        if target_name is None:
            target_name = 'target'
        logger.info(f"Training cascade model {model_id} with {len(X_train)} samples and {len(feature_names)} features")
        
        try:
            # Train the model
            model = RandomForestRegressor(**model_params)
            model.fit(X_train, y_train)
            
            # Make predictions
            y_pred = model.predict(X_train)
            
            # Calculate metrics
            mse = mean_squared_error(y_train, y_pred)
            r2 = r2_score(y_train, y_pred)
            
            # Feature importances
            importances = model.feature_importances_
            feature_importance = dict(zip(feature_names, importances))
            
            # Create model metadata
            metadata = {
                'model_id': model_id,
                'timestamp': datetime.now().isoformat(),
                'feature_names': feature_names,
                'target_name': target_name,
                'model_type': 'RandomForestRegressor',
                'model_params': model_params,
                'metrics': {
                    'train_mse': mse,
                    'train_r2': r2,
                },
                'feature_importance': feature_importance,
                'num_features': len(feature_names),
                'num_samples': len(X_train),
                **kwargs
            }
            
            # Store the model and metadata
            self.models[model_id] = model
            self.model_metadata[model_id] = metadata
            self.current_model_id = model_id
            
            # Save the model and metadata
            self.save_model(model_id)
            
            logger.info(f"Successfully trained model {model_id} with R²: {r2:.4f}")
            
            return {
                'status': 'success',
                'model_id': model_id,
                'metrics': metadata['metrics'],
                'feature_importance': feature_importance
            }
            
        except Exception as e:
            error_msg = f"Error training model {model_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {
                'status': 'error',
                'message': error_msg
            }
    
    def predict(self, model_id: str, X: pd.DataFrame) -> Dict:
        """
        Make predictions using a trained model.
        
        Args:
            model_id: ID of the model to use for prediction
            X: Input features for prediction
            
        Returns:
            Dictionary containing predictions and metadata
        """
        # Check if model is loaded, if not try to load it
        if model_id not in self.models and not self.load_model(model_id):
            error_msg = f"Model {model_id} not found and could not be loaded"
            logger.error(error_msg)
            return {
                'status': 'error',
                'message': error_msg
            }
            
        try:
            model = self.models[model_id]
            metadata = self.model_metadata.get(model_id, {})
            
            # Make predictions
            predictions = model.predict(X)
            
            return {
                'status': 'success',
                'predictions': predictions.tolist(),
                'model_id': model_id,
                'timestamp': datetime.now().isoformat(),
                'num_predictions': len(predictions)
            }
            
        except Exception as e:
            error_msg = f"Error making predictions with model {model_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {
                'status': 'error',
                'message': error_msg
            }
    
    def save_model(self, model_id: str) -> bool:
        """
        Save a trained model to disk.
        
        Args:
            model_id: ID of the model to save
            
        Returns:
            True if successful, False otherwise
        """
        if model_id not in self.models:
            logger.error(f"Cannot save model {model_id}: model not found in memory")
            return False
            
        try:
            # Create model directory
            model_dir = self.models_dir / model_id
            model_dir.mkdir(parents=True, exist_ok=True)
            
            # Save model
            model_path = model_dir / 'model.joblib'
            joblib.dump(self.models[model_id], model_path)
            
            # Save metadata
            metadata_path = model_dir / 'metadata.json'
            with open(metadata_path, 'w') as f:
                json.dump(self.model_metadata[model_id], f, indent=2)
            
            logger.info(f"Saved model {model_id} to {model_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving model {model_id}: {str(e)}", exc_info=True)
            return False
    
    def delete_model(self, model_id: str) -> bool:
        """
        Delete a trained model.
        
        Args:
            model_id: ID of the model to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Remove from memory
            if model_id in self.models:
                del self.models[model_id]
            if model_id in self.model_metadata:
                del self.model_metadata[model_id]
                
            # Remove from disk
            model_dir = self.models_dir / model_id
            if model_dir.exists():
                import shutil
                shutil.rmtree(model_dir)
                logger.info(f"Deleted model {model_id} from {model_dir}")
                
            if self.current_model_id == model_id:
                self.current_model_id = None
                
            return True
            
        except Exception as e:
            logger.error(f"Error deleting model {model_id}: {str(e)}", exc_info=True)
            return False
    
    def list_models(self) -> List[Dict]:
        """
        List all available models.
        
        Returns:
            List of model metadata dictionaries
        """
        models = []
        
        for model_dir in self.models_dir.glob('*'):
            if not model_dir.is_dir():
                continue
                
            metadata_path = model_dir / 'metadata.json'
            if not metadata_path.exists():
                continue
                
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    models.append(metadata)
            except Exception as e:
                logger.warning(f"Error loading metadata for {model_dir.name}: {str(e)}")
        
        return models
    
    def get_model_info(self, model_id: str) -> Optional[Dict]:
        """
        Get information about a specific model.
        
        Args:
            model_id: ID of the model
            
        Returns:
            Model metadata dictionary or None if not found
        """
        if model_id in self.model_metadata:
            return self.model_metadata[model_id]
            
        # Try to load the model if not in memory
        if self.load_model(model_id):
            return self.model_metadata.get(model_id)
            
        return None
