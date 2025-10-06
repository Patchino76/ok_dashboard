"""
Phase 4: Motif Analysis & Validation

Analyzes motif characteristics, validates against process knowledge,
and labels motifs by operating regime type.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class MotifAnalyzer:
    """
    Analyzes and validates discovered motifs
    """
    
    def __init__(self):
        """Initialize motif analyzer"""
        self.motif_characteristics = {}
        self.regime_labels = {}
        
    def analyze_motif_features(self,
                               motif: Dict,
                               data: pd.DataFrame,
                               feature_names: List[str]) -> Dict:
        """
        Analyze feature characteristics for a motif
        
        Args:
            motif: Motif dictionary
            data: Original time series data
            feature_names: List of feature names
            
        Returns:
            Dictionary with feature statistics
        """
        window_size = motif['window_size']
        occurrences = motif['occurrences']
        
        # Extract all occurrence windows
        occurrence_windows = []
        for occ in occurrences:
            idx = occ['index']
            window = data.iloc[idx:idx+window_size]
            occurrence_windows.append(window)
        
        # Calculate statistics for each feature across all occurrences
        feature_stats = {}
        for feature in feature_names:
            values = []
            for window in occurrence_windows:
                values.extend(window[feature].values)
            
            feature_stats[feature] = {
                'mean': np.mean(values),
                'std': np.std(values),
                'min': np.min(values),
                'max': np.max(values),
                'median': np.median(values),
                'range': np.max(values) - np.min(values)
            }
        
        return feature_stats
    
    def calculate_correlation_consistency(self,
                                         motif: Dict,
                                         data: pd.DataFrame) -> Dict:
        """
        Calculate correlation consistency within motif occurrences
        
        Args:
            motif: Motif dictionary
            data: Original time series data
            
        Returns:
            Dictionary with correlation metrics
        """
        window_size = motif['window_size']
        occurrences = motif['occurrences']
        
        # Calculate correlation for each occurrence
        correlations = []
        for occ in occurrences:
            idx = occ['index']
            window = data.iloc[idx:idx+window_size]
            corr_matrix = window.corr()
            correlations.append(corr_matrix.values)
        
        # Average correlation matrix
        avg_correlation = np.mean(correlations, axis=0)
        std_correlation = np.std(correlations, axis=0)
        
        return {
            'avg_correlation': avg_correlation,
            'std_correlation': std_correlation,
            'correlation_consistency': 1.0 / (1.0 + np.mean(std_correlation))
        }
    
    def label_motif_regime(self,
                          motif_id: int,
                          feature_stats: Dict,
                          mv_features: List[str],
                          cv_features: List[str]) -> str:
        """
        Label motif by operating regime type based on feature characteristics
        
        Args:
            motif_id: Motif ID
            feature_stats: Feature statistics dictionary
            mv_features: List of MV feature names
            cv_features: List of CV feature names
            
        Returns:
            Regime label string
        """
        # Simple heuristic-based labeling
        # This should be customized based on domain knowledge
        
        # Check MV levels
        mv_levels = []
        for mv in mv_features:
            if mv in feature_stats:
                mv_levels.append(feature_stats[mv]['mean'])
        
        avg_mv_level = np.mean(mv_levels) if mv_levels else 0
        
        # Check CV stability (low std = stable)
        cv_stabilities = []
        for cv in cv_features:
            if cv in feature_stats:
                cv_stabilities.append(feature_stats[cv]['std'])
        
        avg_cv_stability = np.mean(cv_stabilities) if cv_stabilities else 0
        
        # Label based on characteristics
        if avg_cv_stability < 0.3:  # Normalized data, so std < 0.3 is stable
            if avg_mv_level > 0.5:
                label = "High_Load_Stable"
            elif avg_mv_level < -0.5:
                label = "Low_Load_Stable"
            else:
                label = "Normal_Load_Stable"
        else:
            if avg_mv_level > 0.5:
                label = "High_Load_Unstable"
            elif avg_mv_level < -0.5:
                label = "Low_Load_Unstable"
            else:
                label = "Normal_Load_Unstable"
        
        logger.info(f"  Motif {motif_id}: {label} "
                   f"(MV_level={avg_mv_level:.2f}, CV_stability={avg_cv_stability:.2f})")
        
        return label
    
    def analyze_all_motifs(self,
                          motifs: List[Dict],
                          data: pd.DataFrame,
                          mv_features: List[str],
                          cv_features: List[str],
                          dv_features: Optional[List[str]] = None) -> Dict:
        """
        Analyze all motifs and generate comprehensive report
        
        Args:
            motifs: List of motif dictionaries
            data: Original time series data
            mv_features: List of MV feature names
            cv_features: List of CV feature names
            dv_features: List of DV feature names (optional)
            
        Returns:
            Dictionary with analysis results
        """
        logger.info("=" * 80)
        logger.info("PHASE 4: MOTIF ANALYSIS & VALIDATION")
        logger.info("=" * 80)
        
        all_features = mv_features + cv_features
        if dv_features:
            all_features += dv_features
        
        logger.info(f"\n[Configuration]")
        logger.info(f"  Number of motifs: {len(motifs)}")
        logger.info(f"  MV features: {mv_features}")
        logger.info(f"  CV features: {cv_features}")
        if dv_features:
            logger.info(f"  DV features: {dv_features}")
        
        analysis_results = {}
        
        logger.info(f"\n[Step 1/3] Analyzing feature characteristics...")
        for motif in motifs:
            motif_id = motif['motif_id']
            logger.info(f"\n  Analyzing Motif {motif_id}...")
            
            # Analyze features
            feature_stats = self.analyze_motif_features(
                motif, data, all_features
            )
            
            # Calculate correlation consistency
            corr_metrics = self.calculate_correlation_consistency(
                motif, data
            )
            
            # Label regime
            regime_label = self.label_motif_regime(
                motif_id, feature_stats, mv_features, cv_features
            )
            
            analysis_results[motif_id] = {
                'feature_stats': feature_stats,
                'correlation_metrics': corr_metrics,
                'regime_label': regime_label,
                'n_occurrences': motif['n_occurrences'],
                'consistency_score': motif['quality_metrics']['consistency_score']
            }
            
            self.motif_characteristics[motif_id] = feature_stats
            self.regime_labels[motif_id] = regime_label
        
        # Summarize regime distribution
        logger.info(f"\n[Step 2/3] Summarizing regime distribution...")
        regime_counts = {}
        for motif_id, analysis in analysis_results.items():
            label = analysis['regime_label']
            regime_counts[label] = regime_counts.get(label, 0) + 1
        
        logger.info(f"  Regime Distribution:")
        for regime, count in sorted(regime_counts.items()):
            logger.info(f"    {regime}: {count} motifs")
        
        # Validate against process knowledge
        logger.info(f"\n[Step 3/3] Validating against process knowledge...")
        validation_results = self._validate_motifs(analysis_results, mv_features, cv_features)
        
        logger.info("\n" + "=" * 80)
        logger.info("PHASE 4 COMPLETE: Motifs analyzed and labeled")
        logger.info("=" * 80 + "\n")
        
        return {
            'motif_analysis': analysis_results,
            'regime_distribution': regime_counts,
            'validation': validation_results
        }
    
    def _validate_motifs(self,
                        analysis_results: Dict,
                        mv_features: List[str],
                        cv_features: List[str]) -> Dict:
        """
        Validate motifs against known process behavior
        
        Args:
            analysis_results: Analysis results dictionary
            mv_features: List of MV features
            cv_features: List of CV features
            
        Returns:
            Validation results dictionary
        """
        validation = {
            'total_motifs': len(analysis_results),
            'stable_motifs': 0,
            'unstable_motifs': 0,
            'high_quality_motifs': [],
            'warnings': []
        }
        
        for motif_id, analysis in analysis_results.items():
            regime = analysis['regime_label']
            consistency = analysis['consistency_score']
            n_occurrences = analysis['n_occurrences']
            
            # Count stable vs unstable
            if 'Stable' in regime:
                validation['stable_motifs'] += 1
            else:
                validation['unstable_motifs'] += 1
            
            # Identify high-quality motifs
            if consistency > 0.7 and n_occurrences >= 5:
                validation['high_quality_motifs'].append(motif_id)
            
            # Add warnings for suspicious patterns
            if n_occurrences < 3:
                validation['warnings'].append(
                    f"Motif {motif_id}: Low occurrence count ({n_occurrences})"
                )
            
            if consistency < 0.5:
                validation['warnings'].append(
                    f"Motif {motif_id}: Low consistency score ({consistency:.2f})"
                )
        
        logger.info(f"  Validation Summary:")
        logger.info(f"    Stable motifs: {validation['stable_motifs']}")
        logger.info(f"    Unstable motifs: {validation['unstable_motifs']}")
        logger.info(f"    High-quality motifs: {len(validation['high_quality_motifs'])}")
        logger.info(f"    Warnings: {len(validation['warnings'])}")
        
        return validation
    
    def get_analysis_summary(self) -> pd.DataFrame:
        """
        Get summary DataFrame of motif analysis
        
        Returns:
            DataFrame with analysis summary
        """
        if not self.motif_characteristics:
            return pd.DataFrame()
        
        summary_data = []
        for motif_id in self.motif_characteristics.keys():
            summary_data.append({
                'motif_id': motif_id,
                'regime_label': self.regime_labels.get(motif_id, 'Unknown')
            })
        
        return pd.DataFrame(summary_data)
