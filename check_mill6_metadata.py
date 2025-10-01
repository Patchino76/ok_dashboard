import os
import json
from datetime import datetime

metadata_path = r'c:\Projects\ok_dashboard\python\mills-xgboost\app\optimization_cascade\cascade_models\mill_6\metadata.json'

print("=== MILL 6 MODEL METADATA CHECK ===\n")

# Check file modification time
mod_time = os.path.getmtime(metadata_path)
mod_datetime = datetime.fromtimestamp(mod_time)
print(f"Metadata file last modified: {mod_datetime}")

# Load and check metadata
with open(metadata_path) as f:
    data = json.load(f)

print(f"\n=== TRAINING CONFIGURATION ===")
training_config = data.get('training_config', {})
print(f"Training timestamp: {training_config.get('training_timestamp')}")
print(f"Data shape: {training_config.get('data_shape')}")

configured_features = training_config.get('configured_features', {})
print(f"\n=== CONFIGURED FEATURES ===")
print(f"MV features: {configured_features.get('mv_features', [])}")
print(f"CV features: {configured_features.get('cv_features', [])}")
print(f"DV features: {configured_features.get('dv_features', [])}")
print(f"Target: {configured_features.get('target_variable')}")
print(f"Using custom features: {configured_features.get('using_custom_features')}")

print(f"\n=== QUALITY MODEL ===")
quality_model = data.get('model_performance', {}).get('quality_model', {})
print(f"R² Score: {quality_model.get('r2_score')}")
print(f"RMSE: {quality_model.get('rmse')}")
print(f"Input vars: {quality_model.get('input_vars', [])}")
print(f"CV vars: {quality_model.get('cv_vars', [])}")
print(f"DV vars: {quality_model.get('dv_vars', [])}")

# Check if DVs are in the model
input_vars = quality_model.get('input_vars', [])
has_dvs = any(dv in input_vars for dv in ['Shisti', 'Daiki', 'Grano'])

print(f"\n=== ANALYSIS ===")
if has_dvs:
    print("⚠️  Model EXPECTS DVs (Shisti, Daiki, Grano)")
    print("   Predictions MUST include DV values")
else:
    print("✅ Model does NOT expect DVs")
    print("   Predictions should work without DV values")

print(f"\nTotal input features: {len(input_vars)}")
print(f"Features: {input_vars}")
