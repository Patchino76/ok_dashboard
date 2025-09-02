"""
Cascade Optimization Engine

Implements advanced Bayesian optimization using the cascade model approach:
- Multi-objective optimization
- Constraint handling
- Robust optimization across scenarios
- Integration with Optuna for efficient search
"""

import numpy as np
import pandas as pd
import optuna
from optuna.samplers import TPESampler
from typing import Dict, List, Tuple, Optional, Any, Callable
import logging
from datetime import datetime
import json
import os

from .cascade_models import CascadeModelManager
from .variable_classifier import VariableClassifier, VariableType

class CascadeOptimizationEngine:
    """
    Advanced cascade optimization engine using Bayesian optimization
    """
    
    def __init__(self, model_manager: CascadeModelManager, study_name: str = "cascade_optimization"):
        self.model_manager = model_manager
        self.classifier = VariableClassifier()
        self.study_name = study_name
        self.current_study = None
        self.optimization_results = {}
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Default optimization settings
        self.default_settings = {
            'n_trials': 1000,
            'timeout': 300,  # 5 minutes
            'n_jobs': 1,
            'direction': 'minimize',  # Minimize PSI200
            'sampler_seed': 42
        }
        
        # Penalty weights for constraint violations
        self.penalty_weights = {
            'infeasible_penalty': 100.0,
            'power_penalty_threshold': 1000.0,  # kW
            'power_penalty_weight': 0.5,
            'density_penalty_threshold': 1.3,  # kg/L
            'density_penalty_weight': 0.5
        }
    
    def create_objective_function(self, 
                                dv_values: Dict[str, float],
                                optimization_type: str = "single",
                                custom_penalties: Optional[Dict[str, Any]] = None) -> Callable:
        """
        Create objective function for Optuna optimization
        
        Args:
            dv_values: Fixed disturbance variable values
            optimization_type: 'single', 'multi', or 'robust'
            custom_penalties: Custom penalty configuration
            
        Returns:
            Objective function for Optuna
        """
        
        penalties = {**self.penalty_weights, **(custom_penalties or {})}
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        mv_bounds = self.classifier.get_mv_bounds()
        
        def objective(trial):
            # Sample manipulated variables within bounds
            mv_values = {}
            for mv_id in mvs:
                min_bound, max_bound = mv_bounds[mv_id]
                mv_values[mv_id] = trial.suggest_float(mv_id, min_bound, max_bound)
            
            # Predict using cascade
            try:
                result = self.model_manager.predict_cascade(mv_values, dv_values)
                
                predicted_target = result['predicted_target']
                predicted_cvs = result['predicted_cvs']
                is_feasible = result['is_feasible']
                
                # Base penalty for infeasible solutions
                if not is_feasible:
                    return penalties['infeasible_penalty']
                
                # Soft constraints for operational efficiency
                penalty = 0.0
                
                # Power consumption penalty
                if 'MotorAmp' in predicted_cvs:
                    motor_current = predicted_cvs['MotorAmp']
                    if motor_current > penalties['power_penalty_threshold']:
                        penalty += penalties['power_penalty_weight']
                
                # Density penalty for downstream flotation
                if 'DensityHC' in predicted_cvs:
                    density = predicted_cvs['DensityHC'] / 1000  # Convert to kg/L
                    if density < penalties['density_penalty_threshold']:
                        penalty += penalties['density_penalty_weight']
                
                return predicted_target + penalty
                
            except Exception as e:
                self.logger.error(f"Error in objective function: {e}")
                return penalties['infeasible_penalty']
        
        return objective
    
    def optimize_single_objective(self, 
                                dv_values: Dict[str, float],
                                n_trials: int = 1000,
                                timeout: Optional[int] = None,
                                custom_penalties: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Single-objective optimization to minimize PSI200
        
        Args:
            dv_values: Current disturbance variable values
            n_trials: Number of optimization trials
            timeout: Timeout in seconds
            custom_penalties: Custom penalty weights
            
        Returns:
            Optimization results
        """
        
        self.logger.info(f"Starting single-objective optimization with {n_trials} trials")
        
        # Create study
        study = optuna.create_study(
            direction=self.default_settings['direction'],
            sampler=TPESampler(seed=self.default_settings['sampler_seed']),
            study_name=f"{self.study_name}_single_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        
        # Create objective function
        objective_func = self.create_objective_function(
            dv_values, 
            optimization_type="single",
            custom_penalties=custom_penalties
        )
        
        # Run optimization
        study.optimize(objective_func, n_trials=n_trials, timeout=timeout)
        
        # Store study for analysis
        self.current_study = study
        
        # Get best results
        best_params = study.best_params
        best_value = study.best_value
        
        # Predict final state with best parameters
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        best_mv_values = {mv_id: best_params[mv_id] for mv_id in mvs}
        final_prediction = self.model_manager.predict_cascade(best_mv_values, dv_values)
        
        results = {
            'optimization_type': 'single_objective',
            'best_target_value': best_value,
            'best_mv_parameters': best_mv_values,
            'predicted_cvs': final_prediction['predicted_cvs'],
            'is_feasible': final_prediction['is_feasible'],
            'constraint_violations': final_prediction.get('constraint_violations', []),
            'dv_inputs': dv_values,
            'n_trials': len(study.trials),
            'optimization_time': study.trials[-1].datetime_complete - study.trials[0].datetime_start if study.trials else None,
            'study': study,
            'convergence_data': self._extract_convergence_data(study)
        }
        
        self.optimization_results['single_objective'] = results
        
        self.logger.info(f"Optimization completed. Best PSI200: {best_value:.2f}%")
        
        return results
    
    def optimize_multi_objective(self,
                               dv_values: Dict[str, float],
                               objectives: List[str] = ['quality', 'cost'],
                               n_trials: int = 1000,
                               timeout: Optional[int] = None) -> Dict[str, Any]:
        """
        Multi-objective optimization (quality vs operational cost)
        
        Args:
            dv_values: Current disturbance variable values
            objectives: List of objectives to optimize
            n_trials: Number of optimization trials
            timeout: Timeout in seconds
            
        Returns:
            Multi-objective optimization results
        """
        
        self.logger.info(f"Starting multi-objective optimization: {objectives}")
        
        def multi_objective(trial):
            # Sample MVs
            mvs = [mv.id for mv in self.classifier.get_mvs()]
            mv_bounds = self.classifier.get_mv_bounds()
            
            mv_values = {}
            for mv_id in mvs:
                min_bound, max_bound = mv_bounds[mv_id]
                mv_values[mv_id] = trial.suggest_float(mv_id, min_bound, max_bound)
            
            # Predict cascade
            result = self.model_manager.predict_cascade(mv_values, dv_values)
            
            if not result['is_feasible']:
                return 100.0, 1000.0  # High penalties
            
            predicted_target = result['predicted_target']
            predicted_cvs = result['predicted_cvs']
            
            # Calculate operational cost (simplified model)
            power_cost = predicted_cvs.get('MotorAmp', 200) * 0.10  # $/A
            water_cost = (mv_values.get('WaterMill', 15) + mv_values.get('WaterZumpf', 200)) * 0.50  # $/m³
            ore_cost = mv_values.get('Ore', 190) * 2.0  # $/t
            
            total_cost = power_cost + water_cost + ore_cost
            
            return predicted_target, total_cost
        
        # Create multi-objective study
        study = optuna.create_study(
            directions=['minimize', 'minimize'],  # Minimize both quality and cost
            study_name=f"{self.study_name}_multi_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        
        study.optimize(multi_objective, n_trials=n_trials, timeout=timeout)
        
        # Extract Pareto front
        pareto_trials = []
        for trial in study.trials:
            if trial.state == optuna.trial.TrialState.COMPLETE:
                pareto_trials.append({
                    'trial_number': trial.number,
                    'quality': trial.values[0],
                    'cost': trial.values[1],
                    'parameters': trial.params
                })
        
        results = {
            'optimization_type': 'multi_objective',
            'objectives': objectives,
            'pareto_trials': pareto_trials,
            'n_trials': len(study.trials),
            'study': study,
            'dv_inputs': dv_values
        }
        
        self.optimization_results['multi_objective'] = results
        
        self.logger.info(f"Multi-objective optimization completed. {len(pareto_trials)} Pareto solutions found.")
        
        return results
    
    def optimize_robust(self,
                       dv_scenarios: List[Dict[str, float]],
                       n_trials: int = 1500,
                       timeout: Optional[int] = None,
                       feasibility_threshold: float = 0.8) -> Dict[str, Any]:
        """
        Robust optimization across multiple DV scenarios
        
        Args:
            dv_scenarios: List of different disturbance variable scenarios
            n_trials: Number of optimization trials
            timeout: Timeout in seconds
            feasibility_threshold: Minimum feasibility ratio required
            
        Returns:
            Robust optimization results
        """
        
        self.logger.info(f"Starting robust optimization across {len(dv_scenarios)} scenarios")
        
        def robust_objective(trial):
            # Sample MVs
            mvs = [mv.id for mv in self.classifier.get_mvs()]
            mv_bounds = self.classifier.get_mv_bounds()
            
            mv_values = {}
            for mv_id in mvs:
                min_bound, max_bound = mv_bounds[mv_id]
                mv_values[mv_id] = trial.suggest_float(mv_id, min_bound, max_bound)
            
            # Test performance across all scenarios
            qualities = []
            feasible_count = 0
            
            for dv_scenario in dv_scenarios:
                result = self.model_manager.predict_cascade(mv_values, dv_scenario)
                
                if result['is_feasible']:
                    qualities.append(result['predicted_target'])
                    feasible_count += 1
                else:
                    qualities.append(100.0)  # Penalty for infeasible
            
            # Robust metrics
            mean_quality = np.mean(qualities)
            worst_quality = np.max(qualities)  # Worst-case scenario
            feasibility_ratio = feasible_count / len(dv_scenarios)
            
            # Penalize if not feasible across enough scenarios
            if feasibility_ratio < feasibility_threshold:
                return 100.0
            
            # Conservative approach: weight worst-case performance
            return 0.7 * mean_quality + 0.3 * worst_quality
        
        # Create robust study
        study = optuna.create_study(
            direction='minimize',
            study_name=f"{self.study_name}_robust_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        
        study.optimize(robust_objective, n_trials=n_trials, timeout=timeout)
        
        # Analyze best solution across scenarios
        best_params = study.best_params
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        best_mv_values = {mv_id: best_params[mv_id] for mv_id in mvs}
        
        scenario_results = []
        for i, dv_scenario in enumerate(dv_scenarios):
            result = self.model_manager.predict_cascade(best_mv_values, dv_scenario)
            scenario_results.append({
                'scenario_id': i,
                'dv_values': dv_scenario,
                'predicted_target': result['predicted_target'],
                'predicted_cvs': result['predicted_cvs'],
                'is_feasible': result['is_feasible']
            })
        
        results = {
            'optimization_type': 'robust',
            'best_mv_parameters': best_mv_values,
            'best_robust_value': study.best_value,
            'scenario_results': scenario_results,
            'feasibility_threshold': feasibility_threshold,
            'n_scenarios': len(dv_scenarios),
            'n_trials': len(study.trials),
            'study': study
        }
        
        self.optimization_results['robust'] = results
        
        self.logger.info(f"Robust optimization completed. Best robust value: {study.best_value:.2f}")
        
        return results
    
    def create_implementation_plan(self,
                                 current_mv_values: Dict[str, float],
                                 optimal_mv_values: Dict[str, float],
                                 n_steps: int = 5) -> Dict[str, Any]:
        """
        Create gradual implementation plan from current to optimal settings
        
        Args:
            current_mv_values: Current MV values
            optimal_mv_values: Optimal MV values from optimization
            n_steps: Number of implementation steps
            
        Returns:
            Implementation plan with intermediate steps
        """
        
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        implementation_steps = []
        
        for step in range(n_steps + 1):
            # Linear interpolation between current and optimal
            alpha = step / n_steps
            
            step_mvs = {}
            for mv_id in mvs:
                current_val = current_mv_values.get(mv_id, optimal_mv_values[mv_id])
                step_mvs[mv_id] = current_val + alpha * (optimal_mv_values[mv_id] - current_val)
            
            implementation_steps.append({
                'step': step,
                'progress_percent': alpha * 100,
                'mv_values': step_mvs,
                'description': f"Step {step}: {alpha*100:.0f}% toward optimal"
            })
        
        return {
            'implementation_steps': implementation_steps,
            'total_steps': n_steps,
            'current_values': current_mv_values,
            'target_values': optimal_mv_values
        }
    
    def _extract_convergence_data(self, study) -> Dict[str, List]:
        """Extract convergence data from Optuna study"""
        trial_numbers = []
        best_values = []
        
        current_best = float('inf')
        for trial in study.trials:
            if trial.state == optuna.trial.TrialState.COMPLETE:
                trial_numbers.append(trial.number)
                if trial.value < current_best:
                    current_best = trial.value
                best_values.append(current_best)
        
        return {
            'trial_numbers': trial_numbers,
            'best_values': best_values
        }
    
    def save_optimization_results(self, save_path: str = "optimization_results"):
        """Save optimization results to disk"""
        os.makedirs(save_path, exist_ok=True)
        
        # Save results (excluding study objects which can't be serialized)
        serializable_results = {}
        for opt_type, results in self.optimization_results.items():
            serializable_results[opt_type] = {
                k: v for k, v in results.items() 
                if k != 'study'  # Exclude study object
            }
        
        results_file = os.path.join(save_path, f"cascade_optimization_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(results_file, 'w') as f:
            json.dump(serializable_results, f, indent=2, default=str)
        
        self.logger.info(f"Optimization results saved to {results_file}")
        return results_file
    
    def get_optimization_summary(self) -> Dict[str, Any]:
        """Get summary of all optimization runs"""
        summary = {
            'completed_optimizations': list(self.optimization_results.keys()),
            'total_runs': len(self.optimization_results),
            'cascade_structure': self.classifier.get_cascade_structure(),
            'model_summary': self.model_manager.get_model_summary()
        }
        
        # Add best results from each optimization type
        for opt_type, results in self.optimization_results.items():
            if opt_type == 'single_objective':
                summary[f'{opt_type}_best'] = {
                    'target_value': results['best_target_value'],
                    'mv_parameters': results['best_mv_parameters'],
                    'feasible': results['is_feasible']
                }
            elif opt_type == 'robust':
                summary[f'{opt_type}_best'] = {
                    'robust_value': results['best_robust_value'],
                    'mv_parameters': results['best_mv_parameters'],
                    'n_scenarios': results['n_scenarios']
                }
        
        return summary
