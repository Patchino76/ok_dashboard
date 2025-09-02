"""
Comprehensive Testing Script for Cascade Optimization System

This script demonstrates and tests the complete cascade optimization workflow:
1. Data preparation and model training
2. Model validation and performance analysis
3. Single-objective optimization
4. Multi-objective optimization
5. Robust optimization
6. Results visualization and analysis
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import os
import sys
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Add the app directory to Python path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimization_cascade.variable_classifier import VariableClassifier
from optimization_cascade.cascade_models import CascadeModelManager
from optimization_cascade.cascade_engine import CascadeOptimizationEngine
from optimization_cascade.cascade_validator import CascadeValidator
from optimization_cascade.cascade_plotter import CascadePlotter

class CascadeSystemTester:
    """
    Comprehensive tester for the cascade optimization system
    """
    
    def __init__(self, output_dir: str = "cascade_test_results"):
        self.output_dir = output_dir
        self.classifier = VariableClassifier()
        self.model_manager = None
        self.optimizer = None
        self.validator = None
        self.plotter = CascadePlotter()
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        print("=== CASCADE OPTIMIZATION SYSTEM TESTER ===")
        print(f"Output directory: {output_dir}")
        print(f"Test started: {datetime.now()}")
        print()
    
    def generate_synthetic_data(self, n_samples: int = 2000) -> pd.DataFrame:
        """
        Generate synthetic mill data for testing
        
        Args:
            n_samples: Number of data samples to generate
            
        Returns:
            Synthetic dataset with all required variables
        """
        print(f"Generating synthetic data ({n_samples} samples)...")
        
        np.random.seed(42)  # For reproducible results
        
        # Get variable information
        mvs = self.classifier.get_mvs()
        cvs = self.classifier.get_cvs()
        dvs = self.classifier.get_dvs()
        targets = self.classifier.get_targets()
        
        data = {}
        
        # Generate MVs (manipulated variables) - realistic ranges
        for mv in mvs:
            # Add some correlation and realistic patterns
            if mv.id == 'Ore':
                data[mv.id] = np.random.normal(190, 20, n_samples)
                data[mv.id] = np.clip(data[mv.id], mv.min_bound, mv.max_bound)
            elif mv.id == 'WaterMill':
                data[mv.id] = np.random.normal(15, 3, n_samples)
                data[mv.id] = np.clip(data[mv.id], mv.min_bound, mv.max_bound)
            elif mv.id == 'WaterZumpf':
                data[mv.id] = np.random.normal(195, 25, n_samples)
                data[mv.id] = np.clip(data[mv.id], mv.min_bound, mv.max_bound)
            elif mv.id == 'MotorAmp':
                # Motor current correlated with ore feed
                data[mv.id] = 180 + 0.3 * data['Ore'] + np.random.normal(0, 10, n_samples)
                data[mv.id] = np.clip(data[mv.id], mv.min_bound, mv.max_bound)
        
        # Generate CVs (controlled variables) - dependent on MVs
        for cv in cvs:
            if cv.id == 'PulpHC':
                # Pulp flow depends on ore and water
                data[cv.id] = 400 + 0.5 * data['Ore'] + 2.0 * data['WaterZumpf'] + np.random.normal(0, 20, n_samples)
                data[cv.id] = np.clip(data[cv.id], cv.min_bound, cv.max_bound)
            elif cv.id == 'DensityHC':
                # Density depends on ore/water ratio
                water_total = data['WaterMill'] + data['WaterZumpf']
                ore_water_ratio = data['Ore'] / water_total
                data[cv.id] = 1400 + 200 * ore_water_ratio + np.random.normal(0, 50, n_samples)
                data[cv.id] = np.clip(data[cv.id], cv.min_bound, cv.max_bound)
            elif cv.id == 'PressureHC':
                # Pressure depends on flow and density
                data[cv.id] = 0.1 + 0.0005 * data['PulpHC'] + 0.0001 * data['DensityHC'] + np.random.normal(0, 0.05, n_samples)
                data[cv.id] = np.clip(data[cv.id], cv.min_bound, cv.max_bound)
            elif cv.id == 'PumpRPM':
                # RPM correlated with flow
                data[cv.id] = 200 + 0.8 * data['PulpHC'] + np.random.normal(0, 30, n_samples)
                data[cv.id] = np.clip(data[cv.id], cv.min_bound, cv.max_bound)
        
        # Generate DVs (disturbance variables) - ore quality parameters
        for dv in dvs:
            if dv.id in ['Shisti', 'Daiki']:
                data[dv.id] = np.random.beta(2, 5, n_samples) * 100  # Skewed toward lower values
                data[dv.id] = np.clip(data[dv.id], dv.min_bound, dv.max_bound)
            elif dv.id == 'Class_15':
                data[dv.id] = np.random.normal(25, 8, n_samples)
                data[dv.id] = np.clip(data[dv.id], dv.min_bound, dv.max_bound)
            elif dv.id == 'FE':
                data[dv.id] = np.random.normal(0.15, 0.05, n_samples)
                data[dv.id] = np.clip(data[dv.id], dv.min_bound, dv.max_bound)
        
        # Generate target (PSI200) - complex relationship with CVs and DVs
        # Realistic mill behavior: higher density and pressure generally reduce PSI200
        # Ore quality (DVs) also affects grinding efficiency
        density_effect = -0.01 * (data['DensityHC'] - 1500)  # Normalized density effect
        pressure_effect = -20 * (data['PressureHC'] - 0.3)   # Pressure effect
        ore_hardness_effect = 0.3 * data['Shisti'] + 0.2 * data['Daiki']  # Harder ore = higher PSI200
        motor_effect = -0.05 * (data['MotorAmp'] - 200)      # More power = better grinding
        
        base_psi200 = 25  # Base PSI200 value
        data['PSI200'] = (base_psi200 + density_effect + pressure_effect + 
                         ore_hardness_effect + motor_effect + 
                         np.random.normal(0, 3, n_samples))
        
        # Clip to realistic range
        data['PSI200'] = np.clip(data['PSI200'], 10, 40)
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        print(f"Synthetic data generated: {df.shape}")
        print(f"Data saved to: {self.output_dir}/synthetic_mill_data.csv")
        
        # Save data
        df.to_csv(f"{self.output_dir}/synthetic_mill_data.csv", index=False)
        
        return df
    
    def test_variable_classification(self):
        """Test the variable classification system"""
        print("\n=== TESTING VARIABLE CLASSIFICATION ===")
        
        # Print cascade structure
        self.classifier.print_cascade_summary()
        
        # Test variable classification functions
        mvs = self.classifier.get_mvs()
        cvs = self.classifier.get_cvs()
        dvs = self.classifier.get_dvs()
        targets = self.classifier.get_targets()
        
        print(f"\nVariable counts:")
        print(f"  MVs: {len(mvs)}")
        print(f"  CVs: {len(cvs)}")
        print(f"  DVs: {len(dvs)}")
        print(f"  Targets: {len(targets)}")
        
        # Test bounds and constraints
        mv_bounds = self.classifier.get_mv_bounds()
        cv_constraints = self.classifier.get_cv_constraints()
        
        print(f"\nBounds and constraints defined:")
        print(f"  MV bounds: {len(mv_bounds)}")
        print(f"  CV constraints: {len(cv_constraints)}")
        
        return True
    
    def test_model_training(self, df: pd.DataFrame):
        """Test cascade model training"""
        print("\n=== TESTING CASCADE MODEL TRAINING ===")
        
        # Initialize model manager
        model_save_path = f"{self.output_dir}/cascade_models"
        self.model_manager = CascadeModelManager(model_save_path)
        
        # Train all models
        training_results = self.model_manager.train_all_models(df, test_size=0.2)
        
        print(f"\nTraining completed:")
        print(f"  Process models: {len(training_results['process_models'])}")
        print(f"  Quality model: {'trained' if training_results['quality_model'] else 'failed'}")
        print(f"  Chain validation R²: {training_results['chain_validation']['r2_score']:.4f}")
        
        return training_results
    
    def test_model_validation(self, df: pd.DataFrame):
        """Test comprehensive model validation"""
        print("\n=== TESTING MODEL VALIDATION ===")
        
        if not self.model_manager:
            raise ValueError("Models not trained. Run test_model_training first.")
        
        # Initialize validator
        self.validator = CascadeValidator(self.model_manager)
        
        # Run all validation tests
        individual_results = self.validator.validate_individual_models(df, test_size=0.3)
        quality_results = self.validator.validate_quality_model(df, test_size=0.3)
        cascade_results = self.validator.validate_complete_cascade(df, n_samples=300)
        
        # Cross-validation (reduced folds for speed)
        cv_results = self.validator.cross_validate_models(df, n_folds=3)
        
        # Stress test with extreme scenarios
        extreme_scenarios = [
            {'Shisti': 80.0, 'Daiki': 70.0, 'Class_15': 45.0, 'FE': 0.5},  # Very hard ore
            {'Shisti': 5.0, 'Daiki': 3.0, 'Class_15': 10.0, 'FE': 0.05},   # Very soft ore
            {'Shisti': 50.0, 'Daiki': 50.0, 'Class_15': 30.0, 'FE': 0.3}   # Medium ore
        ]
        stress_results = self.validator.stress_test_optimization(extreme_scenarios, n_trials_per_scenario=50)
        
        # Generate validation report
        report = self.validator.generate_validation_report()
        print(f"\n{report}")
        
        # Save validation report
        with open(f"{self.output_dir}/validation_report.txt", 'w') as f:
            f.write(report)
        
        validation_results = {
            'individual_models': individual_results,
            'quality_model': quality_results,
            'complete_cascade': cascade_results,
            'cross_validation': cv_results,
            'stress_test': stress_results
        }
        
        return validation_results
    
    def test_single_optimization(self):
        """Test single-objective optimization"""
        print("\n=== TESTING SINGLE-OBJECTIVE OPTIMIZATION ===")
        
        if not self.model_manager:
            raise ValueError("Models not trained. Run test_model_training first.")
        
        # Initialize optimizer
        self.optimizer = CascadeOptimizationEngine(self.model_manager)
        
        # Define current ore quality scenario (medium hardness)
        current_dv_values = {
            'Shisti': 25.0,
            'Daiki': 20.0,
            'Class_15': 25.0,
            'FE': 0.15
        }
        
        # Run single-objective optimization
        single_results = self.optimizer.optimize_single_objective(
            dv_values=current_dv_values,
            n_trials=500,  # Reduced for testing speed
            timeout=120    # 2 minutes timeout
        )
        
        print(f"\nSingle-objective optimization completed:")
        print(f"  Best PSI200: {single_results['best_target_value']:.2f}%")
        print(f"  Feasible: {single_results['is_feasible']}")
        print(f"  Trials: {single_results['n_trials']}")
        
        # Print optimal parameters
        print(f"\nOptimal MV parameters:")
        for param, value in single_results['best_mv_parameters'].items():
            print(f"  {param}: {value:.2f}")
        
        return single_results
    
    def test_multi_objective_optimization(self):
        """Test multi-objective optimization"""
        print("\n=== TESTING MULTI-OBJECTIVE OPTIMIZATION ===")
        
        if not self.optimizer:
            raise ValueError("Optimizer not initialized. Run test_single_optimization first.")
        
        # Define DV scenario
        current_dv_values = {
            'Shisti': 25.0,
            'Daiki': 20.0,
            'Class_15': 25.0,
            'FE': 0.15
        }
        
        # Run multi-objective optimization
        multi_results = self.optimizer.optimize_multi_objective(
            dv_values=current_dv_values,
            objectives=['quality', 'cost'],
            n_trials=300,  # Reduced for testing
            timeout=90     # 1.5 minutes
        )
        
        print(f"\nMulti-objective optimization completed:")
        print(f"  Pareto solutions found: {len(multi_results['pareto_trials'])}")
        print(f"  Total trials: {multi_results['n_trials']}")
        
        return multi_results
    
    def test_robust_optimization(self):
        """Test robust optimization"""
        print("\n=== TESTING ROBUST OPTIMIZATION ===")
        
        if not self.optimizer:
            raise ValueError("Optimizer not initialized. Run test_single_optimization first.")
        
        # Define multiple ore quality scenarios
        dv_scenarios = [
            {'Shisti': 15.0, 'Daiki': 10.0, 'Class_15': 20.0, 'FE': 0.10},  # Soft ore
            {'Shisti': 25.0, 'Daiki': 20.0, 'Class_15': 25.0, 'FE': 0.15},  # Medium ore
            {'Shisti': 40.0, 'Daiki': 35.0, 'Class_15': 35.0, 'FE': 0.25},  # Hard ore
        ]
        
        # Run robust optimization
        robust_results = self.optimizer.optimize_robust(
            dv_scenarios=dv_scenarios,
            n_trials=400,  # Reduced for testing
            timeout=120,   # 2 minutes
            feasibility_threshold=0.8
        )
        
        print(f"\nRobust optimization completed:")
        print(f"  Best robust value: {robust_results['best_robust_value']:.2f}")
        print(f"  Scenarios tested: {robust_results['n_scenarios']}")
        print(f"  Total trials: {robust_results['n_trials']}")
        
        return robust_results
    
    def test_visualization(self, validation_results, optimization_results, model_results):
        """Test all visualization capabilities"""
        print("\n=== TESTING VISUALIZATION ===")
        
        plots_dir = f"{self.output_dir}/plots"
        os.makedirs(plots_dir, exist_ok=True)
        
        # Test all plotting functions
        self.plotter.save_all_plots(
            validation_results=validation_results,
            optimization_results={
                'single_objective': optimization_results['single'],
                'multi_objective': optimization_results['multi'],
                'robust': optimization_results['robust']
            },
            model_results=model_results,
            save_path=plots_dir
        )
        
        # Create interactive dashboard
        all_results = {
            'validation': validation_results,
            'optimization': {
                'single_objective': optimization_results['single']
            }
        }
        
        interactive_fig = self.plotter.create_interactive_dashboard(all_results)
        interactive_fig.write_html(f"{plots_dir}/interactive_dashboard.html")
        
        print(f"All plots saved to: {plots_dir}/")
        print(f"Interactive dashboard: {plots_dir}/interactive_dashboard.html")
        
        return True
    
    def run_complete_test(self):
        """Run complete cascade optimization system test"""
        print("=" * 60)
        print("RUNNING COMPLETE CASCADE OPTIMIZATION SYSTEM TEST")
        print("=" * 60)
        
        try:
            # 1. Test variable classification
            self.test_variable_classification()
            
            # 2. Generate synthetic data
            df = self.generate_synthetic_data(n_samples=1500)  # Reduced for speed
            
            # 3. Test model training
            model_results = self.test_model_training(df)
            
            # 4. Test model validation
            validation_results = self.test_model_validation(df)
            
            # 5. Test optimizations
            single_results = self.test_single_optimization()
            multi_results = self.test_multi_objective_optimization()
            robust_results = self.test_robust_optimization()
            
            optimization_results = {
                'single': single_results,
                'multi': multi_results,
                'robust': robust_results
            }
            
            # 6. Test visualization
            self.test_visualization(validation_results, optimization_results, model_results)
            
            # 7. Save optimization results
            results_file = self.optimizer.save_optimization_results(self.output_dir)
            
            # 8. Generate final summary
            self.generate_test_summary(validation_results, optimization_results, model_results)
            
            print("\n" + "=" * 60)
            print("COMPLETE CASCADE OPTIMIZATION SYSTEM TEST SUCCESSFUL!")
            print("=" * 60)
            print(f"All results saved to: {self.output_dir}/")
            
            return True
            
        except Exception as e:
            print(f"\nTEST FAILED: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def generate_test_summary(self, validation_results, optimization_results, model_results):
        """Generate comprehensive test summary"""
        
        summary = []
        summary.append("=" * 60)
        summary.append("CASCADE OPTIMIZATION SYSTEM TEST SUMMARY")
        summary.append("=" * 60)
        summary.append(f"Test completed: {datetime.now()}")
        summary.append(f"Output directory: {self.output_dir}")
        summary.append("")
        
        # Model performance
        summary.append("MODEL PERFORMANCE:")
        summary.append("-" * 30)
        if 'complete_cascade' in validation_results:
            cascade_r2 = validation_results['complete_cascade']['cascade_r2']
            feasibility_rate = validation_results['complete_cascade']['feasibility_rate']
            summary.append(f"Cascade R² Score: {cascade_r2:.4f}")
            summary.append(f"Feasibility Rate: {feasibility_rate:.1f}%")
        
        if 'quality_model' in validation_results:
            quality_r2 = validation_results['quality_model']['r2_score']
            summary.append(f"Quality Model R²: {quality_r2:.4f}")
        summary.append("")
        
        # Optimization results
        summary.append("OPTIMIZATION RESULTS:")
        summary.append("-" * 30)
        if 'single' in optimization_results:
            best_psi200 = optimization_results['single']['best_target_value']
            summary.append(f"Best PSI200 (Single-obj): {best_psi200:.2f}%")
        
        if 'multi' in optimization_results:
            pareto_count = len(optimization_results['multi']['pareto_trials'])
            summary.append(f"Pareto Solutions: {pareto_count}")
        
        if 'robust' in optimization_results:
            robust_value = optimization_results['robust']['best_robust_value']
            summary.append(f"Best Robust Value: {robust_value:.2f}%")
        summary.append("")
        
        # Files generated
        summary.append("FILES GENERATED:")
        summary.append("-" * 30)
        summary.append("• synthetic_mill_data.csv - Test dataset")
        summary.append("• cascade_models/ - Trained models")
        summary.append("• validation_report.txt - Validation results")
        summary.append("• plots/ - All visualization plots")
        summary.append("• cascade_optimization_results_*.json - Optimization results")
        summary.append("")
        
        summary.append("=" * 60)
        
        summary_text = "\n".join(summary)
        print(f"\n{summary_text}")
        
        # Save summary
        with open(f"{self.output_dir}/test_summary.txt", 'w') as f:
            f.write(summary_text)

def main():
    """Main function to run the cascade system test"""
    
    # Create tester
    tester = CascadeSystemTester("cascade_test_results")
    
    # Run complete test
    success = tester.run_complete_test()
    
    if success:
        print("\n🎉 Cascade optimization system test completed successfully!")
        print("Check the 'cascade_test_results' directory for all outputs.")
    else:
        print("\n❌ Cascade optimization system test failed.")
        print("Check the error messages above for details.")
    
    return success

if __name__ == "__main__":
    main()
