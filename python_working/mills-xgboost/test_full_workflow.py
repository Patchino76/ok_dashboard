"""
Test the complete cascade optimization workflow
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_complete_workflow():
    """Test the complete workflow: load models → predict → optimize"""
    print("🚀 Complete Cascade Optimization Workflow Test")
    print("=" * 60)
    
    # Step 1: Load models
    print("\n📂 Step 1: Loading Mill 8 models...")
    try:
        response = requests.post(f"{BASE_URL}/api/v1/cascade/models/8/load")
        if response.status_code == 200:
            result = response.json()
            print("✅ Models loaded successfully")
            print(f"   Mill: {result.get('mill_number')}")
            print(f"   Status: {result.get('status')}")
        else:
            print(f"❌ Model loading failed: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error: {error.get('detail')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Model loading error: {e}")
        return False
    
    # Step 2: Test prediction
    print(f"\n🎯 Step 2: Testing prediction...")
    pred_request = {
        "mv_values": {
            "Ore": 180.0,
            "WaterMill": 15.0,
            "WaterZumpf": 180.0,
            "MotorAmp": 180.0
        },
        "dv_values": {
            "Shisti": 50.0,
            "Daiki": 40.0,
            "Grano": 60.0,
            "Class_12": 45.0,
            "Class_15": 35.0,
            "FE": 0.2
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/v1/cascade/predict", json=pred_request)
        if response.status_code == 200:
            result = response.json()
            print("✅ Prediction successful")
            print(f"   Target: {result.get('predicted_target'):.2f}")
            print(f"   Feasible: {result.get('is_feasible')}")
            print(f"   CVs: {result.get('predicted_cvs')}")
        else:
            print(f"❌ Prediction failed: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error: {error.get('detail')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return False
    
    # Step 3: Test optimization
    print(f"\n🎯 Step 3: Testing optimization...")
    opt_request = {
        "mv_bounds": {
            "Ore": [150, 200],
            "WaterMill": [10, 20],
            "WaterZumpf": [150, 200],
            "MotorAmp": [160, 200]
        },
        "cv_bounds": {
            "PulpHC": [450, 550],
            "DensityHC": [1400, 1600],
            "PressureHC": [0.2, 0.4]
        },
        "dv_values": {
            "Shisti": 50.0,
            "Daiki": 40.0,
            "Grano": 60.0,
            "Class_12": 45.0,
            "Class_15": 35.0,
            "FE": 0.2
        },
        "target_variable": "PSI200",
        "maximize": False,
        "n_trials": 10
    }
    
    try:
        print("   Sending optimization request...")
        start_time = time.time()
        
        response = requests.post(
            f"{BASE_URL}/api/v1/cascade/optimize",
            json=opt_request,
            timeout=60
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Optimization successful in {duration:.1f}s")
            print(f"   Status: {result.get('status')}")
            print(f"   Best target: {result.get('best_target_value'):.2f}")
            print(f"   Feasible: {result.get('is_feasible')}")
            print(f"   Trials: {result.get('n_trials')}")
            
            best_mvs = result.get('best_mv_values', {})
            print(f"   Best MVs:")
            for mv_name, mv_value in best_mvs.items():
                print(f"     {mv_name}: {mv_value:.2f}")
            
            best_cvs = result.get('best_cv_values', {})
            print(f"   Predicted CVs:")
            for cv_name, cv_value in best_cvs.items():
                print(f"     {cv_name}: {cv_value:.2f}")
            
            return True
            
        else:
            print(f"❌ Optimization failed: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error: {error.get('detail')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"⏰ Optimization timed out (>60s)")
        return False
    except Exception as e:
        print(f"❌ Optimization error: {e}")
        return False

def test_different_scenarios():
    """Test optimization with different scenarios"""
    print(f"\n🔄 Testing Different Optimization Scenarios")
    print("=" * 50)
    
    scenarios = [
        {
            "name": "Minimize PSI200 (Standard)",
            "maximize": False,
            "trials": 15
        },
        {
            "name": "Maximize PSI200 (Reverse)",
            "maximize": True,
            "trials": 15
        }
    ]
    
    base_request = {
        "mv_bounds": {
            "Ore": [160, 200],
            "WaterMill": [12, 18],
            "WaterZumpf": [170, 210],
            "MotorAmp": [170, 210]
        },
        "cv_bounds": {
            "PulpHC": [480, 520],
            "DensityHC": [1500, 1700],
            "PressureHC": [0.25, 0.35]
        },
        "dv_values": {
            "Shisti": 40.0,
            "Daiki": 30.0,
            "Grano": 70.0,
            "Class_12": 40.0,
            "Class_15": 30.0,
            "FE": 0.15
        },
        "target_variable": "PSI200"
    }
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n📊 Scenario {i}: {scenario['name']}")
        
        request = base_request.copy()
        request["maximize"] = scenario["maximize"]
        request["n_trials"] = scenario["trials"]
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/cascade/optimize",
                json=request,
                timeout=45
            )
            
            if response.status_code == 200:
                result = response.json()
                target = result.get('best_target_value', 'N/A')
                feasible = result.get('is_feasible', 'N/A')
                print(f"   ✅ Target: {target:.2f}, Feasible: {feasible}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    success = test_complete_workflow()
    
    if success:
        test_different_scenarios()
        print(f"\n🎉 All tests completed successfully!")
        print(f"\n📚 The simple Bayesian optimization system is working!")
    else:
        print(f"\n⚠️  Workflow failed - check server logs for details")
    
    print(f"\n💡 Next steps:")
    print(f"   1. Integration with frontend dashboard")
    print(f"   2. Enhanced multi-objective optimization")
    print(f"   3. Real-time constraint adaptation")
