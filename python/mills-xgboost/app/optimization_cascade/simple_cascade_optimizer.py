"""
Simple Bayesian Optimization for Cascade Models with Optuna

Minimal implementation that accepts MV/CV/DV limits and returns optimal values.
"""

import numpy as np
import optuna
from typing import Dict, List, Any, Tuple, Optional
import logging
from dataclasses import dataclass

from .cascade_models import CascadeModelManager

# Configure logging
logger = logging.getLogger(__name__)

# Suppress Optuna's verbose logging
optuna.logging.set_verbosity(optuna.logging.WARNING)

@dataclass
class OptimizationRequest:
    """Simple optimization request"""
    # Variable bounds
    mv_bounds: Dict[str, Tuple[float, float]]  # {"Ore": (140, 240), ...}
    cv_bounds: Dict[str, Tuple[float, float]]  # {"PulpHC": (400, 600), ...}
    dv_values: Dict[str, float]  # Fixed DV values {"Shisti": 10.0, ...}
    
    # Optimization settings
    target_variable: str = "PSI200"  # What to optimize
    maximize: bool = False  # True = maximize, False = minimize
    n_trials: int = 100
    timeout: Optional[int] = None

@dataclass 
class OptimizationResult:
    """Simple optimization result"""
    best_mv_values: Dict[str, float]  # Optimal MV settings
    best_cv_values: Dict[str, float]  # Predicted CV values at optimum
    best_target_value: float  # Optimal target value
    is_feasible: bool  # Whether solution respects CV constraints
    n_trials: int  # Number of trials completed
    best_trial_number: int  # Which trial was best

class SimpleCascadeOptimizer:
    """
    Simple Optuna-based optimizer for cascade models
    """
    
    def __init__(self, model_manager: CascadeModelManager):
        """Initialize with trained cascade model manager"""
        self.model_manager = model_manager
        
        # Verify models are loaded
        if not model_manager.process_models or not model_manager.quality_model:
            raise ValueError("Cascade models not trained/loaded. Call train_all_models() or load_models() first.")
    
    def optimize(self, request: OptimizationRequest) -> OptimizationResult:
        """
        Run simple Bayesian optimization
        
        Args:
            request: Optimization request with bounds and settings
            
        Returns:
            OptimizationResult with best values
        """
        # Logging moved to endpoint level for cleaner output
        
        # Create Optuna study
        direction = 'maximize' if request.maximize else 'minimize'
        study = optuna.create_study(direction=direction)
        
        # Create objective function
        def objective(trial):
            return self._evaluate_trial(trial, request)
        
        # Run optimization
        study.optimize(objective, n_trials=request.n_trials, timeout=request.timeout)
        
        # Get best trial
        best_trial = study.best_trial
        best_mv_values = {k.replace('mv_', ''): v for k, v in best_trial.params.items()}
        
        # Get prediction for best values
        prediction = self.model_manager.predict_cascade(best_mv_values, request.dv_values)
        
        # Create result
        result = OptimizationResult(
            best_mv_values=best_mv_values,
            best_cv_values=prediction['predicted_cvs'],
            best_target_value=prediction['predicted_target'],
            is_feasible=prediction['is_feasible'],
            n_trials=len(study.trials),
            best_trial_number=best_trial.number
        )
        
        return result
    
    def _evaluate_trial(self, trial: optuna.trial.Trial, request: OptimizationRequest) -> float:
        """
        Evaluate a single optimization trial
        
        Args:
            trial: Optuna trial object
            request: Optimization request
            
        Returns:
            Objective value (target + penalties)
        """
        try:
            # Sample MV values within bounds
            mv_values = {}
            for mv_name, (min_val, max_val) in request.mv_bounds.items():
                mv_values[mv_name] = trial.suggest_float(f"mv_{mv_name}", min_val, max_val)
            
            # Predict cascade: MVs → CVs → Target
            prediction = self.model_manager.predict_cascade(mv_values, request.dv_values)
            
            # Get target value
            target_value = prediction['predicted_target']
            
            # Calculate constraint penalty
            penalty = self._calculate_penalty(prediction['predicted_cvs'], request.cv_bounds)
            
            # Return objective (target + penalty)
            if request.maximize:
                return target_value - penalty  # Maximize target, minimize penalty
            else:
                return target_value + penalty  # Minimize target + penalty
                
        except Exception as e:
            logger.error(f"Error in trial evaluation: {e}")
            # Return worst possible value
            return -1e6 if request.maximize else 1e6
    
    def _calculate_penalty(self, predicted_cvs: Dict[str, float], 
                          cv_bounds: Dict[str, Tuple[float, float]]) -> float:
        """
        Calculate penalty for CV constraint violations
        
        Args:
            predicted_cvs: Predicted CV values
            cv_bounds: CV constraint bounds
            
        Returns:
            Penalty value (0 if no violations)
        """
        penalty = 0.0
        penalty_factor = 1000.0  # Large penalty for constraint violations
        
        for cv_name, cv_value in predicted_cvs.items():
            if cv_name in cv_bounds:
                min_val, max_val = cv_bounds[cv_name]
                
                # Penalty for violations
                if cv_value < min_val:
                    penalty += penalty_factor * (min_val - cv_value) ** 2
                elif cv_value > max_val:
                    penalty += penalty_factor * (cv_value - max_val) ** 2
        
        return penalty

# Convenience functions for easy usage
def optimize_cascade(model_manager: CascadeModelManager,
                    mv_bounds: Dict[str, Tuple[float, float]],
                    cv_bounds: Dict[str, Tuple[float, float]], 
                    dv_values: Dict[str, float],
                    target_variable: str = "PSI200",
                    maximize: bool = False,
                    n_trials: int = 100) -> OptimizationResult:
    """
    Convenience function for simple cascade optimization
    
    Args:
        model_manager: Trained cascade model manager
        mv_bounds: MV bounds {"Ore": (140, 240), ...}
        cv_bounds: CV bounds {"PulpHC": (400, 600), ...}
        dv_values: Fixed DV values {"Shisti": 10.0, ...}
        target_variable: Target to optimize (default: "PSI200")
        maximize: True to maximize, False to minimize
        n_trials: Number of optimization trials
        
    Returns:
        OptimizationResult with best values
    """
    request = OptimizationRequest(
        mv_bounds=mv_bounds,
        cv_bounds=cv_bounds,
        dv_values=dv_values,
        target_variable=target_variable,
        maximize=maximize,
        n_trials=n_trials
    )
    
    optimizer = SimpleCascadeOptimizer(model_manager)
    return optimizer.optimize(request)

def get_default_bounds() -> Tuple[Dict[str, Tuple[float, float]], 
                                 Dict[str, Tuple[float, float]], 
                                 Dict[str, float]]:
    """
    Get default bounds from variable classifier
    
    Returns:
        Tuple of (mv_bounds, cv_bounds, default_dv_values)
    """
    from .old_files_to_delete.variable_classifier import VariableClassifier
    
    classifier = VariableClassifier()
    
    # Get MV bounds
    mv_bounds = classifier.get_mv_bounds()
    
    # Get CV bounds  
    cv_bounds = classifier.get_cv_constraints()
    
    # Get default DV values (middle of ranges)
    dvs = classifier.get_dvs(enabled_only=False)  # Include all DVs
    default_dv_values = {}
    for dv in dvs:
        default_dv_values[dv.id] = (dv.min_bound + dv.max_bound) / 2
    
    return mv_bounds, cv_bounds, default_dv_values
