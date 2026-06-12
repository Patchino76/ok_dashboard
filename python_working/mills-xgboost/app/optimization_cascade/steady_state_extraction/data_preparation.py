"""
Phase 1: Data Preparation for Steady State Extraction

Handles loading, cleaning, normalizing, and resampling time series data
from the PostgreSQL database using db_connector.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
from sklearn.preprocessing import StandardScaler
import sys
import os

# Add parent directories to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from database.db_connector import MillsDataConnector

logger = logging.getLogger(__name__)


class DataPreparation:
    """
    Prepares time series data for matrix profile analysis
    """
    
    def __init__(self, db_connector: MillsDataConnector):
        """
        Initialize with database connector
        
        Args:
            db_connector: MillsDataConnector instance
        """
        self.db_connector = db_connector
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.original_data = None
        self.prepared_data = None
        self.normalized_data = None
        
    def load_mill_data(self, 
                       mill_number: int,
                       start_date: str,
                       end_date: str,
                       resample_freq: str = '1min') -> pd.DataFrame:
        """
        Load mill data from database
        
        Args:
            mill_number: Mill number (6, 7, 8, etc.)
            start_date: Start date string (YYYY-MM-DD HH:MM:SS)
            end_date: End date string (YYYY-MM-DD HH:MM:SS)
            resample_freq: Resampling frequency (default: 1min)
            
        Returns:
            DataFrame with mill data
        """
        logger.info(f"Loading data for Mill {mill_number} from {start_date} to {end_date}")
        
        # Use db_connector to get combined mill and ore quality data
        combined_data = self.db_connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq=resample_freq,
            save_to_logs=False,
            no_interpolation=False  # Use interpolation for smooth data
        )
        
        if combined_data is None or combined_data.empty:
            raise ValueError(f"No data retrieved for Mill {mill_number}")
        
        self.original_data = combined_data
        logger.info(f"Loaded {len(combined_data)} rows with {len(combined_data.columns)} columns")
        logger.info(f"Date range: {combined_data.index.min()} to {combined_data.index.max()}")
        
        return combined_data
    
    def select_features(self, 
                       data: pd.DataFrame,
                       mv_features: Optional[List[str]] = None,
                       cv_features: Optional[List[str]] = None,
                       dv_features: Optional[List[str]] = None) -> pd.DataFrame:
        """
        Select specific features for analysis
        
        Args:
            data: Input DataFrame
            mv_features: Manipulated variables (e.g., Ore, WaterMill, WaterZumpf, MotorAmp)
            cv_features: Controlled variables (e.g., PulpHC, DensityHC, PressureHC)
            dv_features: Disturbance variables (e.g., Shisti, Daiki, Grano)
            
        Returns:
            DataFrame with selected features
        """
        selected_columns = []
        
        if mv_features:
            selected_columns.extend([col for col in mv_features if col in data.columns])
            logger.info(f"Selected MV features: {[col for col in mv_features if col in data.columns]}")
        
        if cv_features:
            selected_columns.extend([col for col in cv_features if col in data.columns])
            logger.info(f"Selected CV features: {[col for col in cv_features if col in data.columns]}")
        
        if dv_features:
            selected_columns.extend([col for col in dv_features if col in data.columns])
            logger.info(f"Selected DV features: {[col for col in dv_features if col in data.columns]}")
        
        if not selected_columns:
            raise ValueError("No valid features selected")
        
        self.feature_columns = selected_columns
        selected_data = data[selected_columns].copy()
        
        logger.info(f"Selected {len(selected_columns)} features for analysis")
        return selected_data
    
    def handle_missing_values(self, 
                             data: pd.DataFrame,
                             method: str = 'interpolate',
                             max_gap: int = 10) -> pd.DataFrame:
        """
        Handle missing values in the dataset
        
        Args:
            data: Input DataFrame
            method: Method to handle missing values ('interpolate', 'ffill', 'drop')
            max_gap: Maximum gap size to interpolate (in data points)
            
        Returns:
            DataFrame with missing values handled
        """
        logger.info(f"Handling missing values using method: {method}")
        
        # Check for missing values
        missing_count = data.isnull().sum()
        if missing_count.sum() > 0:
            logger.warning(f"Found missing values:\n{missing_count[missing_count > 0]}")
        
        if method == 'interpolate':
            # Interpolate with limit on gap size
            data_clean = data.interpolate(method='linear', limit=max_gap, limit_direction='both')
            # Forward fill remaining gaps
            data_clean = data_clean.ffill().bfill()
        elif method == 'ffill':
            data_clean = data.ffill().bfill()
        elif method == 'drop':
            data_clean = data.dropna()
        else:
            raise ValueError(f"Unknown method: {method}")
        
        # Check if any missing values remain
        remaining_missing = data_clean.isnull().sum().sum()
        if remaining_missing > 0:
            logger.warning(f"Still have {remaining_missing} missing values after handling")
            # Drop remaining rows with missing values
            data_clean = data_clean.dropna()
        
        logger.info(f"After handling missing values: {len(data_clean)} rows remaining")
        return data_clean
    
    def normalize_features(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, StandardScaler]:
        """
        Normalize features using StandardScaler (critical for matrix profile!)
        
        Args:
            data: Input DataFrame
            
        Returns:
            Tuple of (normalized DataFrame, fitted scaler)
        """
        logger.info("Normalizing features using StandardScaler")
        
        # Fit and transform
        normalized_values = self.scaler.fit_transform(data)
        normalized_df = pd.DataFrame(
            normalized_values,
            index=data.index,
            columns=data.columns
        )
        
        # Log normalization statistics
        logger.info("Normalization statistics:")
        for col in data.columns:
            orig_mean = data[col].mean()
            orig_std = data[col].std()
            norm_mean = normalized_df[col].mean()
            norm_std = normalized_df[col].std()
            logger.info(f"  {col}: mean {orig_mean:.2f}→{norm_mean:.4f}, std {orig_std:.2f}→{norm_std:.4f}")
        
        self.normalized_data = normalized_df
        return normalized_df, self.scaler
    
    def prepare_for_stumpy(self,
                          mill_number: int,
                          start_date: str,
                          end_date: str,
                          mv_features: List[str],
                          cv_features: List[str],
                          dv_features: Optional[List[str]] = None,
                          resample_freq: str = '1min') -> Tuple[pd.DataFrame, pd.DataFrame, StandardScaler]:
        """
        Complete data preparation pipeline for STUMPY analysis
        
        Args:
            mill_number: Mill number
            start_date: Start date string
            end_date: End date string
            mv_features: List of MV feature names
            cv_features: List of CV feature names
            dv_features: List of DV feature names (optional)
            resample_freq: Resampling frequency
            
        Returns:
            Tuple of (original selected data, normalized data, scaler)
        """
        logger.info("=" * 80)
        logger.info("PHASE 1: DATA PREPARATION FOR STEADY STATE EXTRACTION")
        logger.info("=" * 80)
        
        # Step 1: Load data
        logger.info("\n[Step 1/5] Loading mill data from database...")
        raw_data = self.load_mill_data(mill_number, start_date, end_date, resample_freq)
        
        # Step 2: Select features
        logger.info("\n[Step 2/5] Selecting features for analysis...")
        selected_data = self.select_features(raw_data, mv_features, cv_features, dv_features)
        
        # Step 3: Handle missing values
        logger.info("\n[Step 3/5] Handling missing values...")
        clean_data = self.handle_missing_values(selected_data, method='interpolate', max_gap=10)
        
        # Step 4: Normalize features
        logger.info("\n[Step 4/5] Normalizing features...")
        normalized_data, scaler = self.normalize_features(clean_data)
        
        # Step 5: Final validation
        logger.info("\n[Step 5/5] Final validation...")
        logger.info(f"✅ Prepared data shape: {normalized_data.shape}")
        logger.info(f"✅ Date range: {normalized_data.index.min()} to {normalized_data.index.max()}")
        logger.info(f"✅ Duration: {(normalized_data.index.max() - normalized_data.index.min()).total_seconds() / 3600:.1f} hours")
        logger.info(f"✅ Features: {list(normalized_data.columns)}")
        logger.info(f"✅ No missing values: {not normalized_data.isnull().any().any()}")
        
        self.prepared_data = clean_data
        self.normalized_data = normalized_data
        
        logger.info("\n" + "=" * 80)
        logger.info("PHASE 1 COMPLETE: Data ready for matrix profile computation")
        logger.info("=" * 80 + "\n")
        
        return clean_data, normalized_data, scaler
    
    def get_data_summary(self) -> Dict:
        """
        Get summary statistics of prepared data
        
        Returns:
            Dictionary with summary statistics
        """
        if self.prepared_data is None:
            return {"error": "No data prepared yet"}
        
        summary = {
            "shape": self.prepared_data.shape,
            "date_range": {
                "start": str(self.prepared_data.index.min()),
                "end": str(self.prepared_data.index.max()),
                "duration_hours": (self.prepared_data.index.max() - self.prepared_data.index.min()).total_seconds() / 3600
            },
            "features": list(self.prepared_data.columns),
            "statistics": self.prepared_data.describe().to_dict(),
            "missing_values": self.prepared_data.isnull().sum().to_dict()
        }
        
        return summary
