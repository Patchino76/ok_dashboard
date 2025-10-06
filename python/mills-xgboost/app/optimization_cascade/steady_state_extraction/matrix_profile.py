"""
Phase 2: Matrix Profile Computation

Computes multivariate matrix profiles using STUMPY to identify
patterns and anomalies in mill process time series data.
"""

import pandas as pd
import numpy as np
import stumpy
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class MatrixProfileComputer:
    """
    Computes matrix profiles for time series pattern analysis
    """
    
    def __init__(self):
        """Initialize matrix profile computer"""
        self.matrix_profile = None
        self.matrix_profile_index = None
        self.window_size = None
        self.feature_names = []
        
    def compute_univariate_mp(self, 
                              data: pd.Series,
                              window_size: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute univariate matrix profile for a single time series
        
        Args:
            data: Time series data (1D)
            window_size: Subsequence window size
            
        Returns:
            Tuple of (matrix_profile, matrix_profile_index)
        """
        logger.info(f"Computing univariate matrix profile with window={window_size}")
        
        # Compute matrix profile using STUMP (univariate)
        mp = stumpy.stump(data.values, m=window_size)
        
        # Extract matrix profile and index
        matrix_profile = mp[:, 0]  # Distance to nearest neighbor
        matrix_profile_index = mp[:, 1].astype(int)  # Index of nearest neighbor
        
        logger.info(f"✅ Univariate MP computed: {len(matrix_profile)} profile points")
        
        return matrix_profile, matrix_profile_index
    
    def compute_multivariate_mp(self,
                               data: pd.DataFrame,
                               window_size: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute multivariate matrix profile for multiple time series
        
        Args:
            data: Time series data (2D DataFrame)
            window_size: Subsequence window size
            
        Returns:
            Tuple of (matrix_profile, matrix_profile_index)
        """
        logger.info(f"Computing multivariate matrix profile with window={window_size}")
        logger.info(f"Features: {list(data.columns)}")
        logger.info(f"Data shape (original): {data.shape}")
        
        # Drop rows with NaNs to avoid STUMPY errors
        data_clean = data.dropna()
        if len(data_clean) != len(data):
            logger.warning(f"Dropped {len(data) - len(data_clean)} rows containing NaNs before MSTUMP")
        
        if len(data_clean) <= window_size:
            raise ValueError(
                f"Insufficient data length ({len(data_clean)}) for window size {window_size}. "
                "Reduce window size or provide more data."
            )
        
        # Prepare data for STUMPY (dimensions x timepoints)
        data_array = data_clean.to_numpy(dtype=np.float64).T  # shape: (n_features, n_timepoints)
        logger.info(
            f"Array shape for STUMPY: {data_array.shape} (features x timepoints)"
        )
        
        # Compute multivariate matrix profile using MSTUMP
        logger.info("Running MSTUMP (this may take a few minutes for large datasets)...")
        matrix_profiles, profile_indices = stumpy.mstump(data_array, m=window_size)
        
        # Aggregate across dimensions (mean distance per subsequence)
        matrix_profile = np.nanmean(matrix_profiles, axis=0)
        matrix_profile_index = profile_indices[0].astype(int)
        
        logger.info(f"✅ Multivariate MP computed: {len(matrix_profile)} profile points")
        
        self.matrix_profile = matrix_profile
        self.matrix_profile_index = matrix_profile_index
        self.window_size = window_size
        self.feature_names = list(data_clean.columns)
        
        return matrix_profile, matrix_profile_index
    
    def calculate_window_size(self,
                             data: pd.DataFrame,
                             residence_time_minutes: int = 60,
                             sampling_freq_minutes: int = 1) -> int:
        """
        Calculate appropriate window size based on process residence time
        
        Args:
            data: Time series data
            residence_time_minutes: Process residence time (default: 60 min)
            sampling_freq_minutes: Data sampling frequency (default: 1 min)
            
        Returns:
            Window size in data points
        """
        window_size = residence_time_minutes // sampling_freq_minutes
        
        # Ensure window size is reasonable (not too large or small)
        max_window = len(data) // 4  # Max 25% of data length
        min_window = 30  # Minimum 30 data points
        
        window_size = max(min_window, min(window_size, max_window))
        
        logger.info(f"Calculated window size: {window_size} data points")
        logger.info(f"  Residence time: {residence_time_minutes} minutes")
        logger.info(f"  Sampling frequency: {sampling_freq_minutes} minutes")
        logger.info(f"  Window duration: {window_size * sampling_freq_minutes} minutes")
        
        return window_size
    
    def compute_mp_with_auto_window(self,
                                   data: pd.DataFrame,
                                   residence_time_minutes: int = 60,
                                   sampling_freq_minutes: int = 1) -> Dict:
        """
        Compute matrix profile with automatic window size calculation
        
        Args:
            data: Normalized time series data
            residence_time_minutes: Process residence time
            sampling_freq_minutes: Data sampling frequency
            
        Returns:
            Dictionary with matrix profile results
        """
        logger.info("=" * 80)
        logger.info("PHASE 2: MATRIX PROFILE COMPUTATION")
        logger.info("=" * 80)
        
        # Step 1: Calculate window size
        logger.info("\n[Step 1/3] Calculating optimal window size...")
        window_size = self.calculate_window_size(
            data, 
            residence_time_minutes, 
            sampling_freq_minutes
        )
        
        # Step 2: Compute matrix profile
        logger.info("\n[Step 2/3] Computing multivariate matrix profile...")
        logger.info(f"  Processing {len(data)} timepoints with {len(data.columns)} features")
        logger.info(f"  This will create {len(data) - window_size + 1} subsequences")
        
        matrix_profile, matrix_profile_index = self.compute_multivariate_mp(
            data, 
            window_size
        )
        
        # Step 3: Analyze results
        logger.info("\n[Step 3/3] Analyzing matrix profile results...")
        
        # Calculate statistics
        mp_mean = np.mean(matrix_profile)
        mp_std = np.std(matrix_profile)
        mp_min = np.min(matrix_profile)
        mp_max = np.max(matrix_profile)
        mp_median = np.median(matrix_profile)
        
        logger.info(f"Matrix Profile Statistics:")
        logger.info(f"  Mean distance: {mp_mean:.4f}")
        logger.info(f"  Std distance: {mp_std:.4f}")
        logger.info(f"  Min distance: {mp_min:.4f}")
        logger.info(f"  Max distance: {mp_max:.4f}")
        logger.info(f"  Median distance: {mp_median:.4f}")
        
        # Find potential motifs (low distances) and discords (high distances)
        motif_threshold = mp_mean - mp_std  # 1 std below mean
        discord_threshold = mp_mean + 2 * mp_std  # 2 std above mean
        
        n_motif_candidates = np.sum(matrix_profile < motif_threshold)
        n_discord_candidates = np.sum(matrix_profile > discord_threshold)
        
        logger.info(f"\nPattern Candidates:")
        logger.info(f"  Motif candidates (low distance): {n_motif_candidates}")
        logger.info(f"  Discord candidates (high distance): {n_discord_candidates}")
        
        # Package results
        results = {
            'matrix_profile': matrix_profile,
            'matrix_profile_index': matrix_profile_index,
            'window_size': window_size,
            'feature_names': list(data.columns),
            'statistics': {
                'mean': mp_mean,
                'std': mp_std,
                'min': mp_min,
                'max': mp_max,
                'median': mp_median
            },
            'thresholds': {
                'motif': motif_threshold,
                'discord': discord_threshold
            },
            'candidates': {
                'motifs': n_motif_candidates,
                'discords': n_discord_candidates
            }
        }
        
        logger.info("\n" + "=" * 80)
        logger.info("PHASE 2 COMPLETE: Matrix profile ready for motif discovery")
        logger.info("=" * 80 + "\n")
        
        return results
    
    def get_subsequence(self, 
                       data: pd.DataFrame,
                       index: int,
                       window_size: Optional[int] = None) -> pd.DataFrame:
        """
        Extract a subsequence from the data at given index
        
        Args:
            data: Original time series data
            index: Starting index of subsequence
            window_size: Window size (uses stored if None)
            
        Returns:
            DataFrame with subsequence
        """
        if window_size is None:
            window_size = self.window_size
            
        if window_size is None:
            raise ValueError("Window size not set. Run compute_mp_with_auto_window first.")
        
        end_index = index + window_size
        return data.iloc[index:end_index].copy()
    
    def find_top_motifs(self, 
                       k: int = 10,
                       exclusion_zone: Optional[int] = None) -> List[int]:
        """
        Find top-K motif candidates (lowest distances in matrix profile)
        
        Args:
            k: Number of motifs to find
            exclusion_zone: Minimum distance between motifs (default: window_size/2)
            
        Returns:
            List of motif starting indices
        """
        if self.matrix_profile is None:
            raise ValueError("Matrix profile not computed yet")
        
        if exclusion_zone is None:
            exclusion_zone = self.window_size // 2
        
        logger.info(f"Finding top-{k} motifs with exclusion zone={exclusion_zone}")
        
        # Create a copy of matrix profile for manipulation
        mp_copy = self.matrix_profile.copy()
        motif_indices = []
        
        for i in range(k):
            # Find minimum distance
            min_idx = np.argmin(mp_copy)
            motif_indices.append(min_idx)
            
            # Apply exclusion zone
            start_exclude = max(0, min_idx - exclusion_zone)
            end_exclude = min(len(mp_copy), min_idx + exclusion_zone)
            mp_copy[start_exclude:end_exclude] = np.inf
            
            logger.info(f"  Motif {i+1}: index={min_idx}, distance={self.matrix_profile[min_idx]:.4f}")
        
        return motif_indices
    
    def find_top_discords(self, 
                         k: int = 10,
                         exclusion_zone: Optional[int] = None) -> List[int]:
        """
        Find top-K discord candidates (highest distances in matrix profile)
        
        Args:
            k: Number of discords to find
            exclusion_zone: Minimum distance between discords (default: window_size/2)
            
        Returns:
            List of discord starting indices
        """
        if self.matrix_profile is None:
            raise ValueError("Matrix profile not computed yet")
        
        if exclusion_zone is None:
            exclusion_zone = self.window_size // 2
        
        logger.info(f"Finding top-{k} discords with exclusion zone={exclusion_zone}")
        
        # Create a copy of matrix profile for manipulation
        mp_copy = self.matrix_profile.copy()
        discord_indices = []
        
        for i in range(k):
            # Find maximum distance
            max_idx = np.argmax(mp_copy)
            discord_indices.append(max_idx)
            
            # Apply exclusion zone
            start_exclude = max(0, max_idx - exclusion_zone)
            end_exclude = min(len(mp_copy), max_idx + exclusion_zone)
            mp_copy[start_exclude:end_exclude] = -np.inf
            
            logger.info(f"  Discord {i+1}: index={max_idx}, distance={self.matrix_profile[max_idx]:.4f}")
        
        return discord_indices
