"""
Gaussian Process Regression Cascade Optimizer

Uses Optuna for Bayesian optimization with GPR cascade models.
Supports uncertainty-aware optimization strategies.
"""

import optuna
from typing import Dict, Optional
from pydantic import BaseModel
import time

from .gpr_cascade_models import GPRCascadeModelManager


class GPROptimizationRequest(BaseModel):
    """Request model for GPR cascade optimization"""
    mv_bounds: Dict[str, tuple]
    cv_bounds: Dict[str, tuple]
    dv_values: Dict[str, float]
    target_variable: str = "PSI200"
    maximize: bool = False
    n_trials: int = 100
    use_uncertainty: bool = False  # If True, optimize for robust solutions (mean - k*std)
    uncertainty_weight: float = 1.0  # Weight for uncertainty penalty


class GPROptimizationResult(BaseModel):
    """Result model for GPR cascade optimization"""
    best_mv_values: Dict[str, float]
    best_cv_values: Dict[str, float]
    best_target_value: float
    best_target_uncertainty: Optional[float] = None
    is_feasible: bool
    n_trials: int
    best_trial_number: int
    optimization_time: float


class GPRCascadeOptimizer:
    """
    Bayesian optimizer for GPR cascade models using Optuna.
    Supports uncertainty-aware optimization.
    """
    
    def __init__(self, model_manager: GPRCascadeModelManager):
        self.model_manager = model_manager
        self.penalty_factor = 1000.0  # Penalty for constraint violations
    
    def optimize(self, request: GPROptimizationRequest) -> GPROptimizationResult:
        """
        Run Bayesian optimization to find optimal MV values
        
        Args:
            request: Optimization request with bounds and settings
            
        Returns:
            Optimization result with best MV values and predictions
        """
        print(f"🚀 Starting GPR cascade optimization")
        print(f"   Target: {request.target_variable}")
        print(f"   Maximize: {request.maximize}")
        print(f"   Trials: {request.n_trials}")
        print(f"   Use uncertainty: {request.use_uncertainty}")
        
        start_time = time.time()
        
        # Store best result
        best_result = {
            'mv_values': None,
            'cv_values': None,
            'target_value': None,
            'target_uncertainty': None,
            'is_feasible': False
        }
        
        def objective(trial: optuna.Trial) -> float:
            """Optuna objective function"""
            # Sample MV values
            mv_values = {}
            for mv_name, (min_val, max_val) in request.mv_bounds.items():
                mv_values[mv_name] = trial.suggest_float(mv_name, min_val, max_val)
            
            # Predict using GPR cascade with uncertainty
            try:
                result = self.model_manager.predict_cascade(
                    mv_values=mv_values,
                    dv_values=request.dv_values,
                    return_uncertainty=True
                )
                
                predicted_target = result['predicted_target']
                target_uncertainty = result.get('target_uncertainty', 0.0)
                predicted_cvs = result['predicted_cvs']
                is_feasible = result['is_feasible']
                
                # Check CV constraints
                constraint_penalty = 0.0
                for cv_name, (min_val, max_val) in request.cv_bounds.items():
                    if cv_name in predicted_cvs:
                        cv_value = predicted_cvs[cv_name]
                        if cv_value < min_val:
                            constraint_penalty += self.penalty_factor * (min_val - cv_value) ** 2
                            is_feasible = False
                        elif cv_value > max_val:
                            constraint_penalty += self.penalty_factor * (cv_value - max_val) ** 2
                            is_feasible = False
                
                # Calculate objective value
                if request.use_uncertainty:
                    # Robust optimization: minimize (or maximize) mean ± k*std
                    # For minimization: mean + k*std (prefer low mean and low uncertainty)
                    # For maximization: mean - k*std (prefer high mean and low uncertainty)
                    if request.maximize:
                        objective_value = predicted_target - request.uncertainty_weight * target_uncertainty
                    else:
                        objective_value = predicted_target + request.uncertainty_weight * target_uncertainty
                else:
                    # Standard optimization: just use mean prediction
                    objective_value = predicted_target
                
                # Add constraint penalty
                objective_value += constraint_penalty
                
                # Update best result if this is better and feasible
                nonlocal best_result
                if is_feasible:
                    if best_result['mv_values'] is None:
                        # First feasible solution
                        best_result = {
                            'mv_values': mv_values,
                            'cv_values': predicted_cvs,
                            'target_value': predicted_target,
                            'target_uncertainty': target_uncertainty,
                            'is_feasible': True
                        }
                    else:
                        # Compare with current best
                        current_best = best_result['target_value']
                        if request.maximize:
                            if predicted_target > current_best:
                                best_result = {
                                    'mv_values': mv_values,
                                    'cv_values': predicted_cvs,
                                    'target_value': predicted_target,
                                    'target_uncertainty': target_uncertainty,
                                    'is_feasible': True
                                }
                        else:
                            if predicted_target < current_best:
                                best_result = {
                                    'mv_values': mv_values,
                                    'cv_values': predicted_cvs,
                                    'target_value': predicted_target,
                                    'target_uncertainty': target_uncertainty,
                                    'is_feasible': True
                                }
                
                # Return objective for Optuna (always minimize)
                if request.maximize:
                    return -objective_value  # Negate for maximization
                else:
                    return objective_value
                
            except Exception as e:
                print(f"⚠️ Prediction failed in trial: {e}")
                return float('inf') if not request.maximize else float('-inf')
        
        # Create Optuna study
        direction = "maximize" if request.maximize else "minimize"
        study = optuna.create_study(
            direction=direction,
            sampler=optuna.samplers.TPESampler(seed=42)
        )
        
        # Run optimization
        study.optimize(objective, n_trials=request.n_trials, show_progress_bar=False)
        
        optimization_time = time.time() - start_time
        
        # Get best trial
        best_trial = study.best_trial
        
        print(f"✅ GPR optimization completed in {optimization_time:.2f}s")
        print(f"   Best trial: {best_trial.number}")
        print(f"   Best target: {best_result['target_value']:.4f}")
        if request.use_uncertainty:
            print(f"   Target uncertainty: {best_result['target_uncertainty']:.4f}")
        print(f"   Feasible: {best_result['is_feasible']}")
        
        return GPROptimizationResult(
            best_mv_values=best_result['mv_values'] or {},
            best_cv_values=best_result['cv_values'] or {},
            best_target_value=best_result['target_value'] or 999.0,
            best_target_uncertainty=best_result['target_uncertainty'],
            is_feasible=best_result['is_feasible'],
            n_trials=request.n_trials,
            best_trial_number=best_trial.number,
            optimization_time=optimization_time
        )
