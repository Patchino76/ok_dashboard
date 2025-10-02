"""
Steady-State Detector - Phase 1

Identifies periods where the process is in steady-state operation.
Uses multi-dimensional stability criteria across all variables.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging

from .steady_state_config import SteadyStateConfig, VariableStabilityCriteria, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


class SteadyStateDetector:
    """
    Detects steady-state periods in time-series process data.
    
    Implements Phase 1 of the steady-state identification strategy:
    - Multi-dimensional stability check
    - Temporal continuity validation
    - Quality filtering
    """
    
    def __init__(self, config: Optional[SteadyStateConfig] = None):
        """
        Initialize detector with configuration.
        
        Args:
            config: Steady-state configuration (uses DEFAULT_CONFIG if None)
        """
        self.config = config or DEFAULT_CONFIG
        logger.info(f"Initialized SteadyStateDetector with {self.config}")
    
    def check_variable_stability(
        self,
        series: pd.Series,
        criteria: VariableStabilityCriteria,
        window: str
    ) -> pd.Series:
        """
        Check if a single variable meets stability criteria.
        
        Args:
            series: Time-series data for the variable
            criteria: Stability criteria to apply
            window: Rolling window size (e.g., '60min')
            
        Returns:
            Boolean Series indicating stable periods
        """
        stable_mask = pd.Series(True, index=series.index)
        
        # Calculate rolling statistics
        rolling = series.rolling(window=window, min_periods=self.config.min_samples_per_window)
        rolling_mean = rolling.mean()
        rolling_std = rolling.std()
        
        # Check 1: Rolling standard deviation threshold
        if criteria.rolling_std_threshold_pct is not None:
            # Percentage-based threshold
            threshold = rolling_mean * (criteria.rolling_std_threshold_pct / 100.0)
            std_stable = rolling_std <= threshold
            stable_mask &= std_stable
            logger.debug(f"{criteria.name}: {std_stable.sum()}/{len(std_stable)} periods pass std% check")
        
        elif criteria.rolling_std_threshold_abs is not None:
            # Absolute threshold
            std_stable = rolling_std <= criteria.rolling_std_threshold_abs
            stable_mask &= std_stable
            logger.debug(f"{criteria.name}: {std_stable.sum()}/{len(std_stable)} periods pass std_abs check")
        
        # Check 2: Maximum step change
        if criteria.max_step_change_pct is not None:
            rolling_min = rolling.min()
            rolling_max = rolling.max()
            rolling_range = rolling_max - rolling_min
            max_change_pct = (rolling_range / rolling_mean) * 100.0
            
            step_stable = max_change_pct <= criteria.max_step_change_pct
            stable_mask &= step_stable
            logger.debug(f"{criteria.name}: {step_stable.sum()}/{len(step_stable)} periods pass step change check")
        
        # Check 3: Rate of change
        if criteria.max_rate_of_change is not None:
            # Calculate rate of change (difference per minute)
            rate_of_change = series.diff().abs()
            rolling_max_rate = rate_of_change.rolling(window=window).max()
            
            rate_stable = rolling_max_rate <= criteria.max_rate_of_change
            stable_mask &= rate_stable
            logger.debug(f"{criteria.name}: {rate_stable.sum()}/{len(rate_stable)} periods pass rate check")
        
        return stable_mask
    
    def detect_steady_state_periods(
        self,
        df: pd.DataFrame,
        variables_to_check: Optional[List[str]] = None
    ) -> pd.Series:
        """
        Detect steady-state periods using multi-dimensional stability check.
        
        All specified variables must be simultaneously stable for a period
        to be considered steady-state.
        
        Args:
            df: Input DataFrame with time-series data
            variables_to_check: List of variables to check (None = check all configured)
            
        Returns:
            Boolean Series indicating steady-state timestamps
        """
        logger.info("=" * 60)
        logger.info("PHASE 1: STEADY-STATE DETECTION")
        logger.info("=" * 60)
        
        # Determine which variables to check
        if variables_to_check is None:
            variables_to_check = [col for col in df.columns 
                                 if col in self.config.all_criteria]
        
        logger.info(f"Checking {len(variables_to_check)} variables for stability")
        logger.info(f"Window: {self.config.window_minutes} min, Buffer: {self.config.buffer_minutes} min")
        
        # Initialize overall stability mask (all True)
        overall_stable = pd.Series(True, index=df.index)
        
        window_str = f"{self.config.window_minutes}min"
        
        # Check each variable
        stability_results = {}
        for var_name in variables_to_check:
            if var_name not in df.columns:
                logger.warning(f"Variable {var_name} not found in dataframe, skipping")
                continue
            
            criteria = self.config.get_criteria(var_name)
            if criteria is None:
                logger.warning(f"No criteria defined for {var_name}, skipping")
                continue
            
            # Check stability for this variable
            var_stable = self.check_variable_stability(
                df[var_name],
                criteria,
                window_str
            )
            
            stability_results[var_name] = var_stable
            
            # Update overall stability (AND operation - all must be stable)
            overall_stable &= var_stable
            
            stable_pct = (var_stable.sum() / len(var_stable)) * 100
            logger.info(f"  {var_name:15s}: {var_stable.sum():6d}/{len(var_stable):6d} stable ({stable_pct:5.1f}%)")
        
        # Log overall results
        overall_stable_count = overall_stable.sum()
        overall_stable_pct = (overall_stable_count / len(overall_stable)) * 100
        
        logger.info("-" * 60)
        logger.info(f"Overall Stability: {overall_stable_count}/{len(overall_stable)} periods ({overall_stable_pct:.1f}%)")
        logger.info(f"Variables checked: {len(stability_results)}")
        
        return overall_stable
    
    def check_temporal_continuity(
        self,
        df: pd.DataFrame,
        stability_mask: pd.Series,
        min_duration_minutes: Optional[int] = None
    ) -> pd.Series:
        """
        Ensure temporal continuity - stability must be sustained over time.
        
        For each timestamp T, checks that the period [T-buffer, T] was stable.
        This ensures we're truly in equilibrium, not just momentarily stable.
        
        Args:
            df: Input DataFrame
            stability_mask: Initial stability mask from multi-dimensional check
            min_duration_minutes: Minimum sustained duration (uses buffer if None)
            
        Returns:
            Boolean Series with temporal continuity applied
        """
        logger.info("\nApplying temporal continuity check...")
        
        if min_duration_minutes is None:
            min_duration_minutes = self.config.buffer_minutes
        
        buffer_window = f"{min_duration_minutes}min"
        
        # For each point, check if the preceding window was stable
        # Use rolling window to check if ALL points in window are stable
        rolling_stability = stability_mask.rolling(
            window=buffer_window,
            min_periods=int(min_duration_minutes * 0.8)  # Allow 20% missing data
        ).min()  # min() returns 1 only if ALL values in window are 1
        
        # Convert to boolean
        continuous_stable = rolling_stability.astype(bool)
        
        initial_count = stability_mask.sum()
        final_count = continuous_stable.sum()
        removed = initial_count - final_count
        
        logger.info(f"Temporal continuity ({min_duration_minutes} min buffer):")
        logger.info(f"  Before: {initial_count} stable periods")
        logger.info(f"  After:  {final_count} stable periods")
        logger.info(f"  Removed: {removed} periods (not sustained)")
        
        return continuous_stable
    
    def filter_quality_issues(
        self,
        df: pd.DataFrame,
        stability_mask: pd.Series
    ) -> pd.Series:
        """
        Filter out periods with known quality issues.
        
        Removes:
        - Sensor failures (NaN values)
        - Extreme outliers (beyond physical limits)
        - Maintenance periods (if flagged)
        
        Args:
            df: Input DataFrame
            stability_mask: Current stability mask
            
        Returns:
            Boolean Series with quality filters applied
        """
        if not self.config.enable_quality_filters:
            logger.info("Quality filters disabled, skipping")
            return stability_mask
        
        logger.info("\nApplying quality filters...")
        
        quality_mask = pd.Series(True, index=df.index)
        initial_count = stability_mask.sum()
        
        # Filter 1: Remove rows with any NaN values
        no_nan_mask = ~df.isna().any(axis=1)
        nan_removed = (~no_nan_mask).sum()
        quality_mask &= no_nan_mask
        logger.info(f"  NaN filter: removed {nan_removed} rows")
        
        # Filter 2: Remove extreme outliers (beyond 5 sigma)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col in df.columns:
                mean = df[col].mean()
                std = df[col].std()
                lower_bound = mean - 5 * std
                upper_bound = mean + 5 * std
                
                outlier_mask = (df[col] >= lower_bound) & (df[col] <= upper_bound)
                outliers_removed = (~outlier_mask).sum()
                
                if outliers_removed > 0:
                    quality_mask &= outlier_mask
                    logger.info(f"  Outlier filter ({col}): removed {outliers_removed} rows")
        
        # Combine with stability mask
        final_mask = stability_mask & quality_mask
        final_count = final_mask.sum()
        removed = initial_count - final_count
        
        logger.info(f"Quality filtering summary:")
        logger.info(f"  Before: {initial_count} stable periods")
        logger.info(f"  After:  {final_count} stable periods")
        logger.info(f"  Removed: {removed} periods (quality issues)")
        
        return final_mask
    
    def detect(
        self,
        df: pd.DataFrame,
        variables_to_check: Optional[List[str]] = None
    ) -> Tuple[pd.Series, Dict]:
        """
        Complete steady-state detection pipeline.
        
        Combines:
        1. Multi-dimensional stability check
        2. Temporal continuity validation
        3. Quality filtering
        
        Args:
            df: Input DataFrame with time-series data
            variables_to_check: Variables to check (None = all configured)
            
        Returns:
            Tuple of (steady_state_mask, diagnostics_dict)
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"STEADY-STATE DETECTION PIPELINE")
        logger.info(f"{'='*60}")
        logger.info(f"Input data: {len(df)} rows, {len(df.columns)} columns")
        logger.info(f"Date range: {df.index.min()} to {df.index.max()}")
        
        # Step 1: Multi-dimensional stability
        stability_mask = self.detect_steady_state_periods(df, variables_to_check)
        
        # Step 2: Temporal continuity
        continuous_mask = self.check_temporal_continuity(df, stability_mask)
        
        # Step 3: Quality filtering
        final_mask = self.filter_quality_issues(df, continuous_mask)
        
        # Compile diagnostics
        diagnostics = {
            'total_rows': len(df),
            'after_stability_check': stability_mask.sum(),
            'after_continuity_check': continuous_mask.sum(),
            'after_quality_filter': final_mask.sum(),
            'final_stable_periods': final_mask.sum(),
            'stable_percentage': (final_mask.sum() / len(df)) * 100,
            'variables_checked': variables_to_check or list(self.config.all_criteria.keys()),
            'config': self.config
        }
        
        logger.info(f"\n{'='*60}")
        logger.info(f"DETECTION COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"Total input rows:        {diagnostics['total_rows']:,}")
        logger.info(f"After stability check:   {diagnostics['after_stability_check']:,}")
        logger.info(f"After continuity check:  {diagnostics['after_continuity_check']:,}")
        logger.info(f"After quality filter:    {diagnostics['after_quality_filter']:,}")
        logger.info(f"Final stable periods:    {diagnostics['final_stable_periods']:,} ({diagnostics['stable_percentage']:.1f}%)")
        logger.info(f"{'='*60}\n")
        
        return final_mask, diagnostics
