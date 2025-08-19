#!/usr/bin/env python3
"""
Debug script to test data retrieval with the exact parameters from the training request
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.db_connector import MillsDataConnector
import logging

# Configure logging to see debug output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('debug_data_retrieval.log')
    ]
)

def test_data_retrieval():
    """Test data retrieval with exact parameters from training request"""
    
    # Your exact parameters from the training request
    db_config = {
        "host": "em-m-db4.ellatzite-med.com",
        "port": 5432,
        "dbname": "em_pulse_data",
        "user": "s.lyubenov",
        "password": os.getenv("DB_PASSWORD", "")  # Set DB_PASSWORD environment variable
    }
    
    if not db_config["password"]:
        print("Please set the DB_PASSWORD environment variable or provide the password")
        db_config["password"] = input("Enter database password: ").strip()
    
    mill_number = 6
    start_date = "2025-06-15T03:00:00.000Z"
    end_date = "2025-08-17T00:00:00.000Z"
    
    print(f"Testing data retrieval with:")
    print(f"  Mill: {mill_number}")
    print(f"  Start: {start_date}")
    print(f"  End: {end_date}")
    print(f"  Host: {db_config['host']}")
    print("-" * 50)
    
    try:
        # Initialize connector
        connector = MillsDataConnector(
            host=db_config["host"],
            port=db_config["port"],
            dbname=db_config["dbname"],
            user=db_config["user"],
            password=db_config["password"]
        )
        
        print("Database connection established successfully")
        
        # Test mill data retrieval
        print("\n=== Testing Mill Data Retrieval ===")
        mill_data = connector.get_mill_data(mill_number, start_date, end_date)
        
        if mill_data is not None and not mill_data.empty:
            print(f"Mill data retrieved: {len(mill_data)} rows")
            print(f"Date range: {mill_data.index.min()} to {mill_data.index.max()}")
            print(f"Columns: {list(mill_data.columns)}")
            print("\nLast 10 timestamps:")
            print(mill_data.index[-10:].tolist())
        else:
            print("No mill data retrieved!")
        
        # Test ore quality data retrieval
        print("\n=== Testing Ore Quality Data Retrieval ===")
        ore_data = connector.get_ore_quality(start_date, end_date)
        
        if ore_data is not None and not ore_data.empty:
            print(f"Ore quality data retrieved: {len(ore_data)} rows")
            if 'TimeStamp' in ore_data.columns:
                ore_data['TimeStamp'] = pd.to_datetime(ore_data['TimeStamp'])
                print(f"Date range: {ore_data['TimeStamp'].min()} to {ore_data['TimeStamp'].max()}")
                print("\nLast 10 timestamps:")
                print(ore_data['TimeStamp'].tail(10).tolist())
            print(f"Columns: {list(ore_data.columns)}")
        else:
            print("No ore quality data retrieved!")
        
        # Test combined data retrieval
        print("\n=== Testing Combined Data Retrieval ===")
        combined_data = connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq='1min',
            save_to_logs=True,
            no_interpolation=False
        )
        
        if combined_data is not None and not combined_data.empty:
            print(f"Combined data: {len(combined_data)} rows")
            print(f"Date range: {combined_data.index.min()} to {combined_data.index.max()}")
            print(f"Columns: {list(combined_data.columns)}")
            print("\nLast 10 timestamps:")
            print(combined_data.index[-10:].tolist())
            
            # Save a sample to see the actual data
            sample_file = "debug_sample_data.csv"
            combined_data.tail(20).to_csv(sample_file)
            print(f"\nSaved last 20 rows to {sample_file}")
        else:
            print("No combined data retrieved!")
            
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import pandas as pd
    test_data_retrieval()
