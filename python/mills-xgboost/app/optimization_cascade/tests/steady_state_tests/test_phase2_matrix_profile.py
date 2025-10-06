"""
Test Phase 2: Matrix Profile Computation

Tests the matrix profile computation and generates visualizations
to show patterns, motifs, and discords in the data.
"""

import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import logging

# Setup paths
MILLS_XGBOOST_ROOT = Path(__file__).resolve().parents[4]

if str(MILLS_XGBOOST_ROOT) not in sys.path:
    sys.path.append(str(MILLS_XGBOOST_ROOT))

from app.database.db_connector import MillsDataConnector
from app.optimization_cascade.steady_state_extraction.data_preparation import DataPreparation
from app.optimization_cascade.steady_state_extraction.matrix_profile import MatrixProfileComputer
from config.settings import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def plot_matrix_profile(data: pd.DataFrame, 
                       mp_results: dict,
                       title: str,
                       filename: str):
    """Plot matrix profile with original data"""
    
    matrix_profile = mp_results['matrix_profile']
    window_size = mp_results['window_size']
    
    fig, axes = plt.subplots(2, 1, figsize=(16, 10))
    
    # Plot 1: Original data (first feature as reference)
    first_feature = data.columns[0]
    axes[0].plot(data.index, data[first_feature], linewidth=0.5, alpha=0.7, color='blue')
    axes[0].set_ylabel(f'{first_feature}\n(Normalized)', fontsize=11, fontweight='bold')
    axes[0].set_title(f'Reference Time Series: {first_feature}', fontsize=12, fontweight='bold')
    axes[0].grid(True, alpha=0.3)
    
    # Plot 2: Matrix Profile
    # Create time index for matrix profile (shifted by window_size)
    mp_index = data.index[window_size-1:window_size-1+len(matrix_profile)]
    
    axes[1].plot(mp_index, matrix_profile, linewidth=1, alpha=0.8, color='red')
    axes[1].set_ylabel('Distance', fontsize=11, fontweight='bold')
    axes[1].set_xlabel('Time', fontsize=11, fontweight='bold')
    axes[1].set_title('Matrix Profile (Lower = More Similar Patterns)', fontsize=12, fontweight='bold')
    axes[1].grid(True, alpha=0.3)
    
    # Add threshold lines
    motif_threshold = mp_results['thresholds']['motif']
    discord_threshold = mp_results['thresholds']['discord']
    
    axes[1].axhline(y=motif_threshold, color='green', linestyle='--', 
                   linewidth=2, alpha=0.7, label=f'Motif threshold ({motif_threshold:.2f})')
    axes[1].axhline(y=discord_threshold, color='orange', linestyle='--',
                   linewidth=2, alpha=0.7, label=f'Discord threshold ({discord_threshold:.2f})')
    axes[1].legend(loc='upper right')
    
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def plot_motifs(data: pd.DataFrame,
               motif_indices: list,
               window_size: int,
               title: str,
               filename: str,
               max_motifs: int = 5):
    """Plot top motif patterns"""
    
    n_motifs = min(len(motif_indices), max_motifs)
    n_features = len(data.columns)
    
    fig, axes = plt.subplots(n_features, n_motifs, figsize=(4*n_motifs, 3*n_features))
    
    if n_features == 1:
        axes = axes.reshape(1, -1)
    if n_motifs == 1:
        axes = axes.reshape(-1, 1)
    
    for motif_idx, start_idx in enumerate(motif_indices[:n_motifs]):
        subsequence = data.iloc[start_idx:start_idx+window_size]
        
        for feat_idx, feature in enumerate(data.columns):
            ax = axes[feat_idx, motif_idx]
            ax.plot(range(window_size), subsequence[feature].values, 
                   linewidth=2, alpha=0.8, color='green')
            
            if motif_idx == 0:
                ax.set_ylabel(feature, fontsize=10, fontweight='bold')
            
            if feat_idx == 0:
                timestamp = data.index[start_idx]
                ax.set_title(f'Motif {motif_idx+1}\n{timestamp}', 
                           fontsize=10, fontweight='bold')
            
            ax.grid(True, alpha=0.3)
            ax.set_xlabel('Time (min)', fontsize=9)
    
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def plot_discords(data: pd.DataFrame,
                 discord_indices: list,
                 window_size: int,
                 title: str,
                 filename: str,
                 max_discords: int = 5):
    """Plot top discord patterns (anomalies)"""
    
    n_discords = min(len(discord_indices), max_discords)
    n_features = len(data.columns)
    
    fig, axes = plt.subplots(n_features, n_discords, figsize=(4*n_discords, 3*n_features))
    
    if n_features == 1:
        axes = axes.reshape(1, -1)
    if n_discords == 1:
        axes = axes.reshape(-1, 1)
    
    for discord_idx, start_idx in enumerate(discord_indices[:n_discords]):
        subsequence = data.iloc[start_idx:start_idx+window_size]
        
        for feat_idx, feature in enumerate(data.columns):
            ax = axes[feat_idx, discord_idx]
            ax.plot(range(window_size), subsequence[feature].values,
                   linewidth=2, alpha=0.8, color='red')
            
            if discord_idx == 0:
                ax.set_ylabel(feature, fontsize=10, fontweight='bold')
            
            if feat_idx == 0:
                timestamp = data.index[start_idx]
                ax.set_title(f'Discord {discord_idx+1}\n{timestamp}',
                           fontsize=10, fontweight='bold')
            
            ax.grid(True, alpha=0.3)
            ax.set_xlabel('Time (min)', fontsize=9)
    
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def plot_mp_histogram(mp_results: dict, title: str, filename: str):
    """Plot matrix profile distance distribution"""
    
    matrix_profile = mp_results['matrix_profile']
    stats = mp_results['statistics']
    thresholds = mp_results['thresholds']
    
    fig, ax = plt.subplots(figsize=(12, 6))
    
    # Histogram
    ax.hist(matrix_profile, bins=100, alpha=0.7, edgecolor='black', color='steelblue')
    
    # Add statistics lines
    ax.axvline(stats['mean'], color='blue', linestyle='--', linewidth=2, 
              label=f"Mean: {stats['mean']:.3f}")
    ax.axvline(stats['median'], color='purple', linestyle='--', linewidth=2,
              label=f"Median: {stats['median']:.3f}")
    ax.axvline(thresholds['motif'], color='green', linestyle='--', linewidth=2,
              label=f"Motif threshold: {thresholds['motif']:.3f}")
    ax.axvline(thresholds['discord'], color='red', linestyle='--', linewidth=2,
              label=f"Discord threshold: {thresholds['discord']:.3f}")
    
    ax.set_xlabel('Matrix Profile Distance', fontsize=12, fontweight='bold')
    ax.set_ylabel('Frequency', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.legend(loc='upper right', fontsize=10)
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def test_phase2_matrix_profile():
    """
    Test Phase 2: Matrix Profile Computation
    """
    logger.info("=" * 100)
    logger.info("TESTING PHASE 2: MATRIX PROFILE COMPUTATION")
    logger.info("=" * 100)
    
    # Configuration
    MILL_NUMBER = 8
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=3)  # 3 days for faster computation
    
    # Features to analyze
    MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
    CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
    
    # Matrix profile settings
    RESIDENCE_TIME_MINUTES = 60  # Typical mill residence time
    
    logger.info(f"\nTest Configuration:")
    logger.info(f"  Mill Number: {MILL_NUMBER}")
    logger.info(f"  Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    logger.info(f"  Features: {MV_FEATURES + CV_FEATURES}")
    logger.info(f"  Residence Time: {RESIDENCE_TIME_MINUTES} minutes")
    
    try:
        # Phase 1: Prepare data
        logger.info("\n" + "=" * 80)
        logger.info("Running Phase 1: Data Preparation")
        logger.info("=" * 80)
        
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        data_prep = DataPreparation(db_connector)
        clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
            mill_number=MILL_NUMBER,
            start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            mv_features=MV_FEATURES,
            cv_features=CV_FEATURES,
            dv_features=None,
            resample_freq='1min'
        )
        
        # Phase 2: Compute matrix profile
        logger.info("\n" + "=" * 80)
        logger.info("Running Phase 2: Matrix Profile Computation")
        logger.info("=" * 80)
        
        mp_computer = MatrixProfileComputer()
        mp_results = mp_computer.compute_mp_with_auto_window(
            data=normalized_data,
            residence_time_minutes=RESIDENCE_TIME_MINUTES,
            sampling_freq_minutes=1
        )
        
        # Find motifs and discords
        logger.info("\n[Finding Patterns] Extracting motifs and discords...")
        motif_indices = mp_computer.find_top_motifs(k=10)
        discord_indices = mp_computer.find_top_discords(k=10)
        
        # Generate visualizations
        logger.info("\n[Visualization] Generating plots...")
        
        # Plot 1: Matrix profile overview
        logger.info("  Creating matrix profile overview...")
        plot_matrix_profile(
            normalized_data,
            mp_results,
            f'Mill {MILL_NUMBER} - Matrix Profile Overview (Phase 2)',
            'phase2_matrix_profile_overview.png'
        )
        
        # Plot 2: Matrix profile histogram
        logger.info("  Creating matrix profile histogram...")
        plot_mp_histogram(
            mp_results,
            f'Mill {MILL_NUMBER} - Matrix Profile Distance Distribution',
            'phase2_mp_histogram.png'
        )
        
        # Plot 3: Top motifs
        logger.info("  Creating motif patterns plot...")
        plot_motifs(
            normalized_data,
            motif_indices,
            mp_results['window_size'],
            f'Mill {MILL_NUMBER} - Top 5 Motif Patterns (Recurring Steady States)',
            'phase2_top_motifs.png',
            max_motifs=5
        )
        
        # Plot 4: Top discords
        logger.info("  Creating discord patterns plot...")
        plot_discords(
            normalized_data,
            discord_indices,
            mp_results['window_size'],
            f'Mill {MILL_NUMBER} - Top 5 Discord Patterns (Anomalies)',
            'phase2_top_discords.png',
            max_discords=5
        )
        
        logger.info("✅ All visualizations generated")
        
        # Save results
        logger.info("\n[Saving Results] Saving matrix profile data...")
        
        # Save matrix profile
        mp_df = pd.DataFrame({
            'matrix_profile': mp_results['matrix_profile'],
            'matrix_profile_index': mp_results['matrix_profile_index']
        })
        mp_path = os.path.join(OUTPUT_DIR, 'phase2_matrix_profile.csv')
        mp_df.to_csv(mp_path)
        logger.info(f"✅ Matrix profile saved: {mp_path}")
        
        # Save motif indices
        motif_df = pd.DataFrame({
            'motif_rank': range(1, len(motif_indices)+1),
            'start_index': motif_indices,
            'timestamp': [normalized_data.index[idx] for idx in motif_indices],
            'distance': [mp_results['matrix_profile'][idx] for idx in motif_indices]
        })
        motif_path = os.path.join(OUTPUT_DIR, 'phase2_motif_indices.csv')
        motif_df.to_csv(motif_path, index=False)
        logger.info(f"✅ Motif indices saved: {motif_path}")
        
        # Final summary
        logger.info("\n" + "=" * 100)
        logger.info("PHASE 2 TEST COMPLETED SUCCESSFULLY")
        logger.info("=" * 100)
        logger.info(f"\nResults saved to: {OUTPUT_DIR}")
        logger.info(f"  - phase2_matrix_profile_overview.png")
        logger.info(f"  - phase2_mp_histogram.png")
        logger.info(f"  - phase2_top_motifs.png")
        logger.info(f"  - phase2_top_discords.png")
        logger.info(f"  - phase2_matrix_profile.csv")
        logger.info(f"  - phase2_motif_indices.csv")
        logger.info("\n✅ Ready for Phase 3: Motif Discovery & Analysis")
        
        return mp_results, motif_indices, discord_indices
        
    except Exception as e:
        logger.error(f"\n❌ ERROR in Phase 2 testing: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    test_phase2_matrix_profile()
