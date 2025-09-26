#!/usr/bin/env python3
"""
Test the target-driven optimization API endpoint
"""

import requests
import json

def test_target_optimization_api():
    """Test the /api/v1/ml/cascade/optimize-target endpoint"""
    
    url = "http://localhost:8000/api/v1/ml/cascade/optimize-target"
    
    # Test payload
    payload = {
        "target_value": 25.0,
        "target_variable": "PSI200",
        "tolerance": 0.05,  # 5% tolerance for better success rate
        "mv_bounds": {
            "Ore": [140, 240],
            "WaterMill": [15, 30],
            "WaterZumpf": [200, 250],
            "MotorAmp": [150, 250]
        },
        "cv_bounds": {
            "PulpHC": [400, 600],
            "DensityHC": [1500, 1800],
            "PressureHC": [0.3, 0.7]
        },
        "dv_values": {
            "Shisti": 10.0,
            "Daiki": 15.0
        },
        "n_trials": 50,
        "confidence_level": 0.90
    }
    
    print("🎯 Testing target-driven optimization API...")
    print(f"   Target: {payload['target_value']}")
    print(f"   Tolerance: ±{payload['tolerance']*100:.1f}%")
    print(f"   Trials: {payload['n_trials']}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n✅ API Response Success!")
            print(f"   Status: {result.get('status')}")
            print(f"   Target achieved: {result.get('target_achieved')}")
            print(f"   Best distance: {result.get('best_distance', 0):.4f}")
            print(f"   Best target value: {result.get('best_target_value', 0):.2f}")
            print(f"   Successful trials: {result.get('successful_trials', 0)}/{result.get('total_trials', 0)}")
            print(f"   Success rate: {result.get('success_rate', 0):.1%}")
            
            # Check distributions
            mv_dists = result.get('mv_distributions', {})
            cv_dists = result.get('cv_distributions', {})
            
            print(f"\n📊 MV Distributions: {len(mv_dists)} parameters")
            for param, dist in mv_dists.items():
                print(f"   {param}: samples={dist.get('sample_count', 0)}, mean={dist.get('mean', 0):.2f}")
            
            print(f"\n📈 CV Distributions: {len(cv_dists)} parameters")
            for param, dist in cv_dists.items():
                print(f"   {param}: samples={dist.get('sample_count', 0)}, mean={dist.get('mean', 0):.2f}")
            
            # Check if fix worked
            total_distributions = len(mv_dists) + len(cv_dists)
            if total_distributions > 0:
                print(f"\n✅ SUCCESS: Found {total_distributions} parameter distributions!")
                return True
            else:
                print(f"\n❌ FAILURE: No distributions found!")
                print(f"Full response: {json.dumps(result, indent=2)}")
                return False
                
        else:
            print(f"\n❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Request failed: {e}")
        return False

if __name__ == "__main__":
    success = test_target_optimization_api()
    print(f"\n{'🎉 Test PASSED' if success else '💥 Test FAILED'}")
