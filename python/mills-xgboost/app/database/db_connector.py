import pandas as pd
from sqlalchemy import create_engine
import logging
import os
from datetime import datetime

# Use the main app's logging configuration
logger = logging.getLogger(__name__)

class MillsDataConnector:
    """
    Class to handle database connections and data retrieval from PostgreSQL server
    for mill and ore quality data.
    """
    
    def __init__(self, host, port, dbname, user, password):
        """
        Initialize database connection parameters
        
        Args:
            host: PostgreSQL host address
            port: PostgreSQL port number
            dbname: Database name
            user: PostgreSQL username
            password: PostgreSQL password
        """
        self.connection_string = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        self.engine = None
        try:
            self.engine = create_engine(self.connection_string)
            logger.info("Database connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            raise

    def get_mill_data(self, mill_number, start_date=None, end_date=None):
        """
        Retrieve mill data from PostgreSQL for a specific mill number and date range
        
        Args:
            mill_number: Mill number (6, 7, or 8)
            start_date: Start date for data retrieval (default: None)
            end_date: End date for data retrieval (default: None)
            
        Returns:
            DataFrame with mill data
        """
        try:
            mill_table = f"MILL_{mill_number:02d}"
            
            # Build query
            query = f"SELECT * FROM mills.\"{mill_table}\""
            
            # Add date filters if provided
            conditions = []
            if start_date:
                conditions.append(f"\"TimeStamp\" >= '{start_date}'")
            if end_date:
                conditions.append(f"\"TimeStamp\" <= '{end_date}'")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            # Execute query
            df = pd.read_sql_query(query, self.engine, index_col='TimeStamp')
            logger.info(f"Retrieved {len(df)} rows for Mill {mill_number}")
            return df
            
        except Exception as e:
            logger.error(f"Error retrieving mill data: {e}")
            raise

    def get_ore_quality(self, start_date=None, end_date=None):
        """
        Retrieve ore quality data from PostgreSQL for a specific date range
        
        Args:
            start_date: Start date for data retrieval (default: None)
            end_date: End date for data retrieval (default: None)
            
        Returns:
            DataFrame with ore quality data
        """
        try:
            # Build query
            query = "SELECT * FROM mills.ore_quality"
            
            # Add date filters if provided
            conditions = []
            if start_date:
                conditions.append(f"\"TimeStamp\" >= '{start_date}'")
            if end_date:
                conditions.append(f"\"TimeStamp\" <= '{end_date}'")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            # Execute query
            df = pd.read_sql_query(query, self.engine)
            logger.info(f"Retrieved {len(df)} rows of ore quality data")
            return df
            
        except Exception as e:
            logger.error(f"Error retrieving ore quality data: {e}")
            raise
            
    def process_dataframe(self, df, start_date=None, end_date=None, resample_freq='1min', no_interpolation=False):
        """
        Process a dataframe for use in modeling - handles resampling, smoothing, etc.
        
        Args:
            df: Input DataFrame
            start_date: Optional start date filter
            end_date: Optional end date filter
            resample_freq: Frequency for resampling time series
            no_interpolation: If True, use forward fill instead of interpolation for resampling
                             (keeps values constant within periods like shifts)
            
        Returns:
            Processed DataFrame
        """
        df_processed = df.copy()
        
        # Ensure we have a datetime index
        if not isinstance(df_processed.index, pd.DatetimeIndex):
            if 'TimeStamp' in df_processed.columns:
                df_processed.set_index('TimeStamp', inplace=True)
        
        # Apply date range filtering if provided
        if start_date or end_date:
            start = pd.to_datetime(start_date).tz_localize(None) if start_date else None
            end = pd.to_datetime(end_date).tz_localize(None) if end_date else None
            
            # Remove timezone info if present
            if df_processed.index.tz is not None:
                df_processed.index = df_processed.index.tz_localize(None)
            
            # Apply filters
            if start:
                df_processed = df_processed[df_processed.index >= start]
            if end:
                df_processed = df_processed[df_processed.index <= end]
            
        # Convert object columns to numeric
        for col in df_processed.columns:
            if df_processed[col].dtype == 'object':
                df_processed[col] = pd.to_numeric(df_processed[col], errors='coerce')
        
        # Get only numeric columns
        numeric_cols = df_processed.select_dtypes(include=['number']).columns.tolist()
        
        if numeric_cols:
            if no_interpolation:
                # Resample without interpolation - use forward fill (pad) method
                # This keeps values constant within periods like shifts
                df_resampled = df_processed[numeric_cols].resample(resample_freq).ffill()   
                
                # Forward fill to keep values constant - this ensures same value throughout the period
                df_processed = df_resampled.fillna(method='ffill')
                
                # # Handle any remaining NAs at the start with backward fill
                df_processed = df_processed.fillna(method='bfill')
                logger.info(f"Applied resampling with constant values (no interpolation or smoothing)")
            else:
                # Original behavior - resample and interpolate
                df_processed = df_processed[numeric_cols].resample(resample_freq).mean().interpolate(method='linear')
                
                # Fill remaining NAs
                df_processed = df_processed.interpolate().ffill().bfill()
                logger.info(f"Applied resampling with interpolation")
                
                # Apply smoothing using rolling window only when interpolation is enabled
                window_size = 15  # Same as in the notebook
                df_processed = df_processed.rolling(window=window_size, min_periods=1, center=True).mean()
                logger.info(f"Applied smoothing with rolling window of size {window_size}")
                
            # Log the resampling method used
            logger.info(f"Resampled data to {resample_freq} frequency")
            
            
        return df_processed
    
    def join_dataframes_on_timestamp(self, df1, df2):
        """
        Join two dataframes on their timestamp indices
        
        Args:
            df1: First DataFrame
            df2: Second DataFrame
            
        Returns:
            Joined DataFrame
        """
        # Make sure both dataframes have datetime indices
        for df in [df1, df2]:
            if not isinstance(df.index, pd.DatetimeIndex):
                if 'TimeStamp' in df.columns:
                    df.set_index('TimeStamp', inplace=True)
        
        # Align indices by time
        common_index = df1.index.intersection(df2.index)
        df1_aligned = df1.loc[common_index]
        df2_aligned = df2.loc[common_index]
        
        # Join the dataframes
        joined_df = df1_aligned.join(df2_aligned)
        logger.info(f"Joined dataframes with {len(joined_df)} rows")
        
        return joined_df
    
    def get_combined_data(self, mill_number, start_date=None, end_date=None, resample_freq='1min', save_to_logs=True, no_interpolation=False):
        """
        Get combined mill and ore quality data, processed and joined
        
        Args:
            mill_number: Mill number (6, 7, or 8)
            start_date: Start date for data retrieval
            end_date: End date for data retrieval
            resample_freq: Frequency for resampling time series
            save_to_logs: Whether to save the combined data to a CSV file in the logs folder
            no_interpolation: If True, use forward fill instead of interpolation for ore data
                              (keeps values constant within periods like shifts)
            
        Returns:
            Combined DataFrame with mill and ore quality data
        """
        try:
            logger.info(f"Retrieving mill data for mill {mill_number} from {start_date} to {end_date}")
            
            # Get mill data
            mill_data = self.get_mill_data(mill_number, start_date, end_date)
            if mill_data is None or mill_data.empty:
                logger.warning(f"No mill data found for mill {mill_number}")
                return None
                
            logger.info(f"Mill data retrieved: {len(mill_data)} rows, {len(mill_data.columns)} columns")
            logger.info(f"Mill data columns: {list(mill_data.columns)}")
            logger.info(f"Mill data sample:\n{mill_data.head(3)}")
            print(mill_data.head(3))
            
            # Process mill data - always use interpolation for mill data since it's continuous
            processed_mill_data = self.process_dataframe(mill_data, start_date, end_date, resample_freq, no_interpolation=False)
            logger.info(f"Processed mill data: {len(processed_mill_data)} rows, {len(processed_mill_data.columns)} columns")
            
            # Get ore quality data
            logger.info("Retrieving ore quality data")
            ore_data = self.get_ore_quality(start_date, end_date)
            if ore_data is None:
                logger.warning("No ore quality data found")
                # If no ore data, just return processed mill data
                logger.info(f"Returning processed mill data only")
                return processed_mill_data
            
            logger.info(f"Ore data retrieved: {len(ore_data)} rows, {len(ore_data.columns)} columns")
            logger.info(f"Ore data columns: {list(ore_data.columns)}")
            
            # Process ore data - apply no_interpolation option as requested
            processed_ore_data = self.process_dataframe(ore_data, start_date, end_date, resample_freq, no_interpolation=True)
            logger.info(f"Processed ore data: {len(processed_ore_data)} rows, {len(processed_ore_data.columns)} columns"
                      f" - {'with constant values (no interpolation)' if no_interpolation else 'with interpolation'}")

            
            # Join the two datasets
            combined_data = self.join_dataframes_on_timestamp(processed_mill_data, processed_ore_data)
            logger.info(f"Combined data has {len(combined_data)} rows and {len(combined_data.columns)} columns")
            logger.info(f"Combined data columns: {list(combined_data.columns)}")
            logger.info(f"Combined data sample:\n{combined_data.head(3)}")
            
            # Save the combined data to a CSV file in the logs folder if requested
            if save_to_logs and combined_data is not None and not combined_data.empty:
                try:
                    # Create logs directory if it doesn't exist
                    logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
                    os.makedirs(logs_dir, exist_ok=True)
                    
                    # Generate filename with timestamp
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"combined_data_mill{mill_number}_{timestamp}.csv"
                    filepath = os.path.join(logs_dir, filename)
                    
                    # Save to CSV
                    combined_data.to_csv(filepath)
                    logger.info(f"Combined data saved to {filepath}")
                except Exception as e:
                    logger.error(f"Error saving combined data to logs: {e}")
            
            return combined_data
                
        except Exception as e:
            logger.error(f"Error combining data: {e}")
            return None
