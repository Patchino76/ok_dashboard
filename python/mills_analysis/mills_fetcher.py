from typing import Dict, Any, Optional
from datetime import datetime
import os
import pandas as pd
from sqlalchemy import create_engine, text

# Use hardcoded connection settings from the pg_host.txt content
host = "em-m-db4.ellatzite-med.com"
port = "5432"
database = "em_pulse_data"
user = "s.lyubenov"
password = "tP9uB7sH7mK6zA7t"

print(f"Using database connection: {host}:{port}/{database} as user {user}")

# Create database engine
engine = create_engine(f"postgresql://{user}:{password}@{host}:{port}/{database}", connect_args={'connect_timeout': 10})

# Hardcoded list of mills
MILLS = ['MILL_01', 'MILL_02', 'MILL_03', 'MILL_04', 'MILL_05', 'MILL_06', 
         'MILL_07', 'MILL_08', 'MILL_09', 'MILL_10', 'MILL_11', 'MILL_12']

def get_mill_data(parameter: str, start_ts: datetime, end_ts: datetime,
               connection_config: Optional[Dict[str, Any]] = None, 
               debug: bool = False) -> pd.DataFrame:
    """Fetch mill data for a specific parameter and time range.
    
    Args:
        parameter: The parameter to query (e.g., 'Ore', 'Power')
        start_ts: Start timestamp for the query
        end_ts: End timestamp for the query
        connection_config: Optional connection config to override defaults
        debug: Whether to print debug information
        
    Returns:
        DataFrame with timestamp and mill columns
    """
    try:
        if debug: print("Starting get_mill_data function...")
        
        # Use provided connection config if any
        current_engine = engine
        if connection_config:
            conn_str = f"postgresql://{connection_config.get('user', user)}:{connection_config.get('password', password)}@"
            conn_str += f"{connection_config.get('host', host)}:{connection_config.get('port', port)}/{connection_config.get('database', database)}"
            current_engine = create_engine(conn_str)
        
        # Construct a dynamic UNION ALL query for all mills
        union_parts = []
        params = {'start_ts': start_ts, 'end_ts': end_ts}
        
        # For each mill table, create a query part
        for mill in MILLS:
            sql = f"""
            SELECT 
                "TimeStamp" as timestamp,
                '{mill}' as mill_name,
                "{parameter}" as value
            FROM mills."{mill}"
            WHERE "TimeStamp" >= :start_ts
            AND "TimeStamp" <= :end_ts
            AND "{parameter}" IS NOT NULL
            """
            union_parts.append(sql)
        
        # Join all parts with UNION ALL and order by timestamp
        final_sql = " UNION ALL ".join([f"({q})" for q in union_parts]) + " ORDER BY timestamp, mill_name"
        
        if debug: 
            print("Executing SQL query...")
            print(final_sql[:100] + "..." if len(final_sql) > 100 else final_sql)
        
        # Execute the query
        stmt = text(final_sql)
        with current_engine.connect() as conn:
            df = pd.read_sql(stmt, conn, params=params, parse_dates=['timestamp'])
            if debug: print(f"Query returned {len(df)} rows")
        
        if df.empty:
            if debug: print("No data found, returning empty DataFrame")
            return df
        
        # Pivot the data to have mills as columns
        df_pivoted = df.pivot_table(index='timestamp', columns='mill_name', values='value', aggfunc='mean')
        
        # Find the common time range where all mills have data
        common_start = df_pivoted.dropna(how='all').index.min()
        common_end = df_pivoted.dropna(how='all').index.max()
        if debug: print(f"Common time range: {common_start} to {common_end}")
        
        # Resample to ensure consistent timestamps across all mills
        full_index = pd.date_range(start=common_start, end=common_end, freq='1min')
        df_resampled = pd.DataFrame(index=full_index)
        
        # Resample each mill's data to the new index
        for mill in df_pivoted.columns:
            df_resampled[mill] = df_pivoted[mill].reindex(full_index).ffill()
        
        # Reset index to make timestamp a column again
        df_resampled = df_resampled.reset_index()
        df_resampled = df_resampled.rename(columns={'index': 'timestamp'})
        
        # Remove any rows where all mill values are NA
        df_resampled = df_resampled.dropna(how='all', subset=df_pivoted.columns)
        if debug: print(f"Final DataFrame: {len(df_resampled)} rows with {len(df_resampled.columns)} columns")
        
        return df_resampled
        
    except Exception as e:
        print(f"Error in get_mill_data: {str(e)}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()

if __name__ == "__main__":
    from datetime import timedelta
    import sys
    
    try:
        # Get last 3 days of data
        end_time = datetime.now()
        start_time = end_time - timedelta(days=3)
        
        print(f"Fetching Ore data from {start_time} to {end_time}")
        
        # Fetch data with minimal debug output
        df = get_mill_data(parameter='Ore', start_ts=start_time, end_ts=end_time)
        
        if df.empty:
            print("\nNo data found for the specified parameters")
            sys.exit(1)
        
        # Show basic information
        print("\n" + "-" * 50)
        print(f"Total Records: {len(df)}")
        print(f"Time Range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        print("-" * 50)
        
        # Display record count for each mill
        print("\nRecord count per mill:")
        for col in df.columns:
            if col != 'timestamp':
                print(f"  {col}: {df[col].count()} records")
        
        # Show first 5 rows with clean formatting
        print("\nData Sample (First 5 rows):")
        print("-" * 50)
        pd.set_option('display.max_columns', None)
        pd.set_option('display.width', 120)
        pd.set_option('display.precision', 2)
        print(df.head(5).to_string(index=False))
        
        print("\nData fetching completed successfully")
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
