"""
Schema request for cascade optimization testing
"""

import requests
import json

# Complete schema request for testing
OPTIMIZATION_REQUEST = {
    "mv_bounds": {
        "Ore": [140, 240],           # Ore feed rate (t/h)
        "WaterMill": [5, 25],        # Mill water flow (m³/h)
        "WaterZumpf": [140, 250],    # Sump water flow (m³/h)
        "MotorAmp": [150, 250]       # Motor current (A)
    },
    "cv_bounds": {
        "PulpHC": [400, 600],        # Hydrocyclone pulp flow (m³/h)
        "DensityHC": [1200, 2000],   # Hydrocyclone density (kg/m³)
        "PressureHC": [0.0, 0.6]     # Hydrocyclone pressure (bar)
    },
    "dv_values": {
        "Shisti": 50.0,             # Shale content (%)
        "Daiki": 40.0,              # Dyke content (%)
        "Grano": 60.0,              # Granodiorite content (%)
        "Class_12": 45.0,           # +12mm fraction (%)
        "Class_15": 35.0,           # +15mm fraction (%)
        "FE": 0.2                   # Iron content (%)
    },
    "target_variable": "PSI200",    # Target to optimize
    "maximize": False,              # Minimize PSI200
    "n_trials": 20                  # Number of optimization trials
}

# Alternative requests for different scenarios
MINIMIZE_PSI200_REQUEST = {
    "mv_bounds": {
        "Ore": [160, 200],
        "WaterMill": [10, 20],
        "WaterZumpf": [180, 220],
        "MotorAmp": [180, 220]
    },
    "cv_bounds": {
        "PulpHC": [450, 550],
        "DensityHC": [1400, 1800],
        "PressureHC": [0.2, 0.5]
    },
    "dv_values": {
        "Shisti": 30.0,    # Soft ore scenario
        "Daiki": 25.0,
        "Grano": 70.0,
        "Class_12": 40.0,
        "Class_15": 30.0,
        "FE": 0.15
    },
    "target_variable": "PSI200",
    "maximize": False,
    "n_trials": 15
}

MAXIMIZE_PSI200_REQUEST = {
    "mv_bounds": {
        "Ore": [140, 240],
        "WaterMill": [5, 25],
        "WaterZumpf": [140, 250],
        "MotorAmp": [150, 250]
    },
    "cv_bounds": {
        "PulpHC": [400, 600],
        "DensityHC": [1200, 2000],
        "PressureHC": [0.0, 0.6]
    },
    "dv_values": {
        "Shisti": 80.0,    # Hard ore scenario
        "Daiki": 70.0,
        "Grano": 20.0,
        "Class_12": 60.0,
        "Class_15": 50.0,
        "FE": 0.3
    },
    "target_variable": "PSI200",
    "maximize": True,   # Maximize PSI200
    "n_trials": 25
}

def test_schema_request(request_data, description=""):
    """Test a specific schema request"""
    BASE_URL = "http://localhost:8000"
    
    print(f"\n🧪 Testing: {description}")
    print("=" * 50)
    
    # Step 1: Load models
    print("📂 Loading models...")
    try:
        response = requests.post(f"{BASE_URL}/api/v1/cascade/models/8/load")
        if response.status_code != 200:
            print(f"❌ Model loading failed: {response.status_code}")
            return False
        print("✅ Models loaded")
    except Exception as e:
        print(f"❌ Model loading error: {e}")
        return False
    
    # Step 2: Send optimization request
    print(f"\n🎯 Sending optimization request...")
    print(f"   MV bounds: {request_data['mv_bounds']}")
    print(f"   Target: {request_data['target_variable']}")
    print(f"   Direction: {'Maximize' if request_data['maximize'] else 'Minimize'}")
    print(f"   Trials: {request_data['n_trials']}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/cascade/optimize",
            json=request_data,
            timeout=120
        )
        
        print(f"\n📥 Response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS!")
            print(f"   Status: {result.get('status')}")
            print(f"   Best target: {result.get('best_target_value', 'N/A'):.2f}")
            print(f"   Feasible: {result.get('is_feasible')}")
            print(f"   Trials completed: {result.get('n_trials')}")
            
            # Show optimal settings
            best_mvs = result.get('best_mv_values', {})
            print(f"\n📊 Optimal MV Settings:")
            for mv_name, mv_value in best_mvs.items():
                print(f"     {mv_name}: {mv_value:.2f}")
            
            # Show predicted CVs
            best_cvs = result.get('best_cv_values', {})
            print(f"\n📈 Predicted CV Values:")
            for cv_name, cv_value in best_cvs.items():
                print(f"     {cv_name}: {cv_value:.2f}")
            
            return True
        else:
            print("❌ FAILED!")
            try:
                error = response.json()
                print(f"   Error: {error.get('detail', 'No detail')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Request error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 CASCADE OPTIMIZATION SCHEMA TESTING")
    print("=" * 60)
    
    # Test different scenarios
    scenarios = [
        (OPTIMIZATION_REQUEST, "Standard Optimization (Minimize PSI200)"),
        (MINIMIZE_PSI200_REQUEST, "Soft Ore Scenario (Minimize PSI200)"),
        (MAXIMIZE_PSI200_REQUEST, "Hard Ore Scenario (Maximize PSI200)")
    ]
    
    results = []
    for request_data, description in scenarios:
        success = test_schema_request(request_data, description)
        results.append((description, success))
        
        if not success:
            print(f"\n⚠️  Stopping tests - first failure encountered")
            break
    
    # Summary
    print(f"\n📋 TEST SUMMARY")
    print("=" * 30)
    for description, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} {description}")
    
    print(f"\n💡 Instructions:")
    print(f"   1. Run this script: python test_schema_request.py")
    print(f"   2. Check server console for debug output")
    print(f"   3. Report any errors or success results")

# For manual testing - copy this JSON to use with curl or Postman:
CURL_EXAMPLE = '''
# Example curl command:
curl -X POST "http://localhost:8000/api/v1/cascade/optimize" \\
     -H "Content-Type: application/json" \\
     -d '{
       "mv_bounds": {
         "Ore": [140, 240],
         "WaterMill": [5, 25],
         "WaterZumpf": [140, 250],
         "MotorAmp": [150, 250]
       },
       "cv_bounds": {
         "PulpHC": [400, 600],
         "DensityHC": [1200, 2000],
         "PressureHC": [0.0, 0.6]
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
       "maximize": false,
       "n_trials": 20
     }'
'''

if __name__ == "__main__":
    print("\n" + "="*60)
    print("CURL EXAMPLE FOR MANUAL TESTING:")
    print(CURL_EXAMPLE)
