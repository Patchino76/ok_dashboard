"""
Steady-State Extractor - Phase 2

Extracts representative steady-state samples from identified stable periods.
Each extracted sample represents one independent steady-state operating point.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

from .steady_state_config import SteadyStateConfig, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


class SteadyStateExtractor:
    """
    Extracts steady-state samples from time-series data.
    
    Implements Phase 2 of the steady-state strategy:
    - Aggregate MVs using time-weighted average
    - Aggregate CVs using mean + std (stability indicator)
    - Aggregate targets using median (robust to outliers)
    - Create independent samples (one row per steady-state window)
    """
    
    def __init__(self, config: Optional[SteadyStateConfig] = None):
        """
        Initialize extractor with configuration.
        
        Args:
            config: Steady-state configuration (uses DEFAULT_CONFIG if None)
        """
        self.config = config or DEFAULT_CONFIG
        logger.info(f"Initialized SteadyStateExtractor with {self.config}")
    
    def aggregate_mv_values(
        self,
        df: pd.DataFrame,
        mv_columns: List[str],
        window_start: pd.Timestamp,
        window_end: pd.Timestamp
    ) -> Dict[str, float]:
        """
        Aggregate MV (Manipulated Variable) values using time-weighted average.
        
        MVs are setpoints/inputs - averaging smooths measurement noise while
        preserving the operating point.
        
        Args:
            df: Input DataFrame
            mv_columns: List of MV column names
            window_start: Window start timestamp
            window_end: Window end timestamp
            
        Returns:
            Dictionary of {mv_name: aggregated_value}
        """
        window_data = df.loc[window_start:window_end]
        
        mv_values = {}
        for col in mv_columns:
            if col in window_data.columns:
                # Time-weighted average (simple mean for uniform sampling)
                mv_values[col] = window_data[col].mean()
        
        return mv_values
    
    def aggregate_cv_values(
        self,
        df: pd.DataFrame,
        cv_columns: List[str],
        window_start: pd.Timestamp,
        window_end: pd.Timestamp
    ) -> Dict[str, float]:
        """
        Aggregate CV (Controlled Variable) values using mean.
        
        Also calculates std as a stability indicator (stored separately).
        
        Args:
            df: Input DataFrame
            cv_columns: List of CV column names
            window_start: Window start timestamp
            window_end: Window end timestamp
            
        Returns:
            Dictionary of {cv_name: mean_value}
        """
        window_data = df.loc[window_start:window_end]
        
        cv_values = {}
        for col in cv_columns:
            if col in window_data.columns:
                # Mean value represents the steady-state operating point
                cv_values[col] = window_data[col].mean()
                # Store std separately for quality assessment
                cv_values[f"{col}_std"] = window_data[col].std()
        
        return cv_values
    
    def aggregate_dv_values(
        self,
        df: pd.DataFrame,
        dv_columns: List[str],
        window_start: pd.Timestamp,
        window_end: pd.Timestamp
    ) -> Dict[str, float]:
        """
        Aggregate DV (Disturbance Variable) values using mean.
        
        DVs are external factors (ore characteristics) that change slowly.
        
        Args:
            df: Input DataFrame
            dv_columns: List of DV column names
            window_start: Window start timestamp
            window_end: Window end timestamp
            
        Returns:
            Dictionary of {dv_name: mean_value}
        """
        window_data = df.loc[window_start:window_end]
        
        dv_values = {}
        for col in dv_columns:
            if col in window_data.columns:
                # Mean value for disturbance variables
                dv_values[col] = window_data[col].mean()
        
        return dv_values
    
    def aggregate_target_values(
        self,
        df: pd.DataFrame,
        target_columns: List[str],
        window_start: pd.Timestamp,
        window_end: pd.Timestamp
    ) -> Dict[str, float]:
        """
        Aggregate target values using median (robust to outliers).
        
        Quality measurements may have occasional outliers; median is more
        robust than mean.
        
        Args:
            df: Input DataFrame
            target_columns: List of target column names
            window_start: Window start timestamp
            window_end: Window end timestamp
            
        Returns:
            Dictionary of {target_name: median_value}
        """
        window_data = df.loc[window_start:window_end]
        
        target_values = {}
        for col in target_columns:
            if col in window_data.columns:
                # Median is robust to measurement outliers
                target_values[col] = window_data[col].median()
        
        return target_values
    
    def calculate_stability_score(
        self,
        df: pd.DataFrame,
        window_start: pd.Timestamp,
        window_end: pd.Timestamp,
        variables: List[str]
    ) -> float:
        """
        Calculate a stability score for the window (0-1).
        
        Higher score = more stable operation.
        Based on coefficient of variation (CV = std/mean) across all variables.
        
        Args:
            df: Input DataFrame
            window_start: Window start timestamp
            window_end: Window end timestamp
            variables: Variables to include in score
            
        Returns:
            Stability score (0-1, higher is better)
        """
        window_data = df.loc[window_start:window_end]
        
        cv_scores = []
        for var in variables:
            if var in window_data.columns:
                mean_val = window_data[var].mean()
                std_val = window_data[var].std()
                
                if mean_val != 0:
                    # Coefficient of variation (lower is more stable)
                    cv = std_val / abs(mean_val)
                    # Convert to stability score (invert and normalize)
                    stability = 1.0 / (1.0 + cv)
                    cv_scores.append(stability)
        
        if cv_scores:
            # Average stability across all variables
            return np.mean(cv_scores)
        else:
            return 0.0
    
    def identify_steady_state_windows(
        self,
        df: pd.DataFrame,
        stability_mask: pd.Series
    ) -> List[Tuple[pd.Timestamp, pd.Timestamp]]:
        """
        Identify continuous steady-state windows from stability mask.
        
        Groups consecutive stable periods into windows.
        
        Args:
            df: Input DataFrame
            stability_mask: Boolean mask indicating stable periods
            
        Returns:
            List of (window_start, window_end) tuples
        """
        logger.info("\nIdentifying steady-state windows...")
        
        # Find transitions (stable -> unstable and unstable -> stable)
        stable_periods = stability_mask.astype(int)
        transitions = stable_periods.diff()
        
        # Start of stable periods (0 -> 1 transition)
        starts = df.index[transitions == 1].tolist()
        
        # End of stable periods (1 -> 0 transition)
        ends = df.index[transitions == -1].tolist()
        
        # Handle edge cases
        if stable_periods.iloc[0] == 1:
            starts.insert(0, df.index[0])
        if stable_periods.iloc[-1] == 1:
            ends.append(df.index[-1])
        
        # Create windows
        windows = list(zip(starts, ends))
        
        # Filter windows by minimum duration
        min_duration = pd.Timedelta(minutes=self.config.window_minutes)
        valid_windows = [
            (start, end) for start, end in windows
            if (end - start) >= min_duration
        ]
        
        logger.info(f"Found {len(windows)} stable periods")
        logger.info(f"After duration filter (>={self.config.window_minutes} min): {len(valid_windows)} windows")
        
        if valid_windows:
            durations = [(end - start).total_seconds() / 60 for start, end in valid_windows]
            logger.info(f"Window durations: min={min(durations):.1f} min, "
                       f"max={max(durations):.1f} min, "
                       f"mean={np.mean(durations):.1f} min")
        
        return valid_windows
    
    def extract_steady_state_samples(
        self,
        df: pd.DataFrame,
        stability_mask: pd.Series,
        variable_classification: Optional[Dict[str, List[str]]] = None
    ) -> pd.DataFrame:
        """
        Extract steady-state samples from identified stable periods.
        
        Each row in the output represents ONE steady-state operating point.
        
        Args:
            df: Input DataFrame with time-series data
            stability_mask: Boolean mask indicating stable periods
            variable_classification: Dict with 'mvs', 'cvs', 'dvs', 'targets' lists
            
        Returns:
            DataFrame where each row is one steady-state sample
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"PHASE 2: STEADY-STATE EXTRACTION")
        logger.info(f"{'='*60}")
        
        # Get variable classification
        if variable_classification is None:
            variable_classification = self.config.get_required_variables()
        
        mv_cols = [col for col in variable_classification.get('mvs', []) if col in df.columns]
        cv_cols = [col for col in variable_classification.get('cvs', []) if col in df.columns]
        dv_cols = [col for col in variable_classification.get('dvs', []) if col in df.columns]
        target_cols = [col for col in variable_classification.get('targets', []) if col in df.columns]
        
        logger.info(f"Variable classification:")
        logger.info(f"  MVs: {mv_cols}")
        logger.info(f"  CVs: {cv_cols}")
        logger.info(f"  DVs: {dv_cols}")
        logger.info(f"  Targets: {target_cols}")
        
        # Identify steady-state windows
        windows = self.identify_steady_state_windows(df, stability_mask)
        
        if not windows:
            logger.warning("No steady-state windows found!")
            return pd.DataFrame()
        
        # Extract samples from each window
        samples = []
        
        for i, (window_start, window_end) in enumerate(windows):
            window_duration = (window_end - window_start).total_seconds() / 60
            
            # Aggregate values by variable type
            sample = {}
            
            # MVs: Time-weighted average
            sample.update(self.aggregate_mv_values(df, mv_cols, window_start, window_end))
            
            # CVs: Mean (+ std for quality assessment)
            sample.update(self.aggregate_cv_values(df, cv_cols, window_start, window_end))
            
            # DVs: Mean
            sample.update(self.aggregate_dv_values(df, dv_cols, window_start, window_end))
            
            # Targets: Median (robust to outliers)
            sample.update(self.aggregate_target_values(df, target_cols, window_start, window_end))
            
            # Add metadata
            all_vars = mv_cols + cv_cols + dv_cols + target_cols
            sample['stability_score'] = self.calculate_stability_score(
                df, window_start, window_end, all_vars
            )
            sample['window_duration_min'] = window_duration
            sample['window_start'] = window_start
            sample['window_end'] = window_end
            sample['regime'] = 1  # Could be enhanced with regime classification
            
            samples.append(sample)
            
            if (i + 1) % 100 == 0:
                logger.info(f"Processed {i + 1}/{len(windows)} windows...")
        
        # Create DataFrame
        steady_state_df = pd.DataFrame(samples)
        
        # Remove std columns from main features (keep for diagnostics)
        std_cols = [col for col in steady_state_df.columns if col.endswith('_std')]
        
        logger.info(f"\n{'='*60}")
        logger.info(f"EXTRACTION COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"Input time-series rows:  {len(df):,}")
        logger.info(f"Steady-state windows:    {len(windows):,}")
        logger.info(f"Extracted samples:       {len(steady_state_df):,}")
        logger.info(f"Data reduction:          {len(df)} → {len(steady_state_df)} "
                   f"({(len(steady_state_df)/len(df)*100):.2f}%)")
        logger.info(f"Features per sample:     {len(steady_state_df.columns)}")
        logger.info(f"  - MVs:                 {len(mv_cols)}")
        logger.info(f"  - CVs:                 {len(cv_cols)} (+{len([c for c in std_cols if 'HC' in c or 'Pulp' in c])} std)")
        logger.info(f"  - DVs:                 {len(dv_cols)}")
        logger.info(f"  - Targets:             {len(target_cols)}")
        logger.info(f"  - Metadata:            4 (stability_score, duration, regime, timestamps)")
        logger.info(f"{'='*60}\n")
        
        return steady_state_df
    
    def extract(
        self,
        df: pd.DataFrame,
        stability_mask: pd.Series,
        variable_classification: Optional[Dict[str, List[str]]] = None
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Complete extraction pipeline with diagnostics.
        
        Args:
            df: Input DataFrame
            stability_mask: Boolean mask from detector
            variable_classification: Variable type classification
            
        Returns:
            Tuple of (steady_state_df, diagnostics_dict)
        """
        # Extract samples
        steady_state_df = self.extract_steady_state_samples(
            df, stability_mask, variable_classification
        )
        
        # Compile diagnostics
        diagnostics = {
            'input_rows': len(df),
            'output_samples': len(steady_state_df),
            'data_reduction_pct': (len(steady_state_df) / len(df) * 100) if len(df) > 0 else 0,
            'mean_stability_score': steady_state_df['stability_score'].mean() if len(steady_state_df) > 0 else 0,
            'mean_window_duration_min': steady_state_df['window_duration_min'].mean() if len(steady_state_df) > 0 else 0,
            'config': self.config
        }
        
        return steady_state_df, diagnostics
