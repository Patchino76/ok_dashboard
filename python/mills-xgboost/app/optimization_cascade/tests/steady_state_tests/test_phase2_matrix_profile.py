"""
Test Phase 2: Matrix Profile Computation

Tests the matrix profile computation and generates visualizations
to show patterns, motifs, and discords in the data.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import logging

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

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
    color_map = plt.cm.get_cmap('viridis', len(motif_indices))

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


def test_phase2_matrix_profile() -> tuple:
    """Test Phase 2: Matrix Profile Computation."""

    logger.info("=" * 80)
    logger.info("PHASE 2: MATRIX PROFILE COMPUTATION")
    logger.info("=" * 80)

    MILL_NUMBER = 6
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=114)
    MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
    CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
    MOTIVE_FEATURES = ['Ore', 'WaterZumpf', 'DensityHC']
    RESIDENCE_TIME_MINUTES = 60

    logger.info(f"Mill {MILL_NUMBER} | {START_DATE:%Y-%m-%d} to {END_DATE:%Y-%m-%d} | Residence: {RESIDENCE_TIME_MINUTES}min")

    try:
        logger.info("\n[Data Preparation]")
        db_connector = MillsDataConnector(
            host=settings.DB_HOST, port=settings.DB_PORT, dbname=settings.DB_NAME,
            user=settings.DB_USER, password=settings.DB_PASSWORD
        )

        data_prep = DataPreparation(db_connector)
        clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
            mill_number=MILL_NUMBER,
            start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            mv_features=MV_FEATURES,
            cv_features=CV_FEATURES,
            dv_features=None,
            resample_freq='1min',
        )

        clean_data.to_csv(os.path.join(OUTPUT_DIR, 'phase2_initial_data.csv'), index_label='TimeStamp')

        # Apply filters
        initial_rows = len(clean_data)
        filter_mask = (clean_data['Ore'] > 160) & (clean_data['DensityHC'] > 1600) & (clean_data['WaterMill'] > 
                        10) & (clean_data['DensityHC'] < 1800)

        clean_data = clean_data.loc[filter_mask].copy()
        normalized_data = normalized_data.loc[filter_mask].copy()
        logger.info(f"Filtered: {initial_rows} → {len(clean_data)} rows (Ore>160, DensityHC>1600, WaterMill>10)")

        normalized_motive = normalized_data[MOTIVE_FEATURES]
        full_features = normalized_data[MV_FEATURES + CV_FEATURES]

        logger.info("\n[Matrix Profile Computation]")
        mp_computer = MatrixProfileComputer()
        mp_results = mp_computer.compute_mp_with_auto_window(
            data=normalized_motive,
            residence_time_minutes=RESIDENCE_TIME_MINUTES,
            sampling_freq_minutes=1,
        )

        motif_indices = mp_computer.find_top_motifs(k=10)
        discord_indices = mp_computer.find_top_discords(k=10)
        logger.info(f"Found {len(motif_indices)} motifs, {len(discord_indices)} discords")

        logger.info("\n[Generating Visualizations]")
        plot_matrix_profile(normalized_motive, mp_results, f'Mill {MILL_NUMBER} - Matrix Profile Overview', 'phase2_matrix_profile_overview.png')
        plot_mp_histogram(mp_results, f'Mill {MILL_NUMBER} - Matrix Profile Distance Distribution', 'phase2_mp_histogram.png')
        plot_motifs(normalized_motive, motif_indices, mp_results['window_size'], f'Mill {MILL_NUMBER} - Top 5 Motif Patterns', 'phase2_top_motifs.png', max_motifs=5)
        plot_overlapped_motifs(normalized_motive, motif_indices, mp_results['window_size'], f'Mill {MILL_NUMBER} - Overlapped Motif Windows', 'phase2_motif_overlays.png')
        plot_discords(normalized_motive, discord_indices, mp_results['window_size'], f'Mill {MILL_NUMBER} - Top 5 Discord Patterns', 'phase2_top_discords.png', max_discords=5)

        logger.info("\n[Saving Results]")
        # Save matrix profile
        mp_df = pd.DataFrame({
            'matrix_profile': mp_results['matrix_profile'],
            'matrix_profile_index': mp_results['matrix_profile_index'],
        })
        mp_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_matrix_profile.csv'))

        # Save motif indices
        motif_rank_map = {start_idx: rank for rank, start_idx in enumerate(motif_indices, start=1)}
        motif_df = pd.DataFrame({
            'motif_rank': [motif_rank_map[idx] for idx in motif_indices],
            'start_index': motif_indices,
            'timestamp': [normalized_motive.index[idx] for idx in motif_indices],
            'distance': [mp_results['matrix_profile'][idx] for idx in motif_indices],
        })
        motif_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_motif_indices.csv'), index=False)

        # Save motif windows
        window_size = mp_results['window_size']
        motif_windows = []
        for rank, start_idx in enumerate(motif_indices, start=1):
            subseq = full_features.iloc[start_idx:start_idx + window_size].copy()
            if not subseq.empty:
                subseq['motif_rank'] = rank
                subseq['motif_start_index'] = start_idx
                subseq['motif_start_timestamp'] = normalized_motive.index[start_idx]
                subseq['time_offset_minutes'] = range(len(subseq))
                subseq['matrix_profile_distance'] = mp_results['matrix_profile'][start_idx]
                motif_windows.append(subseq)

        if motif_windows:
            motifs_df = pd.concat(motif_windows).sort_index()
            motifs_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_motif_windows.csv'), index_label='TimeStamp')

        # Save normal windows (motifs + low-distance windows)
        matrix_profile = mp_results['matrix_profile']
        discord_threshold = mp_results['thresholds']['discord'] * 0.55
        qualifying_indices = {idx for idx, distance in enumerate(matrix_profile) if distance < discord_threshold}
        qualifying_indices.update(motif_rank_map.keys())

        normal_windows = []
        last_added_idx = -window_size
        for start_idx in sorted(idx for idx in qualifying_indices if idx <= len(matrix_profile) - 1):
            is_motif_window = start_idx in motif_rank_map
            if not is_motif_window and start_idx - last_added_idx < window_size:
                continue

            subseq = full_features.iloc[start_idx:start_idx + window_size].copy()
            if len(subseq) == window_size:
                subseq['motif_rank'] = motif_rank_map.get(start_idx, pd.NA)
                subseq['motif_start_index'] = start_idx
                subseq['motif_start_timestamp'] = normalized_motive.index[start_idx]
                subseq['time_offset_minutes'] = range(len(subseq))
                subseq['window_category'] = 'motif' if is_motif_window else 'low_distance'
                subseq['matrix_profile_distance'] = matrix_profile[start_idx]
                normal_windows.append(subseq)
                if not is_motif_window:
                    last_added_idx = start_idx

        if normal_windows:
            normal_df = pd.concat(normal_windows).sort_index()
            normal_df = normal_df[list(full_features.columns) + ['matrix_profile_distance']]
            normal_df.to_csv(os.path.join(OUTPUT_DIR, 'phase2_normal_windows.csv'), index_label='TimeStamp')

        logger.info("\n" + "=" * 80)
        logger.info(f"✅ PHASE 2 COMPLETED | Results in: {OUTPUT_DIR}")
        logger.info("=" * 80)
        return mp_results, motif_indices, discord_indices

    except Exception as e:
        logger.error(f"❌ Phase 2 failed: {e}")
        raise


if __name__ == "__main__":
    test_phase2_matrix_profile()
