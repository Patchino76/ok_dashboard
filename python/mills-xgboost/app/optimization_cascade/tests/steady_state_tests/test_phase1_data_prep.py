"""
Test Phase 1: Data Preparation

Tests the data loading, cleaning, normalization pipeline
and generates visualizations to verify data quality.
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
from config.settings import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def plot_raw_data(data: pd.DataFrame, title: str, filename: str):
    """Plot raw time series data"""
    n_features = len(data.columns)
    fig, axes = plt.subplots(n_features, 1, figsize=(15, 3*n_features))
    
    if n_features == 1:
        axes = [axes]
    
    for idx, col in enumerate(data.columns):
        axes[idx].plot(data.index, data[col], linewidth=0.5, alpha=0.7)
        axes[idx].set_ylabel(col, fontsize=10, fontweight='bold')
        axes[idx].grid(True, alpha=0.7)
        axes[idx].set_title(f'{col} - Raw Data', fontsize=10)
    
    axes[-1].set_xlabel('Time', fontsize=10, fontweight='bold')
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def plot_normalized_data(data: pd.DataFrame, title: str, filename: str):
    """Plot normalized time series data"""
    n_features = len(data.columns)
    fig, axes = plt.subplots(n_features, 1, figsize=(15, 3*n_features))
    
    if n_features == 1:
        axes = [axes]
    
    for idx, col in enumerate(data.columns):
        axes[idx].plot(data.index, data[col], linewidth=0.5, alpha=0.7, color='green')
        axes[idx].set_ylabel(col, fontsize=10, fontweight='bold')
        axes[idx].grid(True, alpha=0.3)
        axes[idx].axhline(y=0, color='red', linestyle='--', alpha=0.5, linewidth=1)
        axes[idx].set_title(f'{col} - Normalized (mean=0, std=1)', fontsize=10)
    
    axes[-1].set_xlabel('Time', fontsize=10, fontweight='bold')
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def plot_correlation_matrix(data: pd.DataFrame, title: str, filename: str):
    """Plot correlation matrix heatmap"""
    fig, ax = plt.subplots(figsize=(10, 8))
    
    corr_matrix = data.corr()
    sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='coolwarm', 
                center=0, square=True, linewidths=1, ax=ax,
                cbar_kws={"shrink": 0.8})
    
    ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def plot_distributions(data: pd.DataFrame, title: str, filename: str):
    """Plot feature distributions"""
    n_features = len(data.columns)
    n_cols = 3
    n_rows = (n_features + n_cols - 1) // n_cols
    
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 4*n_rows))
    axes = axes.flatten() if n_features > 1 else [axes]
    
    for idx, col in enumerate(data.columns):
        axes[idx].hist(data[col].dropna(), bins=50, alpha=0.7, edgecolor='black')
        axes[idx].set_xlabel(col, fontsize=10, fontweight='bold')
        axes[idx].set_ylabel('Frequency', fontsize=10)
        axes[idx].grid(True, alpha=0.3)
        
        # Add statistics
        mean_val = data[col].mean()
        std_val = data[col].std()
        axes[idx].axvline(mean_val, color='red', linestyle='--', linewidth=2, label=f'Mean: {mean_val:.2f}')
        axes[idx].legend()
    
    # Hide unused subplots
    for idx in range(n_features, len(axes)):
        axes[idx].axis('off')
    
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()

def test_phase1_data_preparation():
    """
    Test Phase 1: Data Preparation
    """
    logger.info("=" * 100)
    logger.info("TESTING PHASE 1: DATA PREPARATION FOR STEADY STATE EXTRACTION")
    logger.info("=" * 100)
    
    # Configuration
    MILL_NUMBER = 8
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=7)  # Last 7 days
    
    # Features to analyze (key process variables)
    MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
    CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
    DV_FEATURES = ['Shisti', 'Daiki', 'Grano']
    
    logger.info(f"\nTest Configuration:")
    logger.info(f"  Mill Number: {MILL_NUMBER}")
    logger.info(f"  Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    logger.info(f"  MV Features: {MV_FEATURES}")
    logger.info(f"  CV Features: {CV_FEATURES}")
    logger.info(f"  DV Features: {DV_FEATURES}")
    
    try:
        # Initialize database connector
        logger.info("\n[1/6] Initializing database connection...")
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        logger.info("✅ Database connection established")
        
        # Initialize data preparation
        logger.info("\n[2/6] Initializing data preparation module...")
        data_prep = DataPreparation(db_connector)
        logger.info("✅ Data preparation module initialized")
        
        # Run complete preparation pipeline
        logger.info("\n[3/6] Running complete data preparation pipeline...")
        clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
            mill_number=MILL_NUMBER,
            start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            mv_features=MV_FEATURES,
            cv_features=CV_FEATURES,
            dv_features=DV_FEATURES,
            resample_freq='1min'
        )
        logger.info("✅ Data preparation pipeline completed")
        
        # Get data summary
        logger.info("\n[4/6] Generating data summary...")
        summary = data_prep.get_data_summary()
        logger.info(f"Data Summary:")
        logger.info(f"  Shape: {summary['shape']}")
        logger.info(f"  Duration: {summary['date_range']['duration_hours']:.1f} hours")
        logger.info(f"  Features: {summary['features']}")
        
        # Generate visualizations
        logger.info("\n[5/6] Generating visualizations...")
        
        # Plot 1: Raw data time series
        logger.info("  Creating raw data plots...")
        plot_raw_data(
            clean_data,
            f'Mill {MILL_NUMBER} - Raw Time Series Data (Phase 1)',
            'phase1_raw_data.png'
        )
        
        # Plot 2: Normalized data time series
        logger.info("  Creating normalized data plots...")
        plot_normalized_data(
            normalized_data,
            f'Mill {MILL_NUMBER} - Normalized Time Series Data (Phase 1)',
            'phase1_normalized_data.png'
        )
        
        # Plot 3: Correlation matrix
        logger.info("  Creating correlation matrix...")
        plot_correlation_matrix(
            clean_data,
            f'Mill {MILL_NUMBER} - Feature Correlation Matrix',
            'phase1_correlation_matrix.png'
        )
        
        # Plot 4: Feature distributions
        logger.info("  Creating distribution plots...")
        plot_distributions(
            clean_data,
            f'Mill {MILL_NUMBER} - Feature Distributions',
            'phase1_distributions.png'
        )
        
        logger.info("✅ All visualizations generated")
        
        # Save prepared data
        logger.info("\n[6/6] Saving prepared data...")
        clean_data_path = os.path.join(OUTPUT_DIR, 'phase1_clean_data.csv')
        normalized_data_path = os.path.join(OUTPUT_DIR, 'phase1_normalized_data.csv')
        
        clean_data.to_csv(clean_data_path)
        normalized_data.to_csv(normalized_data_path)
        
        logger.info(f"✅ Clean data saved: {clean_data_path}")
        logger.info(f"✅ Normalized data saved: {normalized_data_path}")
        
        # Final summary
        logger.info("\n" + "=" * 100)
        logger.info("PHASE 1 TEST COMPLETED SUCCESSFULLY")
        logger.info("=" * 100)
        logger.info(f"\nResults saved to: {OUTPUT_DIR}")
        logger.info(f"  - phase1_raw_data.png")
        logger.info(f"  - phase1_normalized_data.png")
        logger.info(f"  - phase1_correlation_matrix.png")
        logger.info(f"  - phase1_distributions.png")
        logger.info(f"  - phase1_clean_data.csv")
        logger.info(f"  - phase1_normalized_data.csv")
        logger.info("\n✅ Data is ready for Phase 2: Matrix Profile Computation")
        
        return clean_data, normalized_data, scaler
        
    except Exception as e:
        logger.error(f"\n❌ ERROR in Phase 1 testing: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    test_phase1_data_preparation()
