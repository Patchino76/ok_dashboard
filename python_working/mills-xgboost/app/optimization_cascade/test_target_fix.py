#!/usr/bin/env python3
"""
Quick test to verify target-driven optimization fix
"""

import os
import sys
import logging

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cascade_models import CascadeModelManager
from target_driven_optimizer import TargetDrivenCascadeOptimizer, TargetOptimizationRequest

# Configure logging to see debug output
logging.basicConfig(level=logging.INFO)

def test_target_optimization():
    """Test target-driven optimization with Mill 6"""
    
    # Initialize model manager for Mill 6
    base_path = os.path.join(os.path.dirname(__file__), "cascade_models")
    model_manager = CascadeModelManager(base_path, mill_number=6)
    
    # Load models
    print("Loading Mill 6 models...")
    success = model_manager.load_models()
    if not success:
        print("❌ Failed to load models")
        return
    
    print("✅ Models loaded successfully")
    
    # Create target optimization request
    request = TargetOptimizationRequest(
        target_value=25.0,
        target_variable="PSI200",
        tolerance=0.05,  # Increase tolerance to 5% for testing
        mv_bounds={
            "Ore": (140, 240),
            "WaterMill": (15, 30),
            "WaterZumpf": (200, 250),
            "MotorAmp": (150, 250)
        },
        cv_bounds={
            "PulpHC": (400, 600),
            "DensityHC": (1500, 1800),
            "PressureHC": (0.3, 0.7)
        },
        dv_values={
            "Shisti": 10.0,
            "Daiki": 15.0
        },
        n_trials=50,  # Smaller for quick test
        confidence_level=0.90
    )
    
    # Run optimization
    print(f"\n🎯 Starting target-driven optimization...")
    print(f"   Target: {request.target_value}")
    print(f"   Tolerance: ±{request.tolerance*100:.1f}%")
    print(f"   Trials: {request.n_trials}")
    
    optimizer = TargetDrivenCascadeOptimizer(model_manager)
    result = optimizer.optimize_for_target(request)
    
    # Print results
    print(f"\n📊 Results:")
    print(f"   Target achieved: {result.target_achieved}")
    print(f"   Best distance: {result.best_distance:.4f}")
    print(f"   Best target value: {result.best_target_value:.2f}")
    print(f"   Successful trials: {result.successful_trials}/{result.total_trials}")
    print(f"   Success rate: {result.success_rate:.1%}")
    print(f"   Optimization time: {result.optimization_time:.2f}s")
    
    print(f"\n🎛️ Best MV values:")
    for param, value in result.best_mv_values.items():
        print(f"   {param}: {value:.2f}")
    
    print(f"\n📈 MV Distributions:")
    for param, dist in result.mv_distributions.items():
        print(f"   {param}: mean={dist.mean:.2f}, std={dist.std:.2f}, samples={dist.sample_count}")
    
    print(f"\n📊 CV Distributions:")
    for param, dist in result.cv_distributions.items():
        print(f"   {param}: mean={dist.mean:.2f}, std={dist.std:.2f}, samples={dist.sample_count}")
    
    # Check if distributions are populated
    if result.mv_distributions or result.cv_distributions:
        print("\n✅ SUCCESS: Distributions are populated!")
        return True
    else:
        print("\n❌ FAILURE: Distributions are empty!")
        return False

if __name__ == "__main__":
    success = test_target_optimization()
    sys.exit(0 if success else 1)
