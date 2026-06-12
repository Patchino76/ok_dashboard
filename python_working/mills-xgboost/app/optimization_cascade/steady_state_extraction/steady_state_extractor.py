"""
Phase 5: Steady State Extraction

Extracts clean steady-state datasets from motif occurrences
for use in cascade model training.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class SteadyStateExtractor:
    """
    Extracts steady-state data from motif occurrences
    """
    
    def __init__(self):
        """Initialize steady state extractor"""
        self.steady_state_data = None
        self.extraction_metadata = {}
        
    def extract_from_motif(self,
                          motif: Dict,
                          data: pd.DataFrame,
                          original_data: pd.DataFrame,
                          aggregation_method: str = 'median') -> pd.DataFrame:
        """
        Extract steady-state data from a single motif
        
        Args:
            motif: Motif dictionary with occurrences
            data: Normalized data (for analysis)
            original_data: Original unnormalized data (for extraction)
            aggregation_method: Method to aggregate window ('mean', 'median')
            
        Returns:
            DataFrame with steady-state records
        """
        window_size = motif['window_size']
        occurrences = motif['occurrences']
        motif_id = motif['motif_id']
        
        steady_state_records = []
        
        for occ in occurrences:
            idx = occ['index']
            timestamp = occ['timestamp']
            distance = occ['distance']
            
            # Extract window from original data
            window = original_data.iloc[idx:idx+window_size]
            
            # Aggregate window
            if aggregation_method == 'mean':
                aggregated = window.mean()
            elif aggregation_method == 'median':
                aggregated = window.median()
            else:
                raise ValueError(f"Unknown aggregation method: {aggregation_method}")
            
            # Create record
            record = aggregated.to_dict()
            record['timestamp'] = timestamp
            record['motif_id'] = motif_id
            record['distance'] = distance
            record['window_start_idx'] = idx
            record['window_size'] = window_size
            
            steady_state_records.append(record)
        
        return pd.DataFrame(steady_state_records)
    
    def extract_all_motifs(self,
                          motifs: List[Dict],
                          data: pd.DataFrame,
                          original_data: pd.DataFrame,
                          regime_labels: Dict[int, str],
                          quality_threshold: float = 0.5,
                          min_occurrences: int = 3) -> pd.DataFrame:
        """
        Extract steady-state data from all high-quality motifs
        
        Args:
            motifs: List of motif dictionaries
            data: Normalized data
            original_data: Original unnormalized data
            regime_labels: Dictionary mapping motif_id to regime label
            quality_threshold: Minimum consistency score to include motif
            min_occurrences: Minimum occurrences to include motif
            
        Returns:
            DataFrame with all steady-state records
        """
        logger.info("=" * 80)
        logger.info("PHASE 5: STEADY STATE EXTRACTION")
        logger.info("=" * 80)
        
        logger.info(f"\n[Configuration]")
        logger.info(f"  Quality threshold: {quality_threshold}")
        logger.info(f"  Minimum occurrences: {min_occurrences}")
        
        all_steady_state_data = []
        included_motifs = []
        excluded_motifs = []
        
        logger.info(f"\n[Step 1/3] Filtering motifs by quality...")
        
        for motif in motifs:
            motif_id = motif['motif_id']
            consistency = motif['quality_metrics']['consistency_score']
            n_occurrences = motif['n_occurrences']
            
            # Check quality criteria
            if consistency >= quality_threshold and n_occurrences >= min_occurrences:
                included_motifs.append(motif_id)
                logger.info(f"  ✅ Motif {motif_id}: "
                           f"consistency={consistency:.3f}, "
                           f"occurrences={n_occurrences}")
            else:
                excluded_motifs.append(motif_id)
                logger.info(f"  ❌ Motif {motif_id}: "
                           f"consistency={consistency:.3f}, "
                           f"occurrences={n_occurrences} (excluded)")
        
        logger.info(f"\n  Summary: {len(included_motifs)} motifs included, "
                   f"{len(excluded_motifs)} excluded")
        
        # Extract steady-state data
        logger.info(f"\n[Step 2/3] Extracting steady-state data...")
        
        for motif in motifs:
            motif_id = motif['motif_id']
            
            if motif_id not in included_motifs:
                continue
            
            logger.info(f"\n  Extracting from Motif {motif_id}...")
            
            # Extract steady-state records
            motif_data = self.extract_from_motif(
                motif=motif,
                data=data,
                original_data=original_data,
                aggregation_method='median'
            )
            
            # Add regime label
            motif_data['regime_label'] = regime_labels.get(motif_id, 'Unknown')
            
            all_steady_state_data.append(motif_data)
            logger.info(f"    ✅ Extracted {len(motif_data)} steady-state records")
        
        # Combine all data
        if not all_steady_state_data:
            logger.warning("  ⚠️ No steady-state data extracted!")
            return pd.DataFrame()
        
        steady_state_df = pd.concat(all_steady_state_data, ignore_index=True)
        
        # Calculate quality scores
        logger.info(f"\n[Step 3/3] Calculating quality scores...")
        
        steady_state_df['quality_score'] = 1.0 / (1.0 + steady_state_df['distance'])
        
        # Sort by timestamp
        steady_state_df = steady_state_df.sort_values('timestamp').reset_index(drop=True)
        
        # Store metadata
        self.extraction_metadata = {
            'total_motifs': len(motifs),
            'included_motifs': len(included_motifs),
            'excluded_motifs': len(excluded_motifs),
            'total_records': len(steady_state_df),
            'quality_threshold': quality_threshold,
            'min_occurrences': min_occurrences,
            'extraction_date': datetime.now().isoformat()
        }
        
        # Log summary
        logger.info(f"\n  Extraction Summary:")
        logger.info(f"    Total steady-state records: {len(steady_state_df)}")
        logger.info(f"    Date range: {steady_state_df['timestamp'].min()} to "
                   f"{steady_state_df['timestamp'].max()}")
        logger.info(f"    Regime distribution:")
        for regime, count in steady_state_df['regime_label'].value_counts().items():
            logger.info(f"      {regime}: {count} records")
        
        self.steady_state_data = steady_state_df
        
        logger.info("\n" + "=" * 80)
        logger.info("PHASE 5 COMPLETE: Steady-state dataset ready for training")
        logger.info("=" * 80 + "\n")
        
        return steady_state_df
    
    def get_training_data(self,
                         mv_features: List[str],
                         cv_features: List[str],
                         dv_features: Optional[List[str]] = None,
                         target_variable: Optional[str] = None,
                         regime_filter: Optional[List[str]] = None) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Get training data in format ready for cascade model training
        
        Args:
            mv_features: List of MV feature names
            cv_features: List of CV feature names
            dv_features: List of DV feature names (optional)
            target_variable: Target variable name (optional)
            regime_filter: List of regime labels to include (optional)
            
        Returns:
            Tuple of (features DataFrame, target Series)
        """
        if self.steady_state_data is None:
            raise ValueError("No steady-state data extracted yet")
        
        df = self.steady_state_data.copy()
        
        # Filter by regime if specified
        if regime_filter:
            df = df[df['regime_label'].isin(regime_filter)]
            logger.info(f"Filtered to {len(df)} records from regimes: {regime_filter}")
        
        # Select features
        all_features = mv_features + cv_features
        if dv_features:
            all_features += dv_features
        
        # Check if all features exist
        missing_features = [f for f in all_features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Missing features in data: {missing_features}")
        
        X = df[all_features].copy()
        
        # Get target if specified
        if target_variable:
            if target_variable not in df.columns:
                raise ValueError(f"Target variable '{target_variable}' not in data")
            y = df[target_variable].copy()
        else:
            y = None
        
        logger.info(f"Training data prepared:")
        logger.info(f"  Features: {X.shape}")
        if y is not None:
            logger.info(f"  Target: {y.shape}")
        
        return X, y
    
    def save_steady_state_data(self, filepath: str):
        """
        Save steady-state data to CSV file
        
        Args:
            filepath: Path to save CSV file
        """
        if self.steady_state_data is None:
            raise ValueError("No steady-state data to save")
        
        self.steady_state_data.to_csv(filepath, index=False)
        logger.info(f"✅ Steady-state data saved to: {filepath}")
        
        # Save metadata
        metadata_path = filepath.replace('.csv', '_metadata.txt')
        with open(metadata_path, 'w') as f:
            f.write("STEADY STATE EXTRACTION METADATA\n")
            f.write("=" * 50 + "\n\n")
            for key, value in self.extraction_metadata.items():
                f.write(f"{key}: {value}\n")
        
        logger.info(f"✅ Metadata saved to: {metadata_path}")
    
    def get_summary_statistics(self) -> Dict:
        """
        Get summary statistics of extracted steady-state data
        
        Returns:
            Dictionary with summary statistics
        """
        if self.steady_state_data is None:
            return {"error": "No data extracted yet"}
        
        df = self.steady_state_data
        
        # Exclude metadata columns
        metadata_cols = ['timestamp', 'motif_id', 'distance', 'window_start_idx', 
                        'window_size', 'regime_label', 'quality_score']
        feature_cols = [col for col in df.columns if col not in metadata_cols]
        
        summary = {
            'total_records': len(df),
            'date_range': {
                'start': str(df['timestamp'].min()),
                'end': str(df['timestamp'].max())
            },
            'regime_distribution': df['regime_label'].value_counts().to_dict(),
            'quality_stats': {
                'mean': df['quality_score'].mean(),
                'min': df['quality_score'].min(),
                'max': df['quality_score'].max()
            },
            'feature_statistics': df[feature_cols].describe().to_dict(),
            'extraction_metadata': self.extraction_metadata
        }
        
        return summary
