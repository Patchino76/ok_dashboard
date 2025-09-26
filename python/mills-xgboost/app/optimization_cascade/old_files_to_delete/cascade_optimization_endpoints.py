"""
Enhanced Cascade Optimization Endpoints with Optuna

Provides comprehensive optimization endpoints for the cascade system with
multi-objective optimization, constraint handling, and uncertainty quantification.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Union, Any
import pandas as pd
import os
import json
import asyncio
from datetime import datetime
import logging

from .cascade_models import CascadeModelManager
from .cascade_optimizer import CascadeOptimizer, OptimizationConfig, OptimizationMode
from .variable_classifier import VariableClassifier

# Import database and settings
from ..database.db_connector import MillsDataConnector
from ...config.settings import settings

# Configure logging
logger = logging.getLogger(__name__)

# Create router
cascade_optimization_router = APIRouter(prefix="/api/v1/cascade", tags=["cascade_optimization"])

# Global instances
classifier = VariableClassifier()
model_manager: Optional[CascadeModelManager] = None
optimizer: Optional[CascadeOptimizer] = None

# Optimization job storage (in production, use proper job queue)
optimization_jobs = {}

# Request/Response Models
class OptimizationRequest(BaseModel):
    """Request model for cascade optimization"""
    dv_values: Dict[str, float] = Field(..., description="Disturbance variable values")
    optimization_mode: str = Field("multi_objective", description="Optimization mode: single_objective, multi_objective, robust, pareto")
    n_trials: int = Field(200, description="Number of optimization trials")
    timeout: Optional[int] = Field(None, description="Timeout in seconds")
    
    # Objective weights
    target_weight: float = Field(1.0, description="Weight for target objective")
    constraint_weight: float = Field(0.5, description="Weight for constraint penalty")
    efficiency_weight: float = Field(0.3, description="Weight for efficiency penalty")
    
    # Constraint handling
    soft_constraints: bool = Field(True, description="Use soft constraints with tolerance")
    constraint_tolerance: float = Field(0.05, description="Constraint tolerance (5%)")
    penalty_factor: float = Field(1000.0, description="Penalty factor for constraint violations")
    
    # Advanced features
    robust_optimization: bool = Field(False, description="Enable robust optimization with uncertainty")
    uncertainty_samples: int = Field(50, description="Number of uncertainty samples")
    confidence_level: float = Field(0.95, description="Confidence level for uncertainty")
    adaptive_bounds: bool = Field(True, description="Enable adaptive parameter bounds")
    
    # Target bounds
    target_min: Optional[float] = Field(15, description="Minimum target value")
    target_max: Optional[float] = Field(35, description="Maximum target value")

class OptimizationResponse(BaseModel):
    """Response model for optimization results"""
    job_id: str = Field(..., description="Optimization job ID")
    status: str = Field(..., description="Optimization status")
    message: str = Field(..., description="Status message")
    optimization_mode: str = Field(..., description="Optimization mode used")
    n_trials: int = Field(..., description="Number of trials requested")

class OptimizationResults(BaseModel):
    """Detailed optimization results"""
    job_id: str
    status: str
    optimization_mode: str
    n_trials: int
    
    # Single objective results
    best_value: Optional[float] = None
    best_parameters: Optional[Dict[str, float]] = None
    best_prediction: Optional[Dict[str, Any]] = None
    
    # Multi-objective results
    pareto_solutions: Optional[List[Dict[str, Any]]] = None
    
    # Analysis
    convergence_analysis: Optional[Dict[str, Any]] = None
    parameter_importance: Optional[Dict[str, float]] = None
    optimization_summary: Optional[Dict[str, Any]] = None
    evaluation_history: Optional[List[Dict[str, Any]]] = None
    
    # Metadata
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_seconds: Optional[float] = None

class ParameterRecommendation(BaseModel):
    """Parameter recommendation with confidence metrics"""
    parameter_id: str
    recommended_value: float
    current_value: Optional[float] = None
    improvement_potential: float
    confidence: float
    bounds: tuple[float, float]

# API Endpoints

@cascade_optimization_router.get("/optimization/info")
async def get_optimization_info():
    """Get information about the cascade optimization system"""
    return {
        "system": "Enhanced Cascade Optimization with Optuna",
        "version": "2.0.0",
        "description": "Multi-objective cascade optimization with constraint handling and uncertainty quantification",
        "model_status": {
            "models_trained": bool(model_manager and model_manager.process_models and model_manager.quality_model),
            "optimizer_ready": bool(optimizer)
        },
        "optimization_modes": [mode.value for mode in OptimizationMode],
        "features": {
            "multi_objective": True,
            "constraint_handling": True,
            "uncertainty_quantification": True,
            "robust_optimization": True,
            "pareto_optimization": True,
            "adaptive_bounds": True
        },
        "endpoints": {
            "optimize": "/optimize",
            "status": "/optimization/status/{job_id}",
            "results": "/optimization/results/{job_id}",
            "recommendations": "/recommendations"
        }
    }

@cascade_optimization_router.post("/optimize", response_model=OptimizationResponse)
async def optimize_cascade(request: OptimizationRequest, background_tasks: BackgroundTasks):
    """
    Start cascade optimization with advanced Optuna-based optimization
    """
    global model_manager, optimizer
    
    # Check if models are trained
    if not model_manager or not model_manager.process_models or not model_manager.quality_model:
        raise HTTPException(
            status_code=400, 
            detail="Models not trained. Please train cascade models first using /train endpoint."
        )
    
    # Initialize optimizer if needed
    if not optimizer:
        optimizer = CascadeOptimizer(model_manager)
    
    try:
        # Validate optimization mode
        try:
            opt_mode = OptimizationMode(request.optimization_mode)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid optimization mode. Available modes: {[mode.value for mode in OptimizationMode]}"
            )
        
        # Create optimization configuration
        config = OptimizationConfig(
            mode=opt_mode,
            n_trials=request.n_trials,
            timeout=request.timeout,
            target_weight=request.target_weight,
            constraint_weight=request.constraint_weight,
            efficiency_weight=request.efficiency_weight,
            soft_constraints=request.soft_constraints,
            constraint_tolerance=request.constraint_tolerance,
            penalty_factor=request.penalty_factor,
            uncertainty_samples=request.uncertainty_samples,
            confidence_level=request.confidence_level,
            robust_optimization=request.robust_optimization,
            adaptive_bounds=request.adaptive_bounds
        )
        
        # Generate job ID
        job_id = f"cascade_opt_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(optimization_jobs)}"
        
        # Initialize job status
        optimization_jobs[job_id] = {
            "status": "starting",
            "start_time": datetime.now().isoformat(),
            "config": config,
            "request": request,
            "results": None,
            "error": None
        }
        
        # Start optimization in background
        background_tasks.add_task(
            _run_optimization_background,
            job_id,
            request.dv_values,
            config,
            (request.target_min, request.target_max) if request.target_min and request.target_max else None
        )
        
        return OptimizationResponse(
            job_id=job_id,
            status="started",
            message=f"Cascade optimization started with {request.n_trials} trials",
            optimization_mode=request.optimization_mode,
            n_trials=request.n_trials
        )
        
    except Exception as e:
        logger.error(f"Error starting optimization: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start optimization: {str(e)}")

@cascade_optimization_router.get("/optimization/status/{job_id}")
async def get_optimization_status(job_id: str):
    """Get the status of an optimization job"""
    if job_id not in optimization_jobs:
        raise HTTPException(status_code=404, detail="Optimization job not found")
    
    job = optimization_jobs[job_id]
    
    status_info = {
        "job_id": job_id,
        "status": job["status"],
        "start_time": job["start_time"],
        "optimization_mode": job["config"].mode.value,
        "n_trials": job["config"].n_trials
    }
    
    if job["status"] == "completed":
        status_info["end_time"] = job.get("end_time")
        status_info["duration_seconds"] = job.get("duration_seconds")
        status_info["message"] = "Optimization completed successfully"
    elif job["status"] == "failed":
        status_info["error"] = job.get("error")
        status_info["message"] = f"Optimization failed: {job.get('error', 'Unknown error')}"
    elif job["status"] == "running":
        status_info["message"] = "Optimization in progress"
    else:
        status_info["message"] = "Optimization starting"
    
    return status_info

@cascade_optimization_router.get("/optimization/results/{job_id}", response_model=OptimizationResults)
async def get_optimization_results(job_id: str):
    """Get detailed results of a completed optimization job"""
    if job_id not in optimization_jobs:
        raise HTTPException(status_code=404, detail="Optimization job not found")
    
    job = optimization_jobs[job_id]
    
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Optimization not completed. Current status: {job['status']}"
        )
    
    results = job["results"]
    
    return OptimizationResults(
        job_id=job_id,
        status=job["status"],
        optimization_mode=results["optimization_mode"],
        n_trials=results["n_trials"],
        best_value=results.get("best_value"),
        best_parameters=results.get("best_parameters"),
        best_prediction=results.get("best_prediction"),
        pareto_solutions=results.get("pareto_front"),
        convergence_analysis=results.get("convergence_analysis"),
        parameter_importance=results.get("parameter_importance"),
        optimization_summary=results.get("optimization_summary"),
        evaluation_history=results.get("evaluation_history"),
        start_time=job["start_time"],
        end_time=job.get("end_time"),
        duration_seconds=job.get("duration_seconds")
    )

@cascade_optimization_router.get("/recommendations")
async def get_parameter_recommendations(
    current_mv_values: Dict[str, float],
    dv_values: Dict[str, float],
    target_improvement: float = 5.0
) -> List[ParameterRecommendation]:
    """
    Get parameter recommendations based on current operating conditions
    """
    if not model_manager or not optimizer:
        raise HTTPException(status_code=400, detail="Models not trained or optimizer not initialized")
    
    try:
        # Run quick optimization for recommendations
        config = OptimizationConfig(
            mode=OptimizationMode.SINGLE_OBJECTIVE,
            n_trials=50,  # Quick optimization
            timeout=30    # 30 second timeout
        )
        
        results = optimizer.optimize(dv_values, config)
        
        if "best_parameters" not in results:
            raise HTTPException(status_code=500, detail="Failed to generate recommendations")
        
        best_params = results["best_parameters"]
        param_importance = results.get("parameter_importance", {})
        
        recommendations = []
        
        for param_id, recommended_value in best_params.items():
            current_value = current_mv_values.get(param_id)
            importance = param_importance.get(param_id, 0.0)
            
            # Calculate improvement potential
            if current_value is not None:
                improvement = abs(recommended_value - current_value) / current_value * 100
            else:
                improvement = 0.0
            
            # Get bounds
            bounds = classifier.get_mv_bounds().get(param_id, (0.0, 100.0))
            
            recommendations.append(ParameterRecommendation(
                parameter_id=param_id,
                recommended_value=recommended_value,
                current_value=current_value,
                improvement_potential=improvement,
                confidence=min(importance * 100, 100.0),  # Convert to percentage
                bounds=bounds
            ))
        
        # Sort by improvement potential
        recommendations.sort(key=lambda x: x.improvement_potential, reverse=True)
        
        return recommendations
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {str(e)}")

@cascade_optimization_router.delete("/optimization/{job_id}")
async def cancel_optimization(job_id: str):
    """Cancel a running optimization job"""
    if job_id not in optimization_jobs:
        raise HTTPException(status_code=404, detail="Optimization job not found")
    
    job = optimization_jobs[job_id]
    
    if job["status"] in ["completed", "failed"]:
        return {"message": f"Job {job_id} already {job['status']}"}
    
    # Mark as cancelled (in a real implementation, you'd need proper job cancellation)
    job["status"] = "cancelled"
    job["end_time"] = datetime.now().isoformat()
    
    return {"message": f"Optimization job {job_id} cancelled"}

@cascade_optimization_router.get("/optimization/jobs")
async def list_optimization_jobs():
    """List all optimization jobs with their status"""
    jobs_summary = []
    
    for job_id, job in optimization_jobs.items():
        summary = {
            "job_id": job_id,
            "status": job["status"],
            "start_time": job["start_time"],
            "optimization_mode": job["config"].mode.value,
            "n_trials": job["config"].n_trials
        }
        
        if job["status"] in ["completed", "failed", "cancelled"]:
            summary["end_time"] = job.get("end_time")
            summary["duration_seconds"] = job.get("duration_seconds")
        
        jobs_summary.append(summary)
    
    # Sort by start time (newest first)
    jobs_summary.sort(key=lambda x: x["start_time"], reverse=True)
    
    return {"jobs": jobs_summary, "total_jobs": len(jobs_summary)}

# Background task functions
async def _run_optimization_background(
    job_id: str,
    dv_values: Dict[str, float],
    config: OptimizationConfig,
    target_bounds: Optional[tuple[float, float]]
):
    """Run optimization in background task"""
    global optimizer
    
    try:
        # Update job status
        optimization_jobs[job_id]["status"] = "running"
        
        # Run optimization
        results = optimizer.optimize(dv_values, config, target_bounds)
        
        # Update job with results
        end_time = datetime.now()
        start_time = datetime.fromisoformat(optimization_jobs[job_id]["start_time"])
        duration = (end_time - start_time).total_seconds()
        
        optimization_jobs[job_id].update({
            "status": "completed",
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "results": results
        })
        
        logger.info(f"Optimization job {job_id} completed successfully")
        
    except Exception as e:
        # Update job with error
        optimization_jobs[job_id].update({
            "status": "failed",
            "end_time": datetime.now().isoformat(),
            "error": str(e)
        })
        
        logger.error(f"Optimization job {job_id} failed: {e}")

# Health check
@cascade_optimization_router.get("/optimization/health")
async def optimization_health_check():
    """Health check for optimization system"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "classifier": "ready",
            "model_manager": "ready" if model_manager else "not_initialized",
            "optimizer": "ready" if optimizer else "not_initialized",
            "active_jobs": len([job for job in optimization_jobs.values() if job["status"] == "running"])
        },
        "optimization_modes": [mode.value for mode in OptimizationMode],
        "total_jobs": len(optimization_jobs)
    }
