import requests
import json
import sys

def test_get_tag_values(tag_ids, base_url="http://localhost:8000"):
    """
    Test the get_tag_values endpoint by making a request to it
    
    Args:
        tag_ids: List of tag IDs to fetch
        base_url: The base URL of the API server
    
    Returns:
        The response from the API
    """
    # Convert tag_ids list to query parameters
    tag_ids_str = "&".join([f"tag_ids={id}" for id in tag_ids])
    url = f"{base_url}/api/tag-values?{tag_ids_str}"
    
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
            
            # Print a summary of the values
            print("\nTag Values:")
            for tag_id, value in data.get("data", {}).items():
                print(f"  Tag {tag_id}: {value}")
            
            print(f"\nTimestamp: {data.get('timestamp')}")
            return data
        else:
            print(f"Error: {response.text}")
            return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None

if __name__ == "__main__":
    # Define base URL
    base_url = "http://localhost:8000"
    
    # Get tag_ids from command line arguments or use defaults
    if len(sys.argv) > 1:
        try:
            tag_ids = [int(tag_id) for tag_id in sys.argv[1:]]
        except ValueError:
            print("Error: Tag IDs must be integers")
            sys.exit(1)
    else:
        # Use the tag IDs defined in tags_definition.py
        tag_ids = [1, 2, 3, 11, 12, 13]
    
    # Test the endpoint
    test_get_tag_values(tag_ids, base_url)
