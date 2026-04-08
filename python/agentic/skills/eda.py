"""
skills/eda.py — Exploratory Data Analysis functions.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns


def descriptive_stats(df: pd.DataFrame, columns: list[str] | None = None) -> dict:
    """
    Compute descriptive statistics for selected columns.
    
    Returns:
        {"figures": [], "stats": {col: {mean, std, min, max, q25, q50, q75, missing_pct}}, "summary": str}
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    stats = {}
    for col in columns:
        if col not in df.columns:
            continue
        s = df[col].dropna()
        stats[col] = {
            "count": int(len(s)),
            "mean": round(float(s.mean()), 4),
            "std": round(float(s.std()), 4),
            "min": round(float(s.min()), 4),
            "max": round(float(s.max()), 4),
            "q25": round(float(s.quantile(0.25)), 4),
            "q50": round(float(s.quantile(0.50)), 4),
            "q75": round(float(s.quantile(0.75)), 4),
            "missing_pct": round(float(df[col].isna().mean() * 100), 2),
        }
    
    lines = [f"Descriptive Statistics ({len(columns)} variables, {len(df)} rows):"]
    for col, s in stats.items():
        lines.append(f"  {col}: mean={s['mean']}, std={s['std']}, range=[{s['min']}, {s['max']}], missing={s['missing_pct']}%")
    
    return {"figures": [], "stats": stats, "summary": "\n".join(lines)}


def distribution_plots(df: pd.DataFrame, columns: list[str] | None = None,
                       output_dir: str = "output") -> dict:
    """
    Generate histogram + KDE plots for each column.
    
    Returns:
        {"figures": [paths], "stats": {}, "summary": str}
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    columns = [c for c in columns if c in df.columns]
    n = len(columns)
    if n == 0:
        return {"figures": [], "stats": {}, "summary": "No numeric columns found."}
    
    ncols = min(3, n)
    nrows = (n + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 4 * nrows))
    if n == 1:
        axes = [axes]
    else:
        axes = axes.flatten() if hasattr(axes, 'flatten') else [axes]
    
    for i, col in enumerate(columns):
        ax = axes[i]
        data = df[col].dropna()
        ax.hist(data, bins=50, alpha=0.7, color='steelblue', edgecolor='white')
        ax.set_title(col, fontsize=10, fontweight='bold')
        ax.set_xlabel(col)
        ax.set_ylabel('Count')
        ax.axvline(data.mean(), color='red', linestyle='--', alpha=0.7, label=f'Mean: {data.mean():.2f}')
        ax.legend(fontsize=8)
    
    for i in range(n, len(axes)):
        axes[i].set_visible(False)
    
    plt.tight_layout()
    path = os.path.join(output_dir, "distribution_plots.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return {"figures": [path], "stats": {}, "summary": f"Distribution plots saved for {n} variables."}


def correlation_heatmap(df: pd.DataFrame, columns: list[str] | None = None,
                        output_dir: str = "output") -> dict:
    """
    Generate a correlation heatmap with annotated values.
    
    Returns:
        {"figures": [path], "stats": {top_correlations: [...]}, "summary": str}
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    columns = [c for c in columns if c in df.columns]
    corr = df[columns].corr()
    
    fig, ax = plt.subplots(figsize=(max(8, len(columns)), max(6, len(columns) * 0.8)))
    mask = np.triu(np.ones_like(corr, dtype=bool), k=1)
    sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdBu_r',
                center=0, vmin=-1, vmax=1, ax=ax, square=True,
                linewidths=0.5, cbar_kws={"shrink": 0.8})
    ax.set_title("Correlation Matrix", fontsize=12, fontweight='bold')
    plt.tight_layout()
    
    path = os.path.join(output_dir, "correlation_heatmap.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    # Extract top correlations (excluding self-correlation)
    upper = corr.where(mask.T)
    pairs = []
    for col in upper.columns:
        for idx in upper.index:
            val = upper.loc[idx, col]
            if pd.notna(val):
                pairs.append({"var1": idx, "var2": col, "correlation": round(float(val), 4)})
    pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
    top = pairs[:10]
    
    lines = ["Top correlations:"]
    for p in top:
        lines.append(f"  {p['var1']} ↔ {p['var2']}: {p['correlation']:+.3f}")
    
    return {"figures": [path], "stats": {"top_correlations": top}, "summary": "\n".join(lines)}


def time_series_overview(df: pd.DataFrame, columns: list[str] | None = None,
                         output_dir: str = "output") -> dict:
    """
    Plot time series for selected columns with rolling mean overlay.
    
    Returns:
        {"figures": [path], "stats": {time_range, data_points}, "summary": str}
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()[:8]
    
    columns = [c for c in columns if c in df.columns]
    n = len(columns)
    if n == 0:
        return {"figures": [], "stats": {}, "summary": "No columns to plot."}
    
    fig, axes = plt.subplots(n, 1, figsize=(16, 3 * n), sharex=True)
    if n == 1:
        axes = [axes]
    
    for i, col in enumerate(columns):
        ax = axes[i]
        data = df[col].dropna()
        ax.plot(data.index, data.values, alpha=0.5, linewidth=0.5, color='steelblue')
        # Rolling mean (1-hour window if datetime index, else 60 points)
        try:
            rolling = data.rolling(window='1h' if isinstance(data.index, pd.DatetimeIndex) else 60,
                                   min_periods=1).mean()
        except Exception:
            rolling = data.rolling(window=60, min_periods=1).mean()
        ax.plot(rolling.index, rolling.values, color='red', linewidth=1, alpha=0.8, label='1h rolling mean')
        ax.set_ylabel(col, fontsize=9)
        ax.legend(fontsize=7, loc='upper right')
        ax.grid(True, alpha=0.3)
    
    axes[0].set_title("Time Series Overview", fontsize=12, fontweight='bold')
    plt.tight_layout()
    
    path = os.path.join(output_dir, "time_series_overview.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    time_range = ""
    if isinstance(df.index, pd.DatetimeIndex) and len(df) > 0:
        time_range = f"{df.index.min()} to {df.index.max()}"
    
    return {
        "figures": [path],
        "stats": {"time_range": time_range, "data_points": len(df), "columns_plotted": n},
        "summary": f"Time series overview: {n} variables, {len(df)} data points. {time_range}",
    }
