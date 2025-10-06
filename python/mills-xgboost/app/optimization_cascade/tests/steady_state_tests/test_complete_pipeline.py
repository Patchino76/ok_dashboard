"""
Complete Pipeline Test: All 5 Phases

Tests the complete steady-state extraction pipeline from data preparation
through to final dataset extraction for cascade model training.
"""

import sys
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import logging

# Setup paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from database.db_connector import MillsDataConnector
from optimization_cascade.steady_state_extraction.data_preparation import DataPreparation
from optimization_cascade.steady_state_extraction.matrix_profile import MatrixProfileComputer
from optimization_cascade.steady_state_extraction.motif_discovery import MotifDiscovery
from optimization_cascade.steady_state_extraction.motif_analysis import MotifAnalyzer
from optimization_cascade.steady_state_extraction.steady_state_extractor import SteadyStateExtractor
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


def plot_steady_state_overview(steady_state_df: pd.DataFrame,
                               original_data: pd.DataFrame,
                               title: str,
                               filename: str):
    """Plot overview of extracted steady-state data vs original"""
    
    # Select key features to plot
    features_to_plot = ['Ore', 'WaterMill', 'MotorAmp', 'DensityHC']
    available_features = [f for f in features_to_plot if f in steady_state_df.columns]
    
    if not available_features:
        logger.warning("No features available for plotting")
        return
    
    n_features = len(available_features)
    fig, axes = plt.subplots(n_features, 1, figsize=(16, 3*n_features))
    
    if n_features == 1:
        axes = [axes]
    
    for idx, feature in enumerate(available_features):
        # Plot original data
        axes[idx].plot(original_data.index, original_data[feature],
                      linewidth=0.5, alpha=0.3, color='gray', label='Original Data')
        
        # Plot steady-state points
        axes[idx].scatter(steady_state_df['timestamp'], steady_state_df[feature],
                         c=steady_state_df['quality_score'], cmap='RdYlGn',
                         s=50, alpha=0.8, edgecolors='black', linewidth=0.5,
                         label='Steady-State Points')
        
        axes[idx].set_ylabel(feature, fontsize=11, fontweight='bold')
        axes[idx].grid(True, alpha=0.3)
        axes[idx].legend(loc='upper right')
        
        if idx == 0:
            axes[idx].set_title(f'{feature} - Steady-State Extraction', fontsize=12, fontweight='bold')
    
    axes[-1].set_xlabel('Time', fontsize=11, fontweight='bold')
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()


def plot_regime_distribution(steady_state_df: pd.DataFrame,
                            title: str,
                            filename: str):
    """Plot distribution of operating regimes"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # Regime counts
    regime_counts = steady_state_df['regime_label'].value_counts()
    ax1.bar(range(len(regime_counts)), regime_counts.values, color='steelblue', alpha=0.7)
    ax1.set_xticks(range(len(regime_counts)))
    ax1.set_xticklabels(regime_counts.index, rotation=45, ha='right')
    ax1.set_ylabel('Number of Records', fontsize=11, fontweight='bold')
    ax1.set_title('Regime Distribution', fontsize=12, fontweight='bold')
    ax1.grid(True, alpha=0.3, axis='y')
    
    # Quality score by regime
    regime_quality = steady_state_df.groupby('regime_label')['quality_score'].mean().sort_values(ascending=False)
    ax2.bar(range(len(regime_quality)), regime_quality.values, color='green', alpha=0.7)
    ax2.set_xticks(range(len(regime_quality)))
    ax2.set_xticklabels(regime_quality.index, rotation=45, ha='right')
    ax2.set_ylabel('Average Quality Score', fontsize=11, fontweight='bold')
    ax2.set_title('Quality Score by Regime', fontsize=12, fontweight='bold')
    ax2.grid(True, alpha=0.3, axis='y')
    
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.98)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()


def test_complete_pipeline():
    """
    Test complete steady-state extraction pipeline
    """
    logger.info("=" * 100)
    logger.info("COMPLETE PIPELINE TEST: STEADY-STATE EXTRACTION FOR CASCADE MODELS")
    logger.info("=" * 100)
    
    # Configuration
    MILL_NUMBER = 8
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=3)  # 3 days for testing
    
    # Features
    MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
    CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
    DV_FEATURES = ['Shisti', 'Daiki', 'Grano']
    
    # Matrix profile settings
    RESIDENCE_TIME_MINUTES = 60
    
    # Motif discovery settings
    N_MOTIFS = 10
    DISTANCE_THRESHOLD = 2.0
    
    # Quality filters
    QUALITY_THRESHOLD = 0.5
    MIN_OCCURRENCES = 3
    
    logger.info(f"\nPipeline Configuration:")
    logger.info(f"  Mill: {MILL_NUMBER}")
    logger.info(f"  Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    logger.info(f"  MV Features: {MV_FEATURES}")
    logger.info(f"  CV Features: {CV_FEATURES}")
    logger.info(f"  DV Features: {DV_FEATURES}")
    logger.info(f"  Residence Time: {RESIDENCE_TIME_MINUTES} min")
    logger.info(f"  Number of Motifs: {N_MOTIFS}")
    logger.info(f"  Quality Threshold: {QUALITY_THRESHOLD}")
    
    try:
        # Initialize database
        logger.info("\n[Initialization] Connecting to database...")
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        # PHASE 1: Data Preparation
        logger.info("\n" + "=" * 100)
        logger.info("EXECUTING PHASE 1: DATA PREPARATION")
        logger.info("=" * 100)
        
        data_prep = DataPreparation(db_connector)
        clean_data, normalized_data, scaler = data_prep.prepare_for_stumpy(
            mill_number=MILL_NUMBER,
            start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            mv_features=MV_FEATURES,
            cv_features=CV_FEATURES,
            dv_features=DV_FEATURES,
            resample_freq='1min'
        )
        
        # PHASE 2: Matrix Profile Computation
        logger.info("\n" + "=" * 100)
        logger.info("EXECUTING PHASE 2: MATRIX PROFILE COMPUTATION")
        logger.info("=" * 100)
        
        mp_computer = MatrixProfileComputer()
        mp_results = mp_computer.compute_mp_with_auto_window(
            data=normalized_data,
            residence_time_minutes=RESIDENCE_TIME_MINUTES,
            sampling_freq_minutes=1
        )
        
        # PHASE 3: Motif Discovery
        logger.info("\n" + "=" * 100)
        logger.info("EXECUTING PHASE 3: MOTIF DISCOVERY")
        logger.info("=" * 100)
        
        motif_discovery = MotifDiscovery()
        motifs = motif_discovery.discover_motifs(
            data=normalized_data,
            matrix_profile=mp_results['matrix_profile'],
            matrix_profile_index=mp_results['matrix_profile_index'],
            window_size=mp_results['window_size'],
            k=N_MOTIFS,
            distance_threshold=DISTANCE_THRESHOLD
        )
        
        # PHASE 4: Motif Analysis
        logger.info("\n" + "=" * 100)
        logger.info("EXECUTING PHASE 4: MOTIF ANALYSIS & VALIDATION")
        logger.info("=" * 100)
        
        motif_analyzer = MotifAnalyzer()
        analysis_results = motif_analyzer.analyze_all_motifs(
            motifs=motifs,
            data=normalized_data,
            mv_features=MV_FEATURES,
            cv_features=CV_FEATURES,
            dv_features=DV_FEATURES
        )
        
        # PHASE 5: Steady State Extraction
        logger.info("\n" + "=" * 100)
        logger.info("EXECUTING PHASE 5: STEADY STATE EXTRACTION")
        logger.info("=" * 100)
        
        ss_extractor = SteadyStateExtractor()
        steady_state_df = ss_extractor.extract_all_motifs(
            motifs=motifs,
            data=normalized_data,
            original_data=clean_data,
            regime_labels=motif_analyzer.regime_labels,
            quality_threshold=QUALITY_THRESHOLD,
            min_occurrences=MIN_OCCURRENCES
        )
        
        # Generate final visualizations
        logger.info("\n[Final Visualization] Generating pipeline summary plots...")
        
        if not steady_state_df.empty:
            # Plot 1: Steady-state overview
            logger.info("  Creating steady-state overview...")
            plot_steady_state_overview(
                steady_state_df,
                clean_data,
                f'Mill {MILL_NUMBER} - Steady-State Extraction Overview',
                'pipeline_steady_state_overview.png'
            )
            
            # Plot 2: Regime distribution
            logger.info("  Creating regime distribution...")
            plot_regime_distribution(
                steady_state_df,
                f'Mill {MILL_NUMBER} - Operating Regime Distribution',
                'pipeline_regime_distribution.png'
            )
        
        # Save final results
        logger.info("\n[Saving Results] Saving final steady-state dataset...")
        
        output_csv = os.path.join(OUTPUT_DIR, f'steady_state_data_mill{MILL_NUMBER}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
        ss_extractor.save_steady_state_data(output_csv)
        
        # Get summary statistics
        summary = ss_extractor.get_summary_statistics()
        
        # Save summary report
        report_path = os.path.join(OUTPUT_DIR, 'pipeline_summary_report.txt')
        with open(report_path, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("STEADY-STATE EXTRACTION PIPELINE SUMMARY REPORT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"Mill Number: {MILL_NUMBER}\n")
            f.write(f"Date Range: {START_DATE} to {END_DATE}\n")
            f.write(f"Total Records Extracted: {summary['total_records']}\n\n")
            
            f.write("Regime Distribution:\n")
            for regime, count in summary['regime_distribution'].items():
                f.write(f"  {regime}: {count} records\n")
            
            f.write(f"\nQuality Statistics:\n")
            f.write(f"  Mean: {summary['quality_stats']['mean']:.3f}\n")
            f.write(f"  Min: {summary['quality_stats']['min']:.3f}\n")
            f.write(f"  Max: {summary['quality_stats']['max']:.3f}\n")
            
            f.write(f"\nExtraction Metadata:\n")
            for key, value in summary['extraction_metadata'].items():
                f.write(f"  {key}: {value}\n")
        
        logger.info(f"✅ Summary report saved: {report_path}")
        
        # Final summary
        logger.info("\n" + "=" * 100)
        logger.info("COMPLETE PIPELINE TEST FINISHED SUCCESSFULLY")
        logger.info("=" * 100)
        logger.info(f"\n📊 RESULTS SUMMARY:")
        logger.info(f"  ✅ Total steady-state records extracted: {len(steady_state_df)}")
        logger.info(f"  ✅ Operating regimes identified: {len(steady_state_df['regime_label'].unique())}")
        logger.info(f"  ✅ Average quality score: {steady_state_df['quality_score'].mean():.3f}")
        logger.info(f"  ✅ Date coverage: {steady_state_df['timestamp'].min()} to {steady_state_df['timestamp'].max()}")
        
        logger.info(f"\n📁 OUTPUT FILES:")
        logger.info(f"  - {output_csv}")
        logger.info(f"  - {report_path}")
        logger.info(f"  - pipeline_steady_state_overview.png")
        logger.info(f"  - pipeline_regime_distribution.png")
        
        logger.info(f"\n🎯 NEXT STEPS:")
        logger.info(f"  1. Review extracted steady-state data quality")
        logger.info(f"  2. Validate regime labels match process knowledge")
        logger.info(f"  3. Use steady-state data for cascade model training")
        logger.info(f"  4. Compare model performance with/without steady-state filtering")
        
        return steady_state_df, summary
        
    except Exception as e:
        logger.error(f"\n❌ ERROR in pipeline execution: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


if __name__ == "__main__":
    test_complete_pipeline()
