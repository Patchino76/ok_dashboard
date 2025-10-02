"""
Steady-State Processor - Main Orchestrator

High-level API for transforming raw time-series data into curated steady-state samples.
Combines detection (Phase 1) and extraction (Phase 2) into a single pipeline.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
import os
from datetime import datetime

from .steady_state_config import SteadyStateConfig, DEFAULT_CONFIG
from .steady_state_detector import SteadyStateDetector
from .steady_state_extractor import SteadyStateExtractor

logger = logging.getLogger(__name__)


class SteadyStateProcessor:
    """
    Main processor for steady-state data transformation.
    
    Orchestrates the complete pipeline:
    1. Detection: Identify steady-state periods
    2. Extraction: Aggregate into independent samples
    3. Diagnostics: Quality metrics and reporting
    """
    
    def __init__(self, config: Optional[SteadyStateConfig] = None):
        """
        Initialize processor with configuration.
        
        Args:
            config: Steady-state configuration (uses DEFAULT_CONFIG if None)
        """
        self.config = config or DEFAULT_CONFIG
        self.detector = SteadyStateDetector(config=self.config)
        self.extractor = SteadyStateExtractor(config=self.config)
        
        logger.info(f"Initialized SteadyStateProcessor with {self.config}")
    
    def process(
        self,
        df: pd.DataFrame,
        variable_classification: Optional[Dict[str, List[str]]] = None,
        variables_to_check: Optional[List[str]] = None,
        save_diagnostics: bool = False,
        diagnostics_path: Optional[str] = None
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Transform raw time-series data into steady-state samples.
        
        Complete pipeline:
        1. Validate input data
        2. Detect steady-state periods (Phase 1)
        3. Extract steady-state samples (Phase 2)
        4. Generate diagnostics
        
        Args:
            df: Input DataFrame with time-series data (must have DatetimeIndex)
            variable_classification: Dict with 'mvs', 'cvs', 'dvs', 'targets' lists
            variables_to_check: Specific variables to check for stability (None = all)
            save_diagnostics: Whether to save diagnostic report
            diagnostics_path: Path to save diagnostics (None = auto-generate)
            
        Returns:
            Tuple of (steady_state_df, full_diagnostics_dict)
        """
        logger.info("\n" + "="*80)
        logger.info("STEADY-STATE PROCESSING PIPELINE")
        logger.info("="*80)
        
        # Validate input
        if not isinstance(df.index, pd.DatetimeIndex):
            raise ValueError("DataFrame must have DatetimeIndex")
        
        if df.empty:
            raise ValueError("Input DataFrame is empty")
        
        logger.info(f"Input data: {len(df):,} rows, {len(df.columns)} columns")
        logger.info(f"Date range: {df.index.min()} to {df.index.max()}")
        logger.info(f"Duration: {(df.index.max() - df.index.min()).days} days")
        
        # Phase 1: Detection
        stability_mask, detection_diagnostics = self.detector.detect(
            df, variables_to_check
        )
        
        # Phase 2: Extraction
        steady_state_df, extraction_diagnostics = self.extractor.extract(
            df, stability_mask, variable_classification
        )
        
        # Compile full diagnostics
        full_diagnostics = {
            'pipeline': {
                'input_rows': len(df),
                'input_columns': len(df.columns),
                'output_samples': len(steady_state_df),
                'output_columns': len(steady_state_df.columns) if not steady_state_df.empty else 0,
                'data_reduction_ratio': len(steady_state_df) / len(df) if len(df) > 0 else 0,
                'processing_timestamp': datetime.now().isoformat()
            },
            'detection': detection_diagnostics,
            'extraction': extraction_diagnostics,
            'config': {
                'window_minutes': self.config.window_minutes,
                'buffer_minutes': self.config.buffer_minutes,
                'total_window_minutes': self.config.total_window_minutes,
                'min_samples_per_window': self.config.min_samples_per_window,
                'enable_quality_filters': self.config.enable_quality_filters
            }
        }
        
        # Log summary
        self._log_summary(full_diagnostics)
        
        # Save diagnostics if requested
        if save_diagnostics:
            self._save_diagnostics(full_diagnostics, steady_state_df, diagnostics_path)
        
        return steady_state_df, full_diagnostics
    
    def _log_summary(self, diagnostics: Dict):
        """Log processing summary"""
        logger.info("\n" + "="*80)
        logger.info("PROCESSING SUMMARY")
        logger.info("="*80)
        
        pipeline = diagnostics['pipeline']
        detection = diagnostics['detection']
        extraction = diagnostics['extraction']
        
        logger.info(f"Input:  {pipeline['input_rows']:,} time-series rows")
        logger.info(f"Output: {pipeline['output_samples']:,} steady-state samples")
        logger.info(f"Reduction: {pipeline['data_reduction_ratio']:.4f} "
                   f"({pipeline['data_reduction_ratio']*100:.2f}%)")
        
        logger.info(f"\nDetection Results:")
        logger.info(f"  Stable periods found: {detection['final_stable_periods']:,} "
                   f"({detection['stable_percentage']:.1f}%)")
        logger.info(f"  Variables checked: {len(detection['variables_checked'])}")
        
        logger.info(f"\nExtraction Results:")
        logger.info(f"  Mean stability score: {extraction['mean_stability_score']:.3f}")
        logger.info(f"  Mean window duration: {extraction['mean_window_duration_min']:.1f} min")
        
        logger.info(f"\nExpected Model Performance Improvement:")
        if pipeline['output_samples'] >= 500:
            logger.info(f"  ✅ Excellent: {pipeline['output_samples']:,} samples (>500)")
            logger.info(f"     High-quality data should significantly improve model generalization")
        elif pipeline['output_samples'] >= 200:
            logger.info(f"  ✅ Good: {pipeline['output_samples']:,} samples (200-500)")
            logger.info(f"     Sufficient for XGBoost training with good performance")
        elif pipeline['output_samples'] >= 100:
            logger.info(f"  ⚠️  Marginal: {pipeline['output_samples']:,} samples (100-200)")
            logger.info(f"     May work but consider relaxing stability criteria")
        else:
            logger.info(f"  ❌ Insufficient: {pipeline['output_samples']:,} samples (<100)")
            logger.info(f"     Consider: longer date range or relaxed criteria")
        
        logger.info("="*80 + "\n")
    
    def _save_diagnostics(
        self,
        diagnostics: Dict,
        steady_state_df: pd.DataFrame,
        diagnostics_path: Optional[str] = None
    ):
        """Save diagnostic report and data"""
        try:
            # Determine save path
            if diagnostics_path is None:
                # Auto-generate path in logs directory
                logs_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                    'logs'
                )
                os.makedirs(logs_dir, exist_ok=True)
                
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                diagnostics_path = os.path.join(logs_dir, f"steady_state_diagnostics_{timestamp}")
            
            os.makedirs(diagnostics_path, exist_ok=True)
            
            # Save diagnostics JSON
            import json
            diagnostics_file = os.path.join(diagnostics_path, "diagnostics.json")
            
            # Convert config objects to dict for JSON serialization
            diagnostics_copy = diagnostics.copy()
            if 'config' in diagnostics_copy['detection']:
                diagnostics_copy['detection']['config'] = str(diagnostics_copy['detection']['config'])
            if 'config' in diagnostics_copy['extraction']:
                diagnostics_copy['extraction']['config'] = str(diagnostics_copy['extraction']['config'])
            
            with open(diagnostics_file, 'w') as f:
                json.dump(diagnostics_copy, f, indent=2)
            
            logger.info(f"Saved diagnostics to: {diagnostics_file}")
            
            # Save steady-state data
            if not steady_state_df.empty:
                data_file = os.path.join(diagnostics_path, "steady_state_samples.csv")
                steady_state_df.to_csv(data_file, index=False)
                logger.info(f"Saved steady-state samples to: {data_file}")
            
        except Exception as e:
            logger.error(f"Error saving diagnostics: {e}")


def process_to_steady_state(
    df: pd.DataFrame,
    config: Optional[SteadyStateConfig] = None,
    variable_classification: Optional[Dict[str, List[str]]] = None,
    variables_to_check: Optional[List[str]] = None,
    save_diagnostics: bool = False,
    diagnostics_path: Optional[str] = None
) -> pd.DataFrame:
    """
    Convenience function for steady-state processing.
    
    Transforms raw time-series data into curated steady-state samples.
    
    Args:
        df: Input DataFrame with time-series data (must have DatetimeIndex)
        config: Steady-state configuration (uses DEFAULT_CONFIG if None)
        variable_classification: Dict with 'mvs', 'cvs', 'dvs', 'targets' lists
        variables_to_check: Specific variables to check (None = all configured)
        save_diagnostics: Whether to save diagnostic report
        diagnostics_path: Path to save diagnostics (None = auto-generate)
        
    Returns:
        DataFrame where each row is one steady-state operating point
        
    Example:
        >>> raw_df = db_connector.get_combined_data(mill_number=8, ...)
        >>> steady_state_df = process_to_steady_state(raw_df)
        >>> # Now train model with high-quality data
        >>> model.train(steady_state_df)
    """
    processor = SteadyStateProcessor(config=config)
    
    steady_state_df, diagnostics = processor.process(
        df=df,
        variable_classification=variable_classification,
        variables_to_check=variables_to_check,
        save_diagnostics=save_diagnostics,
        diagnostics_path=diagnostics_path
    )
    
    return steady_state_df


def process_to_steady_state_with_diagnostics(
    df: pd.DataFrame,
    config: Optional[SteadyStateConfig] = None,
    variable_classification: Optional[Dict[str, List[str]]] = None,
    variables_to_check: Optional[List[str]] = None,
    save_diagnostics: bool = False,
    diagnostics_path: Optional[str] = None
) -> Tuple[pd.DataFrame, Dict]:
    """
    Same as process_to_steady_state but also returns diagnostics.
    
    Returns:
        Tuple of (steady_state_df, diagnostics_dict)
    """
    processor = SteadyStateProcessor(config=config)
    
    return processor.process(
        df=df,
        variable_classification=variable_classification,
        variables_to_check=variables_to_check,
        save_diagnostics=save_diagnostics,
        diagnostics_path=diagnostics_path
    )
