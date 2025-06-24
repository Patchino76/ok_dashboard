import os
from typing import List, Optional, Union
from datetime import datetime
import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

# Database connection parameters
DB_CONFIG = {
    'host': 'em-m-db4.ellatzite-med.com',
    'port': 5432,
    'dbname': 'em_pulse_data',
    'user': 's.lyubenov',
    'password': 'tP9uB7sH7mK6zA7t'
}

# List of valid parameters based on the schema
VALID_PARAMETERS = [
    'Ore', 'WaterMill', 'WaterZumpf', 'Power', 'ZumpfLevel',
    'PressureHC', 'DensityHC', 'PulpHC', 'PumpRPM', 'MotorAmp',
    'PSI80', 'PSI200'
]

def get_mill_data(
    mill_names: Union[str, List[str]],
    parameter: str,
    start_ts: datetime,
    end_ts: datetime,
    connection_config: Optional[dict] = None
) -> pd.DataFrame:
    """
    Fetch mill data from the PostgreSQL database.

    Args:
        mill_names: Single mill name (e.g., 'MILL_01') or list of mill names
        parameter: The parameter to fetch (e.g., 'Ore', 'Power')
        start_ts: Start timestamp (inclusive)
        end_ts: End timestamp (inclusive)
        connection_config: Optional database connection configuration

    Returns:
        pandas.DataFrame: DataFrame containing the requested data with columns:
                         ['timestamp', 'mill_name', parameter]

    Raises:
        ValueError: If an invalid parameter is provided
        psycopg2.Error: For database-related errors
    """
    # Validate parameter
    if parameter not in VALID_PARAMETERS:
        raise ValueError(f"Invalid parameter: {parameter}. Must be one of: {', '.join(VALID_PARAMETERS)}")

    # Convert single mill name to list if needed
    if isinstance(mill_names, str):
        mill_names = [mill_names]

    # Ensure mill names are in the correct format
    mill_names = [f"MILL_{str(mill).zfill(2)}" if not mill.upper().startswith('MILL_') else mill.upper() 
                 for mill in mill_names]

    # Use provided config or default
    config = connection_config or DB_CONFIG

    # Build the query
    query = sql.SQL("""
        WITH mill_data AS (
            {union_queries}
        )
        SELECT * FROM mill_data
        WHERE timestamp BETWEEN %s AND %s
        ORDER BY timestamp, mill_name
    """)

    # Create a query part for each mill
    union_parts = []
    for mill in mill_names:
        union_parts.append(
            sql.SQL("""
                SELECT 
                    "TimeStamp" as timestamp,
                    {mill_name} as mill_name,
                    "{parameter}" as value
                FROM mills.{mill_table}
            """).format(
                mill_name=sql.Literal(mill),
                parameter=sql.Identifier(parameter),
                mill_table=sql.Identifier(mill)
            )
        )
    
    # Combine all parts with UNION ALL
    union_query = sql.SQL(" UNION ALL ").join(union_parts)
    
    # Final query with parameters
    final_query = query.format(union_queries=union_query)
    
    # Connect to the database and execute the query
    conn = None
    try:
        conn = psycopg2.connect(**config, cursor_factory=RealDictCursor)
        df = pd.read_sql_query(
            final_query,
            conn,
            params=(start_ts, end_ts),
            parse_dates=['timestamp']
        )
        
        # Pivot the data for better readability
        if not df.empty:
            df = df.pivot(index='timestamp', columns='mill_name', values='value')
            df = df.reset_index()
            
        return df
        
    except Exception as e:
        raise Exception(f"Error fetching data: {str(e)}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    # Example usage
    from datetime import datetime, timedelta
    
    try:
        # Get data for the last 7 days
        end_time = datetime.now()
        start_time = end_time - timedelta(days=7)
        
        mills = ['MILL_01', 'MILL_02']
        parameter = 'Ore'
        
        print(f"Fetching {parameter} data for {', '.join(mills)} from {start_time} to {end_time}")
        
        df = get_mill_data(
            mill_names=mills,
            parameter=parameter,
            start_ts=start_time,
            end_ts=end_time
        )
        
        if not df.empty:
            print(f"\nRetrieved {len(df)} rows of data")
            print("\nFirst 5 rows:")
            print(df.head())
            
            # Basic statistics
            print("\nSummary statistics:")
            print(df.describe())
        else:
            print("No data found for the specified parameters")
            
    except Exception as e:
        print(f"Error: {str(e)}")
