"""
Phase 0 + Phase 1 Diagnostics Runner

Pulls combined mill+ore data, then runs:
  1. Data-quality report (Phase 0)
  2. Leak-free baseline evaluation (Phase 0)
  3. Lag estimation at 1H resolution (Phase 1)
  4. Lag-aligned evaluation + baseline-vs-aligned comparison (Phase 1)

All results are written to a timestamped JSON so we have a persistent baseline
to compare future improvements against.

Usage (from mills-xgboost/app as working dir, so `database` and
`optimization_cascade` are importable):

    python -m optimization_cascade.diagnostics.run_diagnostics \
        --mill 8 --start 2024-06-01 --end 2025-06-01

Or import and call run() programmatically.
"""

from __future__ import annotations

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

import pandas as pd

logger = logging.getLogger(__name__)

# --- Robust imports whether run as module or script ---
try:
    from database.db_connector import MillsDataConnector
except Exception:  # pragma: no cover
    _APP_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if _APP_DIR not in sys.path:
        sys.path.insert(0, _APP_DIR)
    from database.db_connector import MillsDataConnector

try:
    # settings live in mills-xgboost/config
    _MILLS_XGB_ROOT = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    if _MILLS_XGB_ROOT not in sys.path:
        sys.path.insert(0, _MILLS_XGB_ROOT)
    from config.settings import settings
except Exception as e:  # pragma: no cover
    settings = None
    logger.warning(f"Could not import settings, DB creds must be passed explicitly: {e}")

from .data_quality import run_data_quality, print_data_quality
from .lag_estimation import estimate_lags, print_lag_summary
from .evaluation import evaluate_cascade, print_eval_summary
from .lag_alignment import build_full_lagged


# Default variable groups (aligned with variable_classifier defaults).
DEFAULT_MVS = ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"]
DEFAULT_CVS = ["PulpHC", "DensityHC", "PressureHC"]
DEFAULT_DVS: List[str] = []  # DVs mostly disabled today; pass explicitly to include
DEFAULT_TARGET = "PSI200"


def _get_connector(db_kwargs: Optional[Dict[str, Any]] = None) -> MillsDataConnector:
    if db_kwargs:
        return MillsDataConnector(**db_kwargs)
    if settings is None:
        raise RuntimeError("No settings available and no db_kwargs provided")
    return MillsDataConnector(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
    )


def run(
    mill_number: int = 8,
    start_date: str = None,
    end_date: str = None,
    mvs: Optional[List[str]] = None,
    cvs: Optional[List[str]] = None,
    dvs: Optional[List[str]] = None,
    target: str = DEFAULT_TARGET,
    n_splits: int = 5,
    max_lag_hours: int = 6,
    resample_freq: str = "1h",
    output_dir: Optional[str] = None,
    db_kwargs: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run full Phase 0 + Phase 1 diagnostics and persist results to JSON."""
    mvs = mvs or DEFAULT_MVS
    cvs = cvs or DEFAULT_CVS
    dvs = dvs if dvs is not None else DEFAULT_DVS

    print("\n" + "#" * 80)
    print(f"# CASCADE DIAGNOSTICS  Mill {mill_number}  [{start_date} -> {end_date}]")
    print("#" * 80)

    # 1) Pull data (DB is 1H; resample at 1h to match)
    connector = _get_connector(db_kwargs)
    df = connector.get_combined_data(
        mill_number=mill_number,
        start_date=start_date,
        end_date=end_date,
        resample_freq=resample_freq,
        save_to_logs=False,
    )
    if df is None or df.empty:
        raise RuntimeError("No data returned from database for the given parameters")

    print(f"Pulled {len(df)} rows, columns: {list(df.columns)}")

    results: Dict[str, Any] = {
        "generated_at": datetime.now().isoformat(),
        "mill_number": mill_number,
        "start_date": start_date,
        "end_date": end_date,
        "resample_freq": resample_freq,
        "variables": {"mvs": mvs, "cvs": cvs, "dvs": dvs, "target": target},
    }

    # 2) Data quality (Phase 0)
    dq = run_data_quality(df, mill_number=mill_number)
    print_data_quality(dq)
    results["data_quality"] = dq.to_dict()

    # 3) Baseline leak-free evaluation (Phase 0)
    baseline = evaluate_cascade(
        df, mvs=mvs, cvs=cvs, dvs=dvs, target=target,
        n_splits=n_splits, label="baseline_unaligned",
    )
    print_eval_summary(baseline)
    results["baseline_evaluation"] = baseline

    # 4) Lag estimation (Phase 1)
    lag_result = estimate_lags(
        df, mvs=mvs, cvs=cvs, dvs=dvs, target=target, max_lag_hours=max_lag_hours,
    )
    print_lag_summary(lag_result)
    results["lag_estimation"] = lag_result

    # 5) Lag-aligned evaluation (Phase 1)
    mv_lags = lag_result.get("recommended_mv_lags", {})
    df_aligned = build_full_lagged(
        df, mv_lags=mv_lags, mvs=mvs, cvs=cvs, dvs=dvs, target=target,
    )
    aligned = evaluate_cascade(
        df_aligned, mvs=mvs, cvs=cvs, dvs=dvs, target=target,
        n_splits=n_splits, label="lag_aligned",
    )
    print_eval_summary(aligned)
    results["lag_aligned_evaluation"] = aligned

    # 6) Comparison
    comparison = _compare(baseline, aligned)
    results["comparison"] = comparison
    _print_comparison(comparison)

    # 7) Persist
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(output_dir, f"diagnostics_mill{mill_number}_{ts}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(_sanitize(results), f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to: {out_path}\n")
    results["_output_path"] = out_path

    return results


def _compare(baseline: Dict[str, Any], aligned: Dict[str, Any]) -> Dict[str, Any]:
    def full_r2(res):
        return res["full_chain_predicted_cv"]["agg"]["r2_mean"]

    def quality_r2(res):
        return res["quality_model_measured_cv"]["agg"]["r2_mean"]

    cmp = {
        "full_chain_r2": {
            "baseline": full_r2(baseline),
            "lag_aligned": full_r2(aligned),
            "delta": full_r2(aligned) - full_r2(baseline),
        },
        "quality_measured_r2": {
            "baseline": quality_r2(baseline),
            "lag_aligned": quality_r2(aligned),
            "delta": quality_r2(aligned) - quality_r2(baseline),
        },
        "process_models_r2": {},
    }
    for cv in baseline["process_models"]:
        b = baseline["process_models"][cv]["agg"]["r2_mean"]
        a = aligned["process_models"].get(cv, {}).get("agg", {}).get("r2_mean", float("nan"))
        cmp["process_models_r2"][cv] = {"baseline": b, "lag_aligned": a, "delta": a - b}
    return cmp


def _print_comparison(cmp: Dict[str, Any]) -> None:
    print("\n" + "=" * 80)
    print("BASELINE vs LAG-ALIGNED  (R2, higher is better)")
    print("=" * 80)
    fc = cmp["full_chain_r2"]
    print(f"FULL CHAIN R2:  baseline={fc['baseline']:.3f}  "
          f"aligned={fc['lag_aligned']:.3f}  delta={fc['delta']:+.3f}")
    for cv, d in cmp["process_models_r2"].items():
        print(f"  MV->{cv:<10} baseline={d['baseline']:.3f}  "
              f"aligned={d['lag_aligned']:.3f}  delta={d['delta']:+.3f}")
    print("=" * 80 + "\n")


def _sanitize(obj):
    """Make results JSON-safe (NaN/Inf -> None)."""
    import math
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    return obj


def _parse_args():
    p = argparse.ArgumentParser(description="Cascade Phase 0+1 diagnostics")
    p.add_argument("--mill", type=int, default=8)
    p.add_argument("--start", type=str, default=None)
    p.add_argument("--end", type=str, default=None)
    p.add_argument("--target", type=str, default=DEFAULT_TARGET)
    p.add_argument("--splits", type=int, default=5)
    p.add_argument("--max-lag", type=int, default=6)
    p.add_argument("--dvs", type=str, default="", help="comma-separated DV names to include")
    p.add_argument("--resample", type=str, default="1h")
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    args = _parse_args()
    dvs = [d.strip() for d in args.dvs.split(",") if d.strip()] if args.dvs else []
    run(
        mill_number=args.mill,
        start_date=args.start,
        end_date=args.end,
        target=args.target,
        n_splits=args.splits,
        max_lag_hours=args.max_lag,
        dvs=dvs,
        resample_freq=args.resample,
    )
