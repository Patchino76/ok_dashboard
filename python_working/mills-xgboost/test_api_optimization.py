"""
Test Script for Cascade Optimization API

Tests the /api/v1/cascade/optimize endpoint with various scenarios.
"""

import requests
import json
import time

# API base URL (adjust if needed)
BASE_URL = "http://localhost:8000"

def test_cascade_optimization_api():
    """Test the cascade optimization API endpoint"""
    print("🚀 Testing Cascade Optimization API")
    print("=" * 50)
    
    # Test 1: Health Check
    print("\n🏥 Test 1: Health Check")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/cascade/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ Health check passed")
            print(f"   Status: {health.get('status')}")
            print(f"   Available mills: {health.get('available_mills', [])}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Test 2: Load Mill 8 Models (if available)
    print(f"\n📂 Test 2: Load Mill 8 Models")
    try:
        response = requests.post(f"{BASE_URL}/api/v1/cascade/models/8/load")
        if response.status_code == 200:
            print(f"✅ Models loaded successfully")
        else:
            print(f"⚠️  Model loading failed: {response.status_code}")
            print(f"   This is expected if no trained models exist")
    except Exception as e:
        print(f"❌ Model loading error: {e}")
    
    # Test 3: Basic Optimization Request
    print(f"\n🎯 Test 3: Basic Optimization")
    
    optimization_request = {
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
        "maximize": False,
        "n_trials": 20  # Small number for quick test
    }
    
    try:
        print(f"   Sending optimization request...")
        start_time = time.time()
        
        response = requests.post(
            f"{BASE_URL}/api/v1/cascade/optimize",
            json=optimization_request,
            timeout=60  # 60 second timeout
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Optimization completed in {duration:.1f}s")
            print(f"   Status: {result.get('status')}")
            print(f"   Best target: {result.get('best_target_value', 'N/A')}")
            print(f"   Feasible: {result.get('is_feasible', 'N/A')}")
            print(f"   Trials: {result.get('n_trials', 'N/A')}")
            
            # Show best MV values
            best_mvs = result.get('best_mv_values', {})
            if best_mvs:
                print(f"   Best MVs:")
                for mv_name, mv_value in best_mvs.items():
                    print(f"     {mv_name}: {mv_value:.2f}")
            
            return True
            
        elif response.status_code == 400:
            error = response.json()
            print(f"⚠️  Optimization failed (expected if no models): {error.get('detail')}")
            return False
            
        else:
            print(f"❌ Optimization failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"⏰ Optimization timed out (>60s)")
        return False
    except Exception as e:
        print(f"❌ Optimization error: {e}")
        return False

def test_different_scenarios():
    """Test optimization with different scenarios"""
    print(f"\n🔄 Testing Different Scenarios")
    print("=" * 30)
    
    scenarios = [
        {
            "name": "Maximize PSI200",
            "request": {
                "mv_bounds": {"Ore": [160, 200], "WaterMill": [10, 20], "WaterZumpf": [180, 220], "MotorAmp": [180, 220]},
                "cv_bounds": {"PulpHC": [450, 550], "DensityHC": [1400, 1800], "PressureHC": [0.2, 0.5]},
                "dv_values": {"Shisti": 30.0, "Daiki": 25.0, "Grano": 70.0, "Class_12": 40.0, "Class_15": 30.0, "FE": 0.15},
                "target_variable": "PSI200",
                "maximize": True,
                "n_trials": 15
            }
        },
        {
            "name": "Hard Ore Scenario",
            "request": {
                "mv_bounds": {"Ore": [140, 240], "WaterMill": [5, 25], "WaterZumpf": [140, 250], "MotorAmp": [150, 250]},
                "cv_bounds": {"PulpHC": [400, 600], "DensityHC": [1200, 2000], "PressureHC": [0.0, 0.6]},
                "dv_values": {"Shisti": 80.0, "Daiki": 70.0, "Grano": 20.0, "Class_12": 60.0, "Class_15": 50.0, "FE": 0.3},
                "target_variable": "PSI200",
                "maximize": False,
                "n_trials": 15
            }
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n📊 Scenario {i}: {scenario['name']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/cascade/optimize",
                json=scenario['request'],
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Target: {result.get('best_target_value', 'N/A'):.2f}")
                print(f"   ✅ Feasible: {result.get('is_feasible', 'N/A')}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

def main():
    """Main test function"""
    print("🧪 Cascade Optimization API Test Suite")
    print("=" * 60)
    
    # Run basic tests
    success = test_cascade_optimization_api()
    
    if success:
        # Run scenario tests
        test_different_scenarios()
        print(f"\n🎉 All tests completed!")
    else:
        print(f"\n⚠️  Basic tests failed - check if:")
        print(f"   1. API server is running on {BASE_URL}")
        print(f"   2. Cascade models are trained for Mill 8")
        print(f"   3. All dependencies are installed")
    
    print(f"\n📚 See CASCADE_OPTIMIZATION_GUIDE.md for detailed usage")

if __name__ == "__main__":
    main()
