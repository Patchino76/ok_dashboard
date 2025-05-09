import requests
import json
import sys
import matplotlib.pyplot as plt
from datetime import datetime

def test_get_tag_trend(tag_id, hours=8, base_url="http://localhost:8000"):
    """
    Test the get_tag_trend endpoint by making a request to it
    
    Args:
        tag_id: The tag ID to fetch trend data for
        hours: Number of hours of historical data to retrieve (default: 8)
        base_url: The base URL of the API server
    
    Returns:
        The response from the API
    """
    url = f"{base_url}/api/tag-trend/{tag_id}?hours={hours}"
    print(f"Making request to: {url}")
    
    try:
        response = requests.get(url, timeout=5)
        
        # Print status code
        print(f"Status code: {response.status_code}")
        
        # If successful, print the response
        if response.status_code == 200:
            data = response.json()
            print("\nResponse data summary:")
            print(f"Number of data points: {len(data.get('timestamps', []))}")
            print(f"Time range: {data.get('timestamps', [])[0]} to {data.get('timestamps', [])[-1]}" if data.get('timestamps') else "No data")
            print(f"Unit: {data.get('unit')}")
            
            # Optionally plot the trend data
            if data.get('timestamps') and data.get('values'):
                plt.figure(figsize=(10, 6))
                
                # Convert timestamps to datetime objects for better x-axis display
                try:
                    times = [datetime.fromisoformat(ts) for ts in data.get('timestamps')]
                except ValueError:
                    # If fromisoformat fails, just use the string timestamps
                    times = data.get('timestamps')
                
                plt.plot(times, data.get('values'))
                plt.title(f"Trend data for Tag ID {tag_id}")
                plt.xlabel("Time")
                plt.ylabel(f"Value ({data.get('unit', '')})")
                plt.grid(True)
                plt.tight_layout()
                
                # Save the plot to a file
                plot_filename = f"tag_{tag_id}_trend.png"
                plt.savefig(plot_filename)
                print(f"\nPlot saved to: {plot_filename}")
                plt.close()
            
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
    
    # Get tag_id and hours from command line arguments or use defaults
    tag_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    hours = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    
    # Test the endpoint
    test_get_tag_trend(tag_id, hours, base_url)
