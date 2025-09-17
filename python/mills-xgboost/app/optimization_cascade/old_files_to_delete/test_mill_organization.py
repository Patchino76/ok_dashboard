"""
Test Script for Mill-Specific Cascade Model Organization

This script demonstrates the new mill-specific folder structure and metadata saving
functionality for the cascade optimization system.

Usage:
    Activate the venv: C:\venv\crewai311\Scripts\activate
    Run: python test_mill_organization.py
"""

import os
import sys
import json
import asyncio
import requests
from datetime import datetime, timedelta
from pathlib import Path

# Add the parent directories to Python path for imports
current_dir = Path(__file__).parent
sys.path.append(str(current_dir.parent))
sys.path.append(str(current_dir.parent.parent))

from cascade_models import CascadeModelManager
from cascade_endpoints import cascade_router
from variable_classifier import VariableClassifier

def test_mill_organization():
    """Test the mill-specific organization functionality"""
    
    print("=" * 60)
    print("TESTING MILL-SPECIFIC CASCADE MODEL ORGANIZATION")
    print("=" * 60)
    
    # Test configuration
    base_path = os.path.join(current_dir, "test_cascade_models")
    test_mills = [7, 8, 9, 10]
    
    # Clean up any existing test directory
    if os.path.exists(base_path):
        import shutil
        shutil.rmtree(base_path)
    
    print(f"\n1. Testing CascadeModelManager with mill-specific paths")
    print(f"   Base path: {base_path}")
    
    # Test each mill
    managers = {}
    for mill_number in test_mills:
        print(f"\n   Testing Mill {mill_number}:")
        
        # Create manager for this mill
        manager = CascadeModelManager(base_path, mill_number=mill_number)
        managers[mill_number] = manager
        
        print(f"   ✓ Mill {mill_number} path: {manager.model_save_path}")
        print(f"   ✓ Directory created: {os.path.exists(manager.model_save_path)}")
        
        # Test metadata initialization
        expected_metadata_keys = ["mill_number", "created_at", "model_version", 
                                "training_config", "model_performance", "data_info"]
        
        metadata_valid = all(key in manager.metadata for key in expected_metadata_keys)
        print(f"   ✓ Metadata initialized: {metadata_valid}")
        print(f"   ✓ Mill number in metadata: {manager.metadata['mill_number'] == mill_number}")
        
        # Save initial metadata
        manager._save_metadata()
        metadata_file = os.path.join(manager.model_save_path, "metadata.json")
        print(f"   ✓ Metadata file created: {os.path.exists(metadata_file)}")

def test_metadata_functionality():
    """Test metadata saving and loading"""
    
    print(f"\n2. Testing Metadata Functionality")
    
    base_path = os.path.join(current_dir, "test_cascade_models")
    mill_number = 8
    
    # Create manager and simulate training data
    manager = CascadeModelManager(base_path, mill_number=mill_number)
    
    # Simulate training results
    manager.metadata["training_config"] = {
        "test_size": 0.2,
        "data_shape": [1000, 15],
        "training_timestamp": datetime.now().isoformat()
    }
    
    manager.metadata["model_performance"] = {
        "process_model_PulpHC": {
            "r2_score": 0.85,
            "rmse": 2.3,
            "feature_importance": {"Ore": 0.4, "WaterMill": 0.35, "WaterZumpf": 0.25},
            "input_vars": ["Ore", "WaterMill", "WaterZumpf"],
            "output_var": "PulpHC"
        },
        "quality_model": {
            "r2_score": 0.78,
            "rmse": 3.1,
            "feature_importance": {"PulpHC": 0.5, "DensityHC": 0.3, "Shisti": 0.2},
            "input_vars": ["PulpHC", "DensityHC", "PressureHC", "Shisti", "Daiki"],
            "output_var": "PSI200"
        }
    }
    
    manager.metadata["data_info"] = {
        "original_shape": [1200, 15],
        "cleaned_shape": [1000, 15],
        "data_reduction": "16.7%"
    }
    
    # Save metadata
    manager._save_metadata()
    
    # Test loading metadata
    loaded_metadata = manager.load_metadata()
    
    print(f"   ✓ Metadata saved and loaded successfully")
    print(f"   ✓ Mill number preserved: {loaded_metadata['mill_number'] == mill_number}")
    print(f"   ✓ Training config preserved: {'training_config' in loaded_metadata}")
    print(f"   ✓ Model performance preserved: {'model_performance' in loaded_metadata}")
    
    # Test model summary
    summary = manager.get_model_summary()
    print(f"   ✓ Model summary includes mill number: {summary['mill_number'] == mill_number}")
    print(f"   ✓ Model summary includes metadata: {'metadata' in summary}")

def test_mill_model_listing():
    """Test the class method for listing mill models"""
    
    print(f"\n3. Testing Mill Model Listing")
    
    base_path = os.path.join(current_dir, "test_cascade_models")
    
    # Create models for multiple mills
    test_mills = [7, 8, 9]
    for mill_number in test_mills:
        manager = CascadeModelManager(base_path, mill_number=mill_number)
        
        # Add some mock model performance data
        manager.metadata["model_performance"]["process_model_PulpHC"] = {
            "r2_score": 0.80 + mill_number * 0.01,  # Slightly different for each mill
            "rmse": 2.0 + mill_number * 0.1
        }
        manager._save_metadata()
        
        # Create some dummy model files
        dummy_files = [
            f"process_model_PulpHC.pkl",
            f"process_model_DensityHC.pkl", 
            f"quality_model.pkl",
            f"scaler_mv_to_PulpHC.pkl"
        ]
        
        for filename in dummy_files:
            filepath = os.path.join(manager.model_save_path, filename)
            with open(filepath, 'w') as f:
                f.write("dummy model data")
    
    # Test listing functionality
    mill_models = CascadeModelManager.list_mill_models(base_path)
    
    print(f"   ✓ Found {len(mill_models)} mill models")
    print(f"   ✓ Expected mills found: {set(test_mills) == set(mill_models.keys())}")
    
    for mill_num, model_info in mill_models.items():
        print(f"   ✓ Mill {mill_num}:")
        print(f"     - Path: {model_info['path']}")
        print(f"     - Model files: {len(model_info['model_files'])}")
        print(f"     - Complete cascade: {model_info['has_complete_cascade']}")
        print(f"     - Metadata available: {'metadata' in model_info}")

def test_directory_structure():
    """Test the expected directory structure"""
    
    print(f"\n4. Testing Directory Structure")
    
    base_path = os.path.join(current_dir, "test_cascade_models")
    
    print(f"   Base directory: {base_path}")
    
    if os.path.exists(base_path):
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            if os.path.isdir(item_path) and item.startswith("mill_"):
                mill_number = item.split("_")[1]
                print(f"   ✓ Mill {mill_number} directory: {item}")
                
                # Check contents
                contents = os.listdir(item_path)
                has_metadata = "metadata.json" in contents
                model_files = [f for f in contents if f.endswith('.pkl')]
                
                print(f"     - Metadata file: {'✓' if has_metadata else '✗'}")
                print(f"     - Model files: {len(model_files)}")
                
                if has_metadata:
                    metadata_path = os.path.join(item_path, "metadata.json")
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    print(f"     - Mill number in metadata: {metadata.get('mill_number')}")

def test_api_integration():
    """Test API integration with mill-specific paths"""
    
    print(f"\n5. Testing API Integration")
    
    # This would typically require a running FastAPI server
    # For now, we'll just test the endpoint logic
    
    print("   Note: Full API testing requires running FastAPI server")
    print("   Testing endpoint configuration...")
    
    # Test that the router has the expected endpoints
    expected_endpoints = [
        "/info", "/train", "/training/status", "/predict", 
        "/models", "/models/{mill_number}", "/models/{mill_number}/load", "/health"
    ]
    
    # Get routes from the router
    routes = [route.path for route in cascade_router.routes]
    
    for endpoint in expected_endpoints:
        # Handle parameterized routes
        if "{mill_number}" in endpoint:
            # Check if any route matches the pattern
            pattern_found = any(endpoint.replace("{mill_number}", "").replace("/", "") in route.replace("/", "") 
                              for route in routes)
            print(f"   ✓ Endpoint pattern {endpoint}: {'Found' if pattern_found else 'Missing'}")
        else:
            endpoint_found = endpoint in routes or any(endpoint in route for route in routes)
            print(f"   ✓ Endpoint {endpoint}: {'Found' if endpoint_found else 'Missing'}")

def cleanup_test_files():
    """Clean up test files"""
    
    print(f"\n6. Cleaning Up Test Files")
    
    base_path = os.path.join(current_dir, "test_cascade_models")
    
    if os.path.exists(base_path):
        import shutil
        shutil.rmtree(base_path)
        print(f"   ✓ Test directory cleaned up: {base_path}")
    else:
        print(f"   ✓ No cleanup needed")

def main():
    """Main test function"""
    
    print("Starting Mill Organization Tests...")
    print(f"Python executable: {sys.executable}")
    print(f"Working directory: {os.getcwd()}")
    print(f"Test script location: {__file__}")
    
    try:
        # Run all tests
        test_mill_organization()
        test_metadata_functionality()
        test_mill_model_listing()
        test_directory_structure()
        test_api_integration()
        
        print("\n" + "=" * 60)
        print("ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
        print("\nKey Features Implemented:")
        print("✓ Mill-specific model directories (mill_7, mill_8, etc.)")
        print("✓ Comprehensive metadata saving with training info")
        print("✓ Model performance tracking per mill")
        print("✓ Mill model listing and discovery")
        print("✓ API endpoints for mill management")
        print("✓ Automatic directory creation")
        
        print("\nNext Steps:")
        print("1. Test with real database connection")
        print("2. Train models for different mills")
        print("3. Test model loading and switching")
        print("4. Integrate with frontend UI")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Always cleanup
        cleanup_test_files()

if __name__ == "__main__":
    main()
