import requests
import json
from datetime import datetime, timedelta

def test_cascade_endpoint():
    base_url = "http://localhost:8000"
    url = f"{base_url}/api/v1/cascade/train"
    
    print(f"Testing cascade training endpoint: {url}")
    
    # Prepare request data
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    request_data = {
        "mill_number": 1,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "test_size": 0.2,
        "resample_freq": "1H"
    }
    
    print("\nRequest data:")
    print(json.dumps(request_data, indent=2))
    
    try:
        # First, check if the API server is running
        print("\n🔍 Checking if API server is running...")
        health_check = requests.get(f"{base_url}/health")
        print(f"✅ API server is running! Status: {health_check.status_code}")
        
        # Now test the cascade training endpoint
        print("\n🚀 Testing cascade training endpoint...")
        response = requests.post(
            url,
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"\nResponse status code: {response.status_code}")
        
        try:
            print("Response data:")
            print(json.dumps(response.json(), indent=2))
        except ValueError:
            print("Response content (not JSON):")
            print(response.text)
            
    except requests.exceptions.ConnectionError as e:
        print("\n❌ Could not connect to the API server. Please make sure it's running.")
        print(f"Error: {str(e)}")
        print("\nTry starting the API server with: python python/api.py")
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out. The server might be busy or not responding.")
    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred: {str(e)}")
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    test_cascade_endpoint()
