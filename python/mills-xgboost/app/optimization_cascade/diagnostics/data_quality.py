"""
Phase 0 - Data Quality Report

Produces a per-column and dataset-level data-quality assessment for the
combined mill + ore-quality dataset used in cascade training.

Checks:
- Missing values (NaN) per column
- Flatline / stuck-sensor detection (runs of identical consecutive values)
- Basic distribution stats (min/max/mean/std/quantiles)
- Physical sanity checks (CirculativeLoad range, negative flows, density bounds)
- Time-continuity gaps in the index

The report is designed to be JSON-serializable so it can be persisted as a
baseline and compared over time.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


# Physically plausible ranges for sanity checks. These are conservative
# validity bounds (NOT operating setpoints) used only to flag impossible rows.
PHYSICAL_BOUNDS: Dict[str, tuple] = {
    "Ore": (0.0, 400.0),          # t/h
    "WaterMill": (0.0, 60.0),     # m3/h
    "WaterZumpf": (0.0, 400.0),   # m3/h
    "MotorAmp": (0.0, 400.0),     # A
    "PulpHC": (0.0, 1200.0),      # m3/h
    "DensityHC": (1000.0, 2500.0),# kg/m3 (cannot be below water)
    "PressureHC": (0.0, 1.5),     # bar
    "PSI80": (0.0, 100.0),        # %
    "PSI200": (0.0, 100.0),       # %
}

# Typical circulating-load validity range for a ball mill / hydrocyclone loop.
CIRC_LOAD_VALID = (0.5, 5.0)


@dataclass
class ColumnQuality:
    name: str
    n: int
    n_missing: int
    pct_missing: float
    n_flatline: int
    pct_flatline: float
    n_out_of_physical_bounds: int
    pct_out_of_physical_bounds: float
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    std: Optional[float] = None
    q05: Optional[float] = None
    q50: Optional[float] = None
    q95: Optional[float] = None


@dataclass
class DataQualityReport:
    mill_number: Optional[int]
    n_rows: int
    n_cols: int
    date_start: Optional[str]
    date_end: Optional[str]
    median_step_minutes: Optional[float]
    n_time_gaps: int
    largest_gap_minutes: Optional[float]
    columns: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    physical_flags: Dict[str, Any] = field(default_factory=dict)
    overall_row_usability_pct: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _detect_flatline(series: pd.Series, min_run: int = 6) -> int:
    """
    Count rows belonging to flatline runs (identical consecutive values) of
    length >= min_run. At 1H resolution min_run=6 means ~6h of a frozen sensor,
    which is a strong stuck-sensor signal.
    """
    s = series.copy()
    # group id increments whenever value changes
    change = s.ne(s.shift())
    group_id = change.cumsum()
    run_lengths = s.groupby(group_id).transform("size")
    flatline_mask = (run_lengths >= min_run) & s.notna()
    return int(flatline_mask.sum())


def _column_quality(name: str, series: pd.Series) -> ColumnQuality:
    n = int(len(series))
    n_missing = int(series.isna().sum())
    pct_missing = round(100.0 * n_missing / n, 3) if n else 0.0

    n_flat = _detect_flatline(series)
    pct_flat = round(100.0 * n_flat / n, 3) if n else 0.0

    n_oob = 0
    if name in PHYSICAL_BOUNDS:
        lo, hi = PHYSICAL_BOUNDS[name]
        n_oob = int(((series < lo) | (series > hi)).sum())
    pct_oob = round(100.0 * n_oob / n, 3) if n else 0.0

    valid = series.dropna()
    stats = {}
    if len(valid) > 0:
        stats = {
            "min": float(valid.min()),
            "max": float(valid.max()),
            "mean": float(valid.mean()),
            "std": float(valid.std()),
            "q05": float(valid.quantile(0.05)),
            "q50": float(valid.quantile(0.50)),
            "q95": float(valid.quantile(0.95)),
        }

    return ColumnQuality(
        name=name,
        n=n,
        n_missing=n_missing,
        pct_missing=pct_missing,
        n_flatline=n_flat,
        pct_flatline=pct_flat,
        n_out_of_physical_bounds=n_oob,
        pct_out_of_physical_bounds=pct_oob,
        **stats,
    )


def _time_gaps(index: pd.DatetimeIndex) -> tuple:
    """Return (median_step_min, n_gaps, largest_gap_min)."""
    if not isinstance(index, pd.DatetimeIndex) or len(index) < 3:
        return None, 0, None
    deltas = index.to_series().diff().dropna().dt.total_seconds() / 60.0
    if deltas.empty:
        return None, 0, None
    median_step = float(deltas.median())
    # a "gap" is > 1.5x the median step
    gap_mask = deltas > (median_step * 1.5)
    n_gaps = int(gap_mask.sum())
    largest = float(deltas.max())
    return median_step, n_gaps, largest


def run_data_quality(df: pd.DataFrame, mill_number: Optional[int] = None) -> DataQualityReport:
    """
    Build a DataQualityReport for a combined dataframe.

    Args:
        df: combined mill+ore dataframe (DatetimeIndex expected)
        mill_number: for reporting

    Returns:
        DataQualityReport
    """
    n_rows, n_cols = df.shape

    date_start = date_end = None
    median_step = None
    n_gaps = 0
    largest_gap = None
    if isinstance(df.index, pd.DatetimeIndex) and n_rows > 0:
        date_start = str(df.index.min())
        date_end = str(df.index.max())
        median_step, n_gaps, largest_gap = _time_gaps(df.index)

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

    columns: Dict[str, Dict[str, Any]] = {}
    for col in numeric_cols:
        columns[col] = asdict(_column_quality(col, df[col]))

    # Physical sanity flags
    physical_flags: Dict[str, Any] = {}

    # Negative flows
    for col in ["Ore", "WaterMill", "WaterZumpf", "PulpHC"]:
        if col in df.columns:
            physical_flags[f"{col}_negative_rows"] = int((df[col] < 0).sum())

    # CirculativeLoad validity
    if "CirculativeLoad" in df.columns:
        cl = df["CirculativeLoad"].dropna()
        lo, hi = CIRC_LOAD_VALID
        physical_flags["circ_load_valid_pct"] = (
            round(100.0 * ((cl >= lo) & (cl <= hi)).sum() / len(cl), 2) if len(cl) else None
        )

    # Overall row usability: fraction of rows with no missing values across numeric cols
    if n_rows > 0 and numeric_cols:
        usable = df[numeric_cols].notna().all(axis=1).mean() * 100.0
        overall_usability = round(float(usable), 2)
    else:
        overall_usability = None

    report = DataQualityReport(
        mill_number=mill_number,
        n_rows=int(n_rows),
        n_cols=int(n_cols),
        date_start=date_start,
        date_end=date_end,
        median_step_minutes=median_step,
        n_time_gaps=n_gaps,
        largest_gap_minutes=largest_gap,
        columns=columns,
        physical_flags=physical_flags,
        overall_row_usability_pct=overall_usability,
    )

    return report


def print_data_quality(report: DataQualityReport) -> None:
    """Human-readable summary to stdout/logger."""
    print("\n" + "=" * 80)
    print(f"DATA QUALITY REPORT  (Mill {report.mill_number})")
    print("=" * 80)
    print(f"Rows: {report.n_rows}   Cols: {report.n_cols}")
    print(f"Range: {report.date_start} -> {report.date_end}")
    print(f"Median step: {report.median_step_minutes} min   "
          f"Time gaps: {report.n_time_gaps}   Largest gap: {report.largest_gap_minutes} min")
    print(f"Overall row usability (no missing): {report.overall_row_usability_pct}%")
    print("-" * 80)
    print(f"{'column':<16}{'%miss':>8}{'%flat':>8}{'%oob':>8}"
          f"{'min':>10}{'q50':>10}{'max':>10}")
    for col, q in report.columns.items():
        print(f"{col:<16}{q['pct_missing']:>8}{q['pct_flatline']:>8}"
              f"{q['pct_out_of_physical_bounds']:>8}"
              f"{_fmt(q.get('min')):>10}{_fmt(q.get('q50')):>10}{_fmt(q.get('max')):>10}")
    print("-" * 80)
    print(f"Physical flags: {report.physical_flags}")
    print("=" * 80 + "\n")


def _fmt(v):
    return f"{v:.2f}" if isinstance(v, (int, float)) and v is not None else "-"
