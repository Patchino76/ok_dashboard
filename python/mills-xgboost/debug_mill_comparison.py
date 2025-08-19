#!/usr/bin/env python3
"""
Debug script to compare Mill 6 vs Mill 7 data retrieval
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from datetime import datetime
import logging
from sqlalchemy import create_engine, text

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_direct_sql_queries():
    """Test direct SQL queries to compare Mill 6 vs Mill 7 data"""
    
    # Database connection parameters
    db_config = {
        "host": "em-m-db4.ellatzite-med.com",
        "port": 5432,
        "dbname": "em_pulse_data",
        "user": "s.lyubenov",
        "password": "tP9uB7sH7mK6zA7t"
    }
    
    if not db_config["password"]:
        print("Please set DB_PASSWORD environment variable")
        print("Example: $env:DB_PASSWORD='your_password'; python debug_mill_comparison.py")
        return
    
    connection_string = f"postgresql://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['dbname']}"
    
    try:
        engine = create_engine(connection_string)
        
        # Test queries for both mills
        mills = [8]
        start_date = "2025-08-12 00:00:00"
        end_date = "2025-08-19 00:00:00"
        
        for mill_num in mills:
            mill_table = f"MILL_{mill_num:02d}"
            
            print(f"\n=== Testing Mill {mill_num} (Table: {mill_table}) ===")
            
            # Query 1: Count total records
            count_query = f'SELECT COUNT(*) as total_count FROM mills."{mill_table}"'
            with engine.connect() as conn:
                result = conn.execute(text(count_query))
                total_count = result.fetchone()[0]
                print(f"Total records in {mill_table}: {total_count}")
            
            # Query 2: Get date range
            date_range_query = f'SELECT MIN("TimeStamp") as min_date, MAX("TimeStamp") as max_date FROM mills."{mill_table}"'
            with engine.connect() as conn:
                result = conn.execute(text(date_range_query))
                row = result.fetchone()
                print(f"Date range: {row[0]} to {row[1]}")
            
            # Query 3: Count records after 2025-08-12
            after_aug12_query = f'SELECT COUNT(*) as count_after FROM mills."{mill_table}" WHERE "TimeStamp" > \'{start_date}\''
            with engine.connect() as conn:
                result = conn.execute(text(after_aug12_query))
                count_after = result.fetchone()[0]
                print(f"Records after {start_date}: {count_after}")
            
            # Query 4: Get last 5 records
            last_records_query = f'SELECT "TimeStamp" FROM mills."{mill_table}" ORDER BY "TimeStamp" DESC LIMIT 5'
            with engine.connect() as conn:
                result = conn.execute(text(last_records_query))
                last_timestamps = [row[0] for row in result.fetchall()]
                print(f"Last 5 timestamps: {last_timestamps}")
            
            # Query 5: Test the exact query used by the connector
            exact_query = f'SELECT * FROM mills."{mill_table}" WHERE "TimeStamp" >= \'2025-06-15T03:00:00.000Z\' AND "TimeStamp" <= \'2025-08-17T00:00:00.000Z\''
            print(f"Testing exact connector query: {exact_query}")
            
            # Query 5b: Test with timezone-naive query (the fix)
            fixed_query = f'SELECT * FROM mills."{mill_table}" WHERE "TimeStamp" >= \'2025-06-15 03:00:00\' AND "TimeStamp" <= \'2025-08-17 00:00:00\''
            print(f"Testing timezone-fixed query: {fixed_query}")
            
            try:
                df = pd.read_sql_query(exact_query, engine, index_col='TimeStamp')
                print(f"Connector query result: {len(df)} rows")
                if not df.empty:
                    print(f"Date range from connector query: {df.index.min()} to {df.index.max()}")
                    print(f"Last 3 timestamps: {df.index[-3:].tolist()}")
                else:
                    print("No data returned from connector query!")
            except Exception as e:
                print(f"Error with connector query: {e}")
            
            try:
                df_fixed = pd.read_sql_query(fixed_query, engine, index_col='TimeStamp')
                print(f"Fixed query result: {len(df_fixed)} rows")
                if not df_fixed.empty:
                    print(f"Date range from fixed query: {df_fixed.index.min()} to {df_fixed.index.max()}")
                    print(f"Last 3 timestamps: {df_fixed.index[-3:].tolist()}")
                else:
                    print("No data returned from fixed query!")
            except Exception as e:
                print(f"Error with fixed query: {e}")
            
            # Query 6: Test with different date formats
            print("\nTesting different date formats:")
            
            # Format 1: ISO with Z
            iso_z_query = f'SELECT COUNT(*) FROM mills."{mill_table}" WHERE "TimeStamp" <= \'2025-08-17T00:00:00.000Z\''
            with engine.connect() as conn:
                result = conn.execute(text(iso_z_query))
                count_iso_z = result.fetchone()[0]
                print(f"Count with ISO Z format (<=2025-08-17T00:00:00.000Z): {count_iso_z}")
            
            # Format 2: Simple datetime
            simple_query = f'SELECT COUNT(*) FROM mills."{mill_table}" WHERE "TimeStamp" <= \'2025-08-17 00:00:00\''
            with engine.connect() as conn:
                result = conn.execute(text(simple_query))
                count_simple = result.fetchone()[0]
                print(f"Count with simple format (<=2025-08-17 00:00:00): {count_simple}")
            
            # Format 3: Test with later date to see if data exists
            later_query = f'SELECT COUNT(*) FROM mills."{mill_table}" WHERE "TimeStamp" <= \'2025-08-18 00:00:00\''
            with engine.connect() as conn:
                result = conn.execute(text(later_query))
                count_later = result.fetchone()[0]
                print(f"Count with later date (<=2025-08-18 00:00:00): {count_later}")
            
            # Format 4: Test exact cutoff point
            cutoff_query = f'SELECT COUNT(*) FROM mills."{mill_table}" WHERE "TimeStamp" > \'2025-08-12 12:54:00\' AND "TimeStamp" <= \'2025-08-17 00:00:00\''
            with engine.connect() as conn:
                result = conn.execute(text(cutoff_query))
                count_between = result.fetchone()[0]
                print(f"Count between 2025-08-12 12:54:00 and 2025-08-17 00:00:00: {count_between}")
            
            # Format 5: Check what data exists right after the cutoff
            after_cutoff_query = f'SELECT "TimeStamp" FROM mills."{mill_table}" WHERE "TimeStamp" > \'2025-08-12 12:54:00\' ORDER BY "TimeStamp" ASC LIMIT 10'
            with engine.connect() as conn:
                result = conn.execute(text(after_cutoff_query))
                after_cutoff_timestamps = [row[0] for row in result.fetchall()]
                print(f"First 10 timestamps after 2025-08-12 12:54:00: {after_cutoff_timestamps}")
            
            # Format 6: Check data around 2025-08-17
            around_17_query = f'SELECT "TimeStamp" FROM mills."{mill_table}" WHERE "TimeStamp" BETWEEN \'2025-08-16 00:00:00\' AND \'2025-08-18 00:00:00\' ORDER BY "TimeStamp" ASC LIMIT 5'
            with engine.connect() as conn:
                result = conn.execute(text(around_17_query))
                around_17_timestamps = [row[0] for row in result.fetchall()]
                print(f"Timestamps around 2025-08-17: {around_17_timestamps}")
            
            # Format 3: Check timezone handling
            tz_query = f'SELECT "TimeStamp", "TimeStamp"::timestamp AT TIME ZONE \'UTC\' as utc_time FROM mills."{mill_table}" ORDER BY "TimeStamp" DESC LIMIT 3'
            with engine.connect() as conn:
                result = conn.execute(text(tz_query))
                tz_results = result.fetchall()
                print("Timezone comparison (last 3 records):")
                for row in tz_results:
                    print(f"  Original: {row[0]}, UTC: {row[1]}")
        
        # Test ore quality table
        print(f"\n=== Testing Ore Quality Table ===")
        
        # Query 1: Count total records in ore quality
        ore_count_query = 'SELECT COUNT(*) as total_count FROM mills.ore_quality'
        with engine.connect() as conn:
            result = conn.execute(text(ore_count_query))
            total_count = result.fetchone()[0]
            print(f"Total records in ore_quality: {total_count}")
        
        # Query 2: Get ore quality date range
        ore_date_range_query = 'SELECT MIN("TimeStamp") as min_date, MAX("TimeStamp") as max_date FROM mills.ore_quality'
        with engine.connect() as conn:
            result = conn.execute(text(ore_date_range_query))
            row = result.fetchone()
            print(f"Ore quality date range: {row[0]} to {row[1]}")
        
        # Query 3: Count ore quality records after 2025-08-12
        ore_after_aug12_query = f'SELECT COUNT(*) as count_after FROM mills.ore_quality WHERE "TimeStamp" > \'{start_date}\''
        with engine.connect() as conn:
            result = conn.execute(text(ore_after_aug12_query))
            count_after = result.fetchone()[0]
            print(f"Ore quality records after {start_date}: {count_after}")
        
        # Query 4: Get last 5 ore quality records
        ore_last_records_query = 'SELECT "TimeStamp" FROM mills.ore_quality ORDER BY "TimeStamp" DESC LIMIT 5'
        with engine.connect() as conn:
            result = conn.execute(text(ore_last_records_query))
            last_timestamps = [row[0] for row in result.fetchall()]
            print(f"Last 5 ore quality timestamps: {last_timestamps}")
    
    except Exception as e:
        print(f"Database connection error: {e}")
        import traceback
        traceback.print_exc()

def test_pandas_datetime_conversion():
    """Test how pandas handles the datetime conversion"""
    
    print("\n=== Pandas Datetime Conversion Test ===")
    
    test_dates = [
        "2025-08-17T00:00:00.000Z",
        "2025-08-17 00:00:00",
        "2025-08-12 12:54:00"
    ]
    
    for date_str in test_dates:
        try:
            pd_date = pd.to_datetime(date_str)
            pd_date_no_tz = pd.to_datetime(date_str).tz_localize(None) if pd_date.tz else pd_date
            print(f"'{date_str}' -> {pd_date} -> no_tz: {pd_date_no_tz}")
        except Exception as e:
            print(f"Error parsing '{date_str}': {e}")

if __name__ == "__main__":
    print("Mill 6 vs Mill 7 Data Retrieval Comparison")
    print("=" * 50)
    
    test_pandas_datetime_conversion()
    test_direct_sql_queries()
