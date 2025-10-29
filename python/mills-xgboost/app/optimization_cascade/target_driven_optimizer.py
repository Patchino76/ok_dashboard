"""
Target-Driven Cascade Optimizer with Distribution Analysis

Enhanced optimization that seeks specific target values and returns parameter distributions
for uncertainty quantification and visualization.
"""

import numpy as np
import optuna
from typing import Dict, List, Any, Tuple, Optional
import logging
from dataclasses import dataclass
import pandas as pd
from scipy import stats

from .cascade_models import CascadeModelManager

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class ParameterDistribution:
    """Statistical distribution of a parameter from successful trials"""
    mean: float
    std: float
    median: float
    percentiles: Dict[str, float]  # {5: val, 25: val, 50: val, 75: val, 95: val}
    min_value: float
    max_value: float
    sample_count: int

@dataclass
class TargetOptimizationRequest:
    """Request for target-driven optimization"""
    # Required fields (no defaults)
    target_value: float
    mv_bounds: Dict[str, Tuple[float, float]]  # {"Ore": (140, 240), ...}
    cv_bounds: Dict[str, Tuple[float, float]]  # {"PulpHC": (400, 600), ...}
    dv_values: Dict[str, float]  # Fixed DV values {"Shisti": 10.0, ...}
    
    # Optional fields (with defaults)
    target_variable: str = "PSI200"
    tolerance: float = 0.01  # ±1% default tolerance
    n_trials: int = 500  # Default 500 trials
    confidence_level: float = 0.90  # 90% confidence intervals
    timeout: Optional[int] = None

@dataclass 
class TargetOptimizationResult:
    """Result of target-driven optimization with distributions"""
    # Target achievement
    target_achieved: bool
    best_distance: float
    worst_distance: float
    target_value: float
    tolerance: float
    
    # Best solution
    best_mv_values: Dict[str, float]
    best_cv_values: Dict[str, float]
    best_target_value: float
    
    # Parameter distributions from successful trials
    mv_distributions: Dict[str, ParameterDistribution]
    cv_distributions: Dict[str, ParameterDistribution]
    
    # Trial statistics
    successful_trials: int
    total_trials: int
    success_rate: float
    
    # Optimization metadata
    confidence_level: float
    optimization_time: float

class TargetDrivenCascadeOptimizer:
    """
    Enhanced cascade optimizer that seeks specific target values and provides
    parameter distributions for uncertainty quantification
    """
    
    def __init__(self, model_manager: CascadeModelManager):
        """Initialize with trained cascade model manager"""
        self.model_manager = model_manager
        
        # Verify models are loaded
        if not model_manager.process_models or not model_manager.quality_model:
            raise ValueError("Cascade models not trained/loaded. Call train_all_models() or load_models() first.")
    
    def optimize_for_target(self, request: TargetOptimizationRequest) -> TargetOptimizationResult:
        """
        Run target-driven optimization to find parameter distributions
        
        Args:
            request: Target optimization request with target value and bounds
            
        Returns:
            TargetOptimizationResult with distributions and best solution
        """
        import time
        start_time = time.time()
        
        logger.info(f"Starting target-driven optimization for {request.target_variable}")
        logger.info(f"Target value: {request.target_value} ± {request.tolerance*100:.1f}%")
        logger.info(f"Trials: {request.n_trials}")
        
        # Create Optuna study (minimize distance from target)
        study = optuna.create_study(direction='minimize')
        
        # Create objective function
        def objective(trial):
            return self._target_seeking_objective(trial, request)
        
        # Run optimization
        study.optimize(objective, n_trials=request.n_trials, timeout=request.timeout)
        
        # Calculate tolerance threshold (absolute distance from target)
        tolerance_threshold = request.target_value * request.tolerance
        
        # Debug: Log tolerance calculation
        logger.info(f"Target: {request.target_value}, Tolerance: {request.tolerance*100:.1f}%, Threshold: {tolerance_threshold:.4f}")
        
        # Extract successful trials (within tolerance)
        # trial.value represents the distance from target, so it should be <= tolerance_threshold
        successful_trials = [
            trial for trial in study.trials 
            if trial.value is not None and trial.value <= tolerance_threshold
        ]
        
        # Debug: Log trial distances
        if study.trials:
            trial_distances = [t.value for t in study.trials if t.value is not None]
            logger.info(f"Best distance: {min(trial_distances):.4f}, Worst: {max(trial_distances):.4f}")
            logger.info(f"Trials within tolerance ({tolerance_threshold:.4f}): {len(successful_trials)}")
        
        logger.info(f"Successful trials: {len(successful_trials)}/{len(study.trials)}")
        
        # Fallback: If no trials meet strict tolerance, use best 10% of trials for distributions
        if len(successful_trials) == 0 and len(study.trials) > 0:
            logger.info("No trials within strict tolerance, using best 10% of trials for distributions")
            sorted_trials = sorted([t for t in study.trials if t.value is not None], key=lambda t: t.value)
            top_10_percent = max(1, len(sorted_trials) // 10)
            successful_trials = sorted_trials[:top_10_percent]
            logger.info(f"Using top {len(successful_trials)} trials for distributions")
        
        # Get best trial
        best_trial = study.best_trial
        best_mv_values = {k.replace('mv_', ''): v for k, v in best_trial.params.items()}
        
        # Get prediction for best values
        prediction = self.model_manager.predict_cascade(best_mv_values, request.dv_values)
        
        # Extract parameter distributions
        mv_distributions = self._extract_mv_distributions(
            successful_trials, request.confidence_level
        )
        cv_distributions = self._extract_cv_distributions(
            successful_trials, request, request.confidence_level
        )
        
        # Calculate optimization time
        optimization_time = time.time() - start_time
        
        # Calculate worst distance from all trials
        worst_distance = max(
            (trial.value for trial in study.trials if trial.value is not None),
            default=float('inf')
        )
        
        # Create result
        result = TargetOptimizationResult(
            target_achieved=len(successful_trials) > 0,
            best_distance=best_trial.value if best_trial.value is not None else float('inf'),
            worst_distance=worst_distance,
            target_value=request.target_value,
            tolerance=request.tolerance,
            best_mv_values=best_mv_values,
            best_cv_values=prediction['predicted_cvs'],
            best_target_value=prediction['predicted_target'],
            mv_distributions=mv_distributions,
            cv_distributions=cv_distributions,
            successful_trials=len(successful_trials),
            total_trials=len(study.trials),
            success_rate=len(successful_trials) / len(study.trials) if study.trials else 0.0,
            confidence_level=request.confidence_level,
            optimization_time=optimization_time
        )
        
        logger.info(f"Target optimization completed in {optimization_time:.2f}s")
        logger.info(f"Success rate: {result.success_rate:.1%}")
        logger.info(f"Best target: {result.best_target_value:.2f} (distance: {result.best_distance:.4f})")
        logger.info(f"Best distance: {result.best_distance:.4f}, Worst: {result.worst_distance:.4f}")
        
        return result
    
    def _target_seeking_objective(self, trial: optuna.trial.Trial, 
                                 request: TargetOptimizationRequest) -> float:
        """
        Objective function that seeks a specific target value
        
        Args:
            trial: Optuna trial object
            request: Target optimization request
            
        Returns:
            Distance from target + constraint penalties
        """
        try:
            # Sample MV values within bounds
            mv_values = {}
            for mv_name, (min_val, max_val) in request.mv_bounds.items():
                mv_values[mv_name] = trial.suggest_float(f"mv_{mv_name}", min_val, max_val)
            
            # Predict cascade: MVs → CVs → Target
            prediction = self.model_manager.predict_cascade(mv_values, request.dv_values)
            
            # Get predicted target value
            predicted_target = prediction['predicted_target']
            
            # Calculate distance from desired target
            target_distance = abs(predicted_target - request.target_value)
            
            # Calculate constraint penalty for CV bounds
            constraint_penalty = self._calculate_penalty(
                prediction['predicted_cvs'], request.cv_bounds
            )
            
            # Return total objective (distance + penalties)
            return target_distance + constraint_penalty
                
        except Exception as e:
            logger.error(f"Error in trial evaluation: {e}")
            # Return large penalty for failed trials
            return 1e6
    
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
                
                # Quadratic penalty for violations
                if cv_value < min_val:
                    penalty += penalty_factor * (min_val - cv_value) ** 2
                elif cv_value > max_val:
                    penalty += penalty_factor * (cv_value - max_val) ** 2
        
        return penalty
    
    def _extract_mv_distributions(self, successful_trials: List[optuna.trial.FrozenTrial], 
                                 confidence_level: float) -> Dict[str, ParameterDistribution]:
        """
        Extract MV parameter distributions from successful trials
        
        Args:
            successful_trials: List of trials within tolerance
            confidence_level: Confidence level for percentiles (e.g., 0.90)
            
        Returns:
            Dictionary of MV distributions
        """
        mv_distributions = {}
        
        if not successful_trials:
            return mv_distributions
        
        # Get all MV parameter names
        mv_params = set()
        for trial in successful_trials:
            mv_params.update([k for k in trial.params.keys() if k.startswith('mv_')])
        
        # Calculate distributions for each MV
        for mv_param in mv_params:
            mv_name = mv_param.replace('mv_', '')
            values = [trial.params[mv_param] for trial in successful_trials if mv_param in trial.params]
            
            if values:
                mv_distributions[mv_name] = self._calculate_distribution_stats(
                    values, confidence_level
                )
        
        return mv_distributions
    
    def _extract_cv_distributions(self, successful_trials: List[optuna.trial.FrozenTrial],
                                 request: TargetOptimizationRequest,
                                 confidence_level: float) -> Dict[str, ParameterDistribution]:
        """
        Extract CV parameter distributions by predicting CVs for successful MV combinations
        
        Args:
            successful_trials: List of trials within tolerance
            request: Original optimization request
            confidence_level: Confidence level for percentiles
            
        Returns:
            Dictionary of CV distributions
        """
        cv_distributions = {}
        
        if not successful_trials:
            return cv_distributions
        
        # Predict CVs for all successful MV combinations
        cv_predictions = {}
        
        for trial in successful_trials:
            # Extract MV values from trial
            mv_values = {k.replace('mv_', ''): v for k, v in trial.params.items() if k.startswith('mv_')}
            
            try:
                # Predict CVs using cascade model
                prediction = self.model_manager.predict_cascade(mv_values, request.dv_values)
                predicted_cvs = prediction['predicted_cvs']
                
                # Collect CV predictions
                for cv_name, cv_value in predicted_cvs.items():
                    if cv_name not in cv_predictions:
                        cv_predictions[cv_name] = []
                    cv_predictions[cv_name].append(cv_value)
                    
            except Exception as e:
                logger.warning(f"Failed to predict CVs for trial {trial.number}: {e}")
                continue
        
        # Calculate distributions for each CV
        for cv_name, values in cv_predictions.items():
            if values:
                cv_distributions[cv_name] = self._calculate_distribution_stats(
                    values, confidence_level
                )
        
        return cv_distributions
    
    def _calculate_distribution_stats(self, values: List[float], 
                                    confidence_level: float) -> ParameterDistribution:
        """
        Calculate statistical distribution from parameter values
        
        Args:
            values: List of parameter values
            confidence_level: Confidence level for percentiles
            
        Returns:
            ParameterDistribution with statistics
        """
        values_array = np.array(values)
        
        # Calculate percentiles for confidence intervals
        alpha = 1 - confidence_level
        lower_percentile = (alpha / 2) * 100
        upper_percentile = (1 - alpha / 2) * 100
        
        percentiles = {
            5: float(np.percentile(values_array, 5)),
            25: float(np.percentile(values_array, 25)),
            50: float(np.percentile(values_array, 50)),  # median
            75: float(np.percentile(values_array, 75)),
            95: float(np.percentile(values_array, 95)),
            f"{lower_percentile:.1f}": float(np.percentile(values_array, lower_percentile)),
            f"{upper_percentile:.1f}": float(np.percentile(values_array, upper_percentile))
        }
        
        return ParameterDistribution(
            mean=float(np.mean(values_array)),
            std=float(np.std(values_array)),
            median=float(np.median(values_array)),
            percentiles=percentiles,
            min_value=float(np.min(values_array)),
            max_value=float(np.max(values_array)),
            sample_count=len(values)
        )

# Convenience functions for easy usage
def optimize_for_target(model_manager: CascadeModelManager,
                       target_value: float,
                       mv_bounds: Dict[str, Tuple[float, float]],
                       cv_bounds: Dict[str, Tuple[float, float]], 
                       dv_values: Dict[str, float],
                       target_variable: str = "PSI200",
                       tolerance: float = 0.01,
                       n_trials: int = 500,
                       confidence_level: float = 0.90) -> TargetOptimizationResult:
    """
    Convenience function for target-driven cascade optimization
    
    Args:
        model_manager: Trained cascade model manager
        target_value: Desired target value to achieve
        mv_bounds: MV bounds {"Ore": (140, 240), ...}
        cv_bounds: CV bounds {"PulpHC": (400, 600), ...}
        dv_values: Fixed DV values {"Shisti": 10.0, ...}
        target_variable: Target to optimize (default: "PSI200")
        tolerance: Tolerance as fraction (default: 0.01 = ±1%)
        n_trials: Number of optimization trials (default: 500)
        confidence_level: Confidence level for distributions (default: 0.90)
        
    Returns:
        TargetOptimizationResult with distributions and best solution
    """
    request = TargetOptimizationRequest(
        target_value=target_value,
        target_variable=target_variable,
        tolerance=tolerance,
        mv_bounds=mv_bounds,
        cv_bounds=cv_bounds,
        dv_values=dv_values,
        n_trials=n_trials,
        confidence_level=confidence_level
    )
    
    optimizer = TargetDrivenCascadeOptimizer(model_manager)
    return optimizer.optimize_for_target(request)

def get_parameter_bounds_from_distributions(distributions: Dict[str, ParameterDistribution],
                                          confidence_level: float = 0.90) -> Dict[str, Tuple[float, float]]:
    """
    Extract parameter bounds from distributions for visualization
    
    Args:
        distributions: Parameter distributions
        confidence_level: Confidence level for bounds
        
    Returns:
        Dictionary of parameter bounds for shading
    """
    bounds = {}
    
    alpha = 1 - confidence_level
    lower_key = f"{(alpha / 2) * 100:.1f}"
    upper_key = f"{(1 - alpha / 2) * 100:.1f}"
    
    for param_name, dist in distributions.items():
        if lower_key in dist.percentiles and upper_key in dist.percentiles:
            bounds[param_name] = (
                dist.percentiles[lower_key],
                dist.percentiles[upper_key]
            )
    
    return bounds
