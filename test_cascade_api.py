#!/usr/bin/env python3
"""
Test script to verify cascade API endpoints are working correctly
"""
import requests
import json

def test_cascade_endpoints():
    base_url = "http://localhost:8000/api/v1/ml/cascade"
    
    print("🧪 Testing Cascade API Endpoints")
    print("=" * 50)
    
    # Test 1: List all available models
    print("\n1️⃣ Testing GET /models")
    try:
        response = requests.get(f"{base_url}/models")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"📊 Available mills: {list(data.get('mill_models', {}).keys())}")
            print(f"🔢 Total mills: {data.get('total_mills', 0)}")
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Get specific mill model info
    mill_number = 7
    print(f"\n2️⃣ Testing GET /models/{mill_number}")
    try:
        response = requests.get(f"{base_url}/models/{mill_number}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"🏭 Mill: {data.get('mill_number')}")
            
            model_info = data.get('model_info', {})
            print(f"📁 Model info keys: {list(model_info.keys())}")
            
            # Check feature classification
            feature_classification = model_info.get('feature_classification', {})
            if feature_classification:
                print(f"🔧 MV Features: {feature_classification.get('mv_features', [])}")
                print(f"📊 CV Features: {feature_classification.get('cv_features', [])}")
                print(f"🧪 DV Features: {feature_classification.get('dv_features', [])}")
                print(f"🎯 Target Features: {feature_classification.get('target_features', [])}")
            
            # Check all features
            all_features = model_info.get('all_features', [])
            print(f"📋 All Features ({len(all_features)}): {all_features}")
            
            # Check target variable
            target_variable = model_info.get('target_variable')
            print(f"🎯 Target Variable: {target_variable}")
            
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 3: Load model into memory
    print(f"\n3️⃣ Testing POST /models/{mill_number}/load")
    try:
        response = requests.post(f"{base_url}/models/{mill_number}/load")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"📝 Message: {data.get('message', 'No message')}")
            print(f"🏭 Mill: {data.get('mill_number')}")
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("🏁 Cascade API Test Complete")

if __name__ == "__main__":
    test_cascade_endpoints()
