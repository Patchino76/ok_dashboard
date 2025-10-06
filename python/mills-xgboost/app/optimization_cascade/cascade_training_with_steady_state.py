"""
Cascade Model Training with Steady-State Data

Integrates steady-state extraction with cascade model training
to improve model quality using clean, stable operating regime data.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
from datetime import datetime, timedelta
import os

from database.db_connector import MillsDataConnector
from optimization_cascade.steady_state_extraction import (
    DataPreparation,
    MatrixProfileComputer,
    MotifDiscovery,
    MotifAnalyzer,
    SteadyStateExtractor
)
from optimization_cascade.cascade_models import CascadeModelManager

logger = logging.getLogger(__name__)


class CascadeTrainingWithSteadyState:
    """
    Trains cascade models using steady-state extracted data
    """
    
    def __init__(self, 
                 db_connector: MillsDataConnector,
                 model_save_path: str = "cascade_models"):
        """
        Initialize training system
        
        Args:
            db_connector: Database connector instance
            model_save_path: Path to save trained models
        """
        self.db_connector = db_connector
        self.model_save_path = model_save_path
        
        # Initialize components
        self.data_prep = DataPreparation(db_connector)
        self.mp_computer = MatrixProfileComputer()
        self.motif_discovery = MotifDiscovery()
        self.motif_analyzer = MotifAnalyzer()
        self.ss_extractor = SteadyStateExtractor()
        
        # Storage
        self.steady_state_data = None
        self.training_metadata = {}
        
    def extract_steady_state_data(self,
                                  mill_number: int,
                                  start_date: str,
                                  end_date: str,
                                  mv_features: List[str],
                                  cv_features: List[str],
                                  dv_features: Optional[List[str]] = None,
                                  residence_time_minutes: int = 60,
                                  n_motifs: int = 10,
                                  quality_threshold: float = 0.5,
                                  min_occurrences: int = 3) -> pd.DataFrame:
        """
        Extract steady-state data using complete pipeline
        
        Args:
            mill_number: Mill number
            start_date: Start date string
            end_date: End date string
            mv_features: List of MV features
            cv_features: List of CV features
            dv_features: List of DV features (optional)
            residence_time_minutes: Process residence time
            n_motifs: Number of motifs to discover
            quality_threshold: Minimum quality score
            min_occurrences: Minimum pattern occurrences
            
        Returns:
            DataFrame with steady-state data
        """
        logger.info("=" * 100)
        logger.info("EXTRACTING STEADY-STATE DATA FOR CASCADE TRAINING")
        logger.info("=" * 100)
        
        # Phase 1: Data Preparation
        logger.info("\n[Phase 1/5] Preparing data...")
        clean_data, normalized_data, scaler = self.data_prep.prepare_for_stumpy(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            mv_features=mv_features,
            cv_features=cv_features,
            dv_features=dv_features,
            resample_freq='1min'
        )
        
        # Phase 2: Matrix Profile
        logger.info("\n[Phase 2/5] Computing matrix profile...")
        mp_results = self.mp_computer.compute_mp_with_auto_window(
            data=normalized_data,
            residence_time_minutes=residence_time_minutes,
            sampling_freq_minutes=1
        )
        
        # Phase 3: Motif Discovery
        logger.info("\n[Phase 3/5] Discovering motifs...")
        motifs = self.motif_discovery.discover_motifs(
            data=normalized_data,
            matrix_profile=mp_results['matrix_profile'],
            matrix_profile_index=mp_results['matrix_profile_index'],
            window_size=mp_results['window_size'],
            k=n_motifs,
            distance_threshold=2.0
        )
        
        # Phase 4: Motif Analysis
        logger.info("\n[Phase 4/5] Analyzing motifs...")
        analysis_results = self.motif_analyzer.analyze_all_motifs(
            motifs=motifs,
            data=normalized_data,
            mv_features=mv_features,
            cv_features=cv_features,
            dv_features=dv_features
        )
        
        # Phase 5: Steady-State Extraction
        logger.info("\n[Phase 5/5] Extracting steady-state data...")
        steady_state_df = self.ss_extractor.extract_all_motifs(
            motifs=motifs,
            data=normalized_data,
            original_data=clean_data,
            regime_labels=self.motif_analyzer.regime_labels,
            quality_threshold=quality_threshold,
            min_occurrences=min_occurrences
        )
        
        # Store metadata
        self.training_metadata = {
            'mill_number': mill_number,
            'start_date': start_date,
            'end_date': end_date,
            'mv_features': mv_features,
            'cv_features': cv_features,
            'dv_features': dv_features,
            'residence_time_minutes': residence_time_minutes,
            'n_motifs': n_motifs,
            'quality_threshold': quality_threshold,
            'min_occurrences': min_occurrences,
            'total_records': len(steady_state_df),
            'extraction_date': datetime.now().isoformat()
        }
        
        self.steady_state_data = steady_state_df
        
        logger.info("\n✅ Steady-state extraction complete!")
        logger.info(f"   Extracted {len(steady_state_df)} high-quality records")
        
        return steady_state_df
    
    def train_cascade_models(self,
                            mill_number: int,
                            target_variable: str,
                            mv_features: List[str],
                            cv_features: List[str],
                            dv_features: Optional[List[str]] = None,
                            regime_filter: Optional[List[str]] = None,
                            test_size: float = 0.2,
                            model_suffix: str = "steady_state") -> Dict:
        """
        Train cascade models using steady-state data
        
        Args:
            mill_number: Mill number
            target_variable: Target variable name
            mv_features: List of MV features
            cv_features: List of CV features
            dv_features: List of DV features (optional)
            regime_filter: Filter to specific regimes (optional)
            test_size: Test set size
            model_suffix: Suffix for model naming
            
        Returns:
            Dictionary with training results
        """
        if self.steady_state_data is None:
            raise ValueError("No steady-state data available. Run extract_steady_state_data() first.")
        
        logger.info("=" * 100)
        logger.info("TRAINING CASCADE MODELS WITH STEADY-STATE DATA")
        logger.info("=" * 100)
        
        # Get training data
        logger.info("\n[Step 1/3] Preparing training data...")
        
        # Prepare features and target
        all_features = mv_features + cv_features
        if dv_features:
            all_features += dv_features
        all_features.append(target_variable)
        
        # Filter by regime if specified
        df = self.steady_state_data.copy()
        if regime_filter:
            df = df[df['regime_label'].isin(regime_filter)]
            logger.info(f"  Filtered to {len(df)} records from regimes: {regime_filter}")
        
        # Check if all features exist
        missing_features = [f for f in all_features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Missing features in steady-state data: {missing_features}")
        
        training_data = df[all_features].copy()
        
        logger.info(f"  Training data shape: {training_data.shape}")
        logger.info(f"  Features: {all_features}")
        
        # Initialize cascade model manager
        logger.info("\n[Step 2/3] Initializing cascade model manager...")
        
        cascade_manager = CascadeModelManager(
            model_save_path=self.model_save_path,
            mill_number=mill_number
        )
        
        # Configure features
        cascade_manager.configure_features(
            mv_features=mv_features,
            cv_features=cv_features,
            dv_features=dv_features,
            target_variable=target_variable
        )
        
        # Train models
        logger.info("\n[Step 3/3] Training cascade models...")
        
        training_results = cascade_manager.train_all_models(
            data=training_data,
            test_size=test_size
        )
        
        # Save models with steady-state suffix
        model_name = f"cascade_mill_{mill_number}_{model_suffix}"
        save_path = os.path.join(self.model_save_path, model_name)
        cascade_manager.save_models(save_path)
        
        logger.info(f"\n✅ Models saved to: {save_path}")
        
        # Combine results with metadata
        results = {
            'training_results': training_results,
            'steady_state_metadata': self.training_metadata,
            'model_save_path': save_path,
            'training_date': datetime.now().isoformat()
        }
        
        logger.info("\n" + "=" * 100)
        logger.info("CASCADE TRAINING COMPLETE")
        logger.info("=" * 100)
        
        return results
    
    def train_with_comparison(self,
                             mill_number: int,
                             start_date: str,
                             end_date: str,
                             target_variable: str,
                             mv_features: List[str],
                             cv_features: List[str],
                             dv_features: Optional[List[str]] = None,
                             **kwargs) -> Dict:
        """
        Train models with and without steady-state extraction for comparison
        
        Args:
            mill_number: Mill number
            start_date: Start date
            end_date: End date
            target_variable: Target variable
            mv_features: MV features
            cv_features: CV features
            dv_features: DV features (optional)
            **kwargs: Additional parameters
            
        Returns:
            Dictionary with comparison results
        """
        logger.info("=" * 100)
        logger.info("TRAINING COMPARISON: WITH vs WITHOUT STEADY-STATE EXTRACTION")
        logger.info("=" * 100)
        
        # Train with steady-state extraction
        logger.info("\n[Training 1/2] WITH steady-state extraction...")
        
        steady_state_df = self.extract_steady_state_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            mv_features=mv_features,
            cv_features=cv_features,
            dv_features=dv_features,
            **kwargs
        )
        
        results_with_ss = self.train_cascade_models(
            mill_number=mill_number,
            target_variable=target_variable,
            mv_features=mv_features,
            cv_features=cv_features,
            dv_features=dv_features,
            model_suffix="with_steady_state"
        )
        
        # Train without steady-state extraction (all data)
        logger.info("\n[Training 2/2] WITHOUT steady-state extraction (baseline)...")
        
        # Get all data
        all_data = self.db_connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq='1min',
            save_to_logs=False
        )
        
        cascade_manager_baseline = CascadeModelManager(
            model_save_path=self.model_save_path,
            mill_number=mill_number
        )
        
        cascade_manager_baseline.configure_features(
            mv_features=mv_features,
            cv_features=cv_features,
            dv_features=dv_features,
            target_variable=target_variable
        )
        
        results_without_ss = cascade_manager_baseline.train_all_models(
            data=all_data,
            test_size=0.2
        )
        
        model_name_baseline = f"cascade_mill_{mill_number}_baseline"
        save_path_baseline = os.path.join(self.model_save_path, model_name_baseline)
        cascade_manager_baseline.save_models(save_path_baseline)
        
        # Compare results
        logger.info("\n" + "=" * 100)
        logger.info("COMPARISON RESULTS")
        logger.info("=" * 100)
        
        comparison = {
            'with_steady_state': results_with_ss,
            'without_steady_state': {
                'training_results': results_without_ss,
                'model_save_path': save_path_baseline,
                'training_records': len(all_data)
            },
            'improvement': self._calculate_improvement(
                results_with_ss['training_results'],
                results_without_ss
            )
        }
        
        logger.info("\n📊 Performance Comparison:")
        for metric, improvement in comparison['improvement'].items():
            logger.info(f"  {metric}: {improvement:+.2%} improvement")
        
        return comparison
    
    def _calculate_improvement(self, results_ss: Dict, results_baseline: Dict) -> Dict:
        """Calculate performance improvement metrics"""
        
        improvement = {}
        
        # Compare quality model R² scores
        if 'quality_model' in results_ss and 'quality_model' in results_baseline:
            r2_ss = results_ss['quality_model'].get('r2_score', 0)
            r2_baseline = results_baseline['quality_model'].get('r2_score', 0)
            
            if r2_baseline > 0:
                improvement['quality_model_r2'] = (r2_ss - r2_baseline) / abs(r2_baseline)
        
        # Compare process models average R²
        if 'process_models' in results_ss and 'process_models' in results_baseline:
            avg_r2_ss = np.mean([m.get('r2_score', 0) for m in results_ss['process_models'].values()])
            avg_r2_baseline = np.mean([m.get('r2_score', 0) for m in results_baseline['process_models'].values()])
            
            if avg_r2_baseline > 0:
                improvement['process_models_avg_r2'] = (avg_r2_ss - avg_r2_baseline) / abs(avg_r2_baseline)
        
        return improvement
