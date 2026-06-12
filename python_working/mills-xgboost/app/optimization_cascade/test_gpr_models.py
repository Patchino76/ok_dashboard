"""
Test script for GPR cascade models

Tests loading and prediction with GPR models.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimization_cascade.gpr_cascade_models import GPRCascadeModelManager


def test_list_gpr_models():
    """Test listing available GPR models"""
    print("\n" + "="*80)
    print("TEST 1: List GPR Models")
    print("="*80)
    
    base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
    gpr_models = GPRCascadeModelManager.list_mill_models(base_path)
    
    print(f"\nFound {len(gpr_models)} GPR mill models:")
    for mill_num, info in gpr_models.items():
        print(f"\n  Mill {mill_num}:")
        print(f"    Path: {info['path']}")
        print(f"    Model files: {len(info['model_files'])}")
        print(f"    Complete cascade: {info['has_complete_cascade']}")
        if info.get('metadata'):
            metadata = info['metadata']
            print(f"    Model type: {metadata.get('model_type')}")
            print(f"    Created: {metadata.get('created_at')}")
            features = metadata.get('features', {})
            print(f"    MVs: {features.get('mv_features', [])}")
            print(f"    CVs: {features.get('cv_features', [])}")
            print(f"    DVs: {features.get('dv_features', [])}")
            print(f"    Target: {features.get('target_variable')}")
    
    return gpr_models


def test_load_gpr_model(mill_number: int = 8):
    """Test loading a specific GPR model"""
    print("\n" + "="*80)
    print(f"TEST 2: Load GPR Model for Mill {mill_number}")
    print("="*80)
    
    base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
    manager = GPRCascadeModelManager(base_path, mill_number=mill_number)
    
    success = manager.load_models()
    
    if success:
        print(f"\n✅ Successfully loaded GPR models for Mill {mill_number}")
        summary = manager.get_model_summary()
        print(f"\nModel Summary:")
        print(f"  Mill: {summary['mill_number']}")
        print(f"  Model type: {summary['model_type']}")
        print(f"  Process models: {summary['process_models']}")
        print(f"  Quality model: {summary['quality_model_trained']}")
        print(f"  Supports uncertainty: {summary['supports_uncertainty']}")
        return manager
    else:
        print(f"\n❌ Failed to load GPR models for Mill {mill_number}")
        return None


def test_gpr_prediction(manager: GPRCascadeModelManager):
    """Test GPR cascade prediction"""
    print("\n" + "="*80)
    print("TEST 3: GPR Cascade Prediction")
    print("="*80)
    
    # Get features from metadata
    metadata = manager.metadata
    features = metadata.get('features', {})
    mvs = features.get('mv_features', [])
    dvs = features.get('dv_features', [])
    
    print(f"\nRequired features:")
    print(f"  MVs: {mvs}")
    print(f"  DVs: {dvs}")
    
    # Create test values (using midpoint of typical ranges)
    mv_values = {
        'Ore': 200.0,
        'WaterMill': 25.0,
        'WaterZumpf': 200.0
    }
    
    dv_values = {
        'Class_15': 50.0,
        'Daiki': 45.0,
        'FE': 30.0
    }
    
    print(f"\nTest MV values: {mv_values}")
    print(f"Test DV values: {dv_values}")
    
    # Test prediction without uncertainty
    print("\n--- Prediction without uncertainty ---")
    result = manager.predict_cascade(mv_values, dv_values, return_uncertainty=False)
    
    print(f"\nPrediction result:")
    print(f"  Predicted CVs: {result['predicted_cvs']}")
    print(f"  Predicted target: {result['predicted_target']:.4f}")
    print(f"  Is feasible: {result['is_feasible']}")
    
    # Test prediction with uncertainty
    print("\n--- Prediction with uncertainty ---")
    result_unc = manager.predict_cascade(mv_values, dv_values, return_uncertainty=True)
    
    print(f"\nPrediction result with uncertainty:")
    print(f"  Predicted CVs: {result_unc['predicted_cvs']}")
    print(f"  CV uncertainties: {result_unc['cv_uncertainties']}")
    print(f"  Predicted target: {result_unc['predicted_target']:.4f}")
    print(f"  Target uncertainty: {result_unc['target_uncertainty']:.4f}")
    print(f"  Is feasible: {result_unc['is_feasible']}")
    
    return result_unc


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("GPR CASCADE MODEL TESTS")
    print("="*80)
    
    try:
        # Test 1: List models
        gpr_models = test_list_gpr_models()
        
        if not gpr_models:
            print("\n⚠️ No GPR models found. Please train GPR models first.")
            return
        
        # Test 2: Load model
        mill_number = list(gpr_models.keys())[0]  # Use first available mill
        manager = test_load_gpr_model(mill_number)
        
        if not manager:
            print("\n❌ Failed to load GPR model. Cannot continue tests.")
            return
        
        # Test 3: Prediction
        test_gpr_prediction(manager)
        
        print("\n" + "="*80)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
