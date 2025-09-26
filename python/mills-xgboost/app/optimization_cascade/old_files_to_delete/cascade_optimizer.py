"""
Enhanced Cascade Optimization with Optuna

Implements sophisticated multi-objective optimization for the cascade system
with advanced constraint handling, uncertainty quantification, and robust optimization.
"""

import numpy as np
import pandas as pd
import optuna
from typing import Dict, List, Any, Tuple, Optional, Union
import logging
from dataclasses import dataclass
from enum import Enum
import json
import os
from datetime import datetime

from .cascade_models import CascadeModelManager
from .variable_classifier import VariableClassifier, VariableType

# Configure logging
logger = logging.getLogger(__name__)

class OptimizationMode(Enum):
    """Optimization modes for different scenarios"""
    SINGLE_OBJECTIVE = "single_objective"
    MULTI_OBJECTIVE = "multi_objective"
    ROBUST = "robust"
    PARETO = "pareto"

@dataclass
class OptimizationConfig:
    """Configuration for cascade optimization"""
    mode: OptimizationMode = OptimizationMode.MULTI_OBJECTIVE
    n_trials: int = 200
    timeout: Optional[int] = None
    
    # Objective weights
    target_weight: float = 1.0
    constraint_weight: float = 0.5
    efficiency_weight: float = 0.3
    
    # Constraint handling
    soft_constraints: bool = True
    constraint_tolerance: float = 0.05  # 5% tolerance
    penalty_factor: float = 1000.0
    
    # Uncertainty handling
    uncertainty_samples: int = 50
    confidence_level: float = 0.95
    robust_optimization: bool = False
    
    # Advanced features
    adaptive_bounds: bool = True
    historical_performance: bool = True
    
class CascadeOptimizationObjective:
    """
    Advanced objective function for cascade optimization with multi-objective support,
    constraint handling, and uncertainty quantification.
    """
    
    def __init__(self, 
                 model_manager: CascadeModelManager,
                 config: OptimizationConfig,
                 dv_values: Dict[str, float],
                 target_bounds: Optional[Tuple[float, float]] = None):
        """
        Initialize the cascade optimization objective
        
        Args:
            model_manager: Trained cascade model manager
            config: Optimization configuration
            dv_values: Fixed disturbance variable values
            target_bounds: Optional target bounds for constraint checking
        """
        self.model_manager = model_manager
        self.config = config
        self.dv_values = dv_values
        self.target_bounds = target_bounds or (15, 35)  # PSI200 bounds
        
        self.classifier = VariableClassifier()
        self.mvs = [mv.id for mv in self.classifier.get_mvs()]
        self.cvs = [cv.id for cv in self.classifier.get_cvs()]
        self.mv_bounds = self.classifier.get_mv_bounds()
        self.cv_constraints = self.classifier.get_cv_constraints()
        
        # Performance tracking
        self.evaluation_history = []
        
    def __call__(self, trial: optuna.trial.Trial) -> Union[float, List[float]]:
        """
        Evaluate the cascade optimization objective
        
        Args:
            trial: Optuna trial object
            
        Returns:
            Objective value(s) depending on optimization mode
        """
        try:
            # Sample MV values within bounds
            mv_values = self._sample_mv_values(trial)
            
            # Predict cascade with uncertainty if enabled
            if self.config.robust_optimization:
                results = self._robust_cascade_prediction(mv_values)
            else:
                results = self._single_cascade_prediction(mv_values)
            
            # Calculate multi-objective score
            objectives = self._calculate_objectives(results, mv_values)
            
            # Store evaluation for analysis
            self._store_evaluation(trial, mv_values, results, objectives)
            
            # Return based on optimization mode
            if self.config.mode == OptimizationMode.MULTI_OBJECTIVE:
                return self._weighted_objective(objectives)
            elif self.config.mode == OptimizationMode.PARETO:
                return objectives  # Return multiple objectives for Pareto
            else:
                return objectives['primary']
                
        except Exception as e:
            logger.error(f"Error in objective evaluation: {e}")
            # Return penalty value
            return 1e6 if self.config.mode != OptimizationMode.PARETO else [1e6] * 3
    
    def _sample_mv_values(self, trial: optuna.trial.Trial) -> Dict[str, float]:
        """Sample MV values within bounds using Optuna trial"""
        mv_values = {}
        
        for mv_id in self.mvs:
            if mv_id in self.mv_bounds:
                min_bound, max_bound = self.mv_bounds[mv_id]
                
                # Adaptive bounds based on historical performance
                if self.config.adaptive_bounds and len(self.evaluation_history) > 10:
                    min_bound, max_bound = self._adapt_bounds(mv_id, min_bound, max_bound)
                
                mv_values[mv_id] = trial.suggest_float(
                    f"mv_{mv_id}", min_bound, max_bound
                )
            else:
                logger.warning(f"No bounds found for MV {mv_id}, using default")
                mv_values[mv_id] = trial.suggest_float(f"mv_{mv_id}", 0.0, 100.0)
        
        return mv_values
    
    def _single_cascade_prediction(self, mv_values: Dict[str, float]) -> Dict[str, Any]:
        """Single cascade prediction without uncertainty"""
        return self.model_manager.predict_cascade(mv_values, self.dv_values)
    
    def _robust_cascade_prediction(self, mv_values: Dict[str, float]) -> Dict[str, Any]:
        """
        Robust cascade prediction with uncertainty quantification
        Uses Monte Carlo sampling for uncertainty estimation
        """
        predictions = []
        
        for _ in range(self.config.uncertainty_samples):
            # Add noise to MV values for uncertainty
            noisy_mv_values = self._add_uncertainty_noise(mv_values)
            
            # Predict with noisy inputs
            result = self.model_manager.predict_cascade(noisy_mv_values, self.dv_values)
            predictions.append(result)
        
        # Aggregate predictions with uncertainty metrics
        return self._aggregate_uncertain_predictions(predictions)
    
    def _add_uncertainty_noise(self, mv_values: Dict[str, float]) -> Dict[str, float]:
        """Add uncertainty noise to MV values"""
        noisy_values = {}
        noise_level = 0.02  # 2% noise
        
        for mv_id, value in mv_values.items():
            noise = np.random.normal(0, noise_level * value)
            noisy_values[mv_id] = max(0, value + noise)  # Ensure positive values
        
        return noisy_values
    
    def _aggregate_uncertain_predictions(self, predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate uncertain predictions with confidence intervals"""
        targets = [p['predicted_target'] for p in predictions]
        feasible_count = sum(1 for p in predictions if p['is_feasible'])
        
        # Calculate statistics
        mean_target = np.mean(targets)
        std_target = np.std(targets)
        confidence_interval = np.percentile(
            targets, 
            [50 - self.config.confidence_level*50, 50 + self.config.confidence_level*50]
        )
        
        # Aggregate CV predictions
        all_cvs = {}
        for cv_id in self.cvs:
            cv_values = [p['predicted_cvs'].get(cv_id, 0) for p in predictions]
            all_cvs[cv_id] = {
                'mean': np.mean(cv_values),
                'std': np.std(cv_values),
                'confidence_interval': np.percentile(cv_values, [2.5, 97.5])
            }
        
        return {
            'predicted_target': mean_target,
            'target_std': std_target,
            'target_confidence_interval': confidence_interval,
            'predicted_cvs': {cv_id: cv_data['mean'] for cv_id, cv_data in all_cvs.items()},
            'cv_uncertainties': all_cvs,
            'is_feasible': feasible_count / len(predictions) > 0.8,  # 80% feasibility threshold
            'feasibility_probability': feasible_count / len(predictions),
            'uncertainty_metrics': {
                'target_std': std_target,
                'feasibility_probability': feasible_count / len(predictions)
            }
        }
    
    def _calculate_objectives(self, results: Dict[str, Any], mv_values: Dict[str, float]) -> Dict[str, float]:
        """Calculate multiple objectives for optimization"""
        objectives = {}
        
        # Primary objective: Target quality (minimize PSI200)
        target_value = results['predicted_target']
        objectives['primary'] = target_value
        
        # Constraint penalty
        constraint_penalty = self._calculate_constraint_penalty(results)
        objectives['constraint'] = constraint_penalty
        
        # Efficiency objective (minimize energy consumption proxy)
        efficiency_penalty = self._calculate_efficiency_penalty(mv_values)
        objectives['efficiency'] = efficiency_penalty
        
        # Uncertainty penalty (for robust optimization)
        if 'uncertainty_metrics' in results:
            uncertainty_penalty = results['uncertainty_metrics']['target_std'] * 10
            objectives['uncertainty'] = uncertainty_penalty
        else:
            objectives['uncertainty'] = 0.0
        
        return objectives
    
    def _calculate_constraint_penalty(self, results: Dict[str, Any]) -> float:
        """Calculate penalty for constraint violations"""
        penalty = 0.0
        
        # CV constraint violations
        predicted_cvs = results['predicted_cvs']
        for cv_id, cv_value in predicted_cvs.items():
            if cv_id in self.cv_constraints:
                min_val, max_val = self.cv_constraints[cv_id]
                
                if self.config.soft_constraints:
                    # Soft constraint with tolerance
                    tolerance = self.config.constraint_tolerance * (max_val - min_val)
                    if cv_value < (min_val - tolerance):
                        penalty += self.config.penalty_factor * (min_val - tolerance - cv_value) ** 2
                    elif cv_value > (max_val + tolerance):
                        penalty += self.config.penalty_factor * (cv_value - max_val - tolerance) ** 2
                else:
                    # Hard constraints
                    if not (min_val <= cv_value <= max_val):
                        penalty += self.config.penalty_factor
        
        # Target bounds constraint
        target_value = results['predicted_target']
        min_target, max_target = self.target_bounds
        if not (min_target <= target_value <= max_target):
            penalty += self.config.penalty_factor * 0.5
        
        # Feasibility penalty
        if not results.get('is_feasible', True):
            if 'feasibility_probability' in results:
                # Probabilistic feasibility
                feasibility_prob = results['feasibility_probability']
                penalty += self.config.penalty_factor * (1.0 - feasibility_prob)
            else:
                penalty += self.config.penalty_factor
        
        return penalty
    
    def _calculate_efficiency_penalty(self, mv_values: Dict[str, float]) -> float:
        """Calculate efficiency penalty based on resource consumption"""
        penalty = 0.0
        
        # Penalize high resource consumption
        efficiency_weights = {
            'Ore': 0.1,        # Ore consumption
            'WaterMill': 0.2,  # Water consumption
            'WaterZumpf': 0.15, # Water consumption
            'MotorAmp': 0.3    # Energy consumption
        }
        
        for mv_id, weight in efficiency_weights.items():
            if mv_id in mv_values and mv_id in self.mv_bounds:
                min_bound, max_bound = self.mv_bounds[mv_id]
                # Normalize to [0,1] and apply weight
                normalized_value = (mv_values[mv_id] - min_bound) / (max_bound - min_bound)
                penalty += weight * normalized_value
        
        return penalty
    
    def _weighted_objective(self, objectives: Dict[str, float]) -> float:
        """Calculate weighted multi-objective score"""
        return (
            self.config.target_weight * objectives['primary'] +
            self.config.constraint_weight * objectives['constraint'] +
            self.config.efficiency_weight * objectives['efficiency'] +
            0.1 * objectives.get('uncertainty', 0.0)
        )
    
    def _adapt_bounds(self, mv_id: str, min_bound: float, max_bound: float) -> Tuple[float, float]:
        """Adapt bounds based on historical performance"""
        if len(self.evaluation_history) < 10:
            return min_bound, max_bound
        
        # Get best performing values for this MV
        best_evaluations = sorted(self.evaluation_history, key=lambda x: x['objective'])[:10]
        best_values = [eval_data['mv_values'][mv_id] for eval_data in best_evaluations 
                      if mv_id in eval_data['mv_values']]
        
        if not best_values:
            return min_bound, max_bound
        
        # Narrow bounds around best performing region
        mean_best = np.mean(best_values)
        std_best = np.std(best_values)
        
        # Adaptive bounds with 2-sigma range
        adapted_min = max(min_bound, mean_best - 2 * std_best)
        adapted_max = min(max_bound, mean_best + 2 * std_best)
        
        return adapted_min, adapted_max
    
    def _store_evaluation(self, trial: optuna.trial.Trial, mv_values: Dict[str, float], 
                         results: Dict[str, Any], objectives: Dict[str, float]):
        """Store evaluation for analysis and adaptive optimization"""
        evaluation = {
            'trial_number': trial.number,
            'mv_values': mv_values.copy(),
            'predicted_target': results['predicted_target'],
            'predicted_cvs': results['predicted_cvs'].copy(),
            'is_feasible': results['is_feasible'],
            'objectives': objectives.copy(),
            'objective': self._weighted_objective(objectives),
            'timestamp': datetime.now().isoformat()
        }
        
        self.evaluation_history.append(evaluation)
        
        # Keep only recent evaluations to prevent memory issues
        if len(self.evaluation_history) > 1000:
            self.evaluation_history = self.evaluation_history[-500:]

class CascadeOptimizer:
    """
    Main cascade optimizer class that orchestrates the optimization process
    """
    
    def __init__(self, model_manager: CascadeModelManager):
        """
        Initialize the cascade optimizer
        
        Args:
            model_manager: Trained cascade model manager
        """
        self.model_manager = model_manager
        self.classifier = VariableClassifier()
        
    def optimize(self, 
                 dv_values: Dict[str, float],
                 config: OptimizationConfig,
                 target_bounds: Optional[Tuple[float, float]] = None) -> Dict[str, Any]:
        """
        Run cascade optimization with the specified configuration
        
        Args:
            dv_values: Fixed disturbance variable values
            config: Optimization configuration
            target_bounds: Optional target bounds
            
        Returns:
            Optimization results with best parameters and analysis
        """
        logger.info(f"Starting cascade optimization with mode: {config.mode}")
        
        # Create objective function
        objective = CascadeOptimizationObjective(
            self.model_manager, config, dv_values, target_bounds
        )
        
        # Create and configure Optuna study
        if config.mode == OptimizationMode.PARETO:
            study = optuna.create_study(
                directions=['minimize', 'minimize', 'minimize'],  # Multi-objective
                study_name=f"cascade_pareto_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
        else:
            study = optuna.create_study(
                direction='minimize',
                study_name=f"cascade_optimization_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
        
        # Run optimization
        study.optimize(objective, n_trials=config.n_trials, timeout=config.timeout)
        
        # Analyze results
        results = self._analyze_results(study, objective, config)
        
        return results
    
    def _analyze_results(self, study: optuna.study.Study, 
                        objective: CascadeOptimizationObjective,
                        config: OptimizationConfig) -> Dict[str, Any]:
        """Analyze optimization results and provide comprehensive insights"""
        
        if config.mode == OptimizationMode.PARETO:
            # Multi-objective analysis
            pareto_trials = study.best_trials
            
            results = {
                'optimization_mode': config.mode.value,
                'n_trials': len(study.trials),
                'pareto_solutions': len(pareto_trials),
                'pareto_front': [
                    {
                        'trial_number': trial.number,
                        'parameters': trial.params,
                        'objectives': trial.values,
                        'predicted_results': self._get_prediction_for_params(trial.params, objective)
                    }
                    for trial in pareto_trials[:10]  # Top 10 Pareto solutions
                ],
                'study': study
            }
        else:
            # Single objective analysis
            best_trial = study.best_trial
            best_params = {k.replace('mv_', ''): v for k, v in best_trial.params.items()}
            
            # Get detailed prediction for best parameters
            best_prediction = self._get_prediction_for_params(best_trial.params, objective)
            
            results = {
                'optimization_mode': config.mode.value,
                'n_trials': len(study.trials),
                'best_value': best_trial.value,
                'best_parameters': best_params,
                'best_prediction': best_prediction,
                'convergence_analysis': self._analyze_convergence(study),
                'parameter_importance': self._calculate_parameter_importance(study),
                'study': study
            }
        
        # Add evaluation history analysis
        results['evaluation_history'] = objective.evaluation_history[-50:]  # Last 50 evaluations
        results['optimization_summary'] = self._create_optimization_summary(objective, config)
        
        return results
    
    def _get_prediction_for_params(self, trial_params: Dict[str, float], 
                                  objective: CascadeOptimizationObjective) -> Dict[str, Any]:
        """Get cascade prediction for specific parameters"""
        mv_values = {k.replace('mv_', ''): v for k, v in trial_params.items()}
        return self.model_manager.predict_cascade(mv_values, objective.dv_values)
    
    def _analyze_convergence(self, study: optuna.study.Study) -> Dict[str, Any]:
        """Analyze optimization convergence"""
        values = [trial.value for trial in study.trials if trial.value is not None]
        
        if not values:
            return {'converged': False, 'message': 'No valid trials'}
        
        # Simple convergence analysis
        window_size = min(20, len(values) // 4)
        if len(values) < window_size * 2:
            return {'converged': False, 'message': 'Insufficient trials for convergence analysis'}
        
        recent_values = values[-window_size:]
        earlier_values = values[-2*window_size:-window_size]
        
        recent_mean = np.mean(recent_values)
        earlier_mean = np.mean(earlier_values)
        improvement = (earlier_mean - recent_mean) / abs(earlier_mean) if earlier_mean != 0 else 0
        
        converged = improvement < 0.01  # Less than 1% improvement
        
        return {
            'converged': converged,
            'improvement_rate': improvement,
            'recent_mean': recent_mean,
            'earlier_mean': earlier_mean,
            'best_value': min(values),
            'convergence_window': window_size
        }
    
    def _calculate_parameter_importance(self, study: optuna.study.Study) -> Dict[str, float]:
        """Calculate parameter importance using Optuna's built-in method"""
        try:
            importance = optuna.importance.get_param_importances(study)
            # Remove 'mv_' prefix from parameter names
            return {k.replace('mv_', ''): v for k, v in importance.items()}
        except Exception as e:
            logger.warning(f"Could not calculate parameter importance: {e}")
            return {}
    
    def _create_optimization_summary(self, objective: CascadeOptimizationObjective,
                                   config: OptimizationConfig) -> Dict[str, Any]:
        """Create comprehensive optimization summary"""
        history = objective.evaluation_history
        
        if not history:
            return {'message': 'No evaluation history available'}
        
        # Performance statistics
        objectives = [eval_data['objective'] for eval_data in history]
        feasible_evals = [eval_data for eval_data in history if eval_data['is_feasible']]
        
        summary = {
            'total_evaluations': len(history),
            'feasible_evaluations': len(feasible_evals),
            'feasibility_rate': len(feasible_evals) / len(history) if history else 0,
            'best_objective': min(objectives) if objectives else None,
            'mean_objective': np.mean(objectives) if objectives else None,
            'objective_std': np.std(objectives) if objectives else None,
            'configuration': {
                'mode': config.mode.value,
                'n_trials': config.n_trials,
                'target_weight': config.target_weight,
                'constraint_weight': config.constraint_weight,
                'efficiency_weight': config.efficiency_weight,
                'soft_constraints': config.soft_constraints,
                'robust_optimization': config.robust_optimization
            }
        }
        
        return summary
