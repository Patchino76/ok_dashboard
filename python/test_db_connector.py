#!/usr/bin/env python3
"""
Test script to diagnose and fix database connector issues with duplicate timestamps
and data joining problems.
"""

import pandas as pd
import sys
import os
from datetime import datetime, timedelta

# Add the mills-xgboost directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'mills-xgboost'))

from app.database.db_connector import MillsDataConnector

def test_data_integrity():
    """Test data integrity and identify duplicate timestamp issues"""
    
    # Database configuration (same as your training request)
    db_config = {
        "host": "em-m-db4.ellatzite-med.com",
        "port": 5432,
        "dbname": "em_pulse_data",
        "user": "s.lyubenov",
        "password": "your_password_here"  # You'll need to provide this
    }
    
    # Test parameters (same as your training request)
    mill_number = 8
    start_date = "2025-06-10T06:00:00"
    end_date = "2025-07-27T22:00:00"
    
    print("=" * 60)
    print("DATABASE CONNECTOR INTEGRITY TEST")
    print("=" * 60)
    
    try:
        # Initialize connector
        connector = MillsDataConnector(**db_config)
        print("✓ Database connection established")
        
        # Test 1: Check raw mill data for duplicates
        print("\n1. TESTING RAW MILL DATA")
        print("-" * 30)
        
        mill_data = connector.get_mill_data(mill_number, start_date, end_date)
        print(f"Raw mill data shape: {mill_data.shape}")
        print(f"Mill data index type: {type(mill_data.index)}")
        print(f"Mill data date range: {mill_data.index.min()} to {mill_data.index.max()}")
        
        # Check for duplicate timestamps in mill data
        mill_duplicates = mill_data.index.duplicated().sum()
        print(f"Duplicate timestamps in mill data: {mill_duplicates}")
        
        if mill_duplicates > 0:
            print("⚠️  WARNING: Found duplicate timestamps in mill data!")
            duplicate_times = mill_data.index[mill_data.index.duplicated(keep=False)]
            print(f"First 5 duplicate timestamps: {duplicate_times[:5].tolist()}")
        else:
            print("✓ No duplicate timestamps in mill data")
            
        # Test 2: Check raw ore quality data for duplicates
        print("\n2. TESTING RAW ORE QUALITY DATA")
        print("-" * 30)
        
        ore_data = connector.get_ore_quality(start_date, end_date)
        print(f"Raw ore data shape: {ore_data.shape}")
        
        # Set timestamp as index for ore data if not already
        if 'TimeStamp' in ore_data.columns:
            ore_data_indexed = ore_data.set_index('TimeStamp')
        else:
            ore_data_indexed = ore_data
            
        print(f"Ore data index type: {type(ore_data_indexed.index)}")
        print(f"Ore data date range: {ore_data_indexed.index.min()} to {ore_data_indexed.index.max()}")
        
        # Check for duplicate timestamps in ore data
        ore_duplicates = ore_data_indexed.index.duplicated().sum()
        print(f"Duplicate timestamps in ore data: {ore_duplicates}")
        
        if ore_duplicates > 0:
            print("⚠️  WARNING: Found duplicate timestamps in ore data!")
            duplicate_times = ore_data_indexed.index[ore_data_indexed.index.duplicated(keep=False)]
            print(f"First 5 duplicate timestamps: {duplicate_times[:5].tolist()}")
        else:
            print("✓ No duplicate timestamps in ore data")
            
        # Test 3: Check processed mill data
        print("\n3. TESTING PROCESSED MILL DATA")
        print("-" * 30)
        
        processed_mill = connector.process_dataframe(mill_data, start_date, end_date, '1min', no_interpolation=False)
        print(f"Processed mill data shape: {processed_mill.shape}")
        
        mill_proc_duplicates = processed_mill.index.duplicated().sum()
        print(f"Duplicate timestamps in processed mill data: {mill_proc_duplicates}")
        
        if mill_proc_duplicates > 0:
            print("⚠️  WARNING: Found duplicate timestamps in processed mill data!")
        else:
            print("✓ No duplicate timestamps in processed mill data")
            
        # Test 4: Check processed ore data
        print("\n4. TESTING PROCESSED ORE DATA")
        print("-" * 30)
        
        processed_ore = connector.process_dataframe(ore_data_indexed, start_date, end_date, '1min', no_interpolation=True)
        print(f"Processed ore data shape: {processed_ore.shape}")
        
        ore_proc_duplicates = processed_ore.index.duplicated().sum()
        print(f"Duplicate timestamps in processed ore data: {ore_proc_duplicates}")
        
        if ore_proc_duplicates > 0:
            print("⚠️  WARNING: Found duplicate timestamps in processed ore data!")
        else:
            print("✓ No duplicate timestamps in processed ore data")
            
        # Test 5: Check timestamp alignment
        print("\n5. TESTING TIMESTAMP ALIGNMENT")
        print("-" * 30)
        
        common_timestamps = processed_mill.index.intersection(processed_ore.index)
        print(f"Common timestamps between datasets: {len(common_timestamps)}")
        print(f"Mill data timestamps: {len(processed_mill.index)}")
        print(f"Ore data timestamps: {len(processed_ore.index)}")
        
        if len(common_timestamps) == 0:
            print("⚠️  WARNING: No common timestamps between datasets!")
        else:
            print(f"✓ Found {len(common_timestamps)} common timestamps")
            
        # Test 6: Try the join operation
        print("\n6. TESTING JOIN OPERATION")
        print("-" * 30)
        
        try:
            combined = connector.join_dataframes_on_timestamp(processed_mill, processed_ore)
            print(f"✓ Join successful! Combined data shape: {combined.shape}")
        except Exception as join_error:
            print(f"❌ Join failed with error: {join_error}")
            
        # Test 7: Full integration test
        print("\n7. TESTING FULL INTEGRATION")
        print("-" * 30)
        
        try:
            combined_full = connector.get_combined_data(
                mill_number=mill_number,
                start_date=start_date,
                end_date=end_date,
                resample_freq='1min',
                save_to_logs=False
            )
            if combined_full is not None:
                print(f"✓ Full integration successful! Shape: {combined_full.shape}")
                print(f"Columns: {list(combined_full.columns)}")
            else:
                print("❌ Full integration returned None")
        except Exception as full_error:
            print(f"❌ Full integration failed with error: {full_error}")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_data_integrity()
