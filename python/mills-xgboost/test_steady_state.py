"""
Test Script for Steady-State Detection System

Tests the complete steady-state processing pipeline with real mill data.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

import pandas as pd
from datetime import datetime, timedelta

# Import database connector
from app.database.db_connector import MillsDataConnector

# Import steady-state modules
from app.database.steady_state_config import SteadyStateConfig, DEFAULT_CONFIG
from app.database.steady_state_detector import SteadyStateDetector
from app.database.steady_state_extractor import SteadyStateExtractor
from app.database.steady_state_processor import process_to_steady_state_with_diagnostics

# Import settings
from config.settings import settings


def test_steady_state_detection():
    """Test steady-state detection with real mill data"""
    
    print("="*80)
    print("STEADY-STATE DETECTION SYSTEM TEST")
    print("="*80)
    
    # Configuration
    mill_number = 8
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)  # Last 30 days
    
    print(f"\nTest Configuration:")
    print(f"  Mill: {mill_number}")
    print(f"  Date range: {start_date.date()} to {end_date.date()}")
    print(f"  Duration: 30 days")
    
    # Step 1: Load data from database
    print(f"\n{'='*80}")
    print("STEP 1: LOADING DATA FROM DATABASE")
    print("="*80)
    
    try:
        db_connector = MillsDataConnector(
            host=settings.db_host,
            port=settings.db_port,
            dbname=settings.db_name,
            user=settings.db_user,
            password=settings.db_password
        )
        
        raw_df = db_connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d'),
            resample_freq='1min',
            save_to_logs=False
        )
        
        if raw_df is None or raw_df.empty:
            print("❌ No data retrieved from database")
            return
        
        print(f"✅ Data loaded successfully:")
        print(f"   Rows: {len(raw_df):,}")
        print(f"   Columns: {len(raw_df.columns)}")
        print(f"   Date range: {raw_df.index.min()} to {raw_df.index.max()}")
        print(f"   Duration: {(raw_df.index.max() - raw_df.index.min()).days} days")
        print(f"\nColumns: {list(raw_df.columns)}")
        
    except Exception as e:
        print(f"❌ Error loading data: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Step 2: Process to steady-state
    print(f"\n{'='*80}")
    print("STEP 2: STEADY-STATE PROCESSING")
    print("="*80)
    
    try:
        # Create custom config for testing
        config = SteadyStateConfig(
            window_minutes=60,
            buffer_minutes=30,
            min_samples_per_window=30,
            enable_quality_filters=True
        )
        
        print(f"\nConfiguration:")
        print(f"  Window: {config.window_minutes} min")
        print(f"  Buffer: {config.buffer_minutes} min")
        print(f"  Total: {config.total_window_minutes} min")
        print(f"  Min samples: {config.min_samples_per_window}")
        
        # Process to steady-state
        steady_state_df, diagnostics = process_to_steady_state_with_diagnostics(
            df=raw_df,
            config=config,
            save_diagnostics=True  # Save diagnostic reports
        )
        
        print(f"\n✅ Steady-state processing complete!")
        
    except Exception as e:
        print(f"❌ Error in steady-state processing: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Step 3: Analyze results
    print(f"\n{'='*80}")
    print("STEP 3: RESULTS ANALYSIS")
    print("="*80)
    
    pipeline = diagnostics['pipeline']
    detection = diagnostics['detection']
    extraction = diagnostics['extraction']
    
    print(f"\n📊 Data Transformation:")
    print(f"  Input rows:        {pipeline['input_rows']:,}")
    print(f"  Output samples:    {pipeline['output_samples']:,}")
    print(f"  Reduction ratio:   {pipeline['data_reduction_ratio']:.4f} ({pipeline['data_reduction_ratio']*100:.2f}%)")
    
    print(f"\n🔍 Detection Results:")
    print(f"  Stable periods:    {detection['final_stable_periods']:,} ({detection['stable_percentage']:.1f}%)")
    print(f"  Variables checked: {len(detection['variables_checked'])}")
    print(f"  Variables: {', '.join(detection['variables_checked'][:5])}...")
    
    print(f"\n📈 Extraction Results:")
    print(f"  Mean stability score:  {extraction['mean_stability_score']:.3f}")
    print(f"  Mean window duration:  {extraction['mean_window_duration_min']:.1f} min")
    
    # Step 4: Data quality comparison
    print(f"\n{'='*80}")
    print("STEP 4: DATA QUALITY COMPARISON")
    print("="*80)
    
    if not steady_state_df.empty:
        print(f"\n📋 Steady-State Sample Statistics:")
        print(f"\nFirst 3 samples:")
        print(steady_state_df.head(3).to_string())
        
        # Compare variability
        if 'Ore' in raw_df.columns and 'Ore' in steady_state_df.columns:
            raw_std = raw_df['Ore'].std()
            ss_std = steady_state_df['Ore'].std()
            print(f"\n📉 Variability Reduction (Ore example):")
            print(f"  Raw data std:         {raw_std:.2f}")
            print(f"  Steady-state std:     {ss_std:.2f}")
            print(f"  Reduction:            {(1 - ss_std/raw_std)*100:.1f}%")
    
    # Step 5: Model training recommendation
    print(f"\n{'='*80}")
    print("STEP 5: MODEL TRAINING RECOMMENDATION")
    print("="*80)
    
    n_samples = pipeline['output_samples']
    
    if n_samples >= 500:
        print(f"\n✅ EXCELLENT: {n_samples:,} samples")
        print(f"   Recommendation: Proceed with model training")
        print(f"   Expected: Significant improvement in model generalization")
        print(f"   Quality: High-quality steady-state data")
    elif n_samples >= 200:
        print(f"\n✅ GOOD: {n_samples:,} samples")
        print(f"   Recommendation: Proceed with model training")
        print(f"   Expected: Good model performance")
        print(f"   Quality: Sufficient steady-state data")
    elif n_samples >= 100:
        print(f"\n⚠️  MARGINAL: {n_samples:,} samples")
        print(f"   Recommendation: Consider relaxing stability criteria OR extending date range")
        print(f"   Expected: Model may work but with limited generalization")
        print(f"   Quality: Minimal steady-state data")
    else:
        print(f"\n❌ INSUFFICIENT: {n_samples:,} samples")
        print(f"   Recommendation: Extend date range OR relax stability criteria")
        print(f"   Expected: Not enough data for reliable model training")
        print(f"   Quality: Too few steady-state samples")
    
    print(f"\n{'='*80}")
    print("TEST COMPLETE")
    print("="*80)
    print(f"\nDiagnostic reports saved to: logs/steady_state_diagnostics_*")
    print(f"Review the reports for detailed analysis and visualization")


def test_custom_config():
    """Test with custom configuration (relaxed criteria)"""
    
    print("\n\n")
    print("="*80)
    print("TESTING WITH RELAXED CRITERIA")
    print("="*80)
    
    # More relaxed configuration
    relaxed_config = SteadyStateConfig(
        window_minutes=45,  # Shorter window
        buffer_minutes=15,  # Shorter buffer
        min_samples_per_window=20,  # Fewer samples required
        enable_quality_filters=True
    )
    
    print(f"\nRelaxed Configuration:")
    print(f"  Window: {relaxed_config.window_minutes} min (vs 60 min default)")
    print(f"  Buffer: {relaxed_config.buffer_minutes} min (vs 30 min default)")
    print(f"  Total: {relaxed_config.total_window_minutes} min (vs 90 min default)")
    
    print(f"\nExpected: More steady-state samples with slightly lower quality")
    print(f"Use this if default config yields too few samples")


if __name__ == "__main__":
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " "*20 + "STEADY-STATE DETECTION TEST SUITE" + " "*24 + "║")
    print("╚" + "="*78 + "╝")
    
    # Run main test
    test_steady_state_detection()
    
    # Show alternative configuration
    test_custom_config()
    
    print("\n\n" + "="*80)
    print("NEXT STEPS:")
    print("="*80)
    print("""
1. Review diagnostic reports in logs/steady_state_diagnostics_*/
   - diagnostics.json: Detailed statistics
   - steady_state_samples.csv: Extracted samples

2. Train cascade model with steady-state data:
   
   POST /api/v1/ml/cascade/train
   {
     "mill_number": 8,
     "start_date": "2025-09-02",
     "end_date": "2025-10-02",
     "use_steady_state": true,
     "steady_state_window_min": 60,
     "steady_state_buffer_min": 30,
     "save_steady_state_diagnostics": true
   }

3. Compare model performance:
   - Train one model WITH steady-state extraction
   - Train one model WITHOUT steady-state extraction
   - Compare R² scores and generalization

4. Adjust configuration if needed:
   - Too few samples? Relax criteria (shorter window, lower thresholds)
   - Too many samples? Tighten criteria (longer window, stricter thresholds)
""")
    print("="*80)
