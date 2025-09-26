"""
Test script to verify cascade endpoints are accessible and working
"""

import requests
import json
from datetime import datetime

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_cascade_endpoints():
    """Test all cascade endpoints"""
    
    print("🧪 Testing Cascade Endpoints")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/ml/cascade/health")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 2: Info endpoint
    print("\n2. Testing info endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/ml/cascade/info")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 3: Models endpoint
    print("\n3. Testing models endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/ml/cascade/models")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 4: Training status endpoint
    print("\n4. Testing training status endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/ml/cascade/training/status")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 5: NEW Target-driven optimization endpoint
    print("\n5. Testing NEW target-driven optimization endpoint...")
    try:
        # Sample request for target-driven optimization
        request_data = {
            "mill_number": 8,
            "target_value": 23.0,
            "target_variable": "PSI200",
            "tolerance": 0.01,
            "mv_bounds": {
                "Ore": [180, 220],
                "WaterMill": [15, 25],
                "WaterZumpf": [200, 250],
                "MotorAmp": [220, 250]
            },
            "cv_bounds": {
                "PulpHC": [400, 600],
                "DensityHC": [1200, 1400],
                "PressureHC": [80, 120]
            },
            "dv_values": {
                "Shisti": 10.0,
                "Daiki": 15.0,
                "Grano": 20.0
            },
            "n_trials": 50,  # Small number for testing
            "confidence_level": 0.90
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ml/cascade/optimize-target",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Target achieved: {data.get('target_achieved', 'N/A')}")
            print(f"   Success rate: {data.get('success_rate', 'N/A')}")
            print(f"   Successful trials: {data.get('successful_trials', 'N/A')}/{data.get('total_trials', 'N/A')}")
            print(f"   Best distance: {data.get('best_distance', 'N/A')}")
            print(f"   MV distributions: {len(data.get('mv_distributions', {}))}")
            print(f"   CV distributions: {len(data.get('cv_distributions', {}))}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 6: Regular optimization endpoint (for comparison)
    print("\n6. Testing regular optimization endpoint...")
    try:
        # Sample request for regular optimization
        request_data = {
            "mill_number": 8,
            "mv_bounds": {
                "Ore": [180, 220],
                "WaterMill": [15, 25],
                "WaterZumpf": [200, 250],
                "MotorAmp": [220, 250]
            },
            "cv_bounds": {
                "PulpHC": [400, 600],
                "DensityHC": [1200, 1400],
                "PressureHC": [80, 120]
            },
            "dv_values": {
                "Shisti": 10.0,
                "Daiki": 15.0,
                "Grano": 20.0
            },
            "target_variable": "PSI200",
            "maximize": False,
            "n_trials": 50
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ml/cascade/optimize",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Best target value: {data.get('best_target_value', 'N/A')}")
            print(f"   Is feasible: {data.get('is_feasible', 'N/A')}")
            print(f"   Best MV values: {len(data.get('best_mv_values', {}))}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")

def test_fastapi_docs():
    """Test if endpoints are visible in FastAPI docs"""
    print("\n🔍 Testing FastAPI Documentation")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/docs")
        print(f"FastAPI docs status: {response.status_code}")
        
        # Check if cascade endpoints are mentioned in the docs
        if response.status_code == 200:
            content = response.text
            if "cascade" in content.lower():
                print("✅ Cascade endpoints found in FastAPI docs")
            else:
                print("❌ Cascade endpoints NOT found in FastAPI docs")
                
            if "optimize-target" in content:
                print("✅ Target-driven optimization endpoint found in docs")
            else:
                print("❌ Target-driven optimization endpoint NOT found in docs")
        
    except Exception as e:
        print(f"Exception testing docs: {e}")

if __name__ == "__main__":
    test_cascade_endpoints()
    test_fastapi_docs()
    
    print("\n" + "=" * 50)
    print("🎯 Summary:")
    print("- Regular optimization: /api/v1/ml/cascade/optimize")
    print("- NEW Target-driven optimization: /api/v1/ml/cascade/optimize-target")
    print("- Check FastAPI docs at: http://localhost:8000/docs")
    print("=" * 50)
