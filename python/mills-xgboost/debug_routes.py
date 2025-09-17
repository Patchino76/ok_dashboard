"""
Debug script to check available API routes
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def check_available_routes():
    """Check what cascade routes are available"""
    print("🔍 Debugging Available Routes")
    print("=" * 40)
    
    # Test different possible endpoints
    endpoints_to_test = [
        "/api/v1/cascade/health",
        "/api/v1/cascade/info", 
        "/api/v1/cascade/optimize",
        "/api/v1/cascade/predict",
        "/api/v1/cascade/train",
        "/api/v1/cascade/models",
        "/api/v1/ml/cascade/optimize",  # Alternative routing
        "/docs",  # FastAPI auto-docs
        "/openapi.json"  # OpenAPI spec
    ]
    
    print(f"\n📡 Testing endpoints on {BASE_URL}:")
    
    for endpoint in endpoints_to_test:
        try:
            if endpoint == "/docs":
                # Just check if docs are accessible
                response = requests.get(f"{BASE_URL}{endpoint}")
                status = "✅ Available" if response.status_code == 200 else f"❌ {response.status_code}"
                print(f"   {endpoint:<30} {status}")
            elif endpoint == "/openapi.json":
                # Get OpenAPI spec to see all routes
                response = requests.get(f"{BASE_URL}{endpoint}")
                if response.status_code == 200:
                    print(f"   {endpoint:<30} ✅ Available")
                    # Parse and show cascade routes
                    try:
                        spec = response.json()
                        cascade_paths = [path for path in spec.get('paths', {}).keys() if 'cascade' in path]
                        if cascade_paths:
                            print(f"      📋 Cascade paths found:")
                            for path in sorted(cascade_paths):
                                methods = list(spec['paths'][path].keys())
                                print(f"         {path} [{', '.join(methods).upper()}]")
                        else:
                            print(f"      ⚠️  No cascade paths found in OpenAPI spec")
                    except:
                        print(f"      ❌ Could not parse OpenAPI spec")
                else:
                    print(f"   {endpoint:<30} ❌ {response.status_code}")
            else:
                # Test GET request (safe for all endpoints)
                response = requests.get(f"{BASE_URL}{endpoint}")
                if response.status_code == 200:
                    print(f"   {endpoint:<30} ✅ Available")
                elif response.status_code == 405:  # Method not allowed (POST endpoint)
                    print(f"   {endpoint:<30} ✅ Available (POST only)")
                elif response.status_code == 404:
                    print(f"   {endpoint:<30} ❌ Not Found")
                else:
                    print(f"   {endpoint:<30} ⚠️  {response.status_code}")
        except Exception as e:
            print(f"   {endpoint:<30} ❌ Error: {e}")

def check_cascade_info():
    """Get detailed cascade system info"""
    print(f"\n📊 Cascade System Info:")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/cascade/info")
        if response.status_code == 200:
            info = response.json()
            print(f"   System: {info.get('system')}")
            print(f"   Version: {info.get('version')}")
            print(f"   Models trained: {info.get('model_status', {}).get('models_trained')}")
            
            endpoints = info.get('endpoints', {})
            print(f"   📋 Configured endpoints:")
            for name, url in endpoints.items():
                print(f"      {name}: {url}")
        else:
            print(f"   ❌ Failed to get info: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    check_available_routes()
    check_cascade_info()
    
    print(f"\n💡 Recommendations:")
    print(f"   1. Check FastAPI docs at: {BASE_URL}/docs")
    print(f"   2. If /optimize is missing, restart the API server")
    print(f"   3. Check server logs for import errors")
