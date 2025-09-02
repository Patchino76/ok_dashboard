"""
Cascade Validation Module

Provides comprehensive validation and testing capabilities for the cascade optimization system.
Includes model validation, chain testing, and performance analysis.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple, Any, Optional
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')

from .cascade_models import CascadeModelManager
from .variable_classifier import VariableClassifier, VariableType

class CascadeValidator:
    """
    Comprehensive validation system for cascade optimization models
    """
    
    def __init__(self, model_manager: CascadeModelManager):
        self.model_manager = model_manager
        self.classifier = VariableClassifier()
        self.validation_results = {}
        
    def validate_individual_models(self, df: pd.DataFrame, test_size: float = 0.3) -> Dict[str, Any]:
        """
        Validate individual process models (MV → CV) performance
        
        Args:
            df: Validation dataset
            test_size: Fraction of data to use for testing
            
        Returns:
            Validation results for each process model
        """
        print("=== VALIDATING INDIVIDUAL PROCESS MODELS ===")
        
        if not self.model_manager.process_models:
            raise ValueError("Process models not trained. Train models first.")
        
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        cvs = [cv.id for cv in self.classifier.get_cvs()]
        
        results = {}
        
        for cv_id in cvs:
            if cv_id not in self.model_manager.process_models:
                continue
                
            print(f"\nValidating model: MVs → {cv_id}")
            
            # Prepare data
            X = df[mvs]
            y = df[cv_id]
            
            # Use last portion of data for validation
            split_idx = int(len(df) * (1 - test_size))
            X_val = X.iloc[split_idx:]
            y_val = y.iloc[split_idx:]
            
            # Scale features
            scaler = self.model_manager.scalers[f"mv_to_{cv_id}"]
            X_val_scaled = scaler.transform(X_val)
            
            # Predict
            model = self.model_manager.process_models[cv_id]
            y_pred = model.predict(X_val_scaled)
            
            # Calculate metrics
            r2 = r2_score(y_val, y_pred)
            rmse = np.sqrt(mean_squared_error(y_val, y_pred))
            mae = mean_absolute_error(y_val, y_pred)
            
            # Calculate percentage errors
            mape = np.mean(np.abs((y_val - y_pred) / y_val)) * 100
            
            results[cv_id] = {
                'r2_score': r2,
                'rmse': rmse,
                'mae': mae,
                'mape': mape,
                'n_samples': len(y_val),
                'actual_values': y_val.tolist(),
                'predicted_values': y_pred.tolist(),
                'residuals': (y_val - y_pred).tolist()
            }
            
            print(f"  R² Score: {r2:.4f}")
            print(f"  RMSE: {rmse:.4f}")
            print(f"  MAE: {mae:.4f}")
            print(f"  MAPE: {mape:.2f}%")
        
        self.validation_results['individual_models'] = results
        return results
    
    def validate_quality_model(self, df: pd.DataFrame, test_size: float = 0.3) -> Dict[str, Any]:
        """
        Validate quality model (CV + DV → Target) performance
        
        Args:
            df: Validation dataset
            test_size: Fraction of data to use for testing
            
        Returns:
            Quality model validation results
        """
        print("\n=== VALIDATING QUALITY MODEL ===")
        
        if not self.model_manager.quality_model:
            raise ValueError("Quality model not trained. Train models first.")
        
        cvs = [cv.id for cv in self.classifier.get_cvs()]
        dvs = [dv.id for dv in self.classifier.get_dvs()]
        target = 'PSI200'  # Primary target
        
        # Prepare data
        feature_cols = cvs + dvs
        X = df[feature_cols]
        y = df[target]
        
        # Use last portion for validation
        split_idx = int(len(df) * (1 - test_size))
        X_val = X.iloc[split_idx:]
        y_val = y.iloc[split_idx:]
        
        # Scale features
        scaler = self.model_manager.scalers['quality_model']
        X_val_scaled = scaler.transform(X_val)
        
        # Predict
        y_pred = self.model_manager.quality_model.predict(X_val_scaled)
        
        # Calculate metrics
        r2 = r2_score(y_val, y_pred)
        rmse = np.sqrt(mean_squared_error(y_val, y_pred))
        mae = mean_absolute_error(y_val, y_pred)
        mape = np.mean(np.abs((y_val - y_pred) / y_val)) * 100
        
        # Feature importance analysis
        feature_importance = dict(zip(feature_cols, self.model_manager.quality_model.feature_importances_))
        
        results = {
            'r2_score': r2,
            'rmse': rmse,
            'mae': mae,
            'mape': mape,
            'n_samples': len(y_val),
            'actual_values': y_val.tolist(),
            'predicted_values': y_pred.tolist(),
            'residuals': (y_val - y_pred).tolist(),
            'feature_importance': feature_importance,
            'input_features': feature_cols
        }
        
        print(f"Quality Model Performance:")
        print(f"  R² Score: {r2:.4f}")
        print(f"  RMSE: {rmse:.4f}")
        print(f"  MAE: {mae:.4f}")
        print(f"  MAPE: {mape:.2f}%")
        
        self.validation_results['quality_model'] = results
        return results
    
    def validate_complete_cascade(self, df: pd.DataFrame, n_samples: int = 500) -> Dict[str, Any]:
        """
        Validate complete cascade chain: MV → CV → Target
        
        Args:
            df: Validation dataset
            n_samples: Number of samples to test
            
        Returns:
            Complete cascade validation results
        """
        print(f"\n=== VALIDATING COMPLETE CASCADE CHAIN (n={n_samples}) ===")
        
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        dvs = [dv.id for dv in self.classifier.get_dvs()]
        target = 'PSI200'
        
        # Select validation samples
        n_samples = min(n_samples, len(df))
        # Use last portion of data for validation
        val_data = df.tail(n_samples)
        
        predictions = []
        actuals = []
        feasibility_results = []
        cv_predictions = {}
        
        for idx, row in val_data.iterrows():
            # Get actual MV and DV values
            mv_values = {mv_id: row[mv_id] for mv_id in mvs}
            dv_values = {dv_id: row[dv_id] for dv_id in dvs}
            
            # Predict using complete cascade
            try:
                result = self.model_manager.predict_cascade(mv_values, dv_values)
                
                predictions.append(result['predicted_target'])
                actuals.append(row[target])
                feasibility_results.append(result['is_feasible'])
                
                # Store CV predictions for analysis
                for cv_id, cv_pred in result['predicted_cvs'].items():
                    if cv_id not in cv_predictions:
                        cv_predictions[cv_id] = {'predicted': [], 'actual': []}
                    cv_predictions[cv_id]['predicted'].append(cv_pred)
                    cv_predictions[cv_id]['actual'].append(row[cv_id])
                    
            except Exception as e:
                print(f"Error in cascade prediction for row {idx}: {e}")
                predictions.append(999.0)  # High penalty
                actuals.append(row[target])
                feasibility_results.append(False)
        
        # Calculate cascade performance
        r2 = r2_score(actuals, predictions)
        rmse = np.sqrt(mean_squared_error(actuals, predictions))
        mae = mean_absolute_error(actuals, predictions)
        mape = np.mean(np.abs((np.array(actuals) - np.array(predictions)) / np.array(actuals))) * 100
        
        # Feasibility analysis
        feasibility_rate = np.mean(feasibility_results) * 100
        
        # CV prediction accuracy
        cv_accuracy = {}
        for cv_id, cv_data in cv_predictions.items():
            if len(cv_data['predicted']) > 0:
                cv_r2 = r2_score(cv_data['actual'], cv_data['predicted'])
                cv_rmse = np.sqrt(mean_squared_error(cv_data['actual'], cv_data['predicted']))
                cv_accuracy[cv_id] = {'r2': cv_r2, 'rmse': cv_rmse}
        
        results = {
            'cascade_r2': r2,
            'cascade_rmse': rmse,
            'cascade_mae': mae,
            'cascade_mape': mape,
            'feasibility_rate': feasibility_rate,
            'n_samples': n_samples,
            'actual_values': actuals,
            'predicted_values': predictions,
            'feasibility_results': feasibility_results,
            'cv_prediction_accuracy': cv_accuracy,
            'residuals': (np.array(actuals) - np.array(predictions)).tolist()
        }
        
        print(f"Complete Cascade Performance:")
        print(f"  R² Score: {r2:.4f}")
        print(f"  RMSE: {rmse:.4f}")
        print(f"  MAE: {mae:.4f}")
        print(f"  MAPE: {mape:.2f}%")
        print(f"  Feasibility Rate: {feasibility_rate:.1f}%")
        
        self.validation_results['complete_cascade'] = results
        return results
    
    def stress_test_optimization(self, 
                               extreme_scenarios: List[Dict[str, float]],
                               n_trials_per_scenario: int = 100) -> Dict[str, Any]:
        """
        Stress test the optimization system with extreme scenarios
        
        Args:
            extreme_scenarios: List of extreme DV scenarios to test
            n_trials_per_scenario: Number of optimization trials per scenario
            
        Returns:
            Stress test results
        """
        print(f"\n=== STRESS TESTING OPTIMIZATION ({len(extreme_scenarios)} scenarios) ===")
        
        from .cascade_engine import CascadeOptimizationEngine
        optimizer = CascadeOptimizationEngine(self.model_manager)
        
        stress_results = []
        
        for i, scenario in enumerate(extreme_scenarios):
            print(f"\nTesting extreme scenario {i+1}: {scenario}")
            
            try:
                # Run optimization with reduced trials for speed
                result = optimizer.optimize_single_objective(
                    dv_values=scenario,
                    n_trials=n_trials_per_scenario,
                    timeout=60  # 1 minute timeout
                )
                
                stress_results.append({
                    'scenario_id': i,
                    'scenario': scenario,
                    'optimization_success': True,
                    'best_target': result['best_target_value'],
                    'feasible': result['is_feasible'],
                    'n_trials': result['n_trials'],
                    'best_params': result['best_mv_parameters']
                })
                
                print(f"  Success: Best target = {result['best_target_value']:.2f}")
                
            except Exception as e:
                print(f"  Failed: {e}")
                stress_results.append({
                    'scenario_id': i,
                    'scenario': scenario,
                    'optimization_success': False,
                    'error': str(e)
                })
        
        # Analyze stress test results
        success_rate = np.mean([r['optimization_success'] for r in stress_results]) * 100
        
        results = {
            'stress_test_results': stress_results,
            'success_rate': success_rate,
            'n_scenarios': len(extreme_scenarios),
            'n_trials_per_scenario': n_trials_per_scenario
        }
        
        print(f"\nStress Test Summary:")
        print(f"  Success Rate: {success_rate:.1f}%")
        print(f"  Scenarios Tested: {len(extreme_scenarios)}")
        
        self.validation_results['stress_test'] = results
        return results
    
    def cross_validate_models(self, df: pd.DataFrame, n_folds: int = 5) -> Dict[str, Any]:
        """
        Perform cross-validation on the cascade models
        
        Args:
            df: Dataset for cross-validation
            n_folds: Number of cross-validation folds
            
        Returns:
            Cross-validation results
        """
        print(f"\n=== CROSS-VALIDATION ({n_folds} folds) ===")
        
        from sklearn.model_selection import KFold
        
        kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)
        
        mvs = [mv.id for mv in self.classifier.get_mvs()]
        cvs = [cv.id for cv in self.classifier.get_cvs()]
        dvs = [dv.id for dv in self.classifier.get_dvs()]
        target = 'PSI200'
        
        cv_results = {cv_id: {'r2_scores': [], 'rmse_scores': []} for cv_id in cvs}
        quality_results = {'r2_scores': [], 'rmse_scores': []}
        cascade_results = {'r2_scores': [], 'rmse_scores': []}
        
        for fold, (train_idx, val_idx) in enumerate(kf.split(df)):
            print(f"\nFold {fold + 1}/{n_folds}")
            
            train_data = df.iloc[train_idx]
            val_data = df.iloc[val_idx]
            
            # Create temporary model manager for this fold
            temp_manager = CascadeModelManager(model_save_path=f"temp_fold_{fold}")
            
            # Train models on fold training data
            temp_manager.train_all_models(train_data, test_size=0.1)
            
            # Validate on fold validation data
            for cv_id in cvs:
                if cv_id in temp_manager.process_models:
                    X_val = val_data[mvs]
                    y_val = val_data[cv_id]
                    
                    scaler = temp_manager.scalers[f"mv_to_{cv_id}"]
                    X_val_scaled = scaler.transform(X_val)
                    
                    y_pred = temp_manager.process_models[cv_id].predict(X_val_scaled)
                    
                    r2 = r2_score(y_val, y_pred)
                    rmse = np.sqrt(mean_squared_error(y_val, y_pred))
                    
                    cv_results[cv_id]['r2_scores'].append(r2)
                    cv_results[cv_id]['rmse_scores'].append(rmse)
            
            # Validate quality model
            feature_cols = cvs + dvs
            X_quality = val_data[feature_cols]
            y_quality = val_data[target]
            
            scaler_quality = temp_manager.scalers['quality_model']
            X_quality_scaled = scaler_quality.transform(X_quality)
            
            y_quality_pred = temp_manager.quality_model.predict(X_quality_scaled)
            
            r2_quality = r2_score(y_quality, y_quality_pred)
            rmse_quality = np.sqrt(mean_squared_error(y_quality, y_quality_pred))
            
            quality_results['r2_scores'].append(r2_quality)
            quality_results['rmse_scores'].append(rmse_quality)
            
            # Validate complete cascade (sample)
            cascade_val = temp_manager.validate_complete_chain(val_data, n_samples=50)
            cascade_results['r2_scores'].append(cascade_val['r2_score'])
            cascade_results['rmse_scores'].append(cascade_val['rmse'])
        
        # Calculate cross-validation statistics
        results = {
            'n_folds': n_folds,
            'process_models': {},
            'quality_model': {
                'mean_r2': np.mean(quality_results['r2_scores']),
                'std_r2': np.std(quality_results['r2_scores']),
                'mean_rmse': np.mean(quality_results['rmse_scores']),
                'std_rmse': np.std(quality_results['rmse_scores'])
            },
            'cascade_chain': {
                'mean_r2': np.mean(cascade_results['r2_scores']),
                'std_r2': np.std(cascade_results['r2_scores']),
                'mean_rmse': np.mean(cascade_results['rmse_scores']),
                'std_rmse': np.std(cascade_results['rmse_scores'])
            }
        }
        
        for cv_id in cvs:
            if cv_results[cv_id]['r2_scores']:
                results['process_models'][cv_id] = {
                    'mean_r2': np.mean(cv_results[cv_id]['r2_scores']),
                    'std_r2': np.std(cv_results[cv_id]['r2_scores']),
                    'mean_rmse': np.mean(cv_results[cv_id]['rmse_scores']),
                    'std_rmse': np.std(cv_results[cv_id]['rmse_scores'])
                }
        
        print(f"\nCross-Validation Summary:")
        print(f"Quality Model: R² = {results['quality_model']['mean_r2']:.3f} ± {results['quality_model']['std_r2']:.3f}")
        print(f"Cascade Chain: R² = {results['cascade_chain']['mean_r2']:.3f} ± {results['cascade_chain']['std_r2']:.3f}")
        
        self.validation_results['cross_validation'] = results
        return results
    
    def generate_validation_report(self) -> str:
        """
        Generate comprehensive validation report
        
        Returns:
            Formatted validation report as string
        """
        report = []
        report.append("=" * 60)
        report.append("CASCADE OPTIMIZATION VALIDATION REPORT")
        report.append("=" * 60)
        report.append(f"Generated: {pd.Timestamp.now()}")
        report.append("")
        
        # Individual models
        if 'individual_models' in self.validation_results:
            report.append("INDIVIDUAL PROCESS MODELS (MV → CV)")
            report.append("-" * 40)
            for cv_id, results in self.validation_results['individual_models'].items():
                report.append(f"{cv_id}:")
                report.append(f"  R² Score: {results['r2_score']:.4f}")
                report.append(f"  RMSE: {results['rmse']:.4f}")
                report.append(f"  MAPE: {results['mape']:.2f}%")
            report.append("")
        
        # Quality model
        if 'quality_model' in self.validation_results:
            results = self.validation_results['quality_model']
            report.append("QUALITY MODEL (CV + DV → Target)")
            report.append("-" * 40)
            report.append(f"R² Score: {results['r2_score']:.4f}")
            report.append(f"RMSE: {results['rmse']:.4f}")
            report.append(f"MAPE: {results['mape']:.2f}%")
            report.append("")
        
        # Complete cascade
        if 'complete_cascade' in self.validation_results:
            results = self.validation_results['complete_cascade']
            report.append("COMPLETE CASCADE CHAIN")
            report.append("-" * 40)
            report.append(f"R² Score: {results['cascade_r2']:.4f}")
            report.append(f"RMSE: {results['cascade_rmse']:.4f}")
            report.append(f"MAPE: {results['cascade_mape']:.2f}%")
            report.append(f"Feasibility Rate: {results['feasibility_rate']:.1f}%")
            report.append("")
        
        # Cross-validation
        if 'cross_validation' in self.validation_results:
            results = self.validation_results['cross_validation']
            report.append("CROSS-VALIDATION RESULTS")
            report.append("-" * 40)
            report.append(f"Quality Model: R² = {results['quality_model']['mean_r2']:.3f} ± {results['quality_model']['std_r2']:.3f}")
            report.append(f"Cascade Chain: R² = {results['cascade_chain']['mean_r2']:.3f} ± {results['cascade_chain']['std_r2']:.3f}")
            report.append("")
        
        # Stress test
        if 'stress_test' in self.validation_results:
            results = self.validation_results['stress_test']
            report.append("STRESS TEST RESULTS")
            report.append("-" * 40)
            report.append(f"Success Rate: {results['success_rate']:.1f}%")
            report.append(f"Scenarios Tested: {results['n_scenarios']}")
            report.append("")
        
        report.append("=" * 60)
        
        return "\n".join(report)
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """Get summary of all validation results"""
        summary = {
            'validation_types_completed': list(self.validation_results.keys()),
            'total_validations': len(self.validation_results),
            'cascade_structure': self.classifier.get_cascade_structure()
        }
        
        # Add key metrics from each validation
        for val_type, results in self.validation_results.items():
            if val_type == 'complete_cascade':
                summary['cascade_performance'] = {
                    'r2_score': results['cascade_r2'],
                    'rmse': results['cascade_rmse'],
                    'feasibility_rate': results['feasibility_rate']
                }
            elif val_type == 'quality_model':
                summary['quality_model_performance'] = {
                    'r2_score': results['r2_score'],
                    'rmse': results['rmse']
                }
        
        return summary
