"""
skills/shift_kpi.py -- Shift-based KPI and operational analysis functions.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


# Default shift boundaries (Ellatzite 3-shift schedule)
DEFAULT_SHIFTS = {
    1: {"start": 6, "end": 14, "label": "Shift 1 (06-14)"},
    2: {"start": 14, "end": 22, "label": "Shift 2 (14-22)"},
    3: {"start": 22, "end": 6, "label": "Shift 3 (22-06)"},
}


def assign_shifts(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a 'shift' column (1, 2, or 3) based on the DatetimeIndex hour.
    Returns a copy of the DataFrame with the shift column added.
    """
    df = df.copy()
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index)

    hours = df.index.hour
    df["shift"] = np.where(
        (hours >= 6) & (hours < 14), 1,
        np.where((hours >= 14) & (hours < 22), 2, 3)
    )
    df["shift_date"] = df.index.date
    return df


def shift_kpis(df: pd.DataFrame, columns: list = None,
               ore_col: str = "Ore", power_col: str = "Power",
               downtime_threshold: float = 10.0) -> dict:
    """
    Calculate KPIs per shift: mean, std, uptime, downtime, throughput,
    and — crucially — specific energy (kWh/t) computed as
    ratio-of-totals on running minutes.

    For specific energy we use:
        kwh_per_ton = sum(Power[running]) / sum(Ore[running])

    This is the PHYSICALLY CORRECT way (total energy delivered / total tonnage).
    The naïve `mean(Power/Ore)` (mean-of-ratios) is NOT used because:
      • It explodes when Ore → 0 during startups, feeder changes, idling.
      • Those minute-level spikes inflate the mean far above the true energy
        intensity, and systematically penalise shifts that have more short
        transitions — producing artefactual "efficiency" differences.
      • Ratio-of-totals is invariant to downtime distribution and matches the
        metric a utility bill or a mass/energy balance would report.
    A robust median of per-minute kWh/t is also reported as a secondary check.

    Returns:
        {"figures": [], "stats": {shift_1: {...}, ...}, "summary": str}
    """
    if "shift" not in df.columns:
        df = assign_shifts(df)

    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
        columns = [c for c in columns if c not in ["shift", "shift_date"]]

    stats = {}
    for shift_num in [1, 2, 3]:
        shift_data = df[df["shift"] == shift_num]
        label = DEFAULT_SHIFTS[shift_num]["label"]
        shift_stats = {"label": label, "data_points": len(shift_data)}

        for col in columns:
            if col in shift_data.columns:
                vals = shift_data[col].dropna()
                shift_stats[col] = {
                    "mean": round(float(vals.mean()), 2) if len(vals) > 0 else None,
                    "std": round(float(vals.std()), 2) if len(vals) > 0 else None,
                    "min": round(float(vals.min()), 2) if len(vals) > 0 else None,
                    "max": round(float(vals.max()), 2) if len(vals) > 0 else None,
                }

        # Uptime/downtime based on Ore
        if ore_col in shift_data.columns:
            ore = shift_data[ore_col].dropna()
            running_mask_ore = ore >= downtime_threshold
            running = int(running_mask_ore.sum())
            total = len(ore)
            uptime_pct = round(running / total * 100, 1) if total > 0 else 0
            shift_stats["uptime_pct"] = uptime_pct
            shift_stats["downtime_pct"] = round(100 - uptime_pct, 1)
            shift_stats["throughput_mean"] = round(float(ore[running_mask_ore].mean()), 1) if running > 0 else 0

        # Specific energy (kWh/t) — correct ratio-of-totals on running minutes.
        # kW × (1 min / 60) gives kWh per minute; t/h × (1 min / 60) gives t per
        # minute; the 1/60 factors cancel, so sum(Power)/sum(Ore) directly yields
        # kWh/t as long as both series are sampled at the same cadence.
        if ore_col in shift_data.columns and power_col in shift_data.columns:
            pair = shift_data[[ore_col, power_col]].dropna()
            running_pair = pair[pair[ore_col] >= downtime_threshold]
            total_ore = float(running_pair[ore_col].sum())
            total_power = float(running_pair[power_col].sum())
            if total_ore > 0 and len(running_pair) > 0:
                kwh_per_ton_totals = total_power / total_ore
                # Robust secondary metric: median of per-minute Power/Ore on
                # the same running subset. Immune to extreme spikes.
                per_min_ratio = running_pair[power_col] / running_pair[ore_col]
                kwh_per_ton_median = float(per_min_ratio.median())
                # Diagnostic only: mean-of-ratios on the SAME running subset,
                # so the LLM can see how much it inflates vs ratio-of-totals.
                kwh_per_ton_mean_of_ratios = float(per_min_ratio.mean())
                shift_stats["specific_energy"] = {
                    "method": "ratio_of_totals",
                    "kwh_per_ton": round(kwh_per_ton_totals, 3),
                    "kwh_per_ton_median": round(kwh_per_ton_median, 3),
                    "kwh_per_ton_mean_of_ratios_BIASED": round(kwh_per_ton_mean_of_ratios, 3),
                    "running_minutes": int(len(running_pair)),
                    "total_energy_kwh_per_min_units": round(total_power, 1),
                    "total_ore_tph_min_units": round(total_ore, 1),
                }

        stats["shift_%d" % shift_num] = shift_stats

    lines = ["Shift KPI Summary:"]
    for key, s in stats.items():
        lines.append("  %s: %d pts" % (s["label"], s["data_points"]))
        if "uptime_pct" in s:
            lines.append("    Uptime: %.1f%%, Throughput: %s t/h"
                         % (s["uptime_pct"], s.get("throughput_mean", "N/A")))
        se = s.get("specific_energy")
        if se:
            lines.append(
                "    Specific energy (sum(Power)/sum(Ore), running only): %.2f kWh/t "
                "| median per-min: %.2f | mean-of-ratios (BIASED, do not use): %.2f"
                % (se["kwh_per_ton"], se["kwh_per_ton_median"],
                   se["kwh_per_ton_mean_of_ratios_BIASED"])
            )

    lines.append("")
    lines.append("NOTE: For specific energy always use 'kwh_per_ton' (ratio-of-totals).")
    lines.append("The 'kwh_per_ton_mean_of_ratios_BIASED' field is included ONLY as a")
    lines.append("diagnostic — it is inflated by minutes near the Ore threshold and must")
    lines.append("NOT be reported as the shift's specific energy.")

    return {"figures": [], "stats": stats, "summary": "\n".join(lines)}


def shift_comparison_chart(df: pd.DataFrame, columns: list = None,
                           output_dir: str = "output") -> dict:
    """
    Generate box plots comparing shifts for selected variables.

    Returns:
        {"figures": [path], "stats": {}, "summary": str}
    """
    if "shift" not in df.columns:
        df = assign_shifts(df)

    if columns is None:
        columns = [c for c in df.select_dtypes(include=[np.number]).columns
                   if c not in ["shift", "shift_date"]][:6]
    columns = [c for c in columns if c in df.columns]

    n = len(columns)
    if n == 0:
        return {"figures": [], "stats": {}, "summary": "No columns to compare."}

    ncols = min(3, n)
    nrows = (n + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 4 * nrows))
    if n == 1:
        axes = np.array([axes])
    axes = axes.flatten() if hasattr(axes, "flatten") else [axes]

    shift_labels = {1: "Shift 1", 2: "Shift 2", 3: "Shift 3"}
    colors = {1: "#2196F3", 2: "#FF9800", 3: "#4CAF50"}

    for i, col in enumerate(columns):
        ax = axes[i]
        data_by_shift = [df[df["shift"] == s][col].dropna().values for s in [1, 2, 3]]
        bp = ax.boxplot(data_by_shift, labels=[shift_labels[s] for s in [1, 2, 3]],
                        patch_artist=True, widths=0.6)
        for j, patch in enumerate(bp["boxes"]):
            patch.set_facecolor(colors[j + 1])
            patch.set_alpha(0.7)
        ax.set_title(col, fontsize=10, fontweight="bold")
        ax.grid(True, alpha=0.3, axis="y")

    for i in range(n, len(axes)):
        axes[i].set_visible(False)

    fig.suptitle("Shift Comparison", fontsize=13, fontweight="bold", y=1.02)
    plt.tight_layout()

    path = os.path.join(output_dir, "shift_comparison.png")
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()

    return {"figures": [path], "stats": {}, "summary": "Shift comparison charts for %s." % ", ".join(columns)}


def downtime_analysis(df: pd.DataFrame, ore_col: str = "Ore",
                      threshold: float = 10.0, output_dir: str = "output") -> dict:
    """
    Analyze downtime periods (Ore < threshold).

    Returns:
        {"figures": [path], "stats": {total_downtime_hours, n_events, events: [...]}, "summary": str}
    """
    if ore_col not in df.columns:
        return {"figures": [], "stats": {}, "summary": "Column '%s' not found." % ore_col}

    data = df[ore_col].dropna()
    if len(data) == 0:
        return {"figures": [], "stats": {}, "summary": "No data for downtime analysis."}

    is_down = data < threshold

    # Find contiguous downtime events
    events = []
    in_event = False
    event_start = None

    for idx, down in is_down.items():
        if down and not in_event:
            in_event = True
            event_start = idx
        elif not down and in_event:
            in_event = False
            events.append({"start": event_start, "end": idx})

    if in_event:
        events.append({"start": event_start, "end": data.index[-1]})

    # Calculate durations
    for ev in events:
        duration = (pd.Timestamp(ev["end"]) - pd.Timestamp(ev["start"])).total_seconds() / 3600
        ev["duration_hours"] = round(duration, 2)
        ev["start"] = str(ev["start"])
        ev["end"] = str(ev["end"])

    total_downtime = sum(e["duration_hours"] for e in events)
    total_hours = 0
    if isinstance(data.index, pd.DatetimeIndex) and len(data) > 1:
        total_hours = (data.index[-1] - data.index[0]).total_seconds() / 3600

    downtime_pct = round(total_downtime / total_hours * 100, 1) if total_hours > 0 else 0

    # Sort events by duration (longest first)
    events.sort(key=lambda x: x["duration_hours"], reverse=True)

    # Plot
    fig, axes = plt.subplots(2, 1, figsize=(16, 8), sharex=True)

    ax1 = axes[0]
    ax1.plot(data.index, data.values, alpha=0.7, linewidth=0.5, color="steelblue")
    ax1.axhline(threshold, color="red", linestyle="--", linewidth=1, label="Threshold = %.0f" % threshold)
    ax1.fill_between(data.index, 0, data.values, where=is_down.values, alpha=0.3, color="red", label="Downtime")
    ax1.set_ylabel(ore_col)
    ax1.set_title("Downtime Analysis (%d events, %.1f hours total, %.1f%%)" % (len(events), total_downtime, downtime_pct),
                  fontsize=12, fontweight="bold")
    ax1.legend(fontsize=8)
    ax1.grid(True, alpha=0.3)

    # Downtime event bars
    ax2 = axes[1]
    top_events = events[:20]
    if top_events:
        bars = range(len(top_events))
        durations = [e["duration_hours"] for e in top_events]
        labels = [e["start"][:16] for e in top_events]
        ax2.barh(bars, durations, color="salmon", edgecolor="red", alpha=0.7)
        ax2.set_yticks(bars)
        ax2.set_yticklabels(labels, fontsize=7)
        ax2.set_xlabel("Duration (hours)")
        ax2.set_title("Top Downtime Events", fontsize=11)
        ax2.grid(True, alpha=0.3, axis="x")

    plt.tight_layout()
    path = os.path.join(output_dir, "downtime_analysis.png")
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()

    stats = {
        "total_downtime_hours": round(total_downtime, 2),
        "n_events": len(events),
        "downtime_pct": downtime_pct,
        "total_period_hours": round(total_hours, 2),
        "top_events": events[:10],
    }

    lines = ["Downtime Analysis (threshold = %.0f t/h):" % threshold]
    lines.append("  Events: %d, Total downtime: %.1f hours (%.1f%%)" % (len(events), total_downtime, downtime_pct))
    for i, ev in enumerate(events[:5]):
        lines.append("  #%d: %s, duration %.1fh" % (i + 1, ev["start"][:16], ev["duration_hours"]))

    return {"figures": [path], "stats": stats, "summary": "\n".join(lines)}
