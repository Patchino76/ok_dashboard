"""
skills/energy.py — Specific energy & grinding-efficiency analytics.
====================================================================
Domain-specific metrics for ball-mill operation that require ratio-of-totals
aggregation (per the plant's statistical-integrity rules) and a Bond/
Rittinger-style decomposition of grinding work.

Key outputs:
  • specific_energy(df) — kWh/ton ratio-of-totals, with running-only filter,
    median-of-ratios cross-check, and per-shift breakdown
  • bond_work_index(df) — empirical Bond Wi proxy from Power, Ore, PSI80
    (calibrated, not absolute — comparative use only)
  • efficiency_envelope(df) — kWh/ton vs Ore plot identifying the
    Pareto-efficient operating envelope of the mill
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


_RUNNING_ORE = 50.0   # t/h threshold for "running" minutes (matches OEE config)


def _running_mask(df: pd.DataFrame, ore_col: str = "Ore") -> pd.Series:
    if ore_col not in df.columns:
        return pd.Series(False, index=df.index)
    return df[ore_col] >= _RUNNING_ORE


def specific_energy(
    df: pd.DataFrame,
    ore_col: str = "Ore",
    power_col: str = "Power",
    output_dir: str = "output",
) -> dict:
    """
    Compute kWh/ton via ratio-of-totals (the only correct aggregation for
    ratio metrics — see plant rules). Reports:
      • overall kWh/ton on running minutes
      • median of per-minute Power/Ore on the SAME running subset (cross-check)
      • per-shift kWh/ton (ratio-of-totals within each shift)
      • a histogram of per-minute ratios so the user can see distribution shape
    """
    os.makedirs(output_dir, exist_ok=True)

    if ore_col not in df.columns or power_col not in df.columns:
        return {
            "figures": [], "stats": {},
            "summary": f"specific_energy: missing column ({ore_col} or {power_col}).",
        }

    running = _running_mask(df, ore_col)
    n_total = int(len(df))
    n_run = int(running.sum())
    if n_run < 30:
        return {
            "figures": [], "stats": {"n_running": n_run, "n_total": n_total},
            "summary": f"specific_energy: too few running minutes ({n_run}).",
        }

    sub = df.loc[running, [ore_col, power_col]].dropna()
    # CORRECT: ratio of totals
    total_kwh_per_min = float(sub[power_col].sum()) / 60.0   # kWh per minute (Power kW × 1/60 h)
    total_tons = float(sub[ore_col].sum()) / 60.0            # tons in subset (Ore t/h × 1/60 h)
    kwh_per_ton = (total_kwh_per_min / total_tons) if total_tons > 0 else float("nan")

    # CROSS-CHECK: median of per-minute ratios (NOT to be reported as headline)
    per_min_ratio = (sub[power_col] / 60.0) / (sub[ore_col] / 60.0)
    per_min_ratio = per_min_ratio.replace([np.inf, -np.inf], np.nan).dropna()
    median_ratio = float(per_min_ratio.median()) if len(per_min_ratio) else float("nan")

    # Per-shift breakdown (if shift column present)
    shift_breakdown: dict = {}
    if "shift" in df.columns:
        for shift_id, group in df.loc[running].groupby("shift"):
            g = group[[ore_col, power_col]].dropna()
            if len(g) < 10:
                continue
            kwh = float(g[power_col].sum()) / 60.0
            tons = float(g[ore_col].sum()) / 60.0
            shift_breakdown[str(shift_id)] = {
                "n": int(len(g)),
                "kwh_per_ton": round(kwh / tons, 4) if tons > 0 else None,
                "mean_ore": round(float(g[ore_col].mean()), 2),
                "mean_power": round(float(g[power_col].mean()), 2),
            }

    # ── Plot
    fig_path = os.path.join(output_dir, "specific_energy_distribution.png")
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
    # Hist of per-minute ratios
    axes[0].hist(per_min_ratio.clip(0, np.percentile(per_min_ratio, 99)), bins=60,
                 color="#0ea5e9", edgecolor="black", alpha=0.8)
    axes[0].axvline(kwh_per_ton, color="red", lw=2, label=f"ratio-of-totals = {kwh_per_ton:.3f}")
    axes[0].axvline(median_ratio, color="orange", lw=2, ls="--",
                    label=f"median per-min = {median_ratio:.3f}")
    axes[0].set_xlabel("kWh / ton (per-minute)")
    axes[0].set_ylabel("Count")
    axes[0].set_title(f"Distribution of per-minute kWh/ton (running, n={n_run})")
    axes[0].legend()
    axes[0].grid(alpha=0.3)

    # Per-shift bar chart
    if shift_breakdown:
        shifts = list(shift_breakdown.keys())
        kwhs = [shift_breakdown[s]["kwh_per_ton"] or 0 for s in shifts]
        axes[1].bar(shifts, kwhs, color="#10b981", edgecolor="black")
        axes[1].axhline(kwh_per_ton, color="red", ls="--", lw=1.5, label="overall")
        axes[1].set_title("Specific energy by shift (ratio-of-totals)")
        axes[1].set_ylabel("kWh / ton")
        axes[1].legend()
        axes[1].grid(axis="y", alpha=0.3)
    else:
        axes[1].axis("off")
        axes[1].text(0.5, 0.5, "No 'shift' column —\nrun shift_kpi.assign_shifts first",
                     ha="center", va="center", fontsize=11)

    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    stats = {
        "n_running_minutes": n_run,
        "n_total_minutes": n_total,
        "uptime_pct": round(100.0 * n_run / max(n_total, 1), 2),
        "kwh_per_ton_ratio_of_totals": round(kwh_per_ton, 4),
        "kwh_per_ton_median_per_min": round(median_ratio, 4),
        "ratio_disagreement_pct": (
            round(100.0 * abs(kwh_per_ton - median_ratio) / max(kwh_per_ton, 1e-6), 2)
            if np.isfinite(kwh_per_ton) and np.isfinite(median_ratio) else None
        ),
        "shift_breakdown": shift_breakdown,
    }

    summary = (
        f"Specific energy on running minutes (Ore ≥ {_RUNNING_ORE} t/h, "
        f"n={n_run}/{n_total}, uptime {stats['uptime_pct']}%):\n"
        f"  kWh/ton (ratio-of-totals)  = {stats['kwh_per_ton_ratio_of_totals']}  ← report this\n"
        f"  kWh/ton (median per-min)   = {stats['kwh_per_ton_median_per_min']}  (cross-check only)\n"
        f"  Disagreement:                {stats['ratio_disagreement_pct']} %\n"
        f"  Shifts: {list(shift_breakdown.keys())}"
    )
    return {"figures": [fig_path], "stats": stats, "summary": summary}


def bond_work_index(
    df: pd.DataFrame,
    ore_col: str = "Ore",
    power_col: str = "Power",
    psi80_col: str = "PSI80",
    feed_p80_um: float = 12000.0,    # rough feed P80 (μm) — calibration constant
    output_dir: str = "output",
) -> dict:
    """
    Empirical Bond Work Index proxy (NOT absolute, comparative only):
        Wi ≈ (kWh/t) / (10 / sqrt(P80) − 10 / sqrt(F80))
    where P80 is product 80%-passing in μm (PSI80), F80 is feed P80 (μm).

    Use this to compare Wi across mills/shifts under similar feed conditions —
    higher Wi means harder grindability / poorer efficiency for the same energy.
    """
    os.makedirs(output_dir, exist_ok=True)

    needed = [ore_col, power_col, psi80_col]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        return {"figures": [], "stats": {},
                "summary": f"bond_work_index: missing columns {missing}."}

    running = _running_mask(df, ore_col)
    sub = df.loc[running, needed].dropna()
    n = int(len(sub))
    if n < 30:
        return {"figures": [], "stats": {"n": n},
                "summary": f"bond_work_index: too few running rows ({n})."}

    # Specific energy on running subset (ratio of totals)
    kwh_per_ton = (float(sub[power_col].sum()) / 60.0) / max(float(sub[ore_col].sum()) / 60.0, 1e-9)

    # Mean P80 in microns (PSI80 column already in μm per plant convention)
    p80 = float(sub[psi80_col].mean())
    if p80 <= 0 or feed_p80_um <= p80:
        return {"figures": [], "stats": {"n": n, "p80": round(p80, 2)},
                "summary": f"bond_work_index: invalid P80 ({p80} μm)."}

    bond_term = 10.0 / np.sqrt(p80) - 10.0 / np.sqrt(feed_p80_um)
    wi = kwh_per_ton / bond_term if bond_term > 0 else float("nan")

    # Rolling Wi (hourly) for trend visualisation
    if isinstance(df.index, pd.DatetimeIndex):
        hourly = df.loc[running, needed].resample("1h").mean().dropna()
        kwh_h = (hourly[power_col] / hourly[ore_col]).replace([np.inf, -np.inf], np.nan).dropna()
        bond_h = (10.0 / np.sqrt(hourly[psi80_col]) - 10.0 / np.sqrt(feed_p80_um))
        wi_h = (kwh_h / bond_h).replace([np.inf, -np.inf], np.nan).dropna()
    else:
        wi_h = pd.Series(dtype=float)

    fig_path = os.path.join(output_dir, "bond_work_index_trend.png")
    fig, ax = plt.subplots(figsize=(11, 4))
    if len(wi_h) > 0:
        ax.plot(wi_h.index, wi_h.values, color="#6366f1", lw=1.0, label="Hourly Wi proxy")
        ax.axhline(wi, color="red", ls="--", lw=1.5, label=f"Overall = {wi:.2f}")
    ax.set_title(f"Bond Work Index proxy (mean P80 = {p80:.1f} μm, feed F80 = {feed_p80_um:.0f} μm)")
    ax.set_ylabel("Wi proxy (kWh/t per Bond term)")
    ax.grid(alpha=0.3)
    if len(wi_h) > 0:
        ax.legend()
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    stats = {
        "n": n,
        "kwh_per_ton": round(kwh_per_ton, 4),
        "mean_p80_um": round(p80, 2),
        "feed_p80_um": float(feed_p80_um),
        "bond_wi_proxy": round(float(wi), 3) if np.isfinite(wi) else None,
        "wi_hourly_p10": round(float(wi_h.quantile(0.10)), 3) if len(wi_h) else None,
        "wi_hourly_p90": round(float(wi_h.quantile(0.90)), 3) if len(wi_h) else None,
    }
    summary = (
        f"Bond Work Index proxy (n={n}, comparative metric only):\n"
        f"  kWh/ton on running = {stats['kwh_per_ton']}\n"
        f"  mean PSI80 (P80)   = {stats['mean_p80_um']} μm  (assumed F80 = {feed_p80_um} μm)\n"
        f"  Wi proxy           = {stats['bond_wi_proxy']}\n"
        f"  Hourly Wi p10/p90  = {stats['wi_hourly_p10']} / {stats['wi_hourly_p90']}\n"
        f"  Higher Wi ⇒ harder grindability or worse efficiency at same P80."
    )
    return {"figures": [fig_path], "stats": stats, "summary": summary}


def efficiency_envelope(
    df: pd.DataFrame,
    ore_col: str = "Ore",
    power_col: str = "Power",
    psi80_col: str = "PSI80",
    output_dir: str = "output",
) -> dict:
    """
    Plot kWh/ton vs Ore (hourly aggregates) and identify the
    Pareto-efficient envelope: combinations of high throughput AND low
    specific energy. Useful for setpoint recommendations.
    """
    os.makedirs(output_dir, exist_ok=True)

    if not all(c in df.columns for c in [ore_col, power_col]):
        return {"figures": [], "stats": {},
                "summary": "efficiency_envelope: missing Ore or Power column."}

    if not isinstance(df.index, pd.DatetimeIndex):
        return {"figures": [], "stats": {},
                "summary": "efficiency_envelope: requires DatetimeIndex."}

    running = _running_mask(df, ore_col)
    cols = [ore_col, power_col] + ([psi80_col] if psi80_col in df.columns else [])
    hourly = df.loc[running, cols].resample("1h").mean().dropna()
    if len(hourly) < 10:
        return {"figures": [], "stats": {"n_hours": len(hourly)},
                "summary": f"efficiency_envelope: only {len(hourly)} running hours."}

    kwh_t = (hourly[power_col] / hourly[ore_col]).replace([np.inf, -np.inf], np.nan)
    hourly = hourly.assign(kwh_per_ton=kwh_t).dropna()

    # Pareto-efficient frontier: maximise Ore AND minimise kwh/ton
    sorted_by_ore = hourly.sort_values(ore_col, ascending=False).reset_index()
    pareto_idx = []
    best_kwh = float("inf")
    for i, row in sorted_by_ore.iterrows():
        if row["kwh_per_ton"] < best_kwh:
            best_kwh = float(row["kwh_per_ton"])
            pareto_idx.append(i)
    pareto = sorted_by_ore.iloc[pareto_idx].sort_values(ore_col)

    fig_path = os.path.join(output_dir, "efficiency_envelope.png")
    fig, ax = plt.subplots(figsize=(9, 5.5))
    sc = ax.scatter(hourly[ore_col], hourly["kwh_per_ton"],
                    c=hourly[psi80_col] if psi80_col in hourly.columns else "#0ea5e9",
                    cmap="viridis", s=22, alpha=0.7, edgecolor="black", lw=0.3)
    if psi80_col in hourly.columns:
        cb = fig.colorbar(sc, ax=ax)
        cb.set_label(f"{psi80_col} (μm)")
    ax.plot(pareto[ore_col], pareto["kwh_per_ton"], color="red", lw=2,
            marker="o", markersize=7, label="Pareto envelope")
    ax.set_xlabel(f"{ore_col} (t/h, hourly mean on running minutes)")
    ax.set_ylabel("kWh / ton (hourly per-minute Power/Ore)")
    ax.set_title("Efficiency envelope: throughput vs specific energy")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    pareto_records = pareto[[ore_col, "kwh_per_ton"]].head(15).round(3).to_dict("records")

    stats = {
        "n_hours": int(len(hourly)),
        "ore_p10": round(float(hourly[ore_col].quantile(0.10)), 2),
        "ore_p90": round(float(hourly[ore_col].quantile(0.90)), 2),
        "kwh_per_ton_p10": round(float(hourly["kwh_per_ton"].quantile(0.10)), 3),
        "kwh_per_ton_p90": round(float(hourly["kwh_per_ton"].quantile(0.90)), 3),
        "pareto_points": pareto_records,
    }
    summary = (
        f"Efficiency envelope ({stats['n_hours']} running hours):\n"
        f"  Throughput p10–p90 = {stats['ore_p10']} – {stats['ore_p90']} t/h\n"
        f"  kWh/ton p10–p90    = {stats['kwh_per_ton_p10']} – {stats['kwh_per_ton_p90']}\n"
        f"  Pareto points (Ore, kWh/t): {pareto_records[:5]}...\n"
        f"  Recommendation: target setpoints near the Pareto envelope at high Ore."
    )
    return {"figures": [fig_path], "stats": stats, "summary": summary}
