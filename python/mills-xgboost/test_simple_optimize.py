"""
Simple test for cascade optimization endpoint
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_simple_optimization():
    """Test with minimal request"""
    print("🧪 Testing Simple Optimization")
    
    # Very simple request
    simple_request = {
        "mv_bounds": {
            "Ore": [150, 200],
            "WaterMill": [10, 20],
            "WaterZumpf": [150, 200],
            "MotorAmp": [160, 200]
        },
        "cv_bounds": {
            "PulpHC": [450, 550],
            "DensityHC": [1400, 1600],
            "PressureHC": [0.2, 0.4]
        },
        "dv_values": {
            "Shisti": 50.0,
            "Daiki": 40.0,
            "Grano": 60.0,
            "Class_12": 45.0,
            "Class_15": 35.0,
            "FE": 0.2
        },
        "target_variable": "PSI200",
        "maximize": False,
        "n_trials": 5  # Very small number
    }
    
    try:
        print("📤 Sending request...")
        response = requests.post(
            f"{BASE_URL}/api/v1/cascade/optimize",
            json=simple_request,
            timeout=30
        )
        
        print(f"📥 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"   Best target: {result.get('best_target_value')}")
            print(f"   Feasible: {result.get('is_feasible')}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   Detail: {error_detail}")
            except:
                print(f"   Raw response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_model_status():
    """Check if models are actually loaded"""
    print("\n🔍 Checking Model Status")
    
    try:
        # Check cascade info
        response = requests.get(f"{BASE_URL}/api/v1/cascade/info")
        if response.status_code == 200:
            info = response.json()
            models_trained = info.get('model_status', {}).get('models_trained', False)
            print(f"   Models trained: {models_trained}")
            
            if not models_trained:
                print("   ⚠️  Models not trained - this might be the issue")
                return False
        
        # Try a simple prediction first
        pred_request = {
            "mv_values": {"Ore": 180, "WaterMill": 15, "WaterZumpf": 180, "MotorAmp": 180},
            "dv_values": {"Shisti": 50.0, "Daiki": 40.0, "Grano": 60.0, "Class_12": 45.0, "Class_15": 35.0, "FE": 0.2}
        }
        
        response = requests.post(f"{BASE_URL}/api/v1/cascade/predict", json=pred_request)
        if response.status_code == 200:
            print("   ✅ Prediction works")
            return True
        else:
            print(f"   ❌ Prediction failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Simple Cascade Optimization Test")
    print("=" * 40)
    
    # First check if models work
    models_ok = test_model_status()
    
    if models_ok:
        # Then try optimization
        test_simple_optimization()
    else:
        print("\n💡 Models not ready - optimization will fail")
        print("   Try loading models first: POST /api/v1/cascade/models/8/load")
