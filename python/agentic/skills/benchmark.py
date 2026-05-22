"""
skills/benchmark.py — Multi-mill envelope analysis & best-of-fleet benchmarking.
=================================================================================
Compares 2..12 mills under similar feed conditions and identifies operating
windows that the BEST-performing mills exploit. The output is meant to drive
"transfer the best mill's playbook to the under-performers" recommendations.

Core idea: bin the operating space (Ore, DensityHC) and within each bin find
the mill with the lowest PSI80 std-dev (= most stable grinding) and the lowest
kWh/ton (= most efficient). Plot the difference vs the fleet median.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def _safe_float(x):
    try:
        v = float(x)
        if not np.isfinite(v):
            return None
        return round(v, 4)
    except Exception:
        return None


def fleet_kpis(
    mill_dfs: dict[str, pd.DataFrame],
    output_dir: str = "output",
) -> dict:
    """
    Compute headline KPIs for every mill and rank them.

    Parameters
    ----------
    mill_dfs : dict mapping mill label (e.g. "Мелница 8") to its DataFrame.
               Each DataFrame must contain Ore, Power, PSI80, DensityHC.
    """
    os.makedirs(output_dir, exist_ok=True)

    if not mill_dfs:
        return {"figures": [], "stats": {},
                "summary": "benchmark.fleet_kpis: no mills supplied."}

    rows = []
    for name, df in mill_dfs.items():
        if df is None or len(df) == 0:
            continue
        running = df.get("Ore", pd.Series(dtype=float)) >= 50
        sub = df.loc[running]
        n = int(len(sub))
        if n < 30:
            rows.append({"mill": name, "n_running": n,
                         "ore_mean": None, "psi80_mean": None, "psi80_std": None,
                         "kwh_per_ton": None, "uptime_pct": round(100.0 * n / max(len(df), 1), 1)})
            continue

        ore_total = float(sub["Ore"].sum()) / 60.0    if "Ore" in sub else 0.0
        pwr_total = float(sub["Power"].sum()) / 60.0  if "Power" in sub else 0.0
        kwh_t = (pwr_total / ore_total) if ore_total > 0 else None

        rows.append({
            "mill": name,
            "n_running": n,
            "uptime_pct": round(100.0 * n / max(len(df), 1), 2),
            "ore_mean": _safe_float(sub["Ore"].mean())   if "Ore" in sub else None,
            "psi80_mean": _safe_float(sub["PSI80"].mean()) if "PSI80" in sub else None,
            "psi80_std":  _safe_float(sub["PSI80"].std())  if "PSI80" in sub else None,
            "density_mean": _safe_float(sub["DensityHC"].mean()) if "DensityHC" in sub else None,
            "kwh_per_ton": _safe_float(kwh_t),
        })

    df_kpi = pd.DataFrame(rows)
    if df_kpi.empty:
        return {"figures": [], "stats": {},
                "summary": "benchmark.fleet_kpis: no usable mill data."}

    # Rank mills (lower is better for psi80_std and kwh_per_ton; higher for ore_mean)
    df_kpi["rank_throughput"] = df_kpi["ore_mean"].rank(ascending=False, na_option="bottom")
    df_kpi["rank_stability"]  = df_kpi["psi80_std"].rank(ascending=True, na_option="bottom")
    df_kpi["rank_efficiency"] = df_kpi["kwh_per_ton"].rank(ascending=True, na_option="bottom")
    df_kpi["composite_rank"] = df_kpi[["rank_throughput", "rank_stability", "rank_efficiency"]].mean(axis=1)
    df_kpi = df_kpi.sort_values("composite_rank")

    # Plot 1: ranked composite + per-KPI bars
    fig_path = os.path.join(output_dir, "benchmark_fleet_kpis.png")
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    palette = plt.cm.viridis(np.linspace(0, 0.85, len(df_kpi)))

    for ax, col, title, lower_better in [
        (axes[0, 0], "ore_mean", "Throughput (t/h, mean Ore on running)", False),
        (axes[0, 1], "psi80_std", "PSI80 stability (std on running, lower = better)", True),
        (axes[1, 0], "kwh_per_ton", "Specific energy (kWh/ton, lower = better)", True),
        (axes[1, 1], "uptime_pct", "Uptime % (Ore ≥ 50 t/h)", False),
    ]:
        d = df_kpi.sort_values(col, ascending=lower_better).dropna(subset=[col])
        ax.barh(d["mill"], d[col], color=palette[: len(d)], edgecolor="black")
        ax.set_title(title)
        ax.grid(axis="x", alpha=0.3)
        for i, v in enumerate(d[col].values):
            ax.text(v, i, f"  {v:.2f}", va="center", fontsize=8)

    fig.suptitle(f"Fleet KPIs across {len(df_kpi)} mills", fontsize=13)
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    summary_lines = [f"Fleet ranking ({len(df_kpi)} mills, composite rank ↓ = better):"]
    for _, r in df_kpi.iterrows():
        summary_lines.append(
            f"  {r['mill']:<14} composite={r['composite_rank']:.2f}  "
            f"Ore={r['ore_mean']}  PSI80 std={r['psi80_std']}  "
            f"kWh/t={r['kwh_per_ton']}  uptime={r['uptime_pct']}%"
        )

    return {
        "figures": [fig_path],
        "stats": {
            "n_mills": int(len(df_kpi)),
            "ranked": df_kpi.to_dict("records"),
            "best_mill": df_kpi.iloc[0]["mill"],
            "worst_mill": df_kpi.iloc[-1]["mill"],
        },
        "summary": "\n".join(summary_lines),
    }


def envelope_transfer(
    mill_dfs: dict[str, pd.DataFrame],
    target_mill: str,
    metric: str = "psi80_std",     # or "kwh_per_ton"
    bin_var: str = "Ore",
    n_bins: int = 5,
    output_dir: str = "output",
) -> dict:
    """
    Within bins of `bin_var` (e.g. Ore), find the BEST mill per bin and report
    how much `target_mill` could improve if it adopted those operating
    setpoints (DensityHC, WaterMill, MotorAmp) used by the best mill in each bin.

    Returns a per-bin transfer recommendation table.
    """
    os.makedirs(output_dir, exist_ok=True)

    if target_mill not in mill_dfs:
        return {"figures": [], "stats": {},
                "summary": f"benchmark.envelope_transfer: target_mill '{target_mill}' not in mill_dfs."}

    # Pool all running data with mill labels
    frames = []
    for name, df in mill_dfs.items():
        if df is None or len(df) == 0:
            continue
        running = df.get("Ore", pd.Series(dtype=float)) >= 50
        sub = df.loc[running].copy()
        sub["__mill"] = name
        frames.append(sub)
    if not frames:
        return {"figures": [], "stats": {},
                "summary": "benchmark.envelope_transfer: no running data across mills."}
    pool = pd.concat(frames, ignore_index=True)
    if bin_var not in pool.columns or "PSI80" not in pool.columns:
        return {"figures": [], "stats": {},
                "summary": f"benchmark.envelope_transfer: missing {bin_var} or PSI80 column."}

    # Make bins on the pooled distribution
    edges = np.quantile(pool[bin_var].dropna(), np.linspace(0, 1, n_bins + 1))
    edges[0] -= 1e-6  # ensure left edge is included
    pool["__bin"] = pd.cut(pool[bin_var], bins=edges, labels=False, include_lowest=True)

    # Per-bin metric per mill
    if metric == "psi80_std":
        agg = pool.groupby(["__bin", "__mill"])["PSI80"].std()
        better = "lower"
    elif metric == "kwh_per_ton":
        # ratio of totals per (bin, mill)
        if "Power" not in pool.columns:
            return {"figures": [], "stats": {},
                    "summary": "benchmark.envelope_transfer: Power column required for kwh_per_ton."}
        grp = pool.groupby(["__bin", "__mill"])
        agg = (grp["Power"].sum() / 60.0) / (grp["Ore"].sum() / 60.0)
        better = "lower"
    else:
        return {"figures": [], "stats": {},
                "summary": f"benchmark.envelope_transfer: unknown metric '{metric}'."}

    agg = agg.reset_index().rename(columns={agg.name or 0: "metric_value"})
    agg.columns = ["__bin", "__mill", "metric_value"]
    agg = agg.dropna()

    bin_records = []
    for b in sorted(agg["__bin"].dropna().unique()):
        slc = agg[agg["__bin"] == b].sort_values("metric_value", ascending=(better == "lower"))
        if slc.empty:
            continue
        best = slc.iloc[0]
        target = slc[slc["__mill"] == target_mill]
        target_val = float(target["metric_value"].iloc[0]) if len(target) else None
        # Recommended setpoints in this bin (best mill's medians)
        bin_pool = pool[(pool["__bin"] == b) & (pool["__mill"] == best["__mill"])]
        setpoints = {
            col: round(float(bin_pool[col].median()), 3)
            for col in ["Ore", "WaterMill", "WaterZumpf", "MotorAmp", "DensityHC"]
            if col in bin_pool.columns and not bin_pool[col].dropna().empty
        }
        bin_records.append({
            "bin": int(b),
            "bin_low": round(float(edges[int(b)]), 2),
            "bin_high": round(float(edges[int(b) + 1]), 2),
            "best_mill": str(best["__mill"]),
            "best_metric": round(float(best["metric_value"]), 4),
            "target_metric": round(target_val, 4) if target_val is not None else None,
            "improvement": round(float(target_val - best["metric_value"]), 4)
                           if target_val is not None else None,
            "recommended_setpoints": setpoints,
        })

    # Plot
    fig_path = os.path.join(output_dir, f"benchmark_envelope_{target_mill.replace(' ', '_')}_{metric}.png")
    fig, ax = plt.subplots(figsize=(10, 5))
    bins_x = [f"[{r['bin_low']:.0f}–{r['bin_high']:.0f}]" for r in bin_records]
    target_vals = [r["target_metric"] for r in bin_records]
    best_vals = [r["best_metric"] for r in bin_records]
    x = np.arange(len(bins_x))
    ax.bar(x - 0.2, target_vals, 0.4, label=f"{target_mill}", color="#fb7185", edgecolor="black")
    ax.bar(x + 0.2, best_vals, 0.4, label="Best in bin", color="#10b981", edgecolor="black")
    for i, r in enumerate(bin_records):
        ax.text(i + 0.2, (r["best_metric"] or 0), f" {r['best_mill']}",
                rotation=45, fontsize=8, ha="left", va="bottom")
    ax.set_xticks(x)
    ax.set_xticklabels(bins_x, rotation=20)
    ax.set_xlabel(f"{bin_var} bin (t/h)")
    ax.set_ylabel(metric)
    ax.set_title(f"Envelope transfer: {target_mill} vs best mill per {bin_var} bin")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    # Estimate average improvement
    deltas = [r["improvement"] for r in bin_records if r["improvement"] is not None]
    mean_delta = round(float(np.mean(deltas)), 4) if deltas else None

    stats = {
        "target_mill": target_mill,
        "metric": metric,
        "bin_var": bin_var,
        "n_bins": int(len(bin_records)),
        "bins": bin_records,
        "mean_potential_improvement": mean_delta,
    }
    summary_lines = [
        f"Envelope-transfer for {target_mill} (metric={metric}, bin={bin_var}, lower=better):",
        f"  Mean potential improvement (delta vs best in bin): {mean_delta}",
    ]
    for r in bin_records[:6]:
        summary_lines.append(
            f"  {bins_x[r['bin']]}: target={r['target_metric']} vs best={r['best_metric']} "
            f"(by {r['best_mill']}) → setpoints {r['recommended_setpoints']}"
        )
    return {"figures": [fig_path], "stats": stats, "summary": "\n".join(summary_lines)}
