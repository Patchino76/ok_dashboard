import requests
import json
import sys
import time

def check_api_server(base_url="http://localhost:8000"):
    """Check if the API server is running"""
    try:
        response = requests.get(f"{base_url}/docs")
        return response.status_code == 200
    except requests.ConnectionError:
        return False

def test_get_tag_value(tag_id, base_url="http://localhost:8000"):
    """
    Test the get_tag_value endpoint by making a request to it
    
    Args:
        tag_id: The tag ID to fetch
        base_url: The base URL of the API server
    
    Returns:
        The response from the API
    """
    url = f"{base_url}/api/tag-value/{tag_id}"
    print(f"Making request to: {url}")
    
    try:
        response = requests.get(url, timeout=5)
        
        # Print status code
        print(f"Status code: {response.status_code}")
        
        # If successful, print the response
        if response.status_code == 200:
            data = response.json()
            print("\nResponse data:")
            print(json.dumps(data, indent=4))
            print(f"\nUnit: {data.get('unit')}")
            print(f"Value: {data.get('value')}")
            print(f"Timestamp: {data.get('timestamp')}")
            print(f"Status: {data.get('status')}")
            return data
        else:
            print(f"Error: {response.text}")
            return None
    except requests.exceptions.ConnectionError:
        print(f"Connection error: Could not connect to {base_url}")
        print("Make sure the API server is running.")
        return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None

def test_multiple_tags(tag_ids, base_url="http://localhost:8000"):
    """Test multiple tag IDs"""
    results = {}
    for tag_id in tag_ids:
        print(f"\n--- Testing Tag ID: {tag_id} ---")
        result = test_get_tag_value(tag_id, base_url)
        results[tag_id] = result
        time.sleep(0.5)  # Small delay between requests
    
    # Summary
    print("\n=== Test Summary ===")
    for tag_id, result in results.items():
        status = "✓ Success" if result else "✗ Failed"
        print(f"Tag ID {tag_id}: {status}")
    
    return results

if __name__ == "__main__":
    # Define base URL
    base_url = "http://localhost:8000"
    
    # First check if API server is running
    if not check_api_server(base_url):
        print(f"API server at {base_url} doesn't appear to be running.")
        print("Start the server with: python api.py")
        sys.exit(1)
    
    # Get tag_ids from command line arguments or use defaults
    if len(sys.argv) > 1:
        try:
            tag_ids = [int(tag_id) for tag_id in sys.argv[1:]]
        except ValueError:
            print("Error: Tag IDs must be integers")
            sys.exit(1)
    else:
        # Use the tag IDs we've defined in tags_definition.py
        tag_ids = [1, 2, 3, 11, 12, 13, 100, 101]
    
    # Test the endpoint(s)
    test_multiple_tags(tag_ids, base_url)
