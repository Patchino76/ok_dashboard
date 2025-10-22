import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
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
        self.connection_string = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"
        self.engine = None
        self.connection_params = {
            'host': host,
            'port': port,
            'dbname': dbname,
            'user': user,
            'password': '***'  # Masked for security
        }
        
        logger.info(f"Initializing database connection to {user}@{host}:{port}/{dbname}")
        
        try:
            self.engine = create_engine(self.connection_string)
            # Test the connection
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                conn.commit()
            logger.info("✅ Database connection test successful")
        except Exception as e:
            error_msg = f"❌ Failed to initialize database connection: {str(e)}"
            logger.error(error_msg)
            logger.error(f"Connection parameters used: {self.connection_params}")
            raise RuntimeError(error_msg) from e

    def get_mill_data(self, mill_number, start_date=None, end_date=None):
        """
        Retrieve mill data from PostgreSQL MOTIFS tables for a specific mill number and date range.
        MOTIFS tables contain cleaned and filtered data.
        
        Args:
            mill_number: Mill number (6, 7, or 8)
            start_date: Start date for data retrieval (default: None)
            end_date: End date for data retrieval (default: None)
            
        Returns:
            DataFrame with mill data
        """
        try:
            mill_table = f"MOTIFS_{mill_number:02d}"
            
            logger.info(f"Fetching data from {mill_table} for date range: {start_date} to {end_date}")
            
            # Build query
            query = f"SELECT * FROM mills.\"{mill_table}\""
            
            # Add date filters if provided
            conditions = []
            if start_date:
                start_parsed = pd.to_datetime(start_date)
                if start_parsed.tz:
                    start_local = start_parsed.tz_convert(None)
                else:
                    start_local = start_parsed
                conditions.append(f"\"TimeStamp\" >= '{start_local}'")
            if end_date:
                end_parsed = pd.to_datetime(end_date)
                if end_parsed.tz:
                    end_local = end_parsed.tz_convert(None)
                else:
                    end_local = end_parsed
                conditions.append(f"\"TimeStamp\" <= '{end_local}'")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            # Execute query
            df = pd.read_sql_query(query, self.engine, index_col='TimeStamp')
            
            logger.info(f"Retrieved {len(df)} rows from {mill_table}")
            if not df.empty:
                logger.info(f"Date range: {df.index.min()} to {df.index.max()}")
            else:
                logger.warning(f"No data retrieved from {mill_table}")
            
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
            logger.info(f"Fetching ore quality data for date range: {start_date} to {end_date}")
            
            # Build query
            query = "SELECT * FROM mills.ore_quality"
            
            # Add date filters if provided
            conditions = []
            if start_date:
                start_parsed = pd.to_datetime(start_date)
                if start_parsed.tz:
                    start_local = start_parsed.tz_convert(None)
                else:
                    start_local = start_parsed
                conditions.append(f"\"TimeStamp\" >= '{start_local}'")
            if end_date:
                end_parsed = pd.to_datetime(end_date)
                if end_parsed.tz:
                    end_local = end_parsed.tz_convert(None)
                else:
                    end_local = end_parsed
                conditions.append(f"\"TimeStamp\" <= '{end_local}'")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            # Execute query
            df = pd.read_sql_query(query, self.engine)
            
            logger.info(f"Retrieved {len(df)} rows of ore quality data")
            if not df.empty and 'TimeStamp' in df.columns:
                df_temp = df.copy()
                df_temp['TimeStamp'] = pd.to_datetime(df_temp['TimeStamp'])
                logger.info(f"Date range: {df_temp['TimeStamp'].min()} to {df_temp['TimeStamp'].max()}")
            else:
                logger.warning(f"No ore quality data retrieved")
            
            return df
            
        except Exception as e:
            logger.error(f"Error retrieving ore quality data: {e}")
            raise
            
    def process_dataframe(self, df, start_date=None, end_date=None, resample_freq='1min', no_interpolation=False):
        """
        Process a dataframe for use in modeling - handles resampling only.
        MOTIFS tables are already cleaned and filtered, so no additional filtering is applied.
        
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
        
        # CRITICAL FIX: Handle duplicate timestamps before any processing
        if df_processed.index.duplicated().any():
            logger.warning(f"Found {df_processed.index.duplicated().sum()} duplicate timestamps, removing duplicates")
            # Keep the first occurrence of each duplicate timestamp
            df_processed = df_processed[~df_processed.index.duplicated(keep='first')]
            logger.info(f"After removing duplicates: {len(df_processed)} rows remaining")
        
        # Ensure index is sorted
        if not df_processed.index.is_monotonic_increasing:
            logger.info("Sorting index to ensure chronological order")
            df_processed = df_processed.sort_index()
        
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
            
            if not df_processed.empty:
                logger.info(f"After date filtering: {len(df_processed)} rows")
            else:
                logger.warning(f"No data remaining after date filtering!")
            
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
                df_processed = df_resampled.ffill().bfill()
                logger.info(f"Applied resampling with forward fill (no interpolation)")
            else:
                # Resample and interpolate - NO SMOOTHING since MOTIFS data is already cleaned
                df_resampled = df_processed[numeric_cols].resample(resample_freq).mean()
                df_processed = df_resampled.interpolate(method='linear').ffill().bfill()
                logger.info(f"Applied resampling with interpolation")
                
            logger.info(f"Resampled data to {resample_freq} frequency")
            
            # FINAL CHECK: Ensure no duplicate timestamps after processing
            if df_processed.index.duplicated().any():
                logger.error(f"Still have {df_processed.index.duplicated().sum()} duplicate timestamps after processing!")
                df_processed = df_processed[~df_processed.index.duplicated(keep='first')]
                logger.info(f"Final cleanup: {len(df_processed)} rows remaining")
            
        return df_processed
    
    def calculate_circulative_load(self, df: pd.DataFrame, rho_solid: float = 2900) -> pd.DataFrame:
        """
        Calculate circulative load for ball mill operations.
        
        The circulative load represents the ratio of material recirculated back to the mill
        from the cyclone compared to the fresh feed entering the system.
        
        Calculation steps:
            1. Calculate volumetric concentration (C_v) from pulp density
            2. Calculate mass concentration (C_m) from C_v
            3. Calculate mass flow of solids to cyclone (M_solid_to_cyclone) in t/h
            4. Calculate circulative load ratio: CL = (M_solid_to_cyclone - Fresh_Feed) / Fresh_Feed
        
        Args:
            df: DataFrame containing mill operation data
            rho_solid: Density of solid particles in kg/m³ (default: 2900 for copper ore)
        
        Required columns:
            - Ore: Fresh feed ore flow rate (t/h)
            - PulpHC: Pulp flow to hydrocyclone (m³/h)
            - DensityHC: Pulp density at hydrocyclone (kg/m³)
        
        Returns:
            DataFrame with added columns:
                - C_v: Volumetric concentration (fraction)
                - C_m: Mass concentration (fraction)
                - M_solid_to_cyclone: Mass flow of solids to cyclone (t/h)
                - CirculativeLoad: Circulative load ratio (dimensionless)
        
        Raises:
            ValueError: If required columns are missing
        """
        # Validate required columns
        required_cols = ['Ore', 'PulpHC', 'DensityHC']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns for circulative load calculation: {missing_cols}")
        
        logger.info("Calculating circulative load...")
        logger.info(f"  Using rho_solid = {rho_solid} kg/m³")
        
        # Create a copy to avoid modifying the original
        df = df.copy()
        
        # Constants
        rho_water = 1000  # kg/m³
        
        # Step 1: Calculate volumetric concentration (C_v) from pulp density
        # Formula: C_v = (rho_pulp - rho_water) / (rho_solid - rho_water)
        df['C_v'] = (df['DensityHC'] - rho_water) / (rho_solid - rho_water)
        
        # Clip C_v to valid range [0, 1]
        df['C_v'] = df['C_v'].clip(lower=0, upper=1)
        
        # Step 2: Calculate mass concentration (C_m)
        # Formula: C_m = (C_v * rho_solid) / (C_v * rho_solid + (1 - C_v) * rho_water)
        numerator = df['C_v'] * rho_solid
        denominator = df['C_v'] * rho_solid + (1 - df['C_v']) * rho_water
        df['C_m'] = numerator / denominator
        
        # Step 3: Calculate mass flow of solids to cyclone (t/h)
        # Formula: M_solid = PulpHC * DensityHC * C_m / 1000
        # PulpHC is in m³/h, DensityHC in kg/m³, divide by 1000 to get t/h
        df['M_solid_to_cyclone'] = (df['PulpHC'] * df['DensityHC'] * df['C_m']) / 1000
        
        # Step 4: Calculate circulative load ratio
        # Formula: CL = (M_solid_to_cyclone - Fresh_Feed) / Fresh_Feed
        # Avoid division by zero
        df['CirculativeLoad'] = np.where(
            df['Ore'] > 0,
            (df['M_solid_to_cyclone'] - df['Ore']) / df['Ore'],
            np.nan
        )
        
        # Log statistics
        valid_cl = df['CirculativeLoad'].dropna()
        if len(valid_cl) > 0:
            logger.info(f"  ✓ Circulative load calculated for {len(valid_cl)} rows")
            logger.info(f"    Mean: {valid_cl.mean():.3f}")
            logger.info(f"    Median: {valid_cl.median():.3f}")
            logger.info(f"    Std: {valid_cl.std():.3f}")
            logger.info(f"    Min: {valid_cl.min():.3f}")
            logger.info(f"    Max: {valid_cl.max():.3f}")
            
            # Check if values are in typical range
            in_range = ((valid_cl >= 1.5) & (valid_cl <= 3.0)).sum()
            pct_in_range = (in_range / len(valid_cl)) * 100
            logger.info(f"    Values in typical range [1.5, 3.0]: {in_range}/{len(valid_cl)} ({pct_in_range:.1f}%)")
            
            # Warn if many values are outside typical range
            if pct_in_range < 50:
                logger.warning(
                    f"  ⚠ Only {pct_in_range:.1f}% of circulative load values are in the typical range [1.5, 3.0]. "
                    "This may indicate unusual operating conditions or data quality issues."
                )
        else:
            logger.warning("  ⚠ No valid circulative load values calculated")
        
        return df

    def validate_circulative_load(self, df: pd.DataFrame, 
                                  min_valid: float = 0.5, 
                                  max_valid: float = 5.0) -> pd.DataFrame:
        """
        Validate and optionally filter circulative load values.
        
        Args:
            df: DataFrame with CirculativeLoad column
            min_valid: Minimum valid circulative load value
            max_valid: Maximum valid circulative load value
        
        Returns:
            DataFrame with validation info logged
        """
        if 'CirculativeLoad' not in df.columns:
            logger.warning("CirculativeLoad column not found in DataFrame")
            return df
        
        logger.info("Validating circulative load values...")
        
        total = len(df)
        valid = df['CirculativeLoad'].notna().sum()
        invalid = total - valid
        
        logger.info(f"  Total rows: {total}")
        logger.info(f"  Valid values: {valid} ({valid/total*100:.1f}%)")
        logger.info(f"  Invalid/NaN values: {invalid} ({invalid/total*100:.1f}%)")
        
        # Check range
        if valid > 0:
            out_of_range = ((df['CirculativeLoad'] < min_valid) | 
                           (df['CirculativeLoad'] > max_valid)).sum()
            logger.info(f"  Out of range [{min_valid}, {max_valid}]: {out_of_range} ({out_of_range/total*100:.1f}%)")
        
        return df
    
    def join_dataframes_on_timestamp(self, df1, df2):
        """
        Join two dataframes on their timestamp indices with robust error handling
        
        Args:
            df1: First DataFrame (usually mill data)
            df2: Second DataFrame (usually ore quality data)
            
        Returns:
            Joined DataFrame
        """
        try:
            # Make sure both dataframes have datetime indices
            for i, df in enumerate([df1, df2], 1):
                if not isinstance(df.index, pd.DatetimeIndex):
                    if 'TimeStamp' in df.columns:
                        df.set_index('TimeStamp', inplace=True)
                        logger.info(f"Set TimeStamp as index for dataframe {i}")
            
            # Check for duplicate indices before joining
            for i, df in enumerate([df1, df2], 1):
                if df.index.duplicated().any():
                    logger.error(f"Dataframe {i} still has {df.index.duplicated().sum()} duplicate timestamps!")
                    raise ValueError(f"Cannot join dataframes with duplicate timestamps in dataframe {i}")
            
            # Log dataframe info before joining
            logger.info(f"DF1 (mill): {len(df1)} rows, index range: {df1.index.min()} to {df1.index.max()}")
            logger.info(f"DF2 (ore): {len(df2)} rows, index range: {df2.index.min()} to {df2.index.max()}")
            
            # Find common timestamps
            common_index = df1.index.intersection(df2.index)
            logger.info(f"Found {len(common_index)} common timestamps")
            
            if len(common_index) == 0:
                logger.error("No common timestamps found between dataframes")
                logger.info(f"DF1 sample timestamps: {df1.index[:5].tolist()}")
                logger.info(f"DF2 sample timestamps: {df2.index[:5].tolist()}")
                raise ValueError("No overlapping timestamps between mill and ore quality data")
            
            # Align dataframes to common timestamps
            df1_aligned = df1.loc[common_index]
            df2_aligned = df2.loc[common_index]
            
            # Verify alignment
            if not df1_aligned.index.equals(df2_aligned.index):
                logger.error("Index alignment failed after intersection")
                raise ValueError("Failed to align dataframe indices")
            
            # Perform the join using pandas concat for better control
            joined_df = pd.concat([df1_aligned, df2_aligned], axis=1)
            
            # Final validation
            if joined_df.index.duplicated().any():
                logger.error(f"Joined dataframe has {joined_df.index.duplicated().sum()} duplicate timestamps!")
                raise ValueError("Join operation resulted in duplicate timestamps")
            
            # Log combined dataframe information
            logger.info(f"Successfully joined dataframes: {len(joined_df)} rows, {len(joined_df.columns)} columns")
            logger.info(f"Joined dataframe columns: {list(joined_df.columns)}")
            
            # Calculate CirculativeLoad if required columns are present
            required_cols_for_cl = ['Ore', 'PulpHC', 'DensityHC']
            if all(col in joined_df.columns for col in required_cols_for_cl):
                logger.info("All required columns present for CirculativeLoad calculation")
                try:
                    joined_df = self.calculate_circulative_load(joined_df)
                    joined_df = self.validate_circulative_load(joined_df)
                    logger.info("✓ CirculativeLoad calculation completed successfully")
                except Exception as e:
                    logger.error(f"Failed to calculate CirculativeLoad: {e}")
                    logger.warning("Continuing without CirculativeLoad column")
            else:
                missing = [col for col in required_cols_for_cl if col not in joined_df.columns]
                logger.warning(f"Cannot calculate CirculativeLoad - missing columns: {missing}")
            
            # Log head and tail of the combined dataframe
            logger.info("\n=== Combined Dataframe Head (first 3 rows) ===")
            logger.info(joined_df.head(3).to_string())
            logger.info("\n=== Combined Dataframe Tail (last 3 rows) ===")
            logger.info(joined_df.tail(3).to_string())
            logger.info("=" * 50)  # Separator for better readability
            
            return joined_df
            
        except Exception as e:
            logger.error(f"Error in join_dataframes_on_timestamp: {e}")
            raise
    
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
            logger.info(f"=== STARTING get_combined_data for Mill {mill_number} ===")
            logger.info(f"Request parameters - mill_number={mill_number}, start_date={start_date}, end_date={end_date}")
            logger.info(f"Additional parameters - resample_freq={resample_freq}, save_to_logs={save_to_logs}, no_interpolation={no_interpolation}")
            
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
                    filename = f"combined_data_mill{mill_number}.csv"
                    filepath = os.path.join(logs_dir, filename)
                    
                    # Save to CSV
                    combined_data.to_csv(filepath)
                    logger.info(f"Combined data saved to {filepath}")
                except Exception as e:
                    logger.error(f"Error saving combined data to logs: {e}")
            
            logger.info(f"=== COMPLETED get_combined_data for Mill {mill_number} ===")
            logger.info(f"Final result - {len(combined_data) if combined_data is not None else 0} total records")
            if combined_data is not None and not combined_data.empty:
                logger.info(f"Final date range: {combined_data.index.min()} to {combined_data.index.max()}")
                if 'CirculativeLoad' in combined_data.columns:
                    logger.info(f"✓ CirculativeLoad column present in final dataset")
            
            return combined_data
                
        except Exception as e:
            logger.error(f"Error combining data: {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return None
