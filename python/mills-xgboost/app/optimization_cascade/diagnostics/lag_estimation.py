"""
Phase 1 - Lag Estimation (1H resolution)

Estimates the transport/residence delay between:
  - each MV and each CV   (MV -> CV)
  - each CV/DV and the Target (CV/DV -> Target)

Method: for each candidate lag h (in hours), shift the driver series forward
by h and measure association with the response using Pearson correlation and
mutual information. The lag maximizing |association| is reported.

At 1H DB resolution, candidate lags are integer hours (default 0..6h),
which comfortably brackets a typical ~1h mill residence time.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any
import logging

from sklearn.feature_selection import mutual_info_regression

logger = logging.getLogger(__name__)


@dataclass
class LagResult:
    driver: str
    response: str
    best_lag_hours: int
    best_abs_corr: float
    corr_at_best_lag: float
    mi_at_best_lag: float
    corr_by_lag: Dict[int, float]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # JSON keys must be str
        d["corr_by_lag"] = {str(k): v for k, v in self.corr_by_lag.items()}
        return d


class LagEstimator:
    """Estimate integer-hour lags between drivers and responses."""

    def __init__(self, max_lag_hours: int = 6, min_overlap: int = 100):
        self.max_lag_hours = max_lag_hours
        self.min_overlap = min_overlap

    def _pair_lag(self, driver: pd.Series, response: pd.Series) -> Optional[LagResult]:
        corr_by_lag: Dict[int, float] = {}
        best_lag = 0
        best_abs = -1.0
        best_corr = 0.0

        for h in range(0, self.max_lag_hours + 1):
            # shift driver forward by h hours: driver(t) aligned to response(t+h)
            shifted = driver.shift(h)
            aligned = pd.concat([shifted, response], axis=1).dropna()
            if len(aligned) < self.min_overlap:
                continue
            a = aligned.iloc[:, 0]
            b = aligned.iloc[:, 1]
            if a.std() == 0 or b.std() == 0:
                corr = 0.0
            else:
                corr = float(np.corrcoef(a.values, b.values)[0, 1])
            corr_by_lag[h] = round(corr, 4)
            if abs(corr) > best_abs:
                best_abs = abs(corr)
                best_lag = h
                best_corr = corr

        if not corr_by_lag:
            return None

        # Mutual information at the best lag
        shifted = driver.shift(best_lag)
        aligned = pd.concat([shifted, response], axis=1).dropna()
        mi = 0.0
        if len(aligned) >= self.min_overlap:
            try:
                mi = float(
                    mutual_info_regression(
                        aligned.iloc[:, [0]].values,
                        aligned.iloc[:, 1].values,
                        random_state=42,
                    )[0]
                )
            except Exception as e:  # pragma: no cover
                logger.warning(f"MI failed for {driver.name}->{response.name}: {e}")

        return LagResult(
            driver=str(driver.name),
            response=str(response.name),
            best_lag_hours=int(best_lag),
            best_abs_corr=round(float(best_abs), 4),
            corr_at_best_lag=round(float(best_corr), 4),
            mi_at_best_lag=round(mi, 4),
            corr_by_lag=corr_by_lag,
        )

    def estimate(
        self,
        df: pd.DataFrame,
        mvs: List[str],
        cvs: List[str],
        dvs: List[str],
        target: str,
    ) -> Dict[str, Any]:
        """
        Estimate lags for MV->CV and (CV+DV)->Target.

        Returns a dict with:
          - mv_to_cv: {cv: [LagResult...]}  (one per MV)
          - to_target: [LagResult...]        (one per CV and DV)
          - recommended_mv_lags: {mv: hours}  (max |corr| across CVs)
          - recommended_target_lags: {driver: hours}
        """
        present = set(df.columns)
        mvs = [c for c in mvs if c in present]
        cvs = [c for c in cvs if c in present]
        dvs = [c for c in dvs if c in present]

        result: Dict[str, Any] = {"mv_to_cv": {}, "to_target": [], "params": {
            "max_lag_hours": self.max_lag_hours, "min_overlap": self.min_overlap}}

        # MV -> CV
        for cv in cvs:
            cv_results = []
            for mv in mvs:
                r = self._pair_lag(df[mv], df[cv])
                if r is not None:
                    cv_results.append(r)
            result["mv_to_cv"][cv] = [r.to_dict() for r in cv_results]

        # CV/DV -> Target
        target_results = []
        if target in present:
            for drv in cvs + dvs:
                r = self._pair_lag(df[drv], df[target])
                if r is not None:
                    target_results.append(r)
        result["to_target"] = [r.to_dict() for r in target_results]

        # Recommended MV lags: for each MV, take the lag that gave the strongest
        # correlation to ANY CV (the MV's dominant effect delay).
        rec_mv: Dict[str, int] = {}
        best_abs_per_mv: Dict[str, float] = {}
        for cv, rlist in result["mv_to_cv"].items():
            for r in rlist:
                mv = r["driver"]
                if r["best_abs_corr"] > best_abs_per_mv.get(mv, -1.0):
                    best_abs_per_mv[mv] = r["best_abs_corr"]
                    rec_mv[mv] = r["best_lag_hours"]
        result["recommended_mv_lags"] = rec_mv

        rec_tgt: Dict[str, int] = {r["driver"]: r["best_lag_hours"] for r in result["to_target"]}
        result["recommended_target_lags"] = rec_tgt

        return result


def estimate_lags(
    df: pd.DataFrame,
    mvs: List[str],
    cvs: List[str],
    dvs: List[str],
    target: str,
    max_lag_hours: int = 6,
) -> Dict[str, Any]:
    """Convenience wrapper."""
    return LagEstimator(max_lag_hours=max_lag_hours).estimate(df, mvs, cvs, dvs, target)


def print_lag_summary(lag_result: Dict[str, Any]) -> None:
    print("\n" + "=" * 80)
    print("LAG ESTIMATION (hours) @ 1H resolution")
    print("=" * 80)
    print("Recommended MV lags (strongest MV->CV effect delay):")
    for mv, h in lag_result.get("recommended_mv_lags", {}).items():
        print(f"  {mv:<14} -> {h} h")
    print("\nRecommended driver->Target lags:")
    for drv, h in lag_result.get("recommended_target_lags", {}).items():
        print(f"  {drv:<14} -> {h} h")
    print("=" * 80 + "\n")
