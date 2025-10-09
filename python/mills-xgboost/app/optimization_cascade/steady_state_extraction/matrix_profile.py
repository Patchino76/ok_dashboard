"""
Phase 2: Matrix Profile Computation

Computes multivariate matrix profiles using STUMPY to identify
patterns and anomalies in mill process time series data.
"""

import pandas as pd
import numpy as np
import stumpy
from stumpy import fluss, motifs, snippets
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
        self.regime_locations = None
        self.cac_score = None
        self.data = None  # Store reference to original data for motifs()
        
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
        self.data = data_clean  # Store data for motifs()
        
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
    
    def detect_regimes(self, 
                      n_regimes: int = 5,
                      L: Optional[int] = None,
                      excl_factor: int = 1) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detect regime changes using FLUSS (semantic segmentation)
        
        Args:
            n_regimes: Number of regimes to detect
            L: Subsequence length for arc curve (default: window_size // 2)
            excl_factor: Exclusion zone factor (must be integer, default: 1)
            
        Returns:
            Tuple of (cac_score, regime_locations)
        """
        if self.matrix_profile is None:
            raise ValueError("Matrix profile not computed yet")
        
        if L is None:
            L = max(self.window_size // 2, 10)
        
        # Ensure excl_factor is integer for FLUSS
        excl_factor = int(excl_factor)
        
        logger.info(f"\n[FLUSS] Detecting {n_regimes} regimes with L={L}, excl_factor={excl_factor}...")
        
        # Compute corrected arc curve and find regime locations
        cac, regime_locs = fluss(
            self.matrix_profile_index,
            L=L,
            n_regimes=n_regimes,
            excl_factor=excl_factor
        )
        
        self.cac_score = cac
        self.regime_locations = regime_locs
        
        logger.info(f"✅ Detected {len(regime_locs)} regime change points")
        for i, loc in enumerate(regime_locs):
            logger.info(f"  Regime change {i+1}: index={loc}")
        
        return cac, regime_locs
    
    def extract_steady_segments(self, 
                               min_segment_length: Optional[int] = None) -> List[Tuple[int, int]]:
        """
        Extract steady-state segments between regime changes
        
        Args:
            min_segment_length: Minimum segment length (default: window_size)
            
        Returns:
            List of (start_idx, end_idx) tuples for steady segments
        """
        if self.regime_locations is None:
            raise ValueError("Regimes not detected yet. Run detect_regimes() first.")
        
        if min_segment_length is None:
            min_segment_length = self.window_size
        
        logger.info(f"\n[Segment Extraction] Finding steady segments (min length={min_segment_length})...")
        
        segments = []
        regime_locs = sorted(self.regime_locations)
        
        # Add boundaries
        boundaries = [0] + list(regime_locs) + [len(self.matrix_profile)]
        
        for i in range(len(boundaries) - 1):
            start = boundaries[i]
            end = boundaries[i + 1]
            segment_length = end - start
            
            if segment_length >= min_segment_length:
                segments.append((start, end))
                logger.info(f"  Segment {len(segments)}: [{start}:{end}] (length={segment_length})")
        
        logger.info(f"✅ Found {len(segments)} steady segments")
        return segments
    
    def find_consensus_motifs(self,
                             k: int = 3,
                             min_neighbors: int = 2,
                             max_distance: Optional[float] = None,
                             max_matches: int = 10) -> List[List[int]]:
        """
        Find consensus motifs (frequently recurring patterns)
        
        Args:
            k: Number of consensus motifs to find
            min_neighbors: Minimum number of similar patterns required
            max_distance: Maximum distance threshold (default: motif_threshold)
            max_matches: Maximum matches per motif
            
        Returns:
            List of motif index sets (each set contains similar pattern locations)
        """
        if self.matrix_profile is None or self.data is None:
            raise ValueError("Matrix profile not computed yet")
        
        if max_distance is None:
            # Use motif threshold from statistics
            mp_mean = np.mean(self.matrix_profile)
            mp_std = np.std(self.matrix_profile)
            max_distance = mp_mean - mp_std
        
        logger.info(f"\n[Consensus Motifs] Finding {k} consensus motifs...")
        logger.info(f"  Min neighbors: {min_neighbors}")
        logger.info(f"  Max distance: {max_distance:.4f}")
        logger.info(f"  Window size: {self.window_size}")
        
        # Use first feature column for motif discovery
        T = self.data.iloc[:, 0].values
        
        # Call motifs() with the time series data
        motif_distances, motif_indices = motifs(
            T,
            self.matrix_profile,
            min_neighbors=min_neighbors,
            max_distance=max_distance,
            cutoff=np.inf,
            max_matches=max_matches,
            max_motifs=k
        )
        
        # Filter for high-consensus motifs
        consensus_motifs = []
        for i, idx_set in enumerate(motif_indices):
            if len(idx_set) >= min_neighbors:
                consensus_motifs.append(idx_set)
                # Extract scalar distance value (motif_distances can be 2D)
                dist_value = float(motif_distances[i]) if np.ndim(motif_distances[i]) == 0 else float(motif_distances[i][0])
                logger.info(f"  Consensus motif {i+1}: {len(idx_set)} occurrences, avg distance={dist_value:.4f}")
        
        logger.info(f"✅ Found {len(consensus_motifs)} consensus motifs")
        return consensus_motifs
    
    def compute_motif_quality_score(self,
                                   window_data: pd.DataFrame,
                                   mp_distance: float) -> Tuple[float, Dict]:
        """
        Compute quality score for a motif window
        
        Args:
            window_data: DataFrame containing the motif window
            mp_distance: Matrix profile distance for this window
            
        Returns:
            Tuple of (total_score, component_scores)
        """
        # Normalize MP distance (0-1, lower is better)
        mp_max = np.max(self.matrix_profile)
        mp_score = 1.0 - (mp_distance / mp_max) if mp_max > 0 else 1.0
        
        # Stability score (low coefficient of variation is better)
        cv_values = window_data.std() / (window_data.mean() + 1e-8)
        stability_score = 1.0 - np.clip(cv_values.mean(), 0, 1)
        
        # Completeness score
        completeness_score = 1.0 if len(window_data) == self.window_size else 0.0
        
        # Range coverage score (normalized)
        range_coverage = (window_data.max() - window_data.min()).mean()
        coverage_score = np.clip(range_coverage, 0, 1)
        
        # Weighted combination
        weights = {
            'mp_distance': 0.4,
            'stability': 0.3,
            'completeness': 0.2,
            'range_coverage': 0.1
        }
        
        scores = {
            'mp_distance': mp_score,
            'stability': stability_score,
            'completeness': completeness_score,
            'range_coverage': coverage_score
        }
        
        total_score = sum(scores[k] * weights[k] for k in weights)
        
        return total_score, scores
    
    def extract_snippets(self,
                        data: pd.DataFrame,
                        k: int = 3,
                        normalize: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract k most representative snippets (golden examples)
        
        STUMPY's snippets() works on univariate data, so we use the first feature column.
        
        Args:
            data: Time series data (same as used for MP computation)
            k: Number of snippets to extract
            normalize: Whether to normalize data
            
        Returns:
            Tuple of (snippet_indices, snippet_profiles)
        """
        if self.window_size is None:
            raise ValueError("Window size not set. Run compute_mp_with_auto_window first.")
        
        logger.info(f"\n[Snippet Extraction] Finding {k} most representative patterns...")
        
        # STUMPY's snippets() expects univariate time series (1D array)
        # Use the first feature column as reference
        if isinstance(data, pd.DataFrame):
            T = data.iloc[:, 0].values  # Extract first column as 1D array
            feature_name = data.columns[0]
        else:
            T = np.asarray(data).flatten()
            feature_name = "Feature 0"
        
        logger.info(f"  Using feature '{feature_name}' for snippet extraction")
        logger.info(f"  Time series length: {len(T)}")
        logger.info(f"  Window size: {self.window_size}")
        
        # Validate that window size is appropriate
        if self.window_size > len(T) // 2:
            logger.warning(f"Window size {self.window_size} is too large for {len(T)} timepoints")
            logger.warning(f"Reducing window size to {len(T) // 2}")
            effective_window = len(T) // 2
        else:
            effective_window = self.window_size
        
        # Call snippets with univariate time series
        # Let's capture all return values and see what we get
        snippet_result = snippets(
            T,
            m=effective_window,
            k=k,
            normalize=normalize
        )
        
        # Debug: Check what snippets() actually returns
        logger.info(f"  Snippets returned {len(snippet_result)} values")
        
        # Extract indices and profiles (first two values)
        snippet_indices = snippet_result[0]
        snippet_profiles = snippet_result[1]
        
        logger.info(f"✅ Extracted {len(snippet_indices)} snippets")
        for i, idx in enumerate(snippet_indices):
            logger.info(f"  Snippet {i+1}: index={idx}")
        
        return snippet_indices, snippet_profiles
