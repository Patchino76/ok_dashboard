"""
Quick script to reload Mill 6 cascade model
Run this to load the newly trained model into memory
"""
import requests

API_URL = "http://localhost:8000"

print("🔄 Reloading Mill 6 cascade model...")

try:
    response = requests.post(f"{API_URL}/api/v1/ml/cascade/models/6/load")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {data['message']}")
        print(f"\nModel Summary:")
        print(f"  Mill: {data['mill_number']}")
        print(f"  Process models: {data['summary']['process_models']}")
        print(f"  Quality model: {data['summary']['quality_model_trained']}")
        print(f"  Path: {data['summary']['model_save_path']}")
        
        # Check if DVs are included
        metadata = data['summary'].get('metadata', {})
        configured_features = metadata.get('training_config', {}).get('configured_features', {})
        dv_features = configured_features.get('dv_features', [])
        
        print(f"\n📊 Feature Configuration:")
        print(f"  MV features: {configured_features.get('mv_features', [])}")
        print(f"  CV features: {configured_features.get('cv_features', [])}")
        print(f"  DV features: {dv_features}")
        
        # Check quality model input vars
        quality_model = metadata.get('model_performance', {}).get('quality_model', {})
        input_vars = quality_model.get('input_vars', [])
        
        print(f"\n🎯 Quality Model:")
        print(f"  Input vars: {input_vars}")
        print(f"  Total features: {len(input_vars)}")
        
        if dv_features:
            print(f"\n✅ Model includes DVs: {dv_features}")
            print(f"   Predictions MUST include DV values")
        else:
            print(f"\n✅ Model does NOT include DVs")
            print(f"   Predictions should work WITHOUT DV values")
            print(f"   Quality model uses only CVs: {input_vars}")
            
    else:
        print(f"❌ Failed to reload model: {response.status_code}")
        print(f"   Response: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("❌ Cannot connect to API server. Is it running?")
    print("   Start it with: python python/api.py")
except Exception as e:
    print(f"❌ Error: {e}")
