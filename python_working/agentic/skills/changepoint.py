"""
skills/changepoint.py — Offline changepoint detection.
======================================================
Locates abrupt regime shifts in PSI80 / DensityHC / MotorAmp / Ore time series
using the `ruptures` library when available, with a numpy-only fallback (PELT
on a custom cumulative-sum cost) so the skill never hard-fails.

Use cases:
  • Find when product quality (PSI80) changed character — operator handover,
    feed change, ore-blend transition.
  • Cross-check changepoints against shift boundaries to flag suspicious
    operational events.
  • Provide structured event timestamps for the anomaly_detective and the
    forecaster (Prophet's auto-changepoints can be brittle on minute-level data).
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    import ruptures as _rpt  # type: ignore
    _HAS_RUPTURES = True
except Exception:
    _rpt = None
    _HAS_RUPTURES = False


def _fallback_pelt_mean(values: np.ndarray, penalty: float) -> list[int]:
    """Numpy-only Pelt-like detector on the mean (L2 cost). Returns a list of
    breakpoint indices (excluding the final endpoint). Suitable for a few
    hundred to a few thousand points."""
    n = len(values)
    if n < 20:
        return []
    # Cumulative sums for O(1) segment cost
    cs = np.concatenate([[0.0], np.cumsum(values)])
    cs2 = np.concatenate([[0.0], np.cumsum(values ** 2)])

    def seg_cost(a: int, b: int) -> float:  # cost of values[a:b]
        m = b - a
        if m <= 0:
            return 0.0
        s = cs[b] - cs[a]
        s2 = cs2[b] - cs2[a]
        return float(s2 - (s * s) / m)

    F = np.full(n + 1, np.inf)
    F[0] = -penalty
    last = [0] * (n + 1)
    R = [0]
    for tstar in range(1, n + 1):
        best_val = np.inf
        best_t = 0
        for t in R:
            cand = F[t] + seg_cost(t, tstar) + penalty
            if cand < best_val:
                best_val = cand
                best_t = t
        F[tstar] = best_val
        last[tstar] = best_t
        R = [t for t in R + [tstar] if F[t] + seg_cost(t, tstar) <= F[tstar]]

    # Walk back the optimal partition
    bkps: list[int] = []
    cur = n
    while cur > 0:
        prev = last[cur]
        if prev > 0:
            bkps.append(prev)
        cur = prev
    return sorted(bkps)


def detect_changepoints(
    df: pd.DataFrame,
    column: str,
    n_bkps: int | None = None,
    penalty: float | None = None,
    resample: str = "5min",
    output_dir: str = "output",
) -> dict:
    """
    Detect changepoints in `df[column]`.

    Parameters
    ----------
    column   : numeric column to analyse
    n_bkps   : if set, force this number of breakpoints (ruptures Dynp)
    penalty  : if set (and n_bkps is None), use as PELT penalty (larger ⇒ fewer
               breakpoints). Default: 3 × variance of the resampled series.
    resample : pandas freq string. Minute-level series is downsampled to keep
               the segmentation tractable. Use '1min' to disable.
    """
    os.makedirs(output_dir, exist_ok=True)

    if column not in df.columns:
        return {"figures": [], "stats": {"n": 0, "n_changepoints": 0},
                "summary": f"changepoint: column '{column}' missing."}

    s = df[column].dropna()
    if isinstance(df.index, pd.DatetimeIndex) and resample:
        s = s.resample(resample).mean().dropna()
    n = len(s)
    if n < 30:
        return {"figures": [], "stats": {"n": int(n), "n_changepoints": 0},
                "summary": f"changepoint: too few points ({n}) for {column}."}

    values = s.values.astype(float)
    backend = "ruptures" if _HAS_RUPTURES else "fallback"

    bkps_idx: list[int] = []
    try:
        if _HAS_RUPTURES:
            if n_bkps is not None and n_bkps > 0:
                algo = _rpt.Dynp(model="l2", min_size=max(5, n // 50)).fit(values)
                raw = algo.predict(n_bkps=int(n_bkps))
            else:
                pen = float(penalty) if penalty is not None else float(3.0 * np.var(values))
                algo = _rpt.Pelt(model="l2", min_size=max(5, n // 50)).fit(values)
                raw = algo.predict(pen=pen)
            # ruptures includes the final endpoint; drop it
            bkps_idx = [int(b) for b in raw if 0 < b < n]
        else:
            pen = float(penalty) if penalty is not None else float(3.0 * np.var(values))
            bkps_idx = _fallback_pelt_mean(values, pen)
    except Exception as e:
        return {"figures": [], "stats": {"n": int(n), "n_changepoints": 0, "error": str(e)[:200]},
                "summary": f"changepoint: detection failed for {column}: {e}"}

    # Build segment summaries
    segments = []
    edges = [0] + bkps_idx + [n]
    for a, b in zip(edges[:-1], edges[1:]):
        seg_vals = values[a:b]
        if len(seg_vals) == 0:
            continue
        segments.append({
            "start_idx": int(a),
            "end_idx": int(b),
            "start_ts": str(s.index[a]) if hasattr(s.index, "__getitem__") else None,
            "end_ts": str(s.index[min(b - 1, n - 1)]) if hasattr(s.index, "__getitem__") else None,
            "mean": round(float(np.mean(seg_vals)), 4),
            "std": round(float(np.std(seg_vals)), 4),
            "duration_pts": int(len(seg_vals)),
        })

    # Plot
    fig_path = os.path.join(output_dir, f"changepoints_{column}.png")
    fig, ax = plt.subplots(figsize=(11, 4.2))
    ax.plot(s.index, values, color="#0f172a", lw=0.8, label=column)
    palette = ["#fb7185", "#f59e0b", "#10b981", "#6366f1", "#a855f7", "#06b6d4"]
    for i, b in enumerate(bkps_idx):
        ax.axvline(s.index[b], color=palette[i % len(palette)], lw=1.5, ls="--",
                   label=f"cp #{i+1}")
    # Shade segment means
    for seg in segments:
        ax.hlines(seg["mean"], s.index[seg["start_idx"]],
                  s.index[min(seg["end_idx"] - 1, n - 1)],
                  colors="#10b981", lw=2.0, alpha=0.7)
    ax.set_title(f"Changepoints in {column}  (n={n}, {len(bkps_idx)} cps, backend={backend})")
    ax.set_ylabel(column)
    ax.grid(alpha=0.3)
    if bkps_idx:
        ax.legend(loc="upper right", ncol=min(4, len(bkps_idx) + 1), fontsize=8)
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    stats = {
        "n": int(n),
        "n_changepoints": len(bkps_idx),
        "backend": backend,
        "column": column,
        "segments": segments[:20],  # cap to keep payload small
    }

    if bkps_idx:
        diffs = [round(segments[i + 1]["mean"] - segments[i]["mean"], 4)
                 for i in range(len(segments) - 1)]
        stats["segment_mean_jumps"] = diffs
        max_jump = max(diffs, key=lambda v: abs(v)) if diffs else 0.0
        stats["max_abs_jump"] = round(float(abs(max_jump)), 4)
    else:
        stats["max_abs_jump"] = 0.0

    if bkps_idx:
        ts_list = [str(s.index[b]) for b in bkps_idx]
        summary = (
            f"Changepoint analysis for {column} ({backend}, resampled {resample}, n={n}):\n"
            f"  Detected {len(bkps_idx)} changepoint(s).\n"
            f"  Timestamps: {ts_list}\n"
            f"  Segment means: {[seg['mean'] for seg in segments]}\n"
            f"  Largest absolute jump between adjacent segments: {stats['max_abs_jump']}"
        )
    else:
        summary = f"Changepoint analysis for {column}: no significant breakpoints detected (n={n})."

    return {"figures": [fig_path], "stats": stats, "summary": summary}


def changepoints_vs_shifts(
    df: pd.DataFrame,
    column: str = "PSI80",
    output_dir: str = "output",
) -> dict:
    """
    Detect changepoints and report how many fall within ±20 minutes of a
    shift boundary (06:00 / 14:00 / 22:00). High overlap suggests the regime
    change is operator-driven; low overlap suggests it's process-physics-driven.
    """
    res = detect_changepoints(df, column, output_dir=output_dir)
    figures = list(res.get("figures", []))
    stats = dict(res.get("stats", {}))

    if not isinstance(df.index, pd.DatetimeIndex) or stats.get("n_changepoints", 0) == 0:
        stats["shift_aligned_count"] = 0
        stats["shift_aligned_pct"] = 0.0
        return {"figures": figures, "stats": stats, "summary": res["summary"]}

    # Re-derive timestamps from the segments list
    cp_ts = [pd.Timestamp(seg["end_ts"]) for seg in stats.get("segments", [])[:-1]]
    if not cp_ts:
        return {"figures": figures, "stats": stats, "summary": res["summary"]}

    SHIFT_HOURS = (6, 14, 22)
    aligned = 0
    aligned_list = []
    for ts in cp_ts:
        for h in SHIFT_HOURS:
            boundary = ts.normalize() + pd.Timedelta(hours=h)
            if abs((ts - boundary).total_seconds()) <= 20 * 60:  # ±20 minutes
                aligned += 1
                aligned_list.append({"changepoint_ts": str(ts), "near_shift_h": h})
                break

    stats["shift_aligned_count"] = int(aligned)
    stats["shift_aligned_pct"] = round(100.0 * aligned / len(cp_ts), 1)
    stats["shift_aligned_events"] = aligned_list[:10]

    summary = (
        res["summary"]
        + f"\n  Shift-boundary alignment: {aligned}/{len(cp_ts)} "
        + f"changepoint(s) within ±20 min of 06:00/14:00/22:00 "
        + f"({stats['shift_aligned_pct']}%)."
    )
    return {"figures": figures, "stats": stats, "summary": summary}
