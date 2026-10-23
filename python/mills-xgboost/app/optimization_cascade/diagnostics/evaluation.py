"""
Phase 0 - Leak-free Cascade Evaluation Harness

Evaluates the cascade (MV -> CV -> Target) honestly using blocked,
chronological cross-validation (sklearn TimeSeriesSplit). This avoids the
data-leakage that a shuffled train_test_split causes on autocorrelated
time-series data.

It reports, per fold and aggregated:
  - Per-CV process model metrics (MV -> CV)
  - Quality model metrics using MEASURED CVs (CV+DV -> Target)
  - FULL-CHAIN metrics using PREDICTED CVs (MV -> predicted CV -> Target)
    which is the number that actually matters for optimization.

Also supports an optional held-out final block (e.g. most recent 1 month)
to mimic the monthly retraining cadence.

The same harness can evaluate either the RAW aligned data or the
LAG-ALIGNED data (Phase 1) so we can quantify the improvement.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
import logging

import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

logger = logging.getLogger(__name__)


DEFAULT_XGB_PARAMS = {
    "n_estimators": 200,
    "max_depth": 6,
    "learning_rate": 0.1,
    "random_state": 42,
    "n_jobs": -1,
}


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mae": float(mean_absolute_error(y_true, y_pred)),
    }


def _agg(fold_metrics: List[Dict[str, float]]) -> Dict[str, float]:
    if not fold_metrics:
        return {"r2": float("nan"), "rmse": float("nan"), "mae": float("nan")}
    return {
        "r2_mean": float(np.mean([m["r2"] for m in fold_metrics])),
        "r2_std": float(np.std([m["r2"] for m in fold_metrics])),
        "rmse_mean": float(np.mean([m["rmse"] for m in fold_metrics])),
        "mae_mean": float(np.mean([m["mae"] for m in fold_metrics])),
    }


@dataclass
class EvalConfig:
    mvs: List[str]
    cvs: List[str]
    dvs: List[str]
    target: str
    n_splits: int = 5
    xgb_params: Dict[str, Any] = field(default_factory=lambda: dict(DEFAULT_XGB_PARAMS))
    label: str = "baseline"


class CascadeEvaluator:
    """Blocked-CV evaluator for the cascade structure."""

    def __init__(self, config: EvalConfig):
        self.cfg = config

    def _fit_predict(self, X_tr, y_tr, X_te):
        scaler = StandardScaler()
        X_tr_s = scaler.fit_transform(X_tr)
        X_te_s = scaler.transform(X_te)
        model = xgb.XGBRegressor(**self.cfg.xgb_params)
        model.fit(X_tr_s, y_tr)
        return model, scaler, model.predict(X_te_s)

    def evaluate(self, df: pd.DataFrame) -> Dict[str, Any]:
        cfg = self.cfg
        present = set(df.columns)
        mvs = [c for c in cfg.mvs if c in present]
        cvs = [c for c in cfg.cvs if c in present]
        dvs = [c for c in cfg.dvs if c in present]
        target = cfg.target

        # Drop rows missing any required column for a fair, consistent comparison
        needed = mvs + cvs + dvs + [target]
        data = df[needed].dropna().copy()
        n = len(data)
        if n < (cfg.n_splits + 1) * 20:
            raise ValueError(
                f"Not enough clean rows ({n}) for {cfg.n_splits}-fold TimeSeriesSplit"
            )

        tscv = TimeSeriesSplit(n_splits=cfg.n_splits)

        process_fold_metrics: Dict[str, List[Dict[str, float]]] = {cv: [] for cv in cvs}
        quality_measured_folds: List[Dict[str, float]] = []
        full_chain_folds: List[Dict[str, float]] = []

        X_all_mv = data[mvs]

        for fold, (tr_idx, te_idx) in enumerate(tscv.split(data)):
            tr = data.iloc[tr_idx]
            te = data.iloc[te_idx]

            # --- Process models: MV -> each CV ---
            predicted_cv_test = {}
            for cv in cvs:
                _, _, y_pred = self._fit_predict(
                    tr[mvs], tr[cv], te[mvs]
                )
                process_fold_metrics[cv].append(_metrics(te[cv].values, y_pred))
                predicted_cv_test[cv] = y_pred

            # --- Quality model with MEASURED CVs (upper bound) ---
            q_features = cvs + dvs
            _, _, y_pred_q = self._fit_predict(
                tr[q_features], tr[target], te[q_features]
            )
            quality_measured_folds.append(_metrics(te[target].values, y_pred_q))

            # --- FULL CHAIN: quality model trained on measured CVs,
            #     but fed PREDICTED CVs at test time (realistic) ---
            # Re-fit quality model on train (measured), predict using predicted CVs.
            scaler_q = StandardScaler()
            Xq_tr = scaler_q.fit_transform(tr[q_features])
            model_q = xgb.XGBRegressor(**cfg.xgb_params)
            model_q.fit(Xq_tr, tr[target])

            te_chain = pd.DataFrame(index=te.index)
            for cv in cvs:
                te_chain[cv] = predicted_cv_test[cv]
            for dv in dvs:
                te_chain[dv] = te[dv].values
            te_chain = te_chain[q_features]  # enforce column order
            y_pred_chain = model_q.predict(scaler_q.transform(te_chain))
            full_chain_folds.append(_metrics(te[target].values, y_pred_chain))

        result = {
            "label": cfg.label,
            "n_clean_rows": int(n),
            "n_splits": cfg.n_splits,
            "features": {"mvs": mvs, "cvs": cvs, "dvs": dvs, "target": target},
            "process_models": {
                cv: {"folds": process_fold_metrics[cv], "agg": _agg(process_fold_metrics[cv])}
                for cv in cvs
            },
            "quality_model_measured_cv": {
                "folds": quality_measured_folds,
                "agg": _agg(quality_measured_folds),
            },
            "full_chain_predicted_cv": {
                "folds": full_chain_folds,
                "agg": _agg(full_chain_folds),
            },
        }
        return result


def evaluate_cascade(
    df: pd.DataFrame,
    mvs: List[str],
    cvs: List[str],
    dvs: List[str],
    target: str,
    n_splits: int = 5,
    label: str = "baseline",
    xgb_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    cfg = EvalConfig(
        mvs=mvs, cvs=cvs, dvs=dvs, target=target,
        n_splits=n_splits, label=label,
        xgb_params=xgb_params or dict(DEFAULT_XGB_PARAMS),
    )
    return CascadeEvaluator(cfg).evaluate(df)


def print_eval_summary(result: Dict[str, Any]) -> None:
    print("\n" + "=" * 80)
    print(f"CASCADE EVALUATION  [{result['label']}]  "
          f"(leak-free {result['n_splits']}-fold TimeSeriesSplit)")
    print("=" * 80)
    print(f"Clean rows used: {result['n_clean_rows']}")
    f = result["features"]
    print(f"Target: {f['target']}  |  MVs: {f['mvs']}")
    print(f"CVs: {f['cvs']}  |  DVs: {f['dvs']}")
    print("-" * 80)
    print("Process models (MV -> CV):")
    for cv, m in result["process_models"].items():
        a = m["agg"]
        print(f"  {cv:<12} R2={a['r2_mean']:.3f} (+/-{a['r2_std']:.3f})  "
              f"RMSE={a['rmse_mean']:.3f}")
    qa = result["quality_model_measured_cv"]["agg"]
    ca = result["full_chain_predicted_cv"]["agg"]
    print("-" * 80)
    print(f"Quality model (measured CVs)   R2={qa['r2_mean']:.3f} (+/-{qa['r2_std']:.3f})  "
          f"RMSE={qa['rmse_mean']:.3f}   <- upper bound")
    print(f"FULL CHAIN (predicted CVs)     R2={ca['r2_mean']:.3f} (+/-{ca['r2_std']:.3f})  "
          f"RMSE={ca['rmse_mean']:.3f}   <- what matters")
    print("=" * 80 + "\n")
