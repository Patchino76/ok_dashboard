#!/usr/bin/env python3
"""
Test script to verify cascade endpoints are available
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint, method="GET", data=None):
    """Test an endpoint and return the result"""
    try:
        url = f"{BASE_URL}{endpoint}"
        print(f"\n🔍 Testing {method} {url}")
        
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data, headers={"Content-Type": "application/json"})
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("🧪 Testing Cascade Endpoints Availability")
    print("=" * 50)
    
    # Test main health endpoint
    test_endpoint("/health")
    
    # Test ML system info
    test_endpoint("/api/ml/info")
    
    # Test cascade health
    test_endpoint("/api/v1/ml/cascade/health")
    
    # Test cascade info
    test_endpoint("/api/v1/ml/cascade/info")
    
    # Test cascade models list
    test_endpoint("/api/v1/ml/cascade/models")
    
    # Test loading Mill 7 models
    test_endpoint("/api/v1/ml/cascade/models/7/load", method="POST")
    
    # Test cascade prediction with sample data
    prediction_data = {
        "mv_values": {
            "Ore": 150.0,
            "WaterMill": 25.0,
            "WaterZumpf": 200.0,
            "MotorAmp": 220.0
        },
        "dv_values": {
            "Shisti": 15.0,
            "Daiki": 8.0,
            "Grano": 12.0
        }
    }
    test_endpoint("/api/v1/ml/cascade/predict", method="POST", data=prediction_data)

if __name__ == "__main__":
    main()
