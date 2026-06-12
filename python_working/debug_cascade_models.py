import sys
import os
import json

# Add mills-xgboost to path
current_dir = os.getcwd()
mills_xgboost_path = os.path.join(current_dir, "mills-xgboost")
if os.path.exists(mills_xgboost_path):
    sys.path.append(mills_xgboost_path)
    print(f"Added {mills_xgboost_path} to sys.path")
else:
    print(f"Could not find {mills_xgboost_path}")

try:
    print("Attempting to import CascadeModelManager...")
    from app.optimization_cascade.cascade_models import CascadeModelManager
    print("Successfully imported CascadeModelManager")
    
    base_path = os.path.join(mills_xgboost_path, "app", "optimization_cascade", "cascade_models")
    print(f"Listing models from: {base_path}")
    
    if not os.path.exists(base_path):
        print(f"Base path does not exist: {base_path}")
        # Try creating it to see if permissions are issue
        # os.makedirs(base_path, exist_ok=True)
    
    models = CascadeModelManager.list_mill_models(base_path)
    print(f"Models found keys: {list(models.keys())}")
    
    # Try creating an instance like the endpoint does
    print("Attempting to instantiate CascadeModelManager()...")
    temp_manager = CascadeModelManager()
    print("CascadeModelManager instantiated successfully")
    
    print("Attempting to sanitize data...")
    sanitized = temp_manager.sanitize_json_data(models)
    print("Sanitization successful")
    
    print("Success!")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
