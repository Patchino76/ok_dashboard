"""
Utility functions for data processing and cleaning
"""
import numpy as np
import logging

logger = logging.getLogger(__name__)

def clean_array_outliers(values, threshold=3.0):
    """
    Clean outliers from a numpy array using z-score method
    
    Args:
        values: Numpy array of values to clean
        threshold: Z-score threshold for outlier detection (default: 3.0)
        
    Returns:
        Numpy array with outliers replaced with NaN
    """
    try:
        # Make a copy to avoid modifying the original
        cleaned = np.copy(values)
        
        # Calculate mean and standard deviation, ignoring NaN values
        mean = np.nanmean(cleaned)
        std = np.nanstd(cleaned)
        
        # If standard deviation is too small, return original values
        if std < 1e-10:
            return cleaned
        
        # Calculate z-scores
        z_scores = np.abs((cleaned - mean) / std)
        
        # Replace outliers with NaN
        cleaned[z_scores > threshold] = np.nan
        
        return cleaned
    except Exception as e:
        logger.error(f"Error cleaning outliers: {e}")
        # Return original values if there's an error
        return values

def clean_df_outliers(df, column, threshold=3.0):
    """
    Clean outliers from a DataFrame column using z-score method
    
    Args:
        df: Pandas DataFrame
        column: Column name to clean
        threshold: Z-score threshold for outlier detection (default: 3.0)
        
    Returns:
        DataFrame with outliers in the specified column replaced with NaN
    """
    try:
        # Make a copy to avoid modifying the original
        df_copy = df.copy()
        
        # Calculate mean and standard deviation, ignoring NaN values
        mean = df_copy[column].mean()
        std = df_copy[column].std()
        
        # If standard deviation is too small, return original DataFrame
        if std < 1e-10:
            return df_copy
        
        # Calculate z-scores
        z_scores = np.abs((df_copy[column] - mean) / std)
        
        # Replace outliers with NaN
        df_copy.loc[z_scores > threshold, column] = np.nan
        
        return df_copy
    except Exception as e:
        logger.error(f"Error cleaning outliers in DataFrame: {e}")
        # Return original DataFrame if there's an error
        return df
