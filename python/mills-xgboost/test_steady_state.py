"""
Test Script for Steady-State Detection System

Tests the complete steady-state processing pipeline with real mill data.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

import pandas as pd
from datetime import datetime, timedelta
import numpy as np

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
    mill_number = 6
    end_date = datetime.now()
    start_date = end_date - timedelta(days=105)  # Last 30 days
    
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
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
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
        
        # Quick variability analysis
        print(f"\n📊 Data Variability Analysis (key variables):")
        key_vars = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp', 'DensityHC', 'PressureHC', 'PulpHC']
        for var in key_vars:
            if var in raw_df.columns:
                mean_val = raw_df[var].mean()
                std_val = raw_df[var].std()
                cv = (std_val / mean_val * 100) if mean_val != 0 else 0
                print(f"   {var:15s}: mean={mean_val:8.2f}, std={std_val:8.2f}, CV={cv:5.1f}%")
        
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
        # First, try with VERY RELAXED criteria to see if we can find anything
        print(f"\n🔍 Testing with RELAXED criteria first (diagnostic)...")
        relaxed_config = SteadyStateConfig(
            window_minutes=30,  # Very short window
            buffer_minutes=10,  # Very short buffer
            min_samples_per_window=15,  # Few samples
            enable_quality_filters=False  # Disable quality filters for now
        )
        
        # Quick test with relaxed config - only MVs and CVs
        mv_vars_test = list(relaxed_config.mv_criteria.keys())
        cv_vars_test = list(relaxed_config.cv_criteria.keys())
        vars_to_check_test = mv_vars_test + cv_vars_test
        available_vars_test = [col for col in vars_to_check_test if col in raw_df.columns]
        print(f"   Testing with {len(available_vars_test)} variables (MVs+CVs): {available_vars_test}")
        
        from app.database.steady_state_detector import SteadyStateDetector
        test_detector = SteadyStateDetector(relaxed_config)
        test_mask, test_diag = test_detector.detect(raw_df, available_vars_test)
        
        print(f"   Relaxed test result: {test_diag['final_stable_periods']} stable periods found")
        print(f"   ({test_diag['stable_percentage']:.1f}% of data)")
        
        if test_diag['final_stable_periods'] == 0:
            print(f"\n⚠️  WARNING: Even with relaxed criteria, no steady-state found!")
            print(f"   This suggests the process is highly variable.")
            print(f"   Recommendation: Review data quality or adjust thresholds further.")
        
        print(f"\n📋 Now testing with STANDARD criteria (updated defaults)...")
        
        # Use the updated DEFAULT_CONFIG (adjusted based on real data)
        config = DEFAULT_CONFIG
        
        print(f"\n  ℹ️  Using adjusted default configuration based on your process data:")
        print(f"     - Thresholds calibrated to actual CV% values")
        print(f"     - Window sizes optimized for your mill operation")
        
        print(f"\nConfiguration:")
        print(f"  Window: {config.window_minutes} min")
        print(f"  Buffer: {config.buffer_minutes} min")
        print(f"  Total: {config.total_window_minutes} min")
        print(f"  Min samples: {config.min_samples_per_window}")
        
        # Only check MVs and CVs (the variables we control and measure)
        # Exclude DVs (disturbance variables) and Targets for simpler criteria
        mv_vars = list(config.mv_criteria.keys())
        cv_vars = list(config.cv_criteria.keys())
        vars_to_check = mv_vars + cv_vars
        
        available_vars = [col for col in vars_to_check if col in raw_df.columns]
        
        print(f"\n  Variables for stability check (MVs + CVs only):")
        print(f"    MVs configured: {mv_vars}")
        print(f"    CVs configured: {cv_vars}")
        print(f"    Total to check: {len(vars_to_check)} variables")
        print(f"    Available in data: {len(available_vars)} variables")
        print(f"    Available: {available_vars}")
        
        missing_vars = [col for col in vars_to_check if col not in raw_df.columns]
        if missing_vars:
            print(f"    Missing: {missing_vars}")
        
        print(f"\n  ℹ️  Note: Excluding DVs and Targets from stability check for simplicity")
        
        # Add detailed debugging before processing
        print(f"\n  🔍 Debug: Running detailed detection to identify failure point...")
        from app.database.steady_state_detector import SteadyStateDetector
        debug_detector = SteadyStateDetector(config)
        
        # Step-by-step detection
        print(f"\n  Step 1: Multi-dimensional stability check...")
        stability_mask = debug_detector.detect_steady_state_periods(raw_df, available_vars)
        print(f"    Result: {stability_mask.sum()} stable periods")
        
        print(f"\n  Step 2: Temporal continuity check ({config.buffer_minutes} min buffer)...")
        continuous_mask = debug_detector.check_temporal_continuity(raw_df, stability_mask)
        print(f"    Result: {continuous_mask.sum()} continuous stable periods")
        print(f"    Lost: {stability_mask.sum() - continuous_mask.sum()} periods (not sustained)")
        
        print(f"\n  Step 3: Quality filtering...")
        final_mask = debug_detector.filter_quality_issues(raw_df, continuous_mask)
        print(f"    Result: {final_mask.sum()} final stable periods")
        print(f"    Lost: {continuous_mask.sum() - final_mask.sum()} periods (quality issues)")
        
        if final_mask.sum() > 0:
            print(f"\n  ✅ Found {final_mask.sum()} stable timestamps - proceeding with extraction...")
            
            # Show how many distinct windows this represents
            from app.database.steady_state_extractor import SteadyStateExtractor
            extractor = SteadyStateExtractor(config)
            windows = extractor.identify_steady_state_windows(raw_df, final_mask)
            print(f"  📊 These {final_mask.sum()} timestamps form {len(windows)} distinct steady-state windows")
            if windows:
                durations = [(end - start).total_seconds() / 60 for start, end in windows]
                print(f"     Window durations: min={min(durations):.1f} min, max={max(durations):.1f} min, mean={np.mean(durations):.1f} min")
                print(f"     After splitting long windows, expect ~{len(windows)} samples")
        else:
            print(f"\n  ❌ No stable periods after all checks")
            print(f"\n  💡 Diagnosis:")
            if stability_mask.sum() == 0:
                print(f"     Problem: Multi-dimensional stability check too strict")
                print(f"     Solution: Relax individual variable thresholds")
            elif continuous_mask.sum() == 0:
                print(f"     Problem: Temporal continuity check ({config.buffer_minutes} min) too strict")
                print(f"     Solution: Reduce buffer_minutes or window_minutes")
            elif final_mask.sum() == 0:
                print(f"     Problem: Quality filters removing all data")
                print(f"     Solution: Disable quality filters or check for NaN/outliers")
        
        # Process to steady-state
        steady_state_df, diagnostics = process_to_steady_state_with_diagnostics(
            df=raw_df,
            config=config,
            variables_to_check=available_vars,  # Only check available variables
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
        print(f"\nExtraction mode: {'Individual Timestamps' if 'window_id' in steady_state_df.columns else 'Aggregated Windows'}")
        
        if 'window_id' in steady_state_df.columns:
            # Individual timestamp mode
            print(f"\nFirst 3 rows (with original timestamps):")
            display_cols = ['TimeStamp', 'window_id', 'Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp', 'DensityHC', 'PressureHC', 'PulpHC']
            available_display_cols = [col for col in display_cols if col in steady_state_df.columns]
            print(steady_state_df[available_display_cols].head(3).to_string())
            
            print(f"\n📅 Time Coverage Analysis:")
            total_duration = (raw_df.index.max() - raw_df.index.min()).total_seconds() / 60
            steady_state_duration = len(steady_state_df)  # Each row is 1 minute
            coverage_pct = (steady_state_duration / total_duration) * 100
            print(f"  Total time period: {total_duration:.0f} min ({total_duration/60:.1f} hours)")
            print(f"  Steady-state time: {steady_state_duration:.0f} min ({steady_state_duration/60:.1f} hours)")
            print(f"  Coverage: {coverage_pct:.1f}% of total time")
            print(f"  Excluded: {100-coverage_pct:.1f}% (transients, unstable periods)")
            
            print(f"\n  Number of distinct windows: {steady_state_df['window_id'].nunique()}")
            if 'TimeStamp' in steady_state_df.columns:
                print(f"  First timestamp: {steady_state_df['TimeStamp'].min()}")
                print(f"  Last timestamp:  {steady_state_df['TimeStamp'].max()}")
                print(f"  Data spans: {(steady_state_df['TimeStamp'].max() - steady_state_df['TimeStamp'].min()).days} days")
                print(f"  TimeStamp is a regular column (first column in CSV)")
        else:
            # Aggregated mode
            display_cols = ['sample_id', 'window_start', 'window_end', 'window_duration_min', 
                           'stability_score', 'Ore', 'WaterMill', 'MotorAmp', 'DensityHC']
            available_display_cols = [col for col in display_cols if col in steady_state_df.columns]
            print(steady_state_df[available_display_cols].head(3).to_string())
            
            print(f"\n📅 Time Coverage Analysis:")
            total_duration = (raw_df.index.max() - raw_df.index.min()).total_seconds() / 60
            steady_state_duration = steady_state_df['window_duration_min'].sum()
            coverage_pct = (steady_state_duration / total_duration) * 100
            print(f"  Total time period: {total_duration:.0f} min ({total_duration/60:.1f} hours)")
            print(f"  Steady-state time: {steady_state_duration:.0f} min ({steady_state_duration/60:.1f} hours)")
            print(f"  Coverage: {coverage_pct:.1f}% of total time")
            print(f"  Excluded: {100-coverage_pct:.1f}% (transients, unstable periods)")
            
            print(f"\n  First sample: {steady_state_df['window_start'].min()}")
            print(f"  Last sample:  {steady_state_df['window_end'].max()}")
            print(f"  Samples span: {(steady_state_df['window_end'].max() - steady_state_df['window_start'].min()).days} days")
        
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
    
    # Save the final steady-state DataFrame to CSV
    if not steady_state_df.empty:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"steady_state_data_mill8_{timestamp}.csv"
        
        # Save without index since TimeStamp is now a regular column
        steady_state_df.to_csv(output_file, index=False)
        print(f"\n✅ Final steady-state data saved to: {output_file}")
        print(f"   Rows: {len(steady_state_df):,}")
        print(f"   Columns: {len(steady_state_df.columns)}")
        print(f"   TimeStamp is the first column")
        print(f"   Ready for model training!")


def test_custom_config():
    """Test with custom configuration (relaxed criteria)"""
    
    print("\n\n")
    print("="*80)
    print("VARIABLE SELECTION STRATEGY")
    print("="*80)
    
    from app.database.steady_state_config import DEFAULT_CONFIG
    
    print(f"\n📋 Configured Variables (from mills-parameters):")
    print(f"\n  MVs (Manipulated Variables - what we control):")
    for var_name, criteria in DEFAULT_CONFIG.mv_criteria.items():
        print(f"    • {var_name:15s}: std < {criteria.rolling_std_threshold_pct}%")
    
    print(f"\n  CVs (Controlled Variables - what we measure):")
    for var_name, criteria in DEFAULT_CONFIG.cv_criteria.items():
        if criteria.rolling_std_threshold_abs:
            print(f"    • {var_name:15s}: std < {criteria.rolling_std_threshold_abs} (absolute)")
        else:
            print(f"    • {var_name:15s}: std < {criteria.rolling_std_threshold_pct}%")
    
    print(f"\n  ℹ️  Strategy: Check only MVs + CVs for steady-state")
    print(f"     - DVs (disturbance variables) excluded - they change slowly")
    print(f"     - Targets excluded - they're outputs, not control criteria")
    
    print("\n" + "="*80)
    print("ALTERNATIVE CONFIGURATIONS")
    print("="*80)
    
    # More relaxed configuration
    print(f"\n💡 If you get too few samples, try relaxed configuration:")
    print(f"   - Shorter window: 45 min (vs 60 min)")
    print(f"   - Shorter buffer: 15 min (vs 30 min)")
    print(f"   - Total: 60 min (vs 90 min)")
    print(f"   Expected: More samples with slightly lower quality")
    
    print(f"\n💡 If you want highest quality, try strict configuration:")
    print(f"   - Longer window: 90 min (vs 60 min)")
    print(f"   - Longer buffer: 45 min (vs 30 min)")
    print(f"   - Total: 135 min (vs 90 min)")
    print(f"   Expected: Fewer samples with highest quality")


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
