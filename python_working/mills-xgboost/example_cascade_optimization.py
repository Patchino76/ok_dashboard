"""
Example: Simple Cascade Optimization with Optuna

This script demonstrates how to use the simple Bayesian optimization 
for cascade models with minimal code.
"""

import sys
import os
sys.path.append('app')

from app.optimization_cascade.simple_cascade_optimizer import optimize_cascade, get_default_bounds
from app.optimization_cascade.cascade_models import CascadeModelManager

def main():
    """Main example function"""
    print("🚀 Simple Cascade Optimization Example")
    print("=" * 50)
    
    # Step 1: Load trained cascade models
    print("\n📂 Step 1: Loading cascade models...")
    model_manager = CascadeModelManager(
        model_save_path="app/optimization_cascade/cascade_models",
        mill_number=8  # Example mill
    )
    
    if not model_manager.load_models():
        print("❌ No trained models found!")
        print("   Please train cascade models first using the training endpoint.")
        return
    
    print("✅ Models loaded successfully!")
    
    # Step 2: Get default bounds and DV values
    print("\n⚙️  Step 2: Setting up optimization parameters...")
    mv_bounds, cv_bounds, default_dv_values = get_default_bounds()
    
    print(f"   MV bounds: {mv_bounds}")
    print(f"   CV bounds: {cv_bounds}")
    print(f"   DV values: {default_dv_values}")
    
    # Step 3: Run optimization to MINIMIZE PSI200
    print(f"\n🎯 Step 3: Running optimization (minimize PSI200)...")
    
    result = optimize_cascade(
        model_manager=model_manager,
        mv_bounds=mv_bounds,
        cv_bounds=cv_bounds,
        dv_values=default_dv_values,
        target_variable="PSI200",
        maximize=False,  # Minimize PSI200 (typical goal)
        n_trials=50
    )
    
    # Step 4: Display results
    print(f"\n🎉 Step 4: Optimization Results")
    print(f"   Target value (PSI200): {result.best_target_value:.2f}")
    print(f"   Feasible solution: {result.is_feasible}")
    print(f"   Trials completed: {result.n_trials}")
    print(f"   Best trial: #{result.best_trial_number}")
    
    print(f"\n📊 Optimal MV Settings:")
    for mv_name, mv_value in result.best_mv_values.items():
        print(f"   {mv_name}: {mv_value:.2f}")
    
    print(f"\n📈 Predicted CV Values:")
    for cv_name, cv_value in result.best_cv_values.items():
        print(f"   {cv_name}: {cv_value:.2f}")
    
    # Step 5: Try different scenarios
    print(f"\n🔄 Step 5: Testing different scenarios...")
    
    # Scenario A: Hard ore (high Shisti/Daiki)
    hard_ore_dvs = {
        "Shisti": 80.0,
        "Daiki": 70.0,
        "Grano": 20.0,
        "Class_12": 60.0,
        "Class_15": 50.0,
        "FE": 0.3
    }
    
    print(f"\n🪨 Scenario A: Hard ore optimization...")
    result_hard = optimize_cascade(
        model_manager=model_manager,
        mv_bounds=mv_bounds,
        cv_bounds=cv_bounds,
        dv_values=hard_ore_dvs,
        maximize=False,
        n_trials=30
    )
    
    # Scenario B: Soft ore (low Shisti/Daiki)
    soft_ore_dvs = {
        "Shisti": 20.0,
        "Daiki": 15.0,
        "Grano": 80.0,
        "Class_12": 30.0,
        "Class_15": 25.0,
        "FE": 0.1
    }
    
    print(f"\n🧽 Scenario B: Soft ore optimization...")
    result_soft = optimize_cascade(
        model_manager=model_manager,
        mv_bounds=mv_bounds,
        cv_bounds=cv_bounds,
        dv_values=soft_ore_dvs,
        maximize=False,
        n_trials=30
    )
    
    # Compare scenarios
    print(f"\n📊 Scenario Comparison:")
    print(f"   Default ore PSI200: {result.best_target_value:.2f}")
    print(f"   Hard ore PSI200: {result_hard.best_target_value:.2f}")
    print(f"   Soft ore PSI200: {result_soft.best_target_value:.2f}")
    
    print(f"\n✨ Example completed successfully!")

if __name__ == "__main__":
    main()
