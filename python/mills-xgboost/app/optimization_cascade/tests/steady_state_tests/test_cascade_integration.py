"""
Test Cascade Integration with Steady-State Extraction

Tests the complete integration of steady-state extraction with cascade model training.
Compares model performance with and without steady-state filtering.
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
from optimization_cascade.cascade_training_with_steady_state import CascadeTrainingWithSteadyState
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


def plot_model_comparison(comparison_results: dict, filename: str):
    """Plot comparison of model performance"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # Extract metrics
    with_ss = comparison_results['with_steady_state']['training_results']
    without_ss = comparison_results['without_steady_state']['training_results']
    
    # Quality model comparison
    if 'quality_model' in with_ss and 'quality_model' in without_ss:
        r2_with = with_ss['quality_model'].get('r2_score', 0)
        r2_without = without_ss['quality_model'].get('r2_score', 0)
        rmse_with = with_ss['quality_model'].get('rmse', 0)
        rmse_without = without_ss['quality_model'].get('rmse', 0)
        
        # R² comparison
        ax1.bar(['Baseline\n(All Data)', 'Steady-State\n(Filtered)'], 
               [r2_without, r2_with],
               color=['gray', 'green'], alpha=0.7)
        ax1.set_ylabel('R² Score', fontsize=11, fontweight='bold')
        ax1.set_title('Quality Model - R² Score', fontsize=12, fontweight='bold')
        ax1.grid(True, alpha=0.3, axis='y')
        ax1.set_ylim([0, 1])
        
        # Add value labels
        for i, v in enumerate([r2_without, r2_with]):
            ax1.text(i, v + 0.02, f'{v:.3f}', ha='center', fontweight='bold')
        
        # RMSE comparison
        ax2.bar(['Baseline\n(All Data)', 'Steady-State\n(Filtered)'],
               [rmse_without, rmse_with],
               color=['gray', 'green'], alpha=0.7)
        ax2.set_ylabel('RMSE', fontsize=11, fontweight='bold')
        ax2.set_title('Quality Model - RMSE', fontsize=12, fontweight='bold')
        ax2.grid(True, alpha=0.3, axis='y')
        
        # Add value labels
        for i, v in enumerate([rmse_without, rmse_with]):
            ax2.text(i, v + max(rmse_without, rmse_with)*0.02, f'{v:.3f}', 
                    ha='center', fontweight='bold')
    
    plt.suptitle('Model Performance Comparison: Baseline vs Steady-State', 
                fontsize=14, fontweight='bold', y=0.98)
    plt.tight_layout()
    
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    logger.info(f"Saved plot: {filepath}")
    plt.close()


def test_cascade_integration():
    """
    Test cascade model training with steady-state extraction
    """
    logger.info("=" * 100)
    logger.info("TESTING CASCADE INTEGRATION WITH STEADY-STATE EXTRACTION")
    logger.info("=" * 100)
    
    # Configuration
    MILL_NUMBER = 8
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=5)  # 5 days for testing
    
    # Features
    MV_FEATURES = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
    CV_FEATURES = ['PulpHC', 'DensityHC', 'PressureHC']
    DV_FEATURES = ['Shisti', 'Daiki', 'Grano']
    TARGET_VARIABLE = 'PSI200'
    
    # Steady-state extraction settings
    RESIDENCE_TIME = 60
    N_MOTIFS = 10
    QUALITY_THRESHOLD = 0.5
    MIN_OCCURRENCES = 3
    
    logger.info(f"\nTest Configuration:")
    logger.info(f"  Mill: {MILL_NUMBER}")
    logger.info(f"  Date Range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    logger.info(f"  Target: {TARGET_VARIABLE}")
    logger.info(f"  MV Features: {MV_FEATURES}")
    logger.info(f"  CV Features: {CV_FEATURES}")
    logger.info(f"  DV Features: {DV_FEATURES}")
    
    try:
        # Initialize
        logger.info("\n[Initialization] Setting up training system...")
        
        db_connector = MillsDataConnector(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        
        # Create model save directory
        model_save_path = os.path.join(OUTPUT_DIR, 'cascade_models_test')
        os.makedirs(model_save_path, exist_ok=True)
        
        training_system = CascadeTrainingWithSteadyState(
            db_connector=db_connector,
            model_save_path=model_save_path
        )
        
        # Option 1: Train with steady-state extraction only
        logger.info("\n" + "=" * 100)
        logger.info("OPTION 1: TRAINING WITH STEADY-STATE EXTRACTION")
        logger.info("=" * 100)
        
        # Extract steady-state data
        steady_state_df = training_system.extract_steady_state_data(
            mill_number=MILL_NUMBER,
            start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
            mv_features=MV_FEATURES,
            cv_features=CV_FEATURES,
            dv_features=DV_FEATURES,
            residence_time_minutes=RESIDENCE_TIME,
            n_motifs=N_MOTIFS,
            quality_threshold=QUALITY_THRESHOLD,
            min_occurrences=MIN_OCCURRENCES
        )
        
        # Save steady-state data
        ss_data_path = os.path.join(OUTPUT_DIR, f'steady_state_mill{MILL_NUMBER}_cascade.csv')
        training_system.ss_extractor.save_steady_state_data(ss_data_path)
        
        # Train cascade models
        if len(steady_state_df) > 50:  # Need minimum data for training
            results = training_system.train_cascade_models(
                mill_number=MILL_NUMBER,
                target_variable=TARGET_VARIABLE,
                mv_features=MV_FEATURES,
                cv_features=CV_FEATURES,
                dv_features=DV_FEATURES,
                test_size=0.2,
                model_suffix='steady_state'
            )
            
            logger.info("\n✅ Training with steady-state extraction complete!")
            logger.info(f"   Model saved to: {results['model_save_path']}")
        else:
            logger.warning(f"\n⚠️ Insufficient steady-state data ({len(steady_state_df)} records)")
            logger.warning("   Need at least 50 records for training")
            results = None
        
        # Option 2: Train with comparison (if enough data)
        if results and len(steady_state_df) > 100:
            logger.info("\n" + "=" * 100)
            logger.info("OPTION 2: TRAINING WITH COMPARISON")
            logger.info("=" * 100)
            
            comparison_results = training_system.train_with_comparison(
                mill_number=MILL_NUMBER,
                start_date=START_DATE.strftime('%Y-%m-%d %H:%M:%S'),
                end_date=END_DATE.strftime('%Y-%m-%d %H:%M:%S'),
                target_variable=TARGET_VARIABLE,
                mv_features=MV_FEATURES,
                cv_features=CV_FEATURES,
                dv_features=DV_FEATURES,
                residence_time_minutes=RESIDENCE_TIME,
                n_motifs=N_MOTIFS,
                quality_threshold=QUALITY_THRESHOLD,
                min_occurrences=MIN_OCCURRENCES
            )
            
            # Plot comparison
            logger.info("\n[Visualization] Creating comparison plots...")
            plot_model_comparison(
                comparison_results,
                'cascade_integration_comparison.png'
            )
            
            # Save comparison report
            report_path = os.path.join(OUTPUT_DIR, 'cascade_integration_report.txt')
            with open(report_path, 'w') as f:
                f.write("=" * 80 + "\n")
                f.write("CASCADE INTEGRATION TEST REPORT\n")
                f.write("=" * 80 + "\n\n")
                
                f.write(f"Mill Number: {MILL_NUMBER}\n")
                f.write(f"Date Range: {START_DATE} to {END_DATE}\n")
                f.write(f"Target Variable: {TARGET_VARIABLE}\n\n")
                
                f.write("STEADY-STATE EXTRACTION:\n")
                f.write(f"  Total records extracted: {len(steady_state_df)}\n")
                f.write(f"  Quality threshold: {QUALITY_THRESHOLD}\n")
                f.write(f"  Minimum occurrences: {MIN_OCCURRENCES}\n\n")
                
                f.write("PERFORMANCE IMPROVEMENT:\n")
                for metric, improvement in comparison_results['improvement'].items():
                    f.write(f"  {metric}: {improvement:+.2%}\n")
            
            logger.info(f"✅ Comparison report saved: {report_path}")
        
        # Final summary
        logger.info("\n" + "=" * 100)
        logger.info("CASCADE INTEGRATION TEST COMPLETE")
        logger.info("=" * 100)
        
        logger.info(f"\n📊 RESULTS:")
        logger.info(f"  ✅ Steady-state data extracted: {len(steady_state_df)} records")
        logger.info(f"  ✅ Data saved to: {ss_data_path}")
        if results:
            logger.info(f"  ✅ Models trained and saved")
            logger.info(f"  ✅ Model path: {results['model_save_path']}")
        
        logger.info(f"\n🎯 NEXT STEPS:")
        logger.info(f"  1. Review steady-state data quality and regime labels")
        logger.info(f"  2. Test cascade predictions with new models")
        logger.info(f"  3. Compare prediction accuracy vs baseline models")
        logger.info(f"  4. Adjust quality thresholds if needed")
        logger.info(f"  5. Deploy to production if performance improves")
        
        return results
        
    except Exception as e:
        logger.error(f"\n❌ ERROR in cascade integration test: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise


if __name__ == "__main__":
    test_cascade_integration()
