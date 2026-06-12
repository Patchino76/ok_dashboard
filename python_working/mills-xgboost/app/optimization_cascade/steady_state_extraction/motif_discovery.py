"""
Phase 3: Motif Discovery

Discovers and extracts recurring patterns (motifs) from matrix profile results.
Groups similar patterns and identifies distinct operating regimes.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
from sklearn.cluster import DBSCAN
from scipy.spatial.distance import euclidean

logger = logging.getLogger(__name__)


class MotifDiscovery:
    """
    Discovers and groups motifs from matrix profile analysis
    """
    
    def __init__(self):
        """Initialize motif discovery"""
        self.motifs = []
        self.motif_groups = {}
        
    def extract_motif_occurrences(self,
                                  data: pd.DataFrame,
                                  matrix_profile: np.ndarray,
                                  matrix_profile_index: np.ndarray,
                                  motif_idx: int,
                                  window_size: int,
                                  distance_threshold: float = 2.0,
                                  max_occurrences: int = 50) -> List[Dict]:
        """
        Extract all occurrences of a motif pattern
        
        Args:
            data: Original time series data
            matrix_profile: Matrix profile array
            matrix_profile_index: Matrix profile index array
            motif_idx: Starting index of the motif
            window_size: Window size used for matrix profile
            distance_threshold: Maximum distance to consider as same motif
            max_occurrences: Maximum number of occurrences to extract
            
        Returns:
            List of motif occurrence dictionaries
        """
        logger.info(f"Extracting occurrences for motif at index {motif_idx}")
        
        # Get the motif pattern
        motif_pattern = data.iloc[motif_idx:motif_idx+window_size].values
        
        occurrences = []
        occurrences.append({
            'index': motif_idx,
            'timestamp': data.index[motif_idx],
            'distance': 0.0,  # Distance to itself
            'data': motif_pattern
        })
        
        # Find all similar patterns using matrix profile
        for idx in range(len(matrix_profile)):
            if idx == motif_idx:
                continue
                
            # Check if this pattern is similar to our motif
            pattern = data.iloc[idx:idx+window_size].values
            
            # Calculate Euclidean distance between patterns
            distance = np.linalg.norm(pattern - motif_pattern)
            
            if distance <= distance_threshold:
                occurrences.append({
                    'index': idx,
                    'timestamp': data.index[idx],
                    'distance': distance,
                    'data': pattern
                })
                
                if len(occurrences) >= max_occurrences:
                    break
        
        logger.info(f"  Found {len(occurrences)} occurrences")
        return occurrences
    
    def discover_motifs(self,
                       data: pd.DataFrame,
                       matrix_profile: np.ndarray,
                       matrix_profile_index: np.ndarray,
                       window_size: int,
                       k: int = 10,
                       distance_threshold: float = 2.0) -> List[Dict]:
        """
        Discover top-K motifs and their occurrences
        
        Args:
            data: Normalized time series data
            matrix_profile: Matrix profile array
            matrix_profile_index: Matrix profile index array
            window_size: Window size
            k: Number of motifs to discover
            distance_threshold: Distance threshold for grouping occurrences
            
        Returns:
            List of motif dictionaries with occurrences
        """
        logger.info("=" * 80)
        logger.info("PHASE 3: MOTIF DISCOVERY")
        logger.info("=" * 80)
        
        logger.info(f"\n[Configuration]")
        logger.info(f"  Number of motifs to discover: {k}")
        logger.info(f"  Distance threshold: {distance_threshold}")
        logger.info(f"  Window size: {window_size}")
        
        # Find top-K motif candidates
        logger.info(f"\n[Step 1/3] Finding top-{k} motif candidates...")
        
        mp_copy = matrix_profile.copy()
        motif_indices = []
        exclusion_zone = window_size // 2
        
        for i in range(k):
            min_idx = np.argmin(mp_copy)
            motif_indices.append(min_idx)
            
            # Apply exclusion zone
            start_exclude = max(0, min_idx - exclusion_zone)
            end_exclude = min(len(mp_copy), min_idx + exclusion_zone)
            mp_copy[start_exclude:end_exclude] = np.inf
            
            logger.info(f"  Motif {i+1}: index={min_idx}, distance={matrix_profile[min_idx]:.4f}")
        
        # Extract occurrences for each motif
        logger.info(f"\n[Step 2/3] Extracting occurrences for each motif...")
        
        motifs = []
        for i, motif_idx in enumerate(motif_indices):
            logger.info(f"\n  Processing Motif {i+1}/{k}...")
            
            occurrences = self.extract_motif_occurrences(
                data=data,
                matrix_profile=matrix_profile,
                matrix_profile_index=matrix_profile_index,
                motif_idx=motif_idx,
                window_size=window_size,
                distance_threshold=distance_threshold,
                max_occurrences=50
            )
            
            # Calculate representative pattern (median)
            occurrence_data = np.array([occ['data'] for occ in occurrences])
            representative = np.median(occurrence_data, axis=0)
            
            motif_info = {
                'motif_id': i + 1,
                'primary_index': motif_idx,
                'primary_timestamp': data.index[motif_idx],
                'primary_distance': matrix_profile[motif_idx],
                'occurrences': occurrences,
                'n_occurrences': len(occurrences),
                'representative_pattern': representative,
                'window_size': window_size
            }
            
            motifs.append(motif_info)
            logger.info(f"    ✅ Motif {i+1}: {len(occurrences)} occurrences found")
        
        # Calculate motif quality metrics
        logger.info(f"\n[Step 3/3] Calculating motif quality metrics...")
        
        for motif in motifs:
            # Calculate intra-motif variance (how consistent the pattern is)
            occurrence_data = np.array([occ['data'] for occ in motif['occurrences']])
            intra_variance = np.mean(np.var(occurrence_data, axis=0))
            
            # Calculate average distance between occurrences
            distances = [occ['distance'] for occ in motif['occurrences']]
            avg_distance = np.mean(distances)
            max_distance = np.max(distances)
            
            motif['quality_metrics'] = {
                'intra_variance': intra_variance,
                'avg_distance': avg_distance,
                'max_distance': max_distance,
                'consistency_score': 1.0 / (1.0 + intra_variance)  # Higher is better
            }
            
            logger.info(f"  Motif {motif['motif_id']}: "
                       f"occurrences={motif['n_occurrences']}, "
                       f"consistency={motif['quality_metrics']['consistency_score']:.3f}")
        
        self.motifs = motifs
        
        logger.info("\n" + "=" * 80)
        logger.info("PHASE 3 COMPLETE: Motifs discovered and characterized")
        logger.info("=" * 80 + "\n")
        
        return motifs
    
    def cluster_motifs(self,
                      motifs: List[Dict],
                      eps: float = 0.5,
                      min_samples: int = 2) -> Dict[int, List[int]]:
        """
        Cluster similar motifs into groups (operating regimes)
        
        Args:
            motifs: List of motif dictionaries
            eps: DBSCAN epsilon parameter
            min_samples: DBSCAN min_samples parameter
            
        Returns:
            Dictionary mapping cluster_id to list of motif_ids
        """
        logger.info(f"Clustering {len(motifs)} motifs into groups...")
        
        # Extract representative patterns
        patterns = np.array([motif['representative_pattern'].flatten() 
                            for motif in motifs])
        
        # Cluster using DBSCAN
        clustering = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean')
        labels = clustering.fit_predict(patterns)
        
        # Group motifs by cluster
        clusters = {}
        for motif_id, label in enumerate(labels, 1):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(motif_id)
        
        logger.info(f"  Found {len(clusters)} clusters:")
        for cluster_id, motif_ids in clusters.items():
            if cluster_id == -1:
                logger.info(f"    Noise: {len(motif_ids)} motifs")
            else:
                logger.info(f"    Cluster {cluster_id}: {len(motif_ids)} motifs")
        
        self.motif_groups = clusters
        return clusters
    
    def get_motif_summary(self) -> pd.DataFrame:
        """
        Get summary DataFrame of all discovered motifs
        
        Returns:
            DataFrame with motif summary
        """
        if not self.motifs:
            return pd.DataFrame()
        
        summary_data = []
        for motif in self.motifs:
            summary_data.append({
                'motif_id': motif['motif_id'],
                'primary_timestamp': motif['primary_timestamp'],
                'n_occurrences': motif['n_occurrences'],
                'primary_distance': motif['primary_distance'],
                'intra_variance': motif['quality_metrics']['intra_variance'],
                'avg_distance': motif['quality_metrics']['avg_distance'],
                'consistency_score': motif['quality_metrics']['consistency_score']
            })
        
        return pd.DataFrame(summary_data)
