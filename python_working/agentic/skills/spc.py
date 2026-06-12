"""
skills/spc.py — Statistical Process Control functions.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def control_limits(data: pd.Series, n_sigma: float = 3.0) -> dict:
    """
    Calculate control limits for a series.
    
    Returns:
        {"CL": float, "UCL": float, "LCL": float, "std": float}
    """
    mean = float(data.mean())
    std = float(data.std())
    return {
        "CL": round(mean, 4),
        "UCL": round(mean + n_sigma * std, 4),
        "LCL": round(mean - n_sigma * std, 4),
        "std": round(std, 4),
    }


def xbar_chart(df: pd.DataFrame, column: str, spec_limits: tuple | None = None,
               window: str | int = '1h', n_sigma: float = 3.0,
               output_dir: str = "output") -> dict:
    """
    Generate an X-bar control chart with control limits and optional spec limits.
    
    Args:
        df: DataFrame with DatetimeIndex
        column: column name to chart
        spec_limits: (LSL, USL) tuple, or None
        window: rolling window for subgroup means ('1h', '30min', or int for points)
        n_sigma: number of sigma for control limits (default 3)
        output_dir: where to save the chart
    
    Returns:
        {"figures": [path], "stats": {CL, UCL, LCL, Cpk, out_of_control_pct, ...}, "summary": str}
    """
    data = df[column].dropna()
    if len(data) < 10:
        return {"figures": [], "stats": {}, "summary": f"Insufficient data for {column} ({len(data)} points)."}
    
    # Calculate subgroup means
    try:
        xbar = data.rolling(window=window, min_periods=1).mean()
    except Exception:
        xbar = data.rolling(window=60, min_periods=1).mean()
    
    # Control limits from individual data
    cl = float(data.mean())
    sigma = float(data.std())
    ucl = cl + n_sigma * sigma
    lcl = cl - n_sigma * sigma
    
    # Out-of-control points
    ooc_mask = (data > ucl) | (data < lcl)
    ooc_count = int(ooc_mask.sum())
    ooc_pct = round(ooc_count / len(data) * 100, 2)
    
    # Process capability (Cpk)
    cpk = None
    if spec_limits:
        lsl, usl = spec_limits
        cpu = (usl - cl) / (3 * sigma) if sigma > 0 else float('inf')
        cpl = (cl - lsl) / (3 * sigma) if sigma > 0 else float('inf')
        cpk = round(min(cpu, cpl), 3)
    
    # Plot
    fig, ax = plt.subplots(figsize=(16, 5))
    ax.plot(data.index, data.values, alpha=0.4, linewidth=0.5, color='steelblue', label='Raw data')
    ax.plot(xbar.index, xbar.values, color='navy', linewidth=1, alpha=0.8, label=f'X̄ ({window})')
    
    ax.axhline(cl, color='green', linestyle='-', linewidth=1.5, label=f'CL = {cl:.2f}')
    ax.axhline(ucl, color='red', linestyle='--', linewidth=1, label=f'UCL = {ucl:.2f}')
    ax.axhline(lcl, color='red', linestyle='--', linewidth=1, label=f'LCL = {lcl:.2f}')
    
    if spec_limits:
        lsl, usl = spec_limits
        ax.axhline(usl, color='orange', linestyle=':', linewidth=1.5, label=f'USL = {usl}')
        ax.axhline(lsl, color='orange', linestyle=':', linewidth=1.5, label=f'LSL = {lsl}')
    
    # Mark out-of-control points
    ooc_data = data[ooc_mask]
    if len(ooc_data) > 0:
        ax.scatter(ooc_data.index, ooc_data.values, color='red', s=8, zorder=5, label=f'OOC ({ooc_count})')
    
    title = f"X̄ Control Chart — {column}"
    if cpk is not None:
        title += f"  (Cpk = {cpk:.3f})"
    ax.set_title(title, fontsize=12, fontweight='bold')
    ax.set_ylabel(column)
    ax.set_xlabel("Time")
    ax.legend(fontsize=8, loc='upper right')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    
    path = os.path.join(output_dir, f"spc_xbar_{column}.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    stats = {
        "CL": round(cl, 4),
        "UCL": round(ucl, 4),
        "LCL": round(lcl, 4),
        "sigma": round(sigma, 4),
        "out_of_control_count": ooc_count,
        "out_of_control_pct": ooc_pct,
        "total_points": len(data),
    }
    if cpk is not None:
        stats["Cpk"] = cpk
        stats["LSL"] = spec_limits[0]
        stats["USL"] = spec_limits[1]
    
    lines = [f"SPC X̄ Chart for {column}:"]
    lines.append(f"  CL={cl:.2f}, UCL={ucl:.2f}, LCL={lcl:.2f}, σ={sigma:.2f}")
    lines.append(f"  Out-of-control: {ooc_count} points ({ooc_pct}%)")
    if cpk is not None:
        capable = "CAPABLE" if cpk >= 1.33 else "MARGINAL" if cpk >= 1.0 else "NOT CAPABLE"
        lines.append(f"  Cpk = {cpk:.3f} → {capable}")
    
    return {"figures": [path], "stats": stats, "summary": "\n".join(lines)}


def process_capability(df: pd.DataFrame, column: str,
                       lsl: float, usl: float, target: float | None = None,
                       output_dir: str = "output") -> dict:
    """
    Full process capability analysis with histogram, normal fit, and Cp/Cpk/Pp/Ppk.
    
    Returns:
        {"figures": [path], "stats": {Cp, Cpk, Pp, Ppk, ppm_out, ...}, "summary": str}
    """
    from scipy import stats as scipy_stats
    
    data = df[column].dropna()
    n = len(data)
    if n < 30:
        return {"figures": [], "stats": {}, "summary": f"Need ≥30 data points for capability, got {n}."}
    
    mean = float(data.mean())
    std = float(data.std())
    
    if target is None:
        target = (lsl + usl) / 2
    
    # Capability indices
    cp = (usl - lsl) / (6 * std) if std > 0 else float('inf')
    cpu = (usl - mean) / (3 * std) if std > 0 else float('inf')
    cpl = (mean - lsl) / (3 * std) if std > 0 else float('inf')
    cpk = min(cpu, cpl)
    
    # PPM outside spec
    z_upper = (usl - mean) / std if std > 0 else 10
    z_lower = (mean - lsl) / std if std > 0 else 10
    ppm_above = scipy_stats.norm.sf(z_upper) * 1_000_000
    ppm_below = scipy_stats.norm.cdf(-z_lower) * 1_000_000
    ppm_total = ppm_above + ppm_below
    
    # Actual out-of-spec
    actual_ooc = int(((data < lsl) | (data > usl)).sum())
    actual_ooc_pct = round(actual_ooc / n * 100, 2)
    
    # Plot: histogram with normal curve and spec limits
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.hist(data, bins=60, density=True, alpha=0.7, color='steelblue', edgecolor='white')
    
    x_range = np.linspace(mean - 4 * std, mean + 4 * std, 200)
    ax.plot(x_range, scipy_stats.norm.pdf(x_range, mean, std), 'r-', linewidth=2, label='Normal fit')
    
    ax.axvline(lsl, color='orange', linestyle='--', linewidth=2, label=f'LSL = {lsl}')
    ax.axvline(usl, color='orange', linestyle='--', linewidth=2, label=f'USL = {usl}')
    ax.axvline(target, color='green', linestyle='-', linewidth=1.5, label=f'Target = {target}')
    ax.axvline(mean, color='red', linestyle='-', linewidth=1.5, label=f'Mean = {mean:.2f}')
    
    ax.set_title(f"Process Capability — {column}  (Cpk = {cpk:.3f}, Cp = {cp:.3f})",
                 fontsize=12, fontweight='bold')
    ax.set_xlabel(column)
    ax.set_ylabel("Density")
    ax.legend(fontsize=8)
    plt.tight_layout()
    
    path = os.path.join(output_dir, f"capability_{column}.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    stats = {
        "Cp": round(cp, 4),
        "Cpk": round(cpk, 4),
        "mean": round(mean, 4),
        "std": round(std, 4),
        "LSL": lsl,
        "USL": usl,
        "target": target,
        "ppm_total": round(ppm_total, 1),
        "actual_out_of_spec_count": actual_ooc,
        "actual_out_of_spec_pct": actual_ooc_pct,
        "n": n,
    }
    
    capable = "CAPABLE" if cpk >= 1.33 else "MARGINAL" if cpk >= 1.0 else "NOT CAPABLE"
    lines = [f"Process Capability for {column}:"]
    lines.append(f"  Cp = {cp:.3f}, Cpk = {cpk:.3f} → {capable}")
    lines.append(f"  Mean = {mean:.2f}, Std = {std:.2f}")
    lines.append(f"  Spec: [{lsl}, {usl}], Target: {target}")
    lines.append(f"  PPM out of spec (theoretical): {ppm_total:.0f}")
    lines.append(f"  Actual out of spec: {actual_ooc} ({actual_ooc_pct}%)")
    
    return {"figures": [path], "stats": stats, "summary": "\n".join(lines)}


def control_limits_table(df: pd.DataFrame, columns: list[str] | None = None,
                         n_sigma: float = 3.0) -> dict:
    """
    Return control limits for multiple variables as a summary table.
    
    Returns:
        {"figures": [], "stats": {col: {CL, UCL, LCL, std}}, "summary": str}
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    stats = {}
    lines = ["Control Limits Summary (±{:.1f}σ):".format(n_sigma)]
    for col in columns:
        if col not in df.columns:
            continue
        data = df[col].dropna()
        if len(data) < 2:
            continue
        cl = control_limits(data, n_sigma)
        stats[col] = cl
        lines.append(f"  {col}: CL={cl['CL']:.2f}, UCL={cl['UCL']:.2f}, LCL={cl['LCL']:.2f}")
    
    return {"figures": [], "stats": stats, "summary": "\n".join(lines)}
