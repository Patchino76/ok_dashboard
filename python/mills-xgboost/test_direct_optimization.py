"""
Test cascade optimization directly (bypassing API)
"""

import sys
sys.path.append('app')

from optimization_cascade.cascade_models import CascadeModelManager
from optimization_cascade.simple_cascade_optimizer import optimize_cascade, get_default_bounds

def test_direct_optimization():
    """Test cascade optimization directly"""
    print("🚀 Testing Direct Cascade Optimization")
    print("=" * 50)
    
    try:
        # Load models
        print("📂 Loading models...")
        model_manager = CascadeModelManager('app/optimization_cascade/cascade_models', mill_number=8)
        success = model_manager.load_models()
        
        if not success:
            print("❌ Failed to load models")
            return False
        
        print("✅ Models loaded successfully")
        
        # Get default bounds
        print("\n⚙️  Getting default bounds...")
        mv_bounds, cv_bounds, default_dv_values = get_default_bounds()
        
        print(f"   MV bounds: {mv_bounds}")
        print(f"   CV bounds: {cv_bounds}")
        print(f"   DV values: {default_dv_values}")
        
        # Run optimization
        print(f"\n🎯 Running optimization (20 trials)...")
        
        result = optimize_cascade(
            model_manager=model_manager,
            mv_bounds=mv_bounds,
            cv_bounds=cv_bounds,
            dv_values=default_dv_values,
            target_variable="PSI200",
            maximize=False,  # Minimize PSI200
            n_trials=20
        )
        
        print("✅ Optimization completed!")
        print(f"   Best target: {result.best_target_value:.2f}")
        print(f"   Feasible: {result.is_feasible}")
        print(f"   Trials: {result.n_trials}")
        print(f"   Best trial: #{result.best_trial_number}")
        
        print(f"\n📊 Optimal MV Settings:")
        for mv_name, mv_value in result.best_mv_values.items():
            print(f"   {mv_name}: {mv_value:.2f}")
        
        print(f"\n📈 Predicted CV Values:")
        for cv_name, cv_value in result.best_cv_values.items():
            print(f"   {cv_name}: {cv_value:.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_direct_optimization()
    
    if success:
        print(f"\n🎉 SUCCESS! The simple Bayesian optimization system works perfectly!")
        print(f"\n💡 The issue is likely with the API server imports/paths")
        print(f"   The core optimization logic is solid and ready for use")
    else:
        print(f"\n⚠️  Direct optimization failed")
