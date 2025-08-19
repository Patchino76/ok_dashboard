#!/usr/bin/env python3
"""
Simple debug script to check database queries and date handling
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def analyze_date_parameters():
    """Analyze the date parameters from the training request"""
    
    start_date = "2025-06-15T03:00:00.000Z"
    end_date = "2025-08-17T00:00:00.000Z"
    
    print("=== Date Parameter Analysis ===")
    print(f"Raw start_date: {start_date}")
    print(f"Raw end_date: {end_date}")
    
    # Convert to pandas datetime (same as in the code)
    start_pd = pd.to_datetime(start_date).tz_localize(None)
    end_pd = pd.to_datetime(end_date).tz_localize(None)
    
    print(f"Parsed start_date: {start_pd}")
    print(f"Parsed end_date: {end_pd}")
    
    # Check what the SQL query would look like
    print(f"\nSQL conditions would be:")
    print(f"  \"TimeStamp\" >= '{start_date}'")
    print(f"  \"TimeStamp\" <= '{end_date}'")
    
    # Check current date
    current_date = datetime.now()
    print(f"\nCurrent date: {current_date}")
    print(f"End date is in future: {end_pd > pd.to_datetime(current_date)}")
    
    # Check if the issue might be timezone related
    print(f"\nTimezone analysis:")
    print(f"Start date UTC: {pd.to_datetime(start_date)}")
    print(f"End date UTC: {pd.to_datetime(end_date)}")
    
    # Check what the last expected timestamp should be
    print(f"\nExpected last timestamp should be around: {end_pd}")
    
    # The CSV shows last record at 2025-08-12 12:54:00
    last_csv_record = "2025-08-12 12:54:00"
    last_csv_pd = pd.to_datetime(last_csv_record)
    
    print(f"Last CSV record timestamp: {last_csv_pd}")
    print(f"Time difference: {end_pd - last_csv_pd}")
    print(f"Days difference: {(end_pd - last_csv_pd).days}")
    
    return start_pd, end_pd, last_csv_pd

def check_database_query_logic():
    """Check the database query logic without actually connecting"""
    
    print("\n=== Database Query Logic Analysis ===")
    
    mill_number = 6
    start_date = "2025-06-15T03:00:00.000Z"
    end_date = "2025-08-17T00:00:00.000Z"
    
    mill_table = f"MILL_{mill_number:02d}"
    
    # Build query exactly as in the code
    query = f"SELECT * FROM mills.\"{mill_table}\""
    
    conditions = []
    if start_date:
        conditions.append(f"\"TimeStamp\" >= '{start_date}'")
    if end_date:
        conditions.append(f"\"TimeStamp\" <= '{end_date}'")
        
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    print(f"Mill table: {mill_table}")
    print(f"Final query: {query}")
    
    # Same for ore quality
    ore_query = "SELECT * FROM mills.ore_quality"
    ore_conditions = []
    if start_date:
        ore_conditions.append(f"\"TimeStamp\" >= '{start_date}'")
    if end_date:
        ore_conditions.append(f"\"TimeStamp\" <= '{end_date}'")
        
    if ore_conditions:
        ore_query += " WHERE " + " AND ".join(ore_conditions)
    
    print(f"Ore quality query: {ore_query}")

def main():
    print("Debug Analysis for Data Retrieval Issue")
    print("=" * 50)
    
    start_pd, end_pd, last_csv_pd = analyze_date_parameters()
    check_database_query_logic()
    
    print("\n=== Possible Issues ===")
    print("1. Database might not have data beyond 2025-08-12")
    print("2. Timezone conversion might be affecting the query")
    print("3. Date filtering in process_dataframe might be too restrictive")
    print("4. Database connection might be using a different timezone")
    
    print(f"\n=== Recommendations ===")
    print("1. Check if database actually has data after 2025-08-12 12:54:00")
    print("2. Verify timezone handling in database queries")
    print("3. Check if the database server time zone matches expectations")
    print("4. Run a direct SQL query to see max timestamp in the database")

if __name__ == "__main__":
    main()
