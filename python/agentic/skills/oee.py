"""
skills/oee.py — Overall Equipment Effectiveness (OEE) calculations for ball mills.
====================================================================================

OEE = Availability × Performance × Quality

Plant-specific configuration (Ellatzite ore-dressing factory):
  • Speed/Performance reference  : Ore = 180 t/h  →  100% performance
  • Quality band (linear)        : PSI200 ≤ 18%   →  100% quality (zero scrap)
                                    PSI200 ≥ 30%   →  0%   quality (full scrap)
                                    between        →  linear interpolation
  • Availability threshold       : Ore < 50 t/h   →  considered DOWNTIME

All ratios are computed using ratio-of-totals on running minutes (the mathematically
correct way — see DOMAIN_CONTEXT in graph_v3.py for the full rationale).
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


# ── Plant-specific OEE constants ────────────────────────────────────────────

OEE_SPEED_REF_TPH = 180.0          # Ore @ 100% performance
OEE_QUALITY_PSI200_FLOOR = 18.0    # PSI200 (%) at or below which quality = 100%
OEE_QUALITY_PSI200_LIMIT = 30.0    # PSI200 (%) at or above which quality = 0%
OEE_DOWNTIME_THRESHOLD_TPH = 50.0  # Ore below this = downtime
DEFAULT_SHIFTS = {
    1: {"start": 6, "end": 14, "label": "Shift 1 (06-14)"},
    2: {"start": 14, "end": 22, "label": "Shift 2 (14-22)"},
    3: {"start": 22, "end": 6, "label": "Shift 3 (22-06)"},
}


# ── Internal helpers ────────────────────────────────────────────────────────

def _safe_pct(numer: float, denom: float) -> float:
    """Return numer/denom * 100 with safe handling of zero denominators."""
    if denom is None or denom == 0:
        return 0.0
    return float(numer) / float(denom) * 100.0


def _components(df: pd.DataFrame, ore_col: str, quality_col: str,
                speed_ref: float, quality_floor: float, quality_limit: float,
                downtime_threshold: float) -> dict:
    """
    Compute the three OEE components on a DataFrame slice.
    Assumes minute-level sampling (typical for mill_data_*).

    Availability  = running_minutes / total_minutes
                    where running := Ore >= downtime_threshold
    Performance   = mean(Ore[running]) / speed_ref, capped at 1.0
    Quality       = clamp((quality_limit - mean(PSI200[running])) /
                          (quality_limit - quality_floor), 0, 1)
                    (linear band: PSI200 ≤ floor → Q=1, PSI200 ≥ limit → Q=0)
    OEE           = A × P × Q (all in the [0, 1] range, reported as %)

    Also returns auxiliary diagnostics: in-spec fraction by minute, performance
    samples capped count, throughput, and downtime hours.
    """
    out = {
        "availability_pct": 0.0,
        "performance_pct": 0.0,
        "quality_pct": 0.0,
        "oee_pct": 0.0,
        "running_minutes": 0,
        "total_minutes": int(len(df)),
        "downtime_minutes": int(len(df)),
        "downtime_hours": 0.0,
        "throughput_running_tph": None,
        "psi200_running_mean": None,
        "psi200_in_spec_pct": None,
        "speed_ref_tph": speed_ref,
        "quality_floor_psi200": quality_floor,
        "quality_limit_psi200": quality_limit,
        "downtime_threshold_tph": downtime_threshold,
    }
    if ore_col not in df.columns:
        return out

    ore = df[ore_col]
    running_mask = ore >= downtime_threshold
    running_minutes = int(running_mask.sum())
    total_minutes = int(len(df))
    out["running_minutes"] = running_minutes
    out["total_minutes"] = total_minutes
    out["downtime_minutes"] = total_minutes - running_minutes
    out["downtime_hours"] = round((total_minutes - running_minutes) / 60.0, 2)

    if total_minutes == 0:
        return out

    # ── Availability ────────────────────────────────────────────────────
    availability = running_minutes / total_minutes
    out["availability_pct"] = round(availability * 100.0, 2)

    if running_minutes == 0:
        return out

    running = df[running_mask]
    ore_run = running[ore_col].astype(float)

    # ── Performance ─────────────────────────────────────────────────────
    # ratio-of-means: mean throughput / reference throughput, capped at 1.0
    throughput = float(ore_run.mean())
    out["throughput_running_tph"] = round(throughput, 2)
    performance = min(throughput / speed_ref, 1.0) if speed_ref > 0 else 0.0
    out["performance_pct"] = round(performance * 100.0, 2)

    # ── Quality ────────────────────────────────────────────────────────
    # Linear band: PSI200 ≤ quality_floor → Q=100%; PSI200 ≥ quality_limit → Q=0%.
    # In between, quality decreases linearly. This matches the plant convention
    # where 18% +200μm is the operational target (zero scrap) and 30% is the
    # absolute upper limit (full scrap).
    if quality_col in running.columns:
        psi = running[quality_col].astype(float).dropna()
        if len(psi) > 0:
            psi_mean = float(psi.mean())
            out["psi200_running_mean"] = round(psi_mean, 3)
            # Fraction of minutes at or below the floor (truly in-spec).
            in_spec = float((psi <= quality_floor).mean()) * 100.0
            out["psi200_in_spec_pct"] = round(in_spec, 2)
            # Fraction of minutes above the upper limit (full scrap).
            over_limit = float((psi >= quality_limit).mean()) * 100.0
            out["psi200_over_limit_pct"] = round(over_limit, 2)
            band = quality_limit - quality_floor
            if band > 0:
                quality = (quality_limit - psi_mean) / band
            else:
                quality = 1.0 if psi_mean <= quality_floor else 0.0
            quality = max(0.0, min(1.0, quality))
            out["quality_pct"] = round(quality * 100.0, 2)
        else:
            quality = 0.0
    else:
        # No quality column — fall back to 1.0 so OEE = A × P. Flag it.
        quality = 1.0
        out["quality_pct"] = 100.0
        out["quality_note"] = f"Column '{quality_col}' not present — quality defaulted to 100%."

    out["oee_pct"] = round(availability * performance * quality * 100.0, 2)
    return out


# ── Public skill: per-shift OEE ─────────────────────────────────────────────

def shift_oee(df: pd.DataFrame, ore_col: str = "Ore",
              quality_col: str = "PSI200",
              speed_ref: float = OEE_SPEED_REF_TPH,
              quality_floor: float = OEE_QUALITY_PSI200_FLOOR,
              quality_limit: float = OEE_QUALITY_PSI200_LIMIT,
              downtime_threshold: float = OEE_DOWNTIME_THRESHOLD_TPH,
              output_dir: str = "output") -> dict:
    """
    Compute OEE for a single mill broken down by shift (1, 2, 3) plus an
    'overall' bucket aggregating the entire DataFrame.

    OEE = Availability × Performance × Quality, where:
      • Availability = running_minutes / total_minutes  (running := Ore ≥ downtime_threshold)
      • Performance  = mean(Ore[running]) / speed_ref   (capped at 1.0)
      • Quality      = clamp((quality_limit - mean(PSI200[running])) /
                             (quality_limit - quality_floor), 0, 1)
        — linear band: PSI200 ≤ quality_floor → Q=100%; PSI200 ≥ quality_limit → Q=0%.

    Plant defaults (Ellatzite): speed_ref=180 t/h, quality_floor=18 % PSI200,
    quality_limit=30 % PSI200, downtime_threshold=50 t/h.

    Returns:
        {"figures": [path], "stats": {shift_1, shift_2, shift_3, overall}, "summary": str}
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        df = df.copy()
        df.index = pd.to_datetime(df.index)

    if "shift" not in df.columns:
        hours = df.index.hour
        df = df.copy()
        df["shift"] = np.where(
            (hours >= 6) & (hours < 14), 1,
            np.where((hours >= 14) & (hours < 22), 2, 3),
        )

    stats = {}
    for shift_num in [1, 2, 3]:
        shift_df = df[df["shift"] == shift_num]
        comp = _components(shift_df, ore_col, quality_col, speed_ref,
                           quality_floor, quality_limit, downtime_threshold)
        comp["label"] = DEFAULT_SHIFTS[shift_num]["label"]
        stats[f"shift_{shift_num}"] = comp

    overall = _components(df, ore_col, quality_col, speed_ref,
                          quality_floor, quality_limit, downtime_threshold)
    overall["label"] = "Overall"
    stats["overall"] = overall

    # ── Plot: OEE breakdown by shift ────────────────────────────────────
    figures = []
    try:
        os.makedirs(output_dir, exist_ok=True)
        fig, ax = plt.subplots(figsize=(10, 6))

        labels = ["Shift 1 (06-14)", "Shift 2 (14-22)", "Shift 3 (22-06)", "Overall"]
        keys = ["shift_1", "shift_2", "shift_3", "overall"]

        availability = [stats[k]["availability_pct"] for k in keys]
        performance = [stats[k]["performance_pct"] for k in keys]
        quality = [stats[k]["quality_pct"] for k in keys]
        oee = [stats[k]["oee_pct"] for k in keys]

        x = np.arange(len(labels))
        width = 0.2
        ax.bar(x - 1.5 * width, availability, width, label="Availability %", color="#2196F3")
        ax.bar(x - 0.5 * width, performance, width, label="Performance %", color="#FF9800")
        ax.bar(x + 0.5 * width, quality, width, label="Quality %", color="#4CAF50")
        ax.bar(x + 1.5 * width, oee, width, label="OEE %", color="#9C27B0", edgecolor="black")

        ax.set_xticks(x)
        ax.set_xticklabels(labels)
        ax.set_ylabel("Percent (%)")
        ax.set_ylim(0, 105)
        ax.set_title(
            f"OEE by shift  (speed={speed_ref:.0f} t/h, "
            f"quality PSI200 {quality_floor:.0f}\u2013{quality_limit:.0f}%, "
            f"downtime <{downtime_threshold:.0f} t/h)",
            fontsize=11, fontweight="bold",
        )
        ax.grid(True, alpha=0.3, axis="y")
        ax.legend(loc="upper left", fontsize=9)

        # Annotate OEE bars with values
        for xi, val in zip(x + 1.5 * width, oee):
            ax.text(xi, val + 1.5, f"{val:.1f}", ha="center", fontsize=8, fontweight="bold")

        plt.tight_layout()
        path = os.path.join(output_dir, "oee_by_shift.png")
        plt.savefig(path, dpi=150, bbox_inches="tight")
        plt.close()
        figures.append(path)
    except Exception as e:
        print(f"[oee.shift_oee] Chart generation failed: {e}")

    # ── Summary ─────────────────────────────────────────────────────────
    lines = [
        "OEE Summary (config: speed_ref=%.0f t/h, quality_PSI200 band=%.0f-%.0f%% (floor-limit), downtime<%.0f t/h):"
        % (speed_ref, quality_floor, quality_limit, downtime_threshold)
    ]
    for k in ["shift_1", "shift_2", "shift_3", "overall"]:
        s = stats[k]
        lines.append(
            "  %-18s A=%5.1f%%  P=%5.1f%%  Q=%5.1f%%  →  OEE=%5.1f%%  "
            "(throughput=%s t/h, PSI200_mean=%s, downtime=%.1f h)"
            % (
                s["label"],
                s["availability_pct"],
                s["performance_pct"],
                s["quality_pct"],
                s["oee_pct"],
                s["throughput_running_tph"] if s["throughput_running_tph"] is not None else "N/A",
                s["psi200_running_mean"] if s["psi200_running_mean"] is not None else "N/A",
                s["downtime_hours"],
            )
        )
    return {"figures": figures, "stats": stats, "summary": "\n".join(lines)}


# ── Public skill: multi-mill OEE ranking ────────────────────────────────────

def multi_mill_oee(mill_dfs: dict, ore_col: str = "Ore",
                   quality_col: str = "PSI200",
                   speed_ref: float = OEE_SPEED_REF_TPH,
                   quality_floor: float = OEE_QUALITY_PSI200_FLOOR,
                   quality_limit: float = OEE_QUALITY_PSI200_LIMIT,
                   downtime_threshold: float = OEE_DOWNTIME_THRESHOLD_TPH,
                   output_dir: str = "output") -> dict:
    """
    Rank multiple mills by OEE. Pass a dict mapping mill labels to DataFrames,
    e.g. {"Mill 4": df4, "Mill 6": df6, "Mill 7": df7, "Mill 8": df8}.

    Returns:
        {"figures": [path], "stats": {mill_label: {A, P, Q, OEE, ...}}, "summary": str}
    """
    if not isinstance(mill_dfs, dict) or not mill_dfs:
        return {"figures": [], "stats": {}, "summary": "No mill data provided."}

    stats = {}
    for label, df in mill_dfs.items():
        if df is None or len(df) == 0:
            continue
        comp = _components(df, ore_col, quality_col, speed_ref,
                           quality_floor, quality_limit, downtime_threshold)
        stats[label] = comp

    # Sort by OEE descending for the chart
    ranked = sorted(stats.items(), key=lambda kv: kv[1]["oee_pct"], reverse=True)

    figures = []
    try:
        os.makedirs(output_dir, exist_ok=True)
        labels = [r[0] for r in ranked]
        availability = [r[1]["availability_pct"] for r in ranked]
        performance = [r[1]["performance_pct"] for r in ranked]
        quality = [r[1]["quality_pct"] for r in ranked]
        oee = [r[1]["oee_pct"] for r in ranked]

        fig, ax = plt.subplots(figsize=(max(8, 1.4 * len(labels) + 4), 6))
        x = np.arange(len(labels))
        width = 0.2
        ax.bar(x - 1.5 * width, availability, width, label="Availability %", color="#2196F3")
        ax.bar(x - 0.5 * width, performance, width, label="Performance %", color="#FF9800")
        ax.bar(x + 0.5 * width, quality, width, label="Quality %", color="#4CAF50")
        ax.bar(x + 1.5 * width, oee, width, label="OEE %", color="#9C27B0", edgecolor="black")
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=20, ha="right")
        ax.set_ylabel("Percent (%)")
        ax.set_ylim(0, 105)
        ax.set_title(
            f"OEE per mill (ranked)  speed={speed_ref:.0f} t/h, "
            f"quality PSI200 {quality_floor:.0f}\u2013{quality_limit:.0f}%, "
            f"downtime<{downtime_threshold:.0f} t/h",
            fontsize=11, fontweight="bold",
        )
        ax.grid(True, alpha=0.3, axis="y")
        ax.legend(loc="upper right", fontsize=9)

        for xi, val in zip(x + 1.5 * width, oee):
            ax.text(xi, val + 1.5, f"{val:.1f}", ha="center", fontsize=8, fontweight="bold")

        plt.tight_layout()
        path = os.path.join(output_dir, "oee_per_mill.png")
        plt.savefig(path, dpi=150, bbox_inches="tight")
        plt.close()
        figures.append(path)
    except Exception as e:
        print(f"[oee.multi_mill_oee] Chart generation failed: {e}")

    lines = [
        "Multi-mill OEE ranking (config: speed=%.0f t/h, quality_PSI200 band=%.0f-%.0f%%, downtime<%.0f t/h):"
        % (speed_ref, quality_floor, quality_limit, downtime_threshold)
    ]
    for label, s in ranked:
        lines.append(
            "  %-12s A=%5.1f%%  P=%5.1f%%  Q=%5.1f%%  →  OEE=%5.1f%%  "
            "(throughput=%s t/h, PSI200_mean=%s, downtime=%.1f h)"
            % (
                label,
                s["availability_pct"],
                s["performance_pct"],
                s["quality_pct"],
                s["oee_pct"],
                s["throughput_running_tph"] if s["throughput_running_tph"] is not None else "N/A",
                s["psi200_running_mean"] if s["psi200_running_mean"] is not None else "N/A",
                s["downtime_hours"],
            )
        )

    return {"figures": figures, "stats": stats, "summary": "\n".join(lines)}
