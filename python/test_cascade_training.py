#!/usr/bin/env python3
"""
Test script for the full cascade training system
Tests database connection and real model training
"""

import requests
import json
import time
import sys
import os

# Add the mills-xgboost path for direct testing
mills_path = os.path.join(os.path.dirname(__file__), 'mills-xgboost', 'app')
if mills_path not in sys.path:
    sys.path.insert(0, mills_path)

def test_api_health():
    """Test if API is running"""
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        print(f"✓ API Health: {response.status_code}")
        health_data = response.json()
        print(f"  Cascade System Available: {health_data.get('cascade_system', {}).get('available', False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"✗ API Health Check Failed: {e}")
        return False

def test_cascade_health():
    """Test cascade system health"""
    try:
        response = requests.get('http://localhost:8000/api/v1/cascade/health', timeout=5)
        print(f"✓ Cascade Health: {response.status_code}")
        if response.status_code == 200:
            health_data = response.json()
            print(f"  Status: {health_data.get('status')}")
            print(f"  Components: {health_data.get('components', {})}")
        return response.status_code == 200
    except Exception as e:
        print(f"✗ Cascade Health Check Failed: {e}")
        return False

def test_cascade_info():
    """Test cascade system info"""
    try:
        response = requests.get('http://localhost:8000/api/v1/cascade/info', timeout=5)
        print(f"✓ Cascade Info: {response.status_code}")
        if response.status_code == 200:
            info_data = response.json()
            print(f"  System: {info_data.get('system')}")
            print(f"  Version: {info_data.get('version')}")
            print(f"  Model Status: {info_data.get('model_status', {})}")
        return response.status_code == 200
    except Exception as e:
        print(f"✗ Cascade Info Failed: {e}")
        return False

def test_database_training():
    """Test database training with real data"""
    try:
        print("\n=== Testing Database Training ===")
        
        training_request = {
            "data_source": "database",
            "mill_number": 8,
            "start_date": "2025-07-01",
            "end_date": "2025-07-31",
            "test_size": 0.2,
            "resample_freq": "1min"
        }
        
        response = requests.post(
            'http://localhost:8000/api/v1/cascade/train',
            json=training_request,
            timeout=30
        )
        
        print(f"✓ Training Request: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"  Status: {result.get('status')}")
            print(f"  Message: {result.get('message')}")
            print(f"  Data Source: {result.get('data_source')}")
            print(f"  Data Shape: {result.get('data_shape')}")
            print(f"  Mill Number: {result.get('mill_number')}")
            print(f"  Date Range: {result.get('date_range')}")
            print(f"  Model Save Path: {result.get('model_save_path')}")
            
            # Wait a bit for background training
            print("\n  Waiting for background training...")
            time.sleep(10)
            
            # Check training status
            status_response = requests.get('http://localhost:8000/api/v1/cascade/training/status')
            if status_response.status_code == 200:
                status_data = status_response.json()
                print(f"  Training Status: {status_data.get('status')}")
                print(f"  Training Message: {status_data.get('message')}")
                
                if status_data.get('status') == 'completed':
                    summary = status_data.get('summary', {})
                    print(f"  Training Summary: {summary}")
            
            return True
        else:
            print(f"  Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Database Training Failed: {e}")
        return False

def test_synthetic_training():
    """Test synthetic data training as fallback"""
    try:
        print("\n=== Testing Synthetic Training ===")
        
        training_request = {
            "data_source": "synthetic",
            "n_samples": 1000,
            "test_size": 0.2
        }
        
        response = requests.post(
            'http://localhost:8000/api/v1/cascade/train',
            json=training_request,
            timeout=30
        )
        
        print(f"✓ Synthetic Training Request: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"  Status: {result.get('status')}")
            print(f"  Message: {result.get('message')}")
            print(f"  Data Shape: {result.get('data_shape')}")
            return True
        else:
            print(f"  Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Synthetic Training Failed: {e}")
        return False

def main():
    """Run all tests"""
    print("=== Cascade Training System Test ===\n")
    
    # Test API connectivity
    if not test_api_health():
        print("API is not running. Please start the API server first.")
        return
    
    # Test cascade system
    if not test_cascade_health():
        print("Cascade system is not available.")
        return
    
    # Get cascade info
    test_cascade_info()
    
    # Test database training (real functionality)
    db_success = test_database_training()
    
    # If database training fails, try synthetic
    if not db_success:
        print("\nDatabase training failed, trying synthetic data...")
        test_synthetic_training()
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    main()
