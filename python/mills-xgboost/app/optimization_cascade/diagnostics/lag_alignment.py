"""
Phase 1 - Lag-Aligned Feature Builder

Applies estimated lags to build a training frame where each driver is shifted
so that driver(t) aligns with the response it influences at t+lag.

Two alignment strategies are supported:

1. build_mv_lagged(df, mv_lags):
   Shifts each MV forward by its recommended lag. Used for the MV->CV stage,
   so the CV row at time t is paired with the MV values that actually caused it.

2. build_target_lagged(df, target_lags):
   Shifts each CV/DV driver forward by its recommended lag relative to the
   target. Used for the CV/DV->Target stage.

Because the DB is at 1H resolution, lags are integer hours implemented via
pandas .shift(hours). Rows with NaNs introduced by shifting are dropped by
the evaluation harness (which already dropna()s required columns).
"""

from __future__ import annotations

import pandas as pd
from typing import Dict, List, Optional


def build_mv_lagged(
    df: pd.DataFrame,
    mv_lags: Dict[str, int],
    mvs: List[str],
    other_cols: List[str],
) -> pd.DataFrame:
    """
    Return a copy of df where each MV column is shifted forward by mv_lags[mv]
    hours. Non-MV columns (CVs, DVs, target) are left at their original time.

    Assumes a DatetimeIndex at ~1H spacing; .shift(periods) shifts by rows,
    which equals hours when the series is regularly sampled at 1H.
    """
    out = df.copy()
    for mv in mvs:
        if mv in out.columns:
            lag = int(mv_lags.get(mv, 0))
            if lag > 0:
                out[mv] = out[mv].shift(lag)
    keep = [c for c in (mvs + other_cols) if c in out.columns]
    return out[keep]


def build_target_lagged(
    df: pd.DataFrame,
    target_lags: Dict[str, int],
    drivers: List[str],
    target: str,
    passthrough: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Return a copy where each driver (CV/DV) is shifted forward by its lag to
    the target, so driver(t) aligns with target(t+lag).
    """
    out = df.copy()
    for drv in drivers:
        if drv in out.columns:
            lag = int(target_lags.get(drv, 0))
            if lag > 0:
                out[drv] = out[drv].shift(lag)
    keep = list(drivers)
    if passthrough:
        keep += [c for c in passthrough if c in out.columns]
    if target in out.columns and target not in keep:
        keep.append(target)
    keep = [c for c in keep if c in out.columns]
    return out[keep]


def build_full_lagged(
    df: pd.DataFrame,
    mv_lags: Dict[str, int],
    mvs: List[str],
    cvs: List[str],
    dvs: List[str],
    target: str,
) -> pd.DataFrame:
    """
    Build a single frame for full-cascade evaluation where MVs are shifted by
    their recommended MV->CV lag. CVs, DVs and target stay at original time.

    This lets the same evaluation harness be reused on lag-aligned data to
    quantify the accuracy gain versus the unaligned baseline.
    """
    out = df.copy()
    for mv in mvs:
        if mv in out.columns:
            lag = int(mv_lags.get(mv, 0))
            if lag > 0:
                out[mv] = out[mv].shift(lag)
    keep = [c for c in (mvs + cvs + dvs + [target]) if c in out.columns]
    return out[keep]
