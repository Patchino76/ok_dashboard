"""
Test cascade models directly (bypassing API)
"""

import sys
sys.path.append('app')

from optimization_cascade.cascade_models import CascadeModelManager

def test_direct_prediction():
    """Test cascade prediction directly"""
    print("🧪 Testing Direct Cascade Prediction")
    print("=" * 40)
    
    try:
        # Load models
        print("📂 Loading models...")
        cm = CascadeModelManager('app/optimization_cascade/cascade_models', mill_number=8)
        success = cm.load_models()
        
        if not success:
            print("❌ Failed to load models")
            return False
        
        print("✅ Models loaded successfully")
        
        # Test prediction
        print("\n🎯 Testing prediction...")
        mv_values = {
            "Ore": 180.0,
            "WaterMill": 15.0,
            "WaterZumpf": 180.0,
            "MotorAmp": 180.0
        }
        
        dv_values = {
            "Shisti": 50.0,
            "Daiki": 40.0,
            "Grano": 60.0,
            "Class_12": 45.0,
            "Class_15": 35.0,
            "FE": 0.2
        }
        
        print(f"   MV values: {mv_values}")
        print(f"   DV values: {dv_values}")
        
        result = cm.predict_cascade(mv_values, dv_values)
        
        print("✅ Prediction successful!")
        print(f"   Target: {result['predicted_target']:.2f}")
        print(f"   Feasible: {result['is_feasible']}")
        print(f"   CVs: {result['predicted_cvs']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_direct_prediction()
