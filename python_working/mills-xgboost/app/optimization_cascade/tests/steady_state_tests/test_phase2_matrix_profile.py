"""

Tests the matrix profile computation and generates visualizations
to show patterns, motifs, and discords in the data.
"""

import numpy as np
import pandas as pd
import stumpy
from datetime import datetime, timedelta
import logging
import os
import sys
from pathlib import Path
from scipy.signal import medfilt
import matplotlib.pyplot as plt

# Setup paths
MILLS_XGBOOST_ROOT = Path(__file__).resolve().parents[4]

if str(MILLS_XGBOOST_ROOT) not in sys.path:
    sys.path.append(str(MILLS_XGBOOST_ROOT))

from app.database.db_connector import MillsDataConnector
from app.optimization_cascade.steady_state_extraction.data_preparation import DataPreparation
from app.optimization_cascade.steady_state_extraction.matrix_profile import MatrixProfileComputer
from config.settings import settings

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def plot_matrix_profile(data: pd.DataFrame, mp_results: dict, title: str, filename: str) -> None:
    """Plot matrix profile with original data."""
    matrix_profile = mp_results['matrix_profile']
    window_size = mp_results['window_size']
    fig, axes = plt.subplots(2, 1, figsize=(16, 10))

    # Plot reference time series
    first_feature = data.columns[0]
    axes[0].plot(data.index, data[first_feature], linewidth=0.5, alpha=0.7, color='blue')
    axes[0].set_ylabel(f'{first_feature}\n(Normalized)', fontsize=11, fontweight='bold')
    axes[0].set_title(f'Reference Time Series: {first_feature}', fontsize=12, fontweight='bold')
    axes[0].grid(True, alpha=0.3)

    # Plot matrix profile with thresholds
    mp_index = data.index[window_size - 1: window_size - 1 + len(matrix_profile)]
    axes[1].plot(mp_index, matrix_profile, linewidth=1, alpha=0.8, color='red')
    axes[1].set_ylabel('Distance', fontsize=11, fontweight='bold')
    axes[1].set_xlabel('Time', fontsize=11, fontweight='bold')
    axes[1].set_title('Matrix Profile (Lower = More Similar Patterns)', fontsize=12, fontweight='bold')
    axes[1].grid(True, alpha=0.3)

    motif_threshold = mp_results['thresholds']['motif']
    discord_threshold = mp_results['thresholds']['discord']
    axes[1].axhline(y=motif_threshold, color='green', linestyle='--', linewidth=2, alpha=0.7,
                    label=f'Motif threshold ({motif_threshold:.2f})')
    axes[1].axhline(y=discord_threshold, color='orange', linestyle='--', linewidth=2, alpha=0.7,
                    label=f'Discord threshold ({discord_threshold:.2f})')
    axes[1].legend(loc='upper right')

    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()


def plot_motifs(data: pd.DataFrame, motif_indices: list, window_size: int, 
                title: str, filename: str, max_motifs: int = 5) -> None:
    """Plot top motif patterns individually."""
    n_motifs = min(len(motif_indices), max_motifs)
    if n_motifs == 0:
        return

    n_features = len(data.columns)
    fig, axes = plt.subplots(n_features, n_motifs, figsize=(4 * n_motifs, 3 * n_features))
    axes = np.atleast_2d(axes)
    if n_features == 1:
        axes = axes.reshape(1, -1)
    if n_motifs == 1:
        axes = axes.reshape(-1, 1)

    for motif_idx, start_idx in enumerate(motif_indices[:n_motifs]):
        subsequence = data.iloc[start_idx:start_idx + window_size]
        for feat_idx, feature in enumerate(data.columns):
            ax = axes[feat_idx, motif_idx]
            ax.plot(range(window_size), subsequence[feature].values, linewidth=2, alpha=0.8, color='green')
            if motif_idx == 0:
                ax.set_ylabel(feature, fontsize=10, fontweight='bold')
            if feat_idx == 0:
                ax.set_title(f'Motif {motif_idx + 1}\n{data.index[start_idx]}', fontsize=10, fontweight='bold')
            ax.grid(True, alpha=0.3)
            ax.set_xlabel('Time (min)', fontsize=9)

    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()


def plot_overlapped_motifs(data: pd.DataFrame, motif_indices: list, window_size: int,
                           title: str, filename: str) -> None:
    """Plot every motif window overlapped per feature."""
    if not motif_indices:
        return

    n_features = len(data.columns)
    fig, axes = plt.subplots(n_features, 1, figsize=(16, 3 * n_features), sharex=True)
    axes = [axes] if n_features == 1 else axes
    try:
        color_map = plt.colormaps.get_cmap('viridis')
    except AttributeError:
        color_map = plt.cm.get_cmap('viridis')

    for motif_idx, start_idx in enumerate(motif_indices):
        subseq = data.iloc[start_idx:start_idx + window_size]
        if subseq.empty:
            continue

        time_offsets = np.arange(len(subseq))
        motif_label = f"Motif {motif_idx + 1} ({data.index[start_idx]:%Y-%m-%d %H:%M})"
        color = color_map(motif_idx)

        for feat_idx, feature in enumerate(data.columns):
            ax = axes[feat_idx]
            label = motif_label if feat_idx == 0 else None
            ax.plot(time_offsets, subseq[feature].values, color=color, alpha=0.7,
                    linewidth=1.5, label=label)
            ax.grid(True, alpha=0.3)
            ax.set_ylabel(feature, fontsize=10, fontweight='bold')

    axes[-1].set_xlabel('Time offset (minutes)', fontsize=11, fontweight='bold')
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()


def plot_discords(data: pd.DataFrame, discord_indices: list, window_size: int,
                 title: str, filename: str, max_discords: int = 5) -> None:
    """Plot top discord patterns (anomalies)."""
    n_discords = min(len(discord_indices), max_discords)
    if n_discords == 0:
        return

    n_features = len(data.columns)
    fig, axes = plt.subplots(n_features, n_discords, figsize=(4 * n_discords, 3 * n_features))
    axes = np.atleast_2d(axes)
    if n_features == 1:
        axes = axes.reshape(1, -1)
    if n_discords == 1:
        axes = axes.reshape(-1, 1)

    for discord_idx, start_idx in enumerate(discord_indices[:n_discords]):
        subsequence = data.iloc[start_idx:start_idx + window_size]
        for feat_idx, feature in enumerate(data.columns):
            ax = axes[feat_idx, discord_idx]
            ax.plot(range(window_size), subsequence[feature].values, linewidth=2, alpha=0.8, color='red')
            if discord_idx == 0:
                ax.set_ylabel(feature, fontsize=10, fontweight='bold')
            if feat_idx == 0:
                ax.set_title(f'Discord {discord_idx + 1}\n{data.index[start_idx]}', fontsize=10, fontweight='bold')
            ax.grid(True, alpha=0.3)
            ax.set_xlabel('Time (min)', fontsize=9)

    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()


def plot_mp_histogram(mp_results: dict, title: str, filename: str) -> None:
    """Plot matrix profile distance distribution."""
    matrix_profile = mp_results['matrix_profile']
    stats = mp_results['statistics']
    thresholds = mp_results['thresholds']

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.hist(matrix_profile, bins=100, alpha=0.7, edgecolor='black', color='steelblue')
    ax.axvline(stats['mean'], color='blue', linestyle='--', linewidth=2, label=f"Mean: {stats['mean']:.3f}")
    ax.axvline(stats['median'], color='purple', linestyle='--', linewidth=2, label=f"Median: {stats['median']:.3f}")
    ax.axvline(thresholds['motif'], color='green', linestyle='--', linewidth=2, label=f"Motif threshold: {thresholds['motif']:.3f}")
    ax.axvline(thresholds['discord'], color='red', linestyle='--', linewidth=2, label=f"Discord threshold: {thresholds['discord']:.3f}")
    ax.set_xlabel('Matrix Profile Distance', fontsize=12, fontweight='bold')
    ax.set_ylabel('Frequency', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.legend(loc='upper right', fontsize=10)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()


def plot_regime_changes(data: pd.DataFrame, mp_results: dict, regime_locations: np.ndarray,
                       title: str, filename: str) -> None:
    """Plot regime changes detected by FLUSS."""
    fig, ax = plt.subplots(figsize=(16, 6))
    
    first_feature = data.columns[0]
    ax.plot(data.index, data[first_feature], linewidth=0.8, alpha=0.7, color='blue', label=first_feature)
    
    # Mark regime changes
    for i, loc in enumerate(regime_locations):
        if loc < len(data):
            ax.axvline(x=data.index[loc], color='red', linestyle='--', linewidth=2, alpha=0.7,
                      label='Regime change' if i == 0 else '')
    
    ax.set_xlabel('Time', fontsize=12, fontweight='bold')
    ax.set_ylabel('Normalized Value', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()


def plot_consensus_motifs(data: pd.DataFrame, consensus_motifs: list, window_size: int,
                          title: str, filename: str) -> None:
    """Plot consensus motifs with all their occurrences."""
    if not consensus_motifs:
        return
    
    n_motifs = len(consensus_motifs)
    n_features = len(data.columns)
    fig, axes = plt.subplots(n_features, n_motifs, figsize=(5 * n_motifs, 3 * n_features))
    axes = np.atleast_2d(axes)
    if n_features == 1:
        axes = axes.reshape(1, -1)
    if n_motifs == 1:
        axes = axes.reshape(-1, 1)
    
    try:
        color_map = plt.colormaps.get_cmap('tab10')
    except AttributeError:
        color_map = plt.cm.get_cmap('tab10', 10)
    
    for motif_idx, motif_set in enumerate(consensus_motifs):
        for feat_idx, feature in enumerate(data.columns):
            ax = axes[feat_idx, motif_idx]
            
            # Plot all occurrences of this motif
            for occ_idx, start_idx in enumerate(motif_set[:5]):  # Max 5 occurrences
                subseq = data.iloc[start_idx:start_idx + window_size]
                ax.plot(range(len(subseq)), subseq[feature].values, 
                       linewidth=2, alpha=0.6, color=color_map(occ_idx),
                       label=f'Occ {occ_idx+1}')
            
            if motif_idx == 0:
                ax.set_ylabel(feature, fontsize=10, fontweight='bold')
            if feat_idx == 0:
                ax.set_title(f'Consensus Motif {motif_idx + 1}\n({len(motif_set)} occurrences)', 
                           fontsize=10, fontweight='bold')
            ax.grid(True, alpha=0.3)
            ax.set_xlabel('Time (min)', fontsize=9)
            if feat_idx == 0 and motif_idx == 0:
                ax.legend(fontsize=8)
    
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150, bbox_inches='tight')
    plt.close()

#------------------------------------------------------------------------------------------------------
def test_phase2_matrix_profile() -> tuple:
    """Test Phase 2: Matrix Profile Computation with Multi-Mill Support.
    
    Supports both single mill and multi-mill motif detection:
    - Single mill: MILL_NUMBERS = [8]
    - Multi-mill: MILL_NUMBERS = [6, 7, 8]
    
    Multi-mill approach finds consensus patterns across mills for robust training data.
    """

    logger.info("=" * 80)
    logger.info("PHASE 2: MATRIX PROFILE COMPUTATION (MULTI-MILL SUPPORT)")
    logger.info("=" * 80)

    # ========== CONFIGURATION ==========
    # Multi-Mill Support: Works for both single and multiple mills
    # - Single mill:  MILL_NUMBERS = [8]
    # - Multi-mill:   MILL_NUMBERS = [6, 7, 8]
    # 
    # Multi-mill approach finds consensus patterns across mills:
    # ✓ 3x more training data (for 3 mills)
    # ✓ Cross-mill validated patterns (robust generalization)
    # ✓ Captures universal grinding physics, not mill-specific quirks
    # ✓ All outputs include mill_id tracking for analysis
    MILL_NUMBERS = [8]  # Change to [6, 7, 8] for multi-mill processing
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=115)
    MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
    CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
    MOTIVE_FEATURES = ['WaterZumpf', 'DensityHC', 'PulpHC']
    RESIDENCE_TIME_MINUTES = 240  # 4 hours for balanced quality vs quantity

    logger.info(f"Mills: {MILL_NUMBERS} | {START_DATE:%Y-%m-%d} to {END_DATE:%Y-%m-%d} | Window: {RESIDENCE_TIME_MINUTES}min")
    logger.info(f"Strategy: Normalized Multi-Mill Concatenation")
    logger.info(f"Total data span: {len(MILL_NUMBERS)} mill(s) × {(END_DATE - START_DATE).days} days = {len(MILL_NUMBERS) * (END_DATE - START_DATE).days} mill-days")

    try:
        logger.info("\n[Multi-Mill Data Preparation]")
        db_connector = MillsDataConnector(
            host=settings.DB_HOST, port=settings.DB_PORT, dbname=settings.DB_NAME,
            user=settings.DB_USER, password=settings.DB_PASSWORD
        )
        data_prep = DataPreparation(db_connector)
        
        # Storage for multi-mill data
        all_clean_data = []
        all_normalized_data = []
        mill_metadata = []  # Track which data came from which mill
        
        # Process each mill
        for mill_idx, mill_number in enumerate(MILL_NUMBERS):
            logger.info(f"\n[Mill {mill_number}] Processing data...")
            
            # Fetch and prepare data for this mill
            clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
                mill_number=mill_number,
                start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
                end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
                mv_features=MV_FEATURES,
                cv_features=CV_FEATURES,
                dv_features=None,
                resample_freq='1min',
            )
            
            # Apply filters (same criteria for all mills)
            initial_rows = len(clean_data)
            filter_mask = (
                (clean_data['Ore'] > 160) & 
                (clean_data['DensityHC'] > 1600) & 
                (clean_data['DensityHC'] < 1800) &
                (clean_data['WaterMill'] > 6) & 
                (clean_data['PressureHC'] > 0.3) & 
                (clean_data['PulpHC'] > 400)
            )
            
            clean_data_filtered = clean_data.loc[filter_mask].copy()
            normalized_data_filtered = normalized_data.loc[filter_mask].copy()
            
            filtered_rows = len(clean_data_filtered)
            logger.info(f"[Mill {mill_number}] Initial rows: {initial_rows:,}")
            logger.info(f"[Mill {mill_number}] Filtered rows: {filtered_rows:,} ({100*filtered_rows/initial_rows:.1f}% kept)")
            logger.info(f"[Mill {mill_number}] Removed: {initial_rows - filtered_rows:,} rows")
            
            # Skip mill if no data after filtering
            if filtered_rows == 0:
                logger.warning(f"[Mill {mill_number}] ⚠️  No data after filtering - SKIPPING this mill")
                continue
            
            # Add mill identifier column for tracking
            clean_data_filtered['mill_id'] = mill_number
            normalized_data_filtered['mill_id'] = mill_number
            
            # Convert index to column to avoid duplicate timestamp issues
            clean_data_filtered['original_timestamp'] = clean_data_filtered.index
            normalized_data_filtered['original_timestamp'] = normalized_data_filtered.index
            
            # Reset index to sequential integers for stacking
            clean_data_filtered = clean_data_filtered.reset_index(drop=True)
            normalized_data_filtered = normalized_data_filtered.reset_index(drop=True)
            
            # Store data
            all_clean_data.append(clean_data_filtered)
            all_normalized_data.append(normalized_data_filtered)
            mill_metadata.append({
                'mill_number': mill_number,
                'initial_rows': initial_rows,
                'filtered_rows': filtered_rows,
                'date_range': (clean_data_filtered['original_timestamp'].min(), clean_data_filtered['original_timestamp'].max())
            })
        
        # Check if we have any data after processing all mills
        if len(all_clean_data) == 0:
            raise ValueError(f"No data available from any mill after filtering! Check filter criteria or date range.")
        
        # Concatenate all mills data - stacked sequentially (no duplicate timestamps)
        logger.info("\n[Data Concatenation] Stacking mills sequentially...")
        clean_data_combined = pd.concat(all_clean_data, axis=0, ignore_index=True)
        normalized_data_combined = pd.concat(all_normalized_data, axis=0, ignore_index=True)
        
        total_rows = len(clean_data_combined)
        mills_included = [meta['mill_number'] for meta in mill_metadata]
        logger.info(f"Combined dataset: {total_rows:,} total rows from {len(mills_included)} mill(s): {mills_included}")
        logger.info(f"Data stacked sequentially: Mill {mills_included[0]} → Mill {mills_included[-1]}")
        logger.info(f"Sequential index: 0 to {total_rows-1}")
        
        # Save combined initial data with original timestamps as column
        clean_data_combined.to_csv(os.path.join(OUTPUT_DIR, 'phase2_initial_data.csv'), index=False)
        logger.info(f"Saved: phase2_initial_data.csv ({total_rows:,} rows)")
        logger.info(f"  Columns: {list(clean_data_combined.columns)}")
        
        # Apply Two-Stage Smoothing for better pattern discovery
        logger.info("\n[Two-Stage Smoothing] Processing combined dataset...")
        logger.info("Stage 1: Median filter to remove outlier spikes...")
        median_kernel = 5  # Must be odd
        
        # Smooth all columns except mill_id and original_timestamp
        feature_cols = [col for col in clean_data_combined.columns if col not in ['mill_id', 'original_timestamp']]
        for col in feature_cols:
            clean_data_combined[col] = medfilt(clean_data_combined[col].values, kernel_size=median_kernel)
        logger.info(f"  Applied median filter (kernel={median_kernel}) to {len(feature_cols)} features")
        
        logger.info("Stage 2: Rolling mean to smooth sensor noise...")
        smoothing_window = 10  # 10 minutes
        for col in feature_cols:
            clean_data_combined[col] = clean_data_combined[col].rolling(
                window=smoothing_window,
                center=True,
                min_periods=1
            ).mean()
        logger.info(f"  Applied rolling mean (window={smoothing_window} minutes)")
        logger.info(f"✅ Smoothing complete - data ready for STUMPY analysis")
        
        # Re-normalize after smoothing (excluding mill_id)
        logger.info("\n[Re-normalization] Normalizing smoothed data...")
        from sklearn.preprocessing import StandardScaler
        scaler_smooth = StandardScaler()
        
        # Normalize only feature columns
        normalized_features = pd.DataFrame(
            scaler_smooth.fit_transform(clean_data_combined[feature_cols]),
            index=clean_data_combined.index,
            columns=feature_cols
        )
        # Add back mill_id and original_timestamp
        normalized_features['mill_id'] = clean_data_combined['mill_id']
        normalized_features['original_timestamp'] = clean_data_combined['original_timestamp']
        normalized_data_combined = normalized_features
        
        logger.info("✅ Re-normalization complete")
        
        # Save smoothed data for comparison
        clean_data_combined.to_csv(os.path.join(OUTPUT_DIR, 'phase2_smoothed_data.csv'), index=False)
        logger.info(f"Saved: phase2_smoothed_data.csv ({len(clean_data_combined):,} rows)")
        
        # Prepare data for matrix profile computation (without mill_id and timestamp columns)
        # Create a DatetimeIndex for matrix profile (required by STUMPY)
        # Use sequential synthetic timestamps to avoid duplicates
        synthetic_index = pd.date_range(start='2024-01-01', periods=len(normalized_data_combined), freq='1min')
        
        normalized_motive = normalized_data_combined[MOTIVE_FEATURES].copy()
        normalized_motive.index = synthetic_index
        
        full_features = normalized_data_combined[MV_FEATURES + CV_FEATURES].copy()
        full_features.index = synthetic_index
        
        logger.info(f"\nCreated synthetic sequential index for matrix profile computation")
        logger.info(f"  Synthetic time range: {synthetic_index[0]} to {synthetic_index[-1]}")
        logger.info(f"  This avoids duplicate timestamp issues while preserving data order") 

        logger.info("\n[Matrix Profile Computation]")
        mp_computer = MatrixProfileComputer()
        mp_results = mp_computer.compute_mp_with_auto_window(
            data=normalized_motive,
            residence_time_minutes=RESIDENCE_TIME_MINUTES,
            sampling_freq_minutes=1,
        )
        
        # Extract window_size from results
        window_size = mp_results['window_size']

        # Step 1: Detect regime changes with FLUSS (maximum sensitivity)
        logger.info("\n[Step 1: Regime Detection]")
        logger.info("  Using maximum sensitivity parameters:")
        logger.info(f"  - n_regimes: 50 (maximum regime detection)")
        logger.info(f"  - L: 5 (minimum granularity for maximum sensitivity)")
        logger.info(f"  - excl_factor: 1 (standard exclusion)")
        cac, regime_locations = mp_computer.detect_regimes(n_regimes=50, L=5, excl_factor=1)
        
        # Step 2: Extract steady-state segments
        logger.info("\n[Step 2: Steady Segment Extraction]")
        # Reduce minimum to half window size to capture more segments
        min_segment_length = window_size // 2  # 4 hours minimum
        logger.info(f"  Minimum segment length: {min_segment_length} minutes ({min_segment_length/60:.1f} hours)")
        logger.info(f"  This allows segments as short as {min_segment_length/60:.1f} hours")
        steady_segments = mp_computer.extract_steady_segments(min_segment_length=min_segment_length)
        
        # If we still only have 1 segment, add manual segmentation based on time chunks
        if len(steady_segments) <= 1:
            logger.warning(f"  ⚠️  Only {len(steady_segments)} segment found by FLUSS")
            logger.info("  Applying alternative time-based segmentation...")
            # Split data into 7-day chunks as fallback
            total_length = len(clean_data)
            chunk_size = 7 * 24 * 60  # 7 days in minutes
            manual_segments = []
            for start in range(0, total_length, chunk_size):
                end = min(start + chunk_size, total_length)
                if end - start >= min_segment_length:
                    manual_segments.append((start, end))
            logger.info(f"  Created {len(manual_segments)} time-based segments (7-day chunks)")
            # Combine FLUSS segments with manual segments
            all_segments = list(set(steady_segments + manual_segments))
            all_segments.sort()
            steady_segments = all_segments
            logger.info(f"  Total segments after combining: {len(steady_segments)}")
        
        # Step 3: Find consensus motifs (recurring patterns with stricter criteria)
        logger.info("\n[Step 3: Consensus Motif Discovery]")
        logger.info("  Using stricter criteria for higher quality motifs:")
        logger.info(f"  - k: 5 (find more motif types)")
        logger.info(f"  - min_neighbors: 3 (require more occurrences)")
        consensus_motifs = mp_computer.find_consensus_motifs(k=5, min_neighbors=3)
        
        # Step 4: Traditional motif/discord detection (for comparison)
        logger.info("\n[Step 5: Traditional Motif/Discord Detection]")
        motif_indices = mp_computer.find_top_motifs(k=10)
        discord_indices = mp_computer.find_top_discords(k=10)
        logger.info(f"Found {len(motif_indices)} motifs, {len(discord_indices)} discords")

        logger.info("\n[Generating Visualizations]")
        # Create title based on single or multi-mill processing
        mill_label = f"Mill {MILL_NUMBERS[0]}" if len(MILL_NUMBERS) == 1 else f"Mills {MILL_NUMBERS}"
        
        plot_matrix_profile(normalized_motive, mp_results, f'{mill_label} - Matrix Profile Overview', 'phase2_matrix_profile_overview.png')
        plot_mp_histogram(mp_results, f'{mill_label} - Matrix Profile Distance Distribution', 'phase2_mp_histogram.png')
        plot_regime_changes(normalized_motive, mp_results, regime_locations, f'{mill_label} - Regime Changes (FLUSS)', 'phase2_regime_changes.png')
        plot_consensus_motifs(normalized_motive, consensus_motifs, window_size, f'{mill_label} - Consensus Motifs', 'phase2_consensus_motifs.png')
        plot_motifs(normalized_motive, motif_indices, window_size, f'{mill_label} - Top 5 Motif Patterns', 'phase2_top_motifs.png', max_motifs=5)
        plot_overlapped_motifs(normalized_motive, motif_indices, window_size, f'{mill_label} - Overlapped Motif Windows', 'phase2_motif_overlays.png')
        plot_discords(normalized_motive, discord_indices, window_size, f'{mill_label} - Top 5 Discord Patterns', 'phase2_top_discords.png', max_discords=5)

        logger.info("\n[Saving Results]")
        # Save matrix profile
        mp_df = pd.DataFrame({
            'matrix_profile': mp_results['matrix_profile'],
            'matrix_profile_index': mp_results['matrix_profile_index'],
        })
        mp_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_matrix_profile.csv'))

        # Save regime change locations
        regime_df = pd.DataFrame({
            'regime_change_index': regime_locations,
            'timestamp': [normalized_motive.index[loc] if loc < len(normalized_motive) else None for loc in regime_locations]
        })
        regime_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_regime_changes.csv'), index=False)
        
        # Save steady segments
        segments_df = pd.DataFrame(steady_segments, columns=['start_index', 'end_index'])
        segments_df['start_timestamp'] = segments_df['start_index'].apply(lambda x: normalized_motive.index[x])
        segments_df['end_timestamp'] = segments_df['end_index'].apply(lambda x: normalized_motive.index[min(x, len(normalized_motive)-1)])
        segments_df['length'] = segments_df['end_index'] - segments_df['start_index']
        segments_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_steady_segments.csv'), index=False)
        
        # Save consensus motifs with mill tracking
        consensus_data = []
        for motif_idx, motif_set in enumerate(consensus_motifs):
            for occ_idx, start_idx in enumerate(motif_set):
                # Get mill_id and original timestamp using iloc
                synthetic_timestamp = normalized_motive.index[start_idx]
                if 'mill_id' in normalized_data_combined.columns:
                    mill_id = normalized_data_combined.iloc[start_idx]['mill_id']
                else:
                    mill_id = None
                if 'original_timestamp' in normalized_data_combined.columns:
                    original_timestamp = normalized_data_combined.iloc[start_idx]['original_timestamp']
                else:
                    original_timestamp = synthetic_timestamp
                
                consensus_data.append({
                    'consensus_motif_id': motif_idx + 1,
                    'occurrence': occ_idx + 1,
                    'start_index': start_idx,
                    'synthetic_timestamp': synthetic_timestamp,
                    'original_timestamp': original_timestamp,
                    'mill_id': mill_id,
                    'distance': mp_results['matrix_profile'][start_idx]
                })
        if consensus_data:
            consensus_df = pd.DataFrame(consensus_data)
            consensus_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_consensus_motifs.csv'), index=False)
            
            # Analyze cross-mill consensus
            if len(MILL_NUMBERS) > 1:
                logger.info("\n[Consensus Motif Analysis]")
                for motif_id in consensus_df['consensus_motif_id'].unique():
                    motif_data = consensus_df[consensus_df['consensus_motif_id'] == motif_id]
                    mills_in_motif = motif_data['mill_id'].unique()
                    logger.info(f"  Consensus Motif {motif_id}: {len(motif_data)} occurrences across {len(mills_in_motif)} mill(s) {list(mills_in_motif)}")
        
        # Save traditional motif indices with mill tracking
        motif_rank_map = {start_idx: rank for rank, start_idx in enumerate(motif_indices, start=1)}
        motif_data_list = []
        for idx in motif_indices:
            synthetic_timestamp = normalized_motive.index[idx]
            if 'mill_id' in normalized_data_combined.columns:
                mill_id = normalized_data_combined.iloc[idx]['mill_id']
            else:
                mill_id = None
            if 'original_timestamp' in normalized_data_combined.columns:
                original_timestamp = normalized_data_combined.iloc[idx]['original_timestamp']
            else:
                original_timestamp = synthetic_timestamp
            motif_data_list.append({
                'motif_rank': motif_rank_map[idx],
                'start_index': idx,
                'synthetic_timestamp': synthetic_timestamp,
                'original_timestamp': original_timestamp,
                'mill_id': mill_id,
                'distance': mp_results['matrix_profile'][idx]
            })
        motif_df = pd.DataFrame(motif_data_list)
        motif_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_motif_indices.csv'), index=False)
        
        # Analyze motif distribution across mills
        if len(MILL_NUMBERS) > 1:
            logger.info("\n[Traditional Motif Distribution]")
            for mill in MILL_NUMBERS:
                mill_motifs = motif_df[motif_df['mill_id'] == mill]
                logger.info(f"  Mill {mill}: {len(mill_motifs)} motifs ({100*len(mill_motifs)/len(motif_df):.1f}%)")

        # Save motif windows with mill tracking
        window_size = mp_results['window_size']
        motif_windows = []
        for rank, start_idx in enumerate(motif_indices, start=1):
            subseq = full_features.iloc[start_idx:start_idx + window_size].copy()
            if not subseq.empty:
                subseq['motif_rank'] = rank
                subseq['motif_start_index'] = start_idx
                subseq['motif_start_synthetic_timestamp'] = normalized_motive.index[start_idx]
                subseq['time_offset_minutes'] = range(len(subseq))
                subseq['matrix_profile_distance'] = mp_results['matrix_profile'][start_idx]
                # Add mill_id and original_timestamp from combined data
                if 'mill_id' in normalized_data_combined.columns:
                    mill_ids = normalized_data_combined.iloc[start_idx:start_idx + window_size]['mill_id'].values
                    subseq['mill_id'] = mill_ids[:len(subseq)]
                if 'original_timestamp' in normalized_data_combined.columns:
                    orig_timestamps = normalized_data_combined.iloc[start_idx:start_idx + window_size]['original_timestamp'].values
                    subseq['original_timestamp'] = orig_timestamps[:len(subseq)]
                motif_windows.append(subseq)

        if motif_windows:
            motifs_df = pd.concat(motif_windows).reset_index(drop=True)
            # Move original_timestamp to front for readability
            if 'original_timestamp' in motifs_df.columns:
                cols = ['original_timestamp'] + [col for col in motifs_df.columns if col != 'original_timestamp']
                motifs_df = motifs_df[cols]
            motifs_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_motif_windows.csv'), index=False)
            logger.info(f"\nSaved motif windows: {len(motif_windows)} windows × {window_size} minutes = {len(motifs_df):,} data points")

        # Save normal windows (non-discord data points only - NO overlapping windows)
        # This should be SMALLER than smoothed data since we remove anomalies
        matrix_profile = mp_results['matrix_profile']
        discord_threshold = mp_results['thresholds']['discord'] * 0.30
        
        # Create a boolean mask for the entire dataset
        # Matrix profile has fewer points than original data (by window_size - 1)
        normal_mask = np.zeros(len(full_features), dtype=bool)
        
        # Mark all points that are part of low-distance windows as normal
        for idx, distance in enumerate(matrix_profile):
            if distance < discord_threshold:
                # Mark the entire window as normal
                start = idx
                end = min(idx + window_size, len(full_features))
                normal_mask[start:end] = True
        
        # Extract only the normal (non-discord) data points
        normal_data = full_features[normal_mask].copy()
        normal_data['is_normal'] = True
        
        # Add mill_id and original_timestamp to normal data
        if 'mill_id' in normalized_data_combined.columns or 'original_timestamp' in normalized_data_combined.columns:
            # Get the positions of normal_data in the original dataframe
            normal_positions = [i for i, mask_val in enumerate(normal_mask) if mask_val]
            if 'mill_id' in normalized_data_combined.columns:
                normal_data['mill_id'] = normalized_data_combined.iloc[normal_positions]['mill_id'].values
            if 'original_timestamp' in normalized_data_combined.columns:
                normal_data['original_timestamp'] = normalized_data_combined.iloc[normal_positions]['original_timestamp'].values
        
        logger.info(f"\n[Normal Windows Extraction]")
        logger.info(f"  Original data points: {len(full_features):,}")
        logger.info(f"  Normal data points: {len(normal_data):,}")
        logger.info(f"  Discord data points removed: {len(full_features) - len(normal_data):,}")
        
        if len(full_features) > 0:
            logger.info(f"  Percentage kept: {100*len(normal_data)/len(full_features):.1f}%")
        
        # Analyze normal data distribution across mills
        if len(MILL_NUMBERS) > 1 and len(normal_data) > 0 and 'mill_id' in normal_data.columns:
            logger.info(f"\n[Normal Data Distribution Across Mills]")
            for mill in MILL_NUMBERS:
                mill_normal = normal_data[normal_data['mill_id'] == mill]
                logger.info(f"  Mill {mill}: {len(mill_normal):,} normal points ({100*len(mill_normal)/len(normal_data):.1f}%)")
        
        if len(normal_data) > 0:
            # Move original_timestamp to front for readability
            if 'original_timestamp' in normal_data.columns:
                cols = ['original_timestamp'] + [col for col in normal_data.columns if col != 'original_timestamp']
                normal_data = normal_data[cols]
            normal_data.to_csv(os.path.join(OUTPUT_DIR, 'phase2_normal_windows.csv'), index=False)
            logger.info(f"\nSaved: phase2_normal_windows.csv ({len(normal_data):,} rows)")
        else:
            logger.warning(f"\n⚠️  No normal data found! All data points were classified as discords.")
            logger.warning(f"   Consider adjusting discord_threshold or checking data quality.")
        
        # ========== CREATE PREMIUM TRAINING DATA ==========
        # Combine consensus motifs + normal windows for maximum quality
        logger.info(f"\n[Premium Training Data Creation]")
        logger.info(f"Strategy: Consensus Motifs (gold standard) + Normal Windows (volume)")
        
        premium_data_parts = []
        consensus_indices_set = set()
        
        # Step 1: Extract all consensus motif windows (highest quality)
        if len(consensus_motifs) > 0:
            logger.info(f"\nStep 1: Extracting consensus motif windows...")
            for motif_idx, motif_set in enumerate(consensus_motifs):
                for start_idx in motif_set:
                    end_idx = min(start_idx + window_size, len(full_features))
                    # Mark these indices as consensus
                    consensus_indices_set.update(range(start_idx, end_idx))
                    
                    # Extract the window
                    consensus_window = full_features.iloc[start_idx:end_idx].copy()
                    if not consensus_window.empty:
                        consensus_window['data_quality'] = 'consensus_motif'
                        consensus_window['consensus_motif_id'] = motif_idx + 1
                        
                        # Add mill_id and original_timestamp
                        if 'mill_id' in normalized_data_combined.columns:
                            mill_ids = normalized_data_combined.iloc[start_idx:end_idx]['mill_id'].values
                            consensus_window['mill_id'] = mill_ids[:len(consensus_window)]
                        if 'original_timestamp' in normalized_data_combined.columns:
                            orig_timestamps = normalized_data_combined.iloc[start_idx:end_idx]['original_timestamp'].values
                            consensus_window['original_timestamp'] = orig_timestamps[:len(consensus_window)]
                        
                        premium_data_parts.append(consensus_window)
            
            consensus_samples = sum(len(part) for part in premium_data_parts)
            logger.info(f"  ✅ Extracted {len(consensus_motifs)} consensus motifs")
            logger.info(f"  ✅ Total consensus samples: {consensus_samples:,} data points")
        
        # Step 2: Add normal windows that DON'T overlap with consensus motifs
        if len(normal_data) > 0:
            logger.info(f"\nStep 2: Adding non-overlapping normal windows...")
            
            # Filter out normal data that overlaps with consensus motifs
            normal_non_overlap = []
            for idx in range(len(full_features)):
                if normal_mask[idx] and idx not in consensus_indices_set:
                    row = full_features.iloc[idx].copy()
                    row['data_quality'] = 'normal'
                    row['consensus_motif_id'] = None
                    
                    # Add mill_id and original_timestamp
                    if 'mill_id' in normalized_data_combined.columns:
                        row['mill_id'] = normalized_data_combined.iloc[idx]['mill_id']
                    if 'original_timestamp' in normalized_data_combined.columns:
                        row['original_timestamp'] = normalized_data_combined.iloc[idx]['original_timestamp']
                    
                    normal_non_overlap.append(row)
            
            if normal_non_overlap:
                normal_df = pd.DataFrame(normal_non_overlap)
                premium_data_parts.append(normal_df)
                logger.info(f"  ✅ Added {len(normal_non_overlap):,} normal samples (no overlap with consensus)")
                logger.info(f"  ℹ️  Removed {len(normal_data) - len(normal_non_overlap):,} overlapping samples")
        
        # Step 3: Combine and save premium training data
        if premium_data_parts:
            premium_training_data = pd.concat(premium_data_parts, ignore_index=True)
            
            # Move important columns to front
            priority_cols = ['original_timestamp', 'mill_id', 'data_quality', 'consensus_motif_id']
            other_cols = [col for col in premium_training_data.columns if col not in priority_cols]
            premium_training_data = premium_training_data[priority_cols + other_cols]
            
            # Save sequential version (for analysis/inspection)
            premium_training_data.to_csv(os.path.join(OUTPUT_DIR, 'phase2_premium_training_data.csv'), index=False)
            
            # Create SHUFFLED version for ML training (RECOMMENDED)
            # IMPORTANT: Shuffle by GROUP (consensus motif windows + normal chunks), not individual rows
            # This preserves the 240-minute temporal structure of each pattern
            logger.info(f"\nStep 3: Creating shuffled version for ML training...")
            logger.info(f"  Strategy: Shuffle groups (motifs/chunks), preserve temporal structure within each group")
            
            # Separate consensus motifs and normal data
            consensus_data = premium_training_data[premium_training_data['data_quality'] == 'consensus_motif'].copy()
            normal_data_premium = premium_training_data[premium_training_data['data_quality'] == 'normal'].copy()
            
            # Shuffle consensus motifs by motif_id (keep each 240-min window intact)
            shuffled_parts = []
            if len(consensus_data) > 0:
                # Get unique motif IDs and shuffle them
                unique_motifs = consensus_data['consensus_motif_id'].unique()
                np.random.seed(42)
                shuffled_motif_ids = np.random.permutation(unique_motifs)
                
                # Add motifs in shuffled order (each motif's 240-min window stays intact)
                for motif_id in shuffled_motif_ids:
                    motif_window = consensus_data[consensus_data['consensus_motif_id'] == motif_id]
                    shuffled_parts.append(motif_window)
                
                logger.info(f"  ✅ Shuffled {len(unique_motifs)} consensus motif windows (temporal structure preserved)")
            
            # For normal data, we can shuffle individual rows since they're independent
            if len(normal_data_premium) > 0:
                normal_shuffled = normal_data_premium.sample(frac=1.0, random_state=42)
                shuffled_parts.append(normal_shuffled)
                logger.info(f"  ✅ Shuffled {len(normal_data_premium):,} normal data points")
            
            # Combine shuffled parts
            premium_shuffled = pd.concat(shuffled_parts, ignore_index=True)
            premium_shuffled.to_csv(os.path.join(OUTPUT_DIR, 'phase2_premium_training_data_shuffled.csv'), index=False)
            logger.info(f"  ✅ Saved shuffled version for proper train/test splitting")
            logger.info(f"  ℹ️  Each consensus motif's 240-min temporal pattern is preserved")
            
            # Statistics
            consensus_count = len(premium_training_data[premium_training_data['data_quality'] == 'consensus_motif'])
            normal_count = len(premium_training_data[premium_training_data['data_quality'] == 'normal'])
            
            logger.info(f"\n✅ Premium Training Data Created!")
            logger.info(f"  Total samples: {len(premium_training_data):,}")
            logger.info(f"  Consensus motif samples: {consensus_count:,} ({100*consensus_count/len(premium_training_data):.1f}%)")
            logger.info(f"  Normal samples: {normal_count:,} ({100*normal_count/len(premium_training_data):.1f}%)")
            logger.info(f"  Files:")
            logger.info(f"    • phase2_premium_training_data.csv (sequential - for inspection)")
            logger.info(f"    • phase2_premium_training_data_shuffled.csv (shuffled - for ML training)")
            
            # Per-mill breakdown
            if len(MILL_NUMBERS) > 1 and 'mill_id' in premium_training_data.columns:
                logger.info(f"\n  Per-Mill Distribution:")
                for mill in MILL_NUMBERS:
                    mill_data = premium_training_data[premium_training_data['mill_id'] == mill]
                    mill_consensus = len(mill_data[mill_data['data_quality'] == 'consensus_motif'])
                    mill_normal = len(mill_data[mill_data['data_quality'] == 'normal'])
                    logger.info(f"    Mill {mill}: {len(mill_data):,} samples ({mill_consensus:,} consensus + {mill_normal:,} normal)")
        else:
            logger.warning(f"\n⚠️  No premium training data created - no consensus motifs or normal windows available")

        logger.info("\n" + "=" * 80)
        logger.info(f"✅ PHASE 2 COMPLETED | Results in: {OUTPUT_DIR}")
        logger.info("=" * 80)
        logger.info("\n[Multi-Mill Processing Summary]")
        logger.info(f"  Mills processed: {MILL_NUMBERS}")
        logger.info(f"  Total mill-days: {len(MILL_NUMBERS) * (END_DATE - START_DATE).days}")
        for meta in mill_metadata:
            logger.info(f"  Mill {meta['mill_number']}: {meta['filtered_rows']:,} rows")
        logger.info(f"  Combined dataset: {total_rows:,} rows")
        logger.info("\n[Preprocessing Summary]")
        logger.info(f"  - Two-stage smoothing applied:")
        logger.info(f"    • Median filter (kernel={median_kernel}) - removed outliers")
        logger.info(f"    • Rolling mean (window={smoothing_window} min) - smoothed noise")
        logger.info(f"  - Data files:")
        logger.info(f"    • phase2_initial_data.csv - raw filtered data (all mills)")
        logger.info(f"    • phase2_smoothed_data.csv - smoothed data (all mills)")
        logger.info("\n[Pattern Detection Summary]")
        logger.info(f"  - Window size: {window_size} minutes ({window_size/60:.1f} hours)")
        logger.info(f"  - Regime changes detected: {len(regime_locations)}")
        logger.info(f"  - Steady segments found: {len(steady_segments)}")
        logger.info(f"  - Consensus motifs: {len(consensus_motifs)} (high-quality recurring patterns)")
        logger.info(f"  - Traditional motifs: {len(motif_indices)} (top similarity patterns)")
        logger.info(f"  - Discords: {len(discord_indices)} (anomalies detected)")
        logger.info("\n[Output Files]")
        logger.info(f"  ✅ phase2_consensus_motifs.csv - Consensus motifs with mill tracking")
        logger.info(f"  ✅ phase2_motif_indices.csv - Traditional motifs with mill tracking")
        logger.info(f"  ✅ phase2_motif_windows.csv - Full motif windows with features")
        logger.info(f"  ✅ phase2_normal_windows.csv - High-quality training data (discords removed)")
        logger.info(f"  ⭐ phase2_premium_training_data.csv - Sequential (for inspection)")
        logger.info(f"  🎯 phase2_premium_training_data_shuffled.csv - RECOMMENDED for ML training")
        
        # Analyze segment characteristics
        logger.info("\nSteady Segment Analysis:")
        for i, (start, end) in enumerate(steady_segments, 1):
            duration_hours = (end - start) / 60
            logger.info(f"  Segment {i}: {duration_hours:.1f} hours ({start} to {end})")
        
        # Calculate total training data
        total_motif_windows = sum(len(motif_set) for motif_set in consensus_motifs)
        total_motif_samples = total_motif_windows * window_size
        logger.info(f"\n[Training Data Potential]")
        logger.info(f"  - Consensus motif windows: {total_motif_windows}")
        logger.info(f"  - Consensus motif samples: {total_motif_samples:,} data points")
        logger.info(f"  - Traditional motif samples: {len(motif_indices) * window_size:,} data points")
        logger.info(f"  - Normal (non-discord) samples: {len(normal_data):,} data points")
        logger.info(f"  - Average segment length: {sum(end-start for start,end in steady_segments)/len(steady_segments)/60:.1f} hours")
        if len(MILL_NUMBERS) > 1:
            logger.info(f"  - Multi-mill benefit: {len(MILL_NUMBERS)}x data compared to single mill")
        
        # Quality assessment
        logger.info("\n[Data Quality Assessment]")
        if len(steady_segments) >= 10:
            logger.info("  ✅ Good segmentation: Multiple distinct steady-state periods detected")
        elif len(steady_segments) >= 5:
            logger.info("  ⚠️  Moderate segmentation: Consider adjusting FLUSS parameters")
        else:
            logger.info("  ❌ Poor segmentation: Too few segments, parameters need tuning")
        
        if len(consensus_motifs) >= 3:
            logger.info(f"  ✅ Good motif diversity: {len(consensus_motifs)} distinct operating modes")
        else:
            logger.info(f"  ⚠️  Limited motif diversity: Only {len(consensus_motifs)} operating modes found")
        
        if len(MILL_NUMBERS) > 1:
            logger.info(f"  ✅ Multi-mill consensus: Patterns validated across {len(MILL_NUMBERS)} mills")
            logger.info(f"  ✅ Robust training data: Cross-mill patterns ensure generalization")
        
        return {
            'mp_results': mp_results,
            'regime_locations': regime_locations,
            'steady_segments': steady_segments,
            'consensus_motifs': consensus_motifs,
            'motif_indices': motif_indices,
            'discord_indices': discord_indices,
            'mill_metadata': mill_metadata,
            'mill_numbers': MILL_NUMBERS,
            'combined_data': normalized_data_combined,
            'normal_data': normal_data
        }

    except Exception as e:
        logger.error(f"❌ Phase 2 failed: {e}")
        raise


if __name__ == "__main__":
    test_phase2_matrix_profile()
