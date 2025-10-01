import pandas as pd
import numpy as np

# Load the combined data
df = pd.read_csv(r'c:\Projects\ok_dashboard\python\mills-xgboost\app\optimization_cascade\logs\combined_data_mill6.csv')

print("=== CASCADE TRAINING DATA ANALYSIS ===\n")
print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}")
print(f"Columns: {list(df.columns)}\n")

# Check for NaN values
print("=== NaN ANALYSIS ===")
nan_counts = df.isna().sum()
nan_cols = nan_counts[nan_counts > 0]
if len(nan_cols) > 0:
    print(nan_cols)
else:
    print("No NaN values found")

# Check for infinite values
print("\n=== INFINITE VALUES ANALYSIS ===")
numeric_cols = df.select_dtypes(include=[np.number]).columns
inf_found = False
for col in numeric_cols:
    inf_count = np.isinf(df[col]).sum()
    if inf_count > 0:
        print(f"{col}: {inf_count} infinite values")
        inf_found = True
if not inf_found:
    print("No infinite values found")

# Simulate the cleaning process
print("\n=== CLEANING SIMULATION (OLD METHOD) ===")
print(f"Step 1 - Original: {len(df)} rows")
df_test = df.dropna()
print(f"Step 2 - After dropna(): {len(df_test)} rows ❌ REMOVES ALL DATA")

print("\n=== CLEANING SIMULATION (NEW METHOD - FIXED) ===")
print(f"Step 1 - Original: {len(df)} rows")

# Step 1: Drop columns that are entirely NaN
df_clean = df.dropna(axis=1, how='all')
print(f"Step 2 - After dropping empty columns: {len(df_clean)} rows, {len(df_clean.columns)} columns")

# Step 2: Drop rows with any remaining NaN
df_clean = df_clean.dropna(axis=0)
print(f"Step 3 - After removing rows with NaN: {len(df_clean)} rows")

if len(df_clean) > 0:
    numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
    inf_mask = np.isinf(df_clean[numeric_cols]).any(axis=1)
    df_clean = df_clean[~inf_mask]
    print(f"Step 3 - After removing inf: {len(df_clean)} rows")
    
    # Check for duplicates
    if isinstance(df_clean.index, pd.DatetimeIndex):
        duplicates = df_clean.index.duplicated()
        if duplicates.any():
            print(f"Step 4 - Found {duplicates.sum()} duplicate timestamps")
            df_clean = df_clean[~duplicates]
            print(f"Step 4 - After removing duplicates: {len(df_clean)} rows")
else:
    print("Step 3 - STOPPED: No rows remaining after dropna()")

print(f"\n=== FINAL RESULT ===")
print(f"Rows remaining: {len(df_clean)}")
print(f"Data reduction: {((len(df) - len(df_clean)) / len(df) * 100):.1f}%")

# Check required features
required_features = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp', 
                     'PulpHC', 'DensityHC', 'PressureHC', 
                     'Shisti', 'Daiki', 'Grano', 'PSI200']

print(f"\n=== REQUIRED FEATURES CHECK ===")
for feature in required_features:
    if feature in df.columns:
        print(f"✅ {feature}")
    else:
        print(f"❌ {feature} - MISSING!")
