from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd
from sqlalchemy import create_engine, text

# Connection settings
host = "em-m-db4.ellatzite-med.com"
port = "5432"
database = "em_pulse_data"
user = "s.lyubenov"
password = "tP9uB7sH7mK6zA7t"

# Create database engine
engine = create_engine(f"postgresql://{user}:{password}@{host}:{port}/{database}")

# Hardcoded list of mills
MILLS = ['MILL_01', 'MILL_02', 'MILL_03', 'MILL_04', 'MILL_05', 'MILL_06', 
         'MILL_07', 'MILL_08', 'MILL_09', 'MILL_10', 'MILL_11', 'MILL_12']

def get_mills_by_param(parameter: str, start_ts: datetime, end_ts: datetime,
               connection_config: Optional[Dict[str, Any]] = None, freq: str = '5min') -> pd.DataFrame:
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
    
    # Execute the query
    stmt = text(final_sql)
    with current_engine.connect() as conn:
        df = pd.read_sql(stmt, conn, params=params, parse_dates=['timestamp'])
    
    if df.empty:
        return df
    
    # Pivot the data to have mills as columns
    df_pivoted = df.pivot_table(index='timestamp', columns='mill_name', values='value', aggfunc='mean')
    
    # Find the common time range where all mills have data
    common_start = df_pivoted.dropna(how='all').index.min()
    common_end = df_pivoted.dropna(how='all').index.max()
    
    # Resample to ensure consistent timestamps across all mills
    full_index = pd.date_range(start=common_start, end=common_end, freq=freq)
    df_resampled = pd.DataFrame(index=full_index)
    
    # Resample each mill's data to the new index
    for mill in df_pivoted.columns:
        df_resampled[mill] = df_pivoted[mill].reindex(full_index).ffill()
    
    # Reset index to make timestamp a column again
    df_resampled = df_resampled.reset_index()
    df_resampled = df_resampled.rename(columns={'index': 'timestamp'})
    
    # Remove any rows where all mill values are NA
    df_resampled = df_resampled.dropna(how='all', subset=df_pivoted.columns)
    
    return df_resampled

if __name__ == "__main__":
    from datetime import timedelta
    
    # Get last 3 days of data
    end_time = datetime.now()
    start_time = end_time - timedelta(days=3)
    
    # Fetch data with 5min frequency
    df = get_mills_by_param(parameter='PSI80', start_ts=start_time, end_ts=end_time, freq='5min')
    
    # Display minimal information
    if not df.empty:
        print(df.head())
        print(f"Fetched {len(df)} records from {df['timestamp'].min()} to {df['timestamp'].max()}")
    else:
        print("No data found")
