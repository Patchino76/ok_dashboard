"""
Demonstration Script: Mill-Specific Cascade Model Organization

This script demonstrates how to use the enhanced cascade optimization system
with mill-specific folder organization and metadata management.

Prerequisites:
1. Activate the virtual environment: C:\venv\crewai311\Scripts\activate
2. Ensure database connection is configured
3. Run this script: python demonstrate_mill_organization.py

Features Demonstrated:
- Mill-specific model directories
- Comprehensive metadata saving
- Model performance tracking
- Mill model discovery and loading
- API endpoint usage examples
"""

import os
import sys
import json
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

# Add the parent directories to Python path for imports
current_dir = Path(__file__).parent
sys.path.append(str(current_dir.parent))
sys.path.append(str(current_dir.parent.parent))

try:
    from cascade_models import CascadeModelManager
    from variable_classifier import VariableClassifier
    print("✓ Successfully imported cascade modules")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

def demonstrate_basic_usage():
    """Demonstrate basic mill-specific model management"""
    
    print("\n" + "="*60)
    print("1. BASIC MILL-SPECIFIC MODEL MANAGEMENT")
    print("="*60)
    
    # Define base path for models
    base_path = os.path.join(current_dir, "cascade_models")
    
    print(f"Base model path: {base_path}")
    
    # Create managers for different mills
    mills_to_test = [7, 8, 9, 10]
    managers = {}
    
    for mill_number in mills_to_test:
        print(f"\n--- Setting up Mill {mill_number} ---")
        
        # Create mill-specific manager
        manager = CascadeModelManager(base_path, mill_number=mill_number)
        managers[mill_number] = manager
        
        print(f"✓ Mill {mill_number} model path: {manager.model_save_path}")
        print(f"✓ Directory exists: {os.path.exists(manager.model_save_path)}")
        
        # Show initial metadata
        print(f"✓ Initial metadata:")
        print(f"  - Mill number: {manager.metadata['mill_number']}")
        print(f"  - Created at: {manager.metadata['created_at']}")
        print(f"  - Model version: {manager.metadata['model_version']}")
        
        # Save initial metadata
        manager._save_metadata()
        print(f"✓ Metadata saved to: {os.path.join(manager.model_save_path, 'metadata.json')}")

def demonstrate_metadata_management():
    """Demonstrate comprehensive metadata management"""
    
    print("\n" + "="*60)
    print("2. METADATA MANAGEMENT DEMONSTRATION")
    print("="*60)
    
    base_path = os.path.join(current_dir, "cascade_models")
    mill_number = 8  # Use Mill 8 for demonstration
    
    # Create manager
    manager = CascadeModelManager(base_path, mill_number=mill_number)
    
    print(f"\n--- Simulating Training Process for Mill {mill_number} ---")
    
    # Simulate training configuration
    training_config = {
        "test_size": 0.2,
        "data_shape": [1500, 18],
        "training_timestamp": datetime.now().isoformat(),
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "resample_freq": "1min"
    }
    
    manager.metadata["training_config"] = training_config
    print(f"✓ Training configuration added")
    
    # Simulate data information
    data_info = {
        "original_shape": [1800, 18],
        "cleaned_shape": [1500, 18],
        "data_reduction": "16.7%",
        "missing_values_removed": 200,
        "outliers_removed": 100
    }
    
    manager.metadata["data_info"] = data_info
    print(f"✓ Data information added")
    
    # Simulate model performance results
    model_performance = {
        "process_model_PulpHC": {
            "r2_score": 0.847,
            "rmse": 2.34,
            "feature_importance": {
                "Ore": 0.42,
                "WaterMill": 0.38,
                "WaterZumpf": 0.20
            },
            "input_vars": ["Ore", "WaterMill", "WaterZumpf"],
            "output_var": "PulpHC"
        },
        "process_model_DensityHC": {
            "r2_score": 0.823,
            "rmse": 1.89,
            "feature_importance": {
                "Ore": 0.45,
                "WaterMill": 0.35,
                "WaterZumpf": 0.20
            },
            "input_vars": ["Ore", "WaterMill", "WaterZumpf"],
            "output_var": "DensityHC"
        },
        "process_model_PressureHC": {
            "r2_score": 0.791,
            "rmse": 3.12,
            "feature_importance": {
                "Ore": 0.38,
                "WaterMill": 0.42,
                "WaterZumpf": 0.20
            },
            "input_vars": ["Ore", "WaterMill", "WaterZumpf"],
            "output_var": "PressureHC"
        },
        "quality_model": {
            "r2_score": 0.782,
            "rmse": 4.56,
            "feature_importance": {
                "PulpHC": 0.35,
                "DensityHC": 0.28,
                "PressureHC": 0.22,
                "Shisti": 0.08,
                "Daiki": 0.07
            },
            "input_vars": ["PulpHC", "DensityHC", "PressureHC", "Shisti", "Daiki"],
            "output_var": "PSI200",
            "cv_vars": ["PulpHC", "DensityHC", "PressureHC"],
            "dv_vars": ["Shisti", "Daiki"]
        },
        "chain_validation": {
            "r2_score": 0.756,
            "rmse": 5.23,
            "mae": 4.12,
            "n_samples": 300
        }
    }
    
    manager.metadata["model_performance"] = model_performance
    print(f"✓ Model performance data added")
    
    # Save comprehensive metadata
    manager._save_metadata()
    print(f"✓ Complete metadata saved")
    
    # Demonstrate metadata loading
    loaded_metadata = manager.load_metadata()
    print(f"\n--- Loaded Metadata Summary ---")
    print(f"Mill Number: {loaded_metadata['mill_number']}")
    print(f"Training Date: {loaded_metadata['training_config']['training_timestamp'][:10]}")
    print(f"Data Shape: {loaded_metadata['training_config']['data_shape']}")
    print(f"Process Models: {len([k for k in loaded_metadata['model_performance'].keys() if k.startswith('process_model')])}")
    print(f"Quality Model R²: {loaded_metadata['model_performance']['quality_model']['r2_score']:.3f}")
    print(f"Chain Validation R²: {loaded_metadata['model_performance']['chain_validation']['r2_score']:.3f}")

def demonstrate_mill_discovery():
    """Demonstrate mill model discovery and listing"""
    
    print("\n" + "="*60)
    print("3. MILL MODEL DISCOVERY")
    print("="*60)
    
    base_path = os.path.join(current_dir, "cascade_models")
    
    # Create models for multiple mills with different characteristics
    mills_data = {
        7: {"r2": 0.82, "rmse": 2.1, "models": 3},
        8: {"r2": 0.85, "rmse": 1.9, "models": 4},
        9: {"r2": 0.79, "rmse": 2.3, "models": 3},
        10: {"r2": 0.88, "rmse": 1.7, "models": 4}
    }
    
    print("Setting up models for multiple mills...")
    
    for mill_number, data in mills_data.items():
        manager = CascadeModelManager(base_path, mill_number=mill_number)
        
        # Add performance data
        manager.metadata["model_performance"]["quality_model"] = {
            "r2_score": data["r2"],
            "rmse": data["rmse"],
            "n_models": data["models"]
        }
        manager.metadata["training_config"] = {
            "training_timestamp": (datetime.now() - timedelta(days=mill_number)).isoformat(),
            "data_shape": [1000 + mill_number * 100, 15]
        }
        
        manager._save_metadata()
        
        # Create dummy model files
        model_files = [
            "process_model_PulpHC.pkl",
            "process_model_DensityHC.pkl",
            "process_model_PressureHC.pkl",
            "quality_model.pkl"
        ][:data["models"]]
        
        for filename in model_files:
            filepath = os.path.join(manager.model_save_path, filename)
            with open(filepath, 'w') as f:
                f.write(f"dummy model data for mill {mill_number}")
        
        print(f"✓ Mill {mill_number}: {data['models']} models, R²={data['r2']:.3f}")
    
    # Demonstrate discovery
    print(f"\n--- Discovering Available Mill Models ---")
    mill_models = CascadeModelManager.list_mill_models(base_path)
    
    print(f"Found {len(mill_models)} mill model sets:")
    
    for mill_num in sorted(mill_models.keys()):
        model_info = mill_models[mill_num]
        metadata = model_info['metadata']
        
        print(f"\n🏭 Mill {mill_num}:")
        print(f"   📁 Path: {model_info['path']}")
        print(f"   📊 Model Files: {len(model_info['model_files'])}")
        print(f"   ✅ Complete Cascade: {model_info['has_complete_cascade']}")
        
        if 'model_performance' in metadata and 'quality_model' in metadata['model_performance']:
            perf = metadata['model_performance']['quality_model']
            print(f"   📈 Quality Model R²: {perf.get('r2_score', 'N/A')}")
            print(f"   📉 Quality Model RMSE: {perf.get('rmse', 'N/A')}")
        
        if 'training_config' in metadata:
            train_date = metadata['training_config'].get('training_timestamp', '')[:10]
            data_shape = metadata['training_config'].get('data_shape', 'N/A')
            print(f"   📅 Training Date: {train_date}")
            print(f"   📋 Data Shape: {data_shape}")

def demonstrate_model_loading():
    """Demonstrate loading models for specific mills"""
    
    print("\n" + "="*60)
    print("4. MODEL LOADING DEMONSTRATION")
    print("="*60)
    
    base_path = os.path.join(current_dir, "cascade_models")
    
    # Test loading models for different mills
    test_mills = [8, 9]
    
    for mill_number in test_mills:
        print(f"\n--- Loading Models for Mill {mill_number} ---")
        
        try:
            # Create manager for specific mill
            manager = CascadeModelManager(base_path, mill_number=mill_number)
            
            # Get model summary
            summary = manager.get_model_summary()
            
            print(f"✓ Manager created for Mill {mill_number}")
            print(f"✓ Model path: {summary['model_save_path']}")
            print(f"✓ Metadata available: {summary['metadata'] is not None}")
            
            if summary['metadata']:
                metadata = summary['metadata']
                print(f"✓ Mill number in metadata: {metadata.get('mill_number')}")
                print(f"✓ Model version: {metadata.get('model_version')}")
                
                if 'model_performance' in metadata:
                    perf_keys = list(metadata['model_performance'].keys())
                    print(f"✓ Performance data available for: {perf_keys}")
                
        except Exception as e:
            print(f"❌ Error loading Mill {mill_number}: {e}")

def demonstrate_api_usage():
    """Demonstrate API endpoint usage patterns"""
    
    print("\n" + "="*60)
    print("5. API USAGE PATTERNS")
    print("="*60)
    
    print("The following API endpoints are now available:")
    
    endpoints = [
        ("GET", "/api/v1/cascade/models", "List all available mill models"),
        ("GET", "/api/v1/cascade/models/{mill_number}", "Get info for specific mill"),
        ("POST", "/api/v1/cascade/models/{mill_number}/load", "Load models for specific mill"),
        ("POST", "/api/v1/cascade/train", "Train models (now with mill_number parameter)"),
        ("GET", "/api/v1/cascade/training/status", "Get training status (mill-aware)"),
        ("POST", "/api/v1/cascade/predict", "Make predictions (mill-aware)"),
        ("GET", "/api/v1/cascade/health", "Health check with mill info")
    ]
    
    for method, endpoint, description in endpoints:
        print(f"  {method:4} {endpoint:45} - {description}")
    
    print(f"\nExample API Usage:")
    print(f"""
    # List all mill models
    GET /api/v1/cascade/models
    
    # Get Mill 8 model information
    GET /api/v1/cascade/models/8
    
    # Load Mill 8 models
    POST /api/v1/cascade/models/8/load
    
    # Train models for Mill 9
    POST /api/v1/cascade/train
    {{
        "mill_number": 9,
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "test_size": 0.2,
        "resample_freq": "1min",
        "model_suffix": "v2"
    }}
    
    # Make prediction (after loading Mill 8 models)
    POST /api/v1/cascade/predict
    {{
        "mv_values": {{"Ore": 45.2, "WaterMill": 12.8, "WaterZumpf": 8.5}},
        "dv_values": {{"Shisti": 78.5, "Daiki": 23.1}}
    }}
    """)

def show_directory_structure():
    """Show the resulting directory structure"""
    
    print("\n" + "="*60)
    print("6. DIRECTORY STRUCTURE")
    print("="*60)
    
    base_path = os.path.join(current_dir, "cascade_models")
    
    def print_tree(path, prefix="", max_depth=3, current_depth=0):
        if current_depth >= max_depth:
            return
            
        if not os.path.exists(path):
            return
            
        items = sorted(os.listdir(path))
        for i, item in enumerate(items):
            item_path = os.path.join(path, item)
            is_last = i == len(items) - 1
            
            current_prefix = "└── " if is_last else "├── "
            print(f"{prefix}{current_prefix}{item}")
            
            if os.path.isdir(item_path) and current_depth < max_depth - 1:
                next_prefix = prefix + ("    " if is_last else "│   ")
                print_tree(item_path, next_prefix, max_depth, current_depth + 1)
    
    print(f"📁 {base_path}")
    print_tree(base_path)
    
    # Show file sizes and metadata summary
    if os.path.exists(base_path):
        print(f"\n--- Summary ---")
        total_size = 0
        mill_count = 0
        
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            if os.path.isdir(item_path) and item.startswith("mill_"):
                mill_count += 1
                mill_size = sum(
                    os.path.getsize(os.path.join(item_path, f))
                    for f in os.listdir(item_path)
                    if os.path.isfile(os.path.join(item_path, f))
                )
                total_size += mill_size
                
                mill_number = item.split("_")[1]
                print(f"Mill {mill_number}: {mill_size:,} bytes")
        
        print(f"Total Mills: {mill_count}")
        print(f"Total Size: {total_size:,} bytes")

def cleanup_demo():
    """Clean up demonstration files"""
    
    print("\n" + "="*60)
    print("7. CLEANUP")
    print("="*60)
    
    base_path = os.path.join(current_dir, "cascade_models")
    
    response = input(f"\nDo you want to clean up the demo files in {base_path}? (y/N): ")
    
    if response.lower() == 'y':
        if os.path.exists(base_path):
            import shutil
            shutil.rmtree(base_path)
            print(f"✓ Demo files cleaned up")
        else:
            print(f"✓ No files to clean up")
    else:
        print(f"✓ Demo files preserved for inspection")

def main():
    """Main demonstration function"""
    
    print("🏭 MILL-SPECIFIC CASCADE MODEL ORGANIZATION DEMONSTRATION")
    print("=" * 70)
    
    print(f"\nEnvironment Information:")
    print(f"Python: {sys.executable}")
    print(f"Working Directory: {os.getcwd()}")
    print(f"Script Location: {__file__}")
    
    try:
        # Run demonstrations
        demonstrate_basic_usage()
        demonstrate_metadata_management()
        demonstrate_mill_discovery()
        demonstrate_model_loading()
        demonstrate_api_usage()
        show_directory_structure()
        
        print("\n" + "="*70)
        print("🎉 DEMONSTRATION COMPLETED SUCCESSFULLY!")
        print("="*70)
        
        print("\n✅ Key Features Demonstrated:")
        features = [
            "Mill-specific model directories (mill_7, mill_8, etc.)",
            "Comprehensive metadata management",
            "Model performance tracking per mill",
            "Mill model discovery and listing",
            "Model loading for specific mills",
            "Enhanced API endpoints",
            "Automatic directory organization"
        ]
        
        for feature in features:
            print(f"   ✓ {feature}")
        
        print("\n🚀 Ready for Production Use:")
        print("   1. Activate venv: C:\\venv\\crewai311\\Scripts\\activate")
        print("   2. Configure database connection")
        print("   3. Start FastAPI server")
        print("   4. Train models for different mills")
        print("   5. Use mill-specific predictions")
        
    except Exception as e:
        print(f"\n❌ Demonstration failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        cleanup_demo()

if __name__ == "__main__":
    main()
