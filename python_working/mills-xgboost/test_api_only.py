"""
Test API optimization after loading models
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_api_optimization():
    """Test API optimization step by step"""
    print("🚀 API Optimization Test")
    print("=" * 30)
    
    # Step 1: Load models
    print("\n📂 Step 1: Loading models...")
    try:
        response = requests.post(f"{BASE_URL}/api/v1/cascade/models/8/load")
        if response.status_code == 200:
            print("✅ Models loaded")
        else:
            print(f"❌ Model loading failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Step 2: Check model status
    print("\n🔍 Step 2: Checking model status...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/cascade/info")
        if response.status_code == 200:
            info = response.json()
            models_trained = info.get('model_status', {}).get('models_trained', False)
            print(f"   Models trained: {models_trained}")
            if not models_trained:
                print("   ⚠️  Models still not trained after loading!")
                return False
        else:
            print(f"❌ Info check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Step 3: Try optimization with minimal request
    print("\n🎯 Step 3: Testing optimization...")
    opt_request = {
        "mv_bounds": {
            "Ore": [160, 200],
            "WaterMill": [12, 18],
            "WaterZumpf": [170, 210],
            "MotorAmp": [170, 210]
        },
        "cv_bounds": {
            "PulpHC": [480, 520],
            "DensityHC": [1500, 1700],
            "PressureHC": [0.25, 0.35]
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
        "n_trials": 10
    }
    
    try:
        print("   Sending optimization request...")
        print("   (Check server console for debug output)")
        
        response = requests.post(
            f"{BASE_URL}/api/v1/cascade/optimize",
            json=opt_request,
            timeout=60
        )
        
        print(f"   Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Optimization successful!")
            print(f"   Best target: {result.get('best_target_value', 'N/A'):.2f}")
            print(f"   Feasible: {result.get('is_feasible', 'N/A')}")
            print(f"   Trials: {result.get('n_trials', 'N/A')}")
            return True
        else:
            print(f"❌ Optimization failed: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error detail: {error.get('detail', 'No detail')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

if __name__ == "__main__":
    success = test_api_optimization()
    
    if success:
        print(f"\n🎉 API optimization works!")
    else:
        print(f"\n⚠️  API optimization failed")
        print(f"\n💡 Check server console for debug output:")
        print(f"   - Look for '🔍 Optimization request received'")
        print(f"   - Look for any error messages or stack traces")
        print(f"   - The debug logging should show exactly where it fails")
