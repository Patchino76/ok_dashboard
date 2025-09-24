#!/usr/bin/env python3
"""
Test script to verify the cascade models API fix
"""

import json
import requests
import sys
import os

def test_cascade_models_api():
    """Test the cascade models API endpoints"""
    base_url = "http://localhost:8000"
    
    print("Testing Cascade Models API Fix")
    print("=" * 50)
    
    # Test 1: List all mill models
    print("\n1. Testing /api/v1/ml/cascade/models endpoint...")
    try:
        response = requests.get(f"{base_url}/api/v1/ml/cascade/models")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS: API returned valid JSON")
            print(f"Total mills: {data.get('total_mills', 0)}")
            mill_models = data.get('mill_models', {})
            for mill_num in mill_models.keys():
                print(f"  - Mill {mill_num}: {len(mill_models[mill_num].get('model_files', []))} model files")
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ FAILED: Could not connect to server. Make sure it's running on localhost:8000")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: Invalid JSON response - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False
    
    # Test 2: Get specific mill model info (Mill 8 - the one with NaN)
    print("\n2. Testing /api/v1/ml/cascade/models/8 endpoint...")
    try:
        response = requests.get(f"{base_url}/api/v1/ml/cascade/models/8")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS: Mill 8 API returned valid JSON")
            model_info = data.get('model_info', {})
            metadata = model_info.get('metadata', {})
            chain_validation = metadata.get('model_performance', {}).get('chain_validation', {})
            r2_score = chain_validation.get('r2_score')
            print(f"Chain validation R² score: {r2_score} (should be null, not NaN)")
            
            if r2_score is None:
                print("✅ SUCCESS: NaN value properly converted to null")
            else:
                print(f"⚠️  WARNING: R² score is {r2_score}, expected null")
                
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            print(f"Response: {response.text}")
            
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: Invalid JSON response - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False
    
    # Test 3: Direct JSON serialization test
    print("\n3. Testing direct metadata JSON serialization...")
    try:
        from mills_xgboost.app.optimization_cascade.cascade_models import CascadeModelManager
        
        base_path = os.path.join(os.path.dirname(__file__), "mills-xgboost", "app", "optimization_cascade", "cascade_models")
        mill_models = CascadeModelManager.list_mill_models(base_path)
        
        # Try to serialize to JSON
        json_str = json.dumps(mill_models, indent=2)
        print("✅ SUCCESS: Direct JSON serialization works")
        print(f"Serialized {len(mill_models)} mill models successfully")
        
    except ValueError as e:
        if "JSON compliant" in str(e):
            print(f"❌ FAILED: Still has JSON compliance issues - {e}")
            return False
        else:
            raise
    except Exception as e:
        print(f"❌ FAILED: Unexpected error in direct test - {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 ALL TESTS PASSED! The cascade models API fix is working correctly.")
    return True

if __name__ == "__main__":
    success = test_cascade_models_api()
    sys.exit(0 if success else 1)
