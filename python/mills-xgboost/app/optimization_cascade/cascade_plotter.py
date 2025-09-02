"""
Cascade Plotter Module

Provides comprehensive plotting and visualization capabilities for cascade optimization results.
Includes model validation plots, optimization convergence, and result analysis.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple, Any, Optional
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import warnings
warnings.filterwarnings('ignore')

from .variable_classifier import VariableClassifier, VariableType

class CascadePlotter:
    """
    Comprehensive plotting system for cascade optimization analysis
    """
    
    def __init__(self, figsize: Tuple[int, int] = (12, 8)):
        self.classifier = VariableClassifier()
        self.figsize = figsize
        
        # Set plotting style
        plt.style.use('default')
        sns.set_palette("husl")
        
        # Color schemes
        self.colors = {
            'MV': '#FF6B6B',    # Red for Manipulated Variables
            'CV': '#4ECDC4',    # Teal for Controlled Variables  
            'DV': '#45B7D1',    # Blue for Disturbance Variables
            'TARGET': '#96CEB4', # Green for Targets
            'prediction': '#FFA07A',
            'actual': '#20B2AA',
            'residual': '#DDA0DD'
        }
    
    def plot_model_validation(self, validation_results: Dict[str, Any], save_path: Optional[str] = None):
        """
        Plot model validation results including individual models and cascade performance
        
        Args:
            validation_results: Results from CascadeValidator
            save_path: Optional path to save plots
        """
        
        # Create subplots for different validation aspects
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle('Cascade Model Validation Results', fontsize=16, fontweight='bold')
        
        # 1. Individual model performance
        if 'individual_models' in validation_results:
            models_data = validation_results['individual_models']
            
            cv_names = list(models_data.keys())
            r2_scores = [models_data[cv]['r2_score'] for cv in cv_names]
            rmse_scores = [models_data[cv]['rmse'] for cv in cv_names]
            
            # R² scores bar plot
            axes[0, 0].bar(cv_names, r2_scores, color=self.colors['CV'], alpha=0.7)
            axes[0, 0].set_title('Process Models R² Scores')
            axes[0, 0].set_ylabel('R² Score')
            axes[0, 0].tick_params(axis='x', rotation=45)
            axes[0, 0].grid(True, alpha=0.3)
            
            # RMSE scores bar plot
            axes[0, 1].bar(cv_names, rmse_scores, color=self.colors['MV'], alpha=0.7)
            axes[0, 1].set_title('Process Models RMSE')
            axes[0, 1].set_ylabel('RMSE')
            axes[0, 1].tick_params(axis='x', rotation=45)
            axes[0, 1].grid(True, alpha=0.3)
        
        # 2. Quality model performance
        if 'quality_model' in validation_results:
            quality_data = validation_results['quality_model']
            
            actual = quality_data['actual_values']
            predicted = quality_data['predicted_values']
            
            # Actual vs Predicted scatter plot
            axes[0, 2].scatter(actual, predicted, alpha=0.6, color=self.colors['TARGET'])
            min_val = min(min(actual), min(predicted))
            max_val = max(max(actual), max(predicted))
            axes[0, 2].plot([min_val, max_val], [min_val, max_val], 'r--', lw=2)
            axes[0, 2].set_xlabel('Actual PSI200')
            axes[0, 2].set_ylabel('Predicted PSI200')
            axes[0, 2].set_title(f'Quality Model: R² = {quality_data["r2_score"]:.3f}')
            axes[0, 2].grid(True, alpha=0.3)
        
        # 3. Complete cascade performance
        if 'complete_cascade' in validation_results:
            cascade_data = validation_results['complete_cascade']
            
            actual = cascade_data['actual_values']
            predicted = cascade_data['predicted_values']
            
            # Cascade actual vs predicted
            axes[1, 0].scatter(actual, predicted, alpha=0.6, color=self.colors['prediction'])
            min_val = min(min(actual), min(predicted))
            max_val = max(max(actual), max(predicted))
            axes[1, 0].plot([min_val, max_val], [min_val, max_val], 'r--', lw=2)
            axes[1, 0].set_xlabel('Actual PSI200')
            axes[1, 0].set_ylabel('Cascade Predicted PSI200')
            axes[1, 0].set_title(f'Complete Cascade: R² = {cascade_data["cascade_r2"]:.3f}')
            axes[1, 0].grid(True, alpha=0.3)
            
            # Residuals plot
            residuals = cascade_data['residuals']
            axes[1, 1].scatter(predicted, residuals, alpha=0.6, color=self.colors['residual'])
            axes[1, 1].axhline(y=0, color='r', linestyle='--')
            axes[1, 1].set_xlabel('Predicted PSI200')
            axes[1, 1].set_ylabel('Residuals')
            axes[1, 1].set_title('Cascade Residuals Plot')
            axes[1, 1].grid(True, alpha=0.3)
            
            # Feasibility rate
            feasibility_rate = cascade_data['feasibility_rate']
            axes[1, 2].pie([feasibility_rate, 100-feasibility_rate], 
                          labels=['Feasible', 'Infeasible'],
                          colors=[self.colors['TARGET'], self.colors['MV']],
                          autopct='%1.1f%%')
            axes[1, 2].set_title('Feasibility Rate')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(f"{save_path}/model_validation.png", dpi=300, bbox_inches='tight')
            print(f"Model validation plot saved to {save_path}/model_validation.png")
        
        plt.show()
    
    def plot_optimization_results(self, optimization_results: Dict[str, Any], save_path: Optional[str] = None):
        """
        Plot optimization results including convergence and parameter distributions
        
        Args:
            optimization_results: Results from CascadeOptimizationEngine
            save_path: Optional path to save plots
        """
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('Cascade Optimization Results', fontsize=16, fontweight='bold')
        
        if 'single_objective' in optimization_results:
            single_results = optimization_results['single_objective']
            
            # 1. Convergence plot
            if 'convergence_data' in single_results:
                conv_data = single_results['convergence_data']
                axes[0, 0].plot(conv_data['trial_numbers'], conv_data['best_values'], 
                               color=self.colors['TARGET'], linewidth=2)
                axes[0, 0].set_xlabel('Trial Number')
                axes[0, 0].set_ylabel('Best PSI200 Value')
                axes[0, 0].set_title('Optimization Convergence')
                axes[0, 0].grid(True, alpha=0.3)
            
            # 2. Best parameters bar plot
            best_params = single_results['best_mv_parameters']
            param_names = list(best_params.keys())
            param_values = list(best_params.values())
            
            bars = axes[0, 1].bar(param_names, param_values, color=self.colors['MV'], alpha=0.7)
            axes[0, 1].set_title('Optimal MV Parameters')
            axes[0, 1].set_ylabel('Parameter Values')
            axes[0, 1].tick_params(axis='x', rotation=45)
            axes[0, 1].grid(True, alpha=0.3)
            
            # Add value labels on bars
            for bar, value in zip(bars, param_values):
                axes[0, 1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(param_values)*0.01,
                               f'{value:.1f}', ha='center', va='bottom')
            
            # 3. Predicted CVs
            predicted_cvs = single_results['predicted_cvs']
            cv_names = list(predicted_cvs.keys())
            cv_values = list(predicted_cvs.values())
            
            bars = axes[1, 0].bar(cv_names, cv_values, color=self.colors['CV'], alpha=0.7)
            axes[1, 0].set_title('Predicted CV Values at Optimum')
            axes[1, 0].set_ylabel('CV Values')
            axes[1, 0].tick_params(axis='x', rotation=45)
            axes[1, 0].grid(True, alpha=0.3)
            
            # Add value labels
            for bar, value in zip(bars, cv_values):
                axes[1, 0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(cv_values)*0.01,
                               f'{value:.1f}', ha='center', va='bottom')
            
            # 4. Optimization summary
            axes[1, 1].axis('off')
            summary_text = f"""
Optimization Summary:
━━━━━━━━━━━━━━━━━━━━
Best PSI200: {single_results['best_target_value']:.2f}%
Feasible: {'Yes' if single_results['is_feasible'] else 'No'}
Trials: {single_results['n_trials']}
Time: {single_results.get('optimization_time', 'N/A')}

Constraint Violations:
{len(single_results.get('constraint_violations', []))} violations
            """
            axes[1, 1].text(0.1, 0.5, summary_text, fontsize=12, verticalalignment='center',
                           bbox=dict(boxstyle="round,pad=0.3", facecolor=self.colors['TARGET'], alpha=0.3))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(f"{save_path}/optimization_results.png", dpi=300, bbox_inches='tight')
            print(f"Optimization results plot saved to {save_path}/optimization_results.png")
        
        plt.show()
    
    def plot_feature_importance(self, model_results: Dict[str, Any], save_path: Optional[str] = None):
        """
        Plot feature importance for all models in the cascade
        
        Args:
            model_results: Training results from CascadeModelManager
            save_path: Optional path to save plots
        """
        
        # Count number of models to plot
        n_process_models = len(model_results.get('process_models', {}))
        n_plots = n_process_models + 1  # +1 for quality model
        
        # Calculate subplot layout
        n_cols = min(3, n_plots)
        n_rows = (n_plots + n_cols - 1) // n_cols
        
        fig, axes = plt.subplots(n_rows, n_cols, figsize=(5*n_cols, 4*n_rows))
        if n_plots == 1:
            axes = [axes]
        elif n_rows == 1:
            axes = [axes]
        else:
            axes = axes.flatten()
        
        fig.suptitle('Feature Importance Analysis', fontsize=16, fontweight='bold')
        
        plot_idx = 0
        
        # Plot process model feature importances
        if 'process_models' in model_results:
            for cv_id, model_data in model_results['process_models'].items():
                importance = model_data['feature_importance']
                
                features = list(importance.keys())
                importances = list(importance.values())
                
                # Sort by importance
                sorted_idx = np.argsort(importances)[::-1]
                features = [features[i] for i in sorted_idx]
                importances = [importances[i] for i in sorted_idx]
                
                axes[plot_idx].barh(features, importances, color=self.colors['MV'], alpha=0.7)
                axes[plot_idx].set_title(f'Process Model: MVs → {cv_id}')
                axes[plot_idx].set_xlabel('Feature Importance')
                axes[plot_idx].grid(True, alpha=0.3)
                
                plot_idx += 1
        
        # Plot quality model feature importance
        if 'quality_model' in model_results:
            quality_data = model_results['quality_model']
            importance = quality_data['feature_importance']
            
            features = list(importance.keys())
            importances = list(importance.values())
            
            # Sort by importance
            sorted_idx = np.argsort(importances)[::-1]
            features = [features[i] for i in sorted_idx]
            importances = [importances[i] for i in sorted_idx]
            
            # Color code by variable type
            colors = []
            for feature in features:
                if self.classifier.is_cv(feature):
                    colors.append(self.colors['CV'])
                elif self.classifier.is_dv(feature):
                    colors.append(self.colors['DV'])
                else:
                    colors.append(self.colors['TARGET'])
            
            axes[plot_idx].barh(features, importances, color=colors, alpha=0.7)
            axes[plot_idx].set_title('Quality Model: CVs + DVs → PSI200')
            axes[plot_idx].set_xlabel('Feature Importance')
            axes[plot_idx].grid(True, alpha=0.3)
            
            plot_idx += 1
        
        # Hide unused subplots
        for i in range(plot_idx, len(axes)):
            axes[i].set_visible(False)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(f"{save_path}/feature_importance.png", dpi=300, bbox_inches='tight')
            print(f"Feature importance plot saved to {save_path}/feature_importance.png")
        
        plt.show()
    
    def plot_pareto_front(self, multi_objective_results: Dict[str, Any], save_path: Optional[str] = None):
        """
        Plot Pareto front for multi-objective optimization results
        
        Args:
            multi_objective_results: Multi-objective optimization results
            save_path: Optional path to save plots
        """
        
        if 'pareto_trials' not in multi_objective_results:
            print("No Pareto trials data available for plotting")
            return
        
        pareto_trials = multi_objective_results['pareto_trials']
        
        qualities = [trial['quality'] for trial in pareto_trials]
        costs = [trial['cost'] for trial in pareto_trials]
        
        plt.figure(figsize=self.figsize)
        
        # Scatter plot of all solutions
        plt.scatter(qualities, costs, alpha=0.6, color=self.colors['TARGET'], s=50)
        
        # Highlight Pareto front
        # Simple Pareto front identification (could be improved)
        pareto_front = []
        for i, (q1, c1) in enumerate(zip(qualities, costs)):
            is_pareto = True
            for j, (q2, c2) in enumerate(zip(qualities, costs)):
                if i != j and q2 <= q1 and c2 <= c1 and (q2 < q1 or c2 < c1):
                    is_pareto = False
                    break
            if is_pareto:
                pareto_front.append((q1, c1, i))
        
        if pareto_front:
            pareto_qualities = [pf[0] for pf in pareto_front]
            pareto_costs = [pf[1] for pf in pareto_front]
            
            plt.scatter(pareto_qualities, pareto_costs, color=self.colors['MV'], 
                       s=100, marker='*', label='Pareto Front', edgecolors='black')
        
        plt.xlabel('Quality (PSI200 %)')
        plt.ylabel('Operational Cost ($)')
        plt.title('Multi-Objective Optimization: Quality vs Cost')
        plt.grid(True, alpha=0.3)
        plt.legend()
        
        if save_path:
            plt.savefig(f"{save_path}/pareto_front.png", dpi=300, bbox_inches='tight')
            print(f"Pareto front plot saved to {save_path}/pareto_front.png")
        
        plt.show()
    
    def plot_robust_analysis(self, robust_results: Dict[str, Any], save_path: Optional[str] = None):
        """
        Plot robust optimization analysis across scenarios
        
        Args:
            robust_results: Robust optimization results
            save_path: Optional path to save plots
        """
        
        if 'scenario_results' not in robust_results:
            print("No scenario results available for robust analysis plotting")
            return
        
        scenario_results = robust_results['scenario_results']
        
        scenario_ids = [sr['scenario_id'] for sr in scenario_results]
        target_values = [sr['predicted_target'] for sr in scenario_results]
        feasibility = [sr['is_feasible'] for sr in scenario_results]
        
        fig, axes = plt.subplots(1, 2, figsize=(15, 6))
        fig.suptitle('Robust Optimization Analysis', fontsize=16, fontweight='bold')
        
        # 1. Target values across scenarios
        colors = [self.colors['TARGET'] if feas else self.colors['MV'] for feas in feasibility]
        bars = axes[0].bar(scenario_ids, target_values, color=colors, alpha=0.7)
        axes[0].set_xlabel('Scenario ID')
        axes[0].set_ylabel('Predicted PSI200 (%)')
        axes[0].set_title('Target Values Across Scenarios')
        axes[0].grid(True, alpha=0.3)
        
        # Add feasibility indicators
        for bar, feas in zip(bars, feasibility):
            if not feas:
                axes[0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(target_values)*0.01,
                           'Infeasible', ha='center', va='bottom', color='red', fontweight='bold')
        
        # 2. Feasibility summary
        feasible_count = sum(feasibility)
        infeasible_count = len(feasibility) - feasible_count
        
        axes[1].pie([feasible_count, infeasible_count], 
                   labels=['Feasible', 'Infeasible'],
                   colors=[self.colors['TARGET'], self.colors['MV']],
                   autopct='%1.1f%%')
        axes[1].set_title('Feasibility Across Scenarios')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(f"{save_path}/robust_analysis.png", dpi=300, bbox_inches='tight')
            print(f"Robust analysis plot saved to {save_path}/robust_analysis.png")
        
        plt.show()
    
    def create_interactive_dashboard(self, all_results: Dict[str, Any]) -> go.Figure:
        """
        Create interactive Plotly dashboard with all results
        
        Args:
            all_results: Combined results from validation and optimization
            
        Returns:
            Plotly figure object
        """
        
        # Create subplots
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Model Performance', 'Optimization Convergence', 
                          'Parameter Values', 'Feature Importance'),
            specs=[[{"secondary_y": False}, {"secondary_y": False}],
                   [{"secondary_y": False}, {"secondary_y": False}]]
        )
        
        # Add traces based on available data
        if 'validation' in all_results and 'individual_models' in all_results['validation']:
            models_data = all_results['validation']['individual_models']
            cv_names = list(models_data.keys())
            r2_scores = [models_data[cv]['r2_score'] for cv in cv_names]
            
            fig.add_trace(
                go.Bar(x=cv_names, y=r2_scores, name='R² Scores', 
                      marker_color=self.colors['CV']),
                row=1, col=1
            )
        
        if 'optimization' in all_results and 'single_objective' in all_results['optimization']:
            opt_data = all_results['optimization']['single_objective']
            
            if 'convergence_data' in opt_data:
                conv_data = opt_data['convergence_data']
                fig.add_trace(
                    go.Scatter(x=conv_data['trial_numbers'], y=conv_data['best_values'],
                             mode='lines', name='Convergence', line_color=self.colors['TARGET']),
                    row=1, col=2
                )
            
            if 'best_mv_parameters' in opt_data:
                best_params = opt_data['best_mv_parameters']
                param_names = list(best_params.keys())
                param_values = list(best_params.values())
                
                fig.add_trace(
                    go.Bar(x=param_names, y=param_values, name='Optimal Parameters',
                          marker_color=self.colors['MV']),
                    row=2, col=1
                )
        
        # Update layout
        fig.update_layout(
            title_text="Cascade Optimization Interactive Dashboard",
            showlegend=True,
            height=800
        )
        
        return fig
    
    def save_all_plots(self, 
                      validation_results: Optional[Dict[str, Any]] = None,
                      optimization_results: Optional[Dict[str, Any]] = None,
                      model_results: Optional[Dict[str, Any]] = None,
                      save_path: str = "cascade_plots"):
        """
        Save all available plots to specified directory
        
        Args:
            validation_results: Validation results
            optimization_results: Optimization results  
            model_results: Model training results
            save_path: Directory to save plots
        """
        
        import os
        os.makedirs(save_path, exist_ok=True)
        
        print(f"Saving all plots to {save_path}/")
        
        if validation_results:
            self.plot_model_validation(validation_results, save_path)
        
        if optimization_results:
            self.plot_optimization_results(optimization_results, save_path)
            
            if 'multi_objective' in optimization_results:
                self.plot_pareto_front(optimization_results['multi_objective'], save_path)
            
            if 'robust' in optimization_results:
                self.plot_robust_analysis(optimization_results['robust'], save_path)
        
        if model_results:
            self.plot_feature_importance(model_results, save_path)
        
        print(f"All plots saved to {save_path}/")
    
    def print_plotting_summary(self):
        """Print summary of available plotting functions"""
        print("=== CASCADE PLOTTER FUNCTIONS ===")
        print("1. plot_model_validation() - Model performance and validation plots")
        print("2. plot_optimization_results() - Optimization convergence and results")
        print("3. plot_feature_importance() - Feature importance for all models")
        print("4. plot_pareto_front() - Multi-objective Pareto front")
        print("5. plot_robust_analysis() - Robust optimization across scenarios")
        print("6. create_interactive_dashboard() - Interactive Plotly dashboard")
        print("7. save_all_plots() - Save all plots to directory")
        print("=" * 50)
