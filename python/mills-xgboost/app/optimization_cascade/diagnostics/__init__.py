"""
Diagnostics package for cascade optimization (Phase 0 + Phase 1).

Provides:
- data_quality: per-column data quality + physical sanity report
- lag_estimation: MV->CV->Target lag estimation at 1H resolution
- evaluation: leak-free blocked TimeSeriesSplit evaluation (per-stage + full chain)
- run_diagnostics: entry point that pulls data and runs all of the above
"""

from .data_quality import DataQualityReport, run_data_quality
from .lag_estimation import LagEstimator, estimate_lags
from .evaluation import CascadeEvaluator, evaluate_cascade

__all__ = [
    "DataQualityReport",
    "run_data_quality",
    "LagEstimator",
    "estimate_lags",
    "CascadeEvaluator",
    "evaluate_cascade",
]
