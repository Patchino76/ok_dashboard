"""
Test script for target-driven cascade optimization

This script tests the new target-driven optimization functionality
that seeks specific target values and returns parameter distributions.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from cascade_models import CascadeModelManager
from target_driven_optimizer import optimize_for_target, get_parameter_bounds_from_distributions

def test_target_optimization():
    """Test target-driven optimization with a trained model"""
    
    print("🎯 Testing Target-Driven Cascade Optimization")
    print("=" * 50)
    
    # Initialize model manager
    base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
    model_manager = CascadeModelManager(base_path, mill_number=8)
    
    # Try to load existing models
    success = model_manager.load_models()
    if not success:
        print("❌ No trained models found for Mill 8")
        print("Please train models first using the cascade training endpoint")
        return
    
    print("✅ Models loaded successfully")
    
    # Define optimization parameters
    target_value = 23.0  # Desired PSI200 value
    tolerance = 0.01     # ±1% tolerance
    
    # MV bounds (manipulated variables)
    mv_bounds = {
        "Ore": (180, 220),
        "WaterMill": (15, 25),
        "WaterZumpf": (200, 250),
        "MotorAmp": (220, 250)
    }
    
    # CV bounds (controlled variables - constraints)
    cv_bounds = {
        "PulpHC": (400, 600),
        "DensityHC": (1200, 1400),
        "PressureHC": (80, 120)
    }
    
    # DV values (disturbance variables - fixed)
    dv_values = {
        "Shisti": 10.0,
        "Daiki": 15.0,
        "Grano": 20.0
    }
    
    print(f"\n🎯 Target Configuration:")
    print(f"   Target value: {target_value}")
    print(f"   Tolerance: ±{tolerance*100:.1f}%")
    print(f"   Target range: {target_value*(1-tolerance):.2f} - {target_value*(1+tolerance):.2f}")
    
    print(f"\n📊 Optimization Parameters:")
    print(f"   MV bounds: {mv_bounds}")
    print(f"   CV bounds: {cv_bounds}")
    print(f"   DV values: {dv_values}")
    
    try:
        # Run target-driven optimization
        print(f"\n🚀 Starting target-driven optimization...")
        result = optimize_for_target(
            model_manager=model_manager,
            target_value=target_value,
            mv_bounds=mv_bounds,
            cv_bounds=cv_bounds,
            dv_values=dv_values,
            target_variable="PSI200",
            tolerance=tolerance,
            n_trials=100,  # Smaller number for testing
            confidence_level=0.90
        )
        
        print(f"\n✅ Optimization completed!")
        print(f"   Optimization time: {result.optimization_time:.2f}s")
        print(f"   Target achieved: {result.target_achieved}")
        print(f"   Success rate: {result.success_rate:.1%}")
        print(f"   Successful trials: {result.successful_trials}/{result.total_trials}")
        
        print(f"\n🎯 Best Solution:")
        print(f"   Target value: {result.best_target_value:.2f}")
        print(f"   Distance from target: {result.best_distance:.4f}")
        print(f"   Best MV values: {result.best_mv_values}")
        print(f"   Best CV values: {result.best_cv_values}")
        
        print(f"\n📊 MV Distributions (90% confidence):")
        for mv_name, dist in result.mv_distributions.items():
            print(f"   {mv_name}:")
            print(f"     Mean: {dist.mean:.2f} ± {dist.std:.2f}")
            print(f"     Range: [{dist.min_value:.2f}, {dist.max_value:.2f}]")
            print(f"     90% CI: [{dist.percentiles['5.0']:.2f}, {dist.percentiles['95.0']:.2f}]")
            print(f"     Samples: {dist.sample_count}")
        
        print(f"\n📊 CV Distributions (90% confidence):")
        for cv_name, dist in result.cv_distributions.items():
            print(f"   {cv_name}:")
            print(f"     Mean: {dist.mean:.2f} ± {dist.std:.2f}")
            print(f"     Range: [{dist.min_value:.2f}, {dist.max_value:.2f}]")
            print(f"     90% CI: [{dist.percentiles['5.0']:.2f}, {dist.percentiles['95.0']:.2f}]")
            print(f"     Samples: {dist.sample_count}")
        
        # Extract bounds for visualization
        mv_bounds_viz = get_parameter_bounds_from_distributions(result.mv_distributions, 0.90)
        cv_bounds_viz = get_parameter_bounds_from_distributions(result.cv_distributions, 0.90)
        
        print(f"\n🎨 Visualization Bounds (90% confidence):")
        print(f"   MV bounds for shading: {mv_bounds_viz}")
        print(f"   CV bounds for shading: {cv_bounds_viz}")
        
        return result
        
    except Exception as e:
        print(f"❌ Optimization failed: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_target_optimization()
