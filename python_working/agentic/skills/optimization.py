"""
skills/optimization.py -- Process optimization analysis functions.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def pareto_frontier(df: pd.DataFrame, x_col: str, y_col: str,
                    x_minimize: bool = False, y_minimize: bool = True,
                    output_dir: str = "output") -> dict:
    """
    Find and plot the Pareto frontier between two objectives.

    Args:
        df: DataFrame with the two columns
        x_col, y_col: column names for the two objectives
        x_minimize: True if lower x is better
        y_minimize: True if lower y is better
        output_dir: where to save chart

    Returns:
        {"figures": [path], "stats": {n_pareto_points, pareto_points}, "summary": str}
    """
    data = df[[x_col, y_col]].dropna()
    if len(data) < 10:
        return {"figures": [], "stats": {}, "summary": "Insufficient data for Pareto analysis."}

    x = data[x_col].values
    y = data[y_col].values

    # Sort by x
    sort_idx = np.argsort(x) if not x_minimize else np.argsort(-x)
    x_sorted = x[sort_idx]
    y_sorted = y[sort_idx]

    # Find Pareto-optimal points
    pareto_mask = np.zeros(len(x_sorted), dtype=bool)
    if y_minimize:
        best_y = np.inf
        for i in range(len(x_sorted)):
            if y_sorted[i] < best_y:
                pareto_mask[i] = True
                best_y = y_sorted[i]
    else:
        best_y = -np.inf
        for i in range(len(x_sorted)):
            if y_sorted[i] > best_y:
                pareto_mask[i] = True
                best_y = y_sorted[i]

    pareto_x = x_sorted[pareto_mask]
    pareto_y = y_sorted[pareto_mask]

    # Plot
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.scatter(x, y, alpha=0.2, s=5, color="steelblue", label="All points")
    ax.plot(pareto_x, pareto_y, "r-o", markersize=4, linewidth=1.5, label="Pareto frontier")
    ax.set_xlabel(x_col)
    ax.set_ylabel(y_col)
    ax.set_title("Pareto Frontier: %s vs %s (%d optimal points)" % (x_col, y_col, len(pareto_x)),
                 fontsize=12, fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    path = os.path.join(output_dir, "pareto_%s_vs_%s.png" % (x_col, y_col))
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()

    pareto_points = [{"x": round(float(px), 3), "y": round(float(py), 3)}
                     for px, py in zip(pareto_x, pareto_y)]

    stats = {
        "n_pareto_points": len(pareto_x),
        "pareto_points": pareto_points[:20],
        "x_range": [round(float(x.min()), 3), round(float(x.max()), 3)],
        "y_range": [round(float(y.min()), 3), round(float(y.max()), 3)],
    }

    lines = ["Pareto Frontier: %s vs %s" % (x_col, y_col)]
    lines.append("  Pareto-optimal points: %d / %d total" % (len(pareto_x), len(x)))
    if len(pareto_points) > 0:
        lines.append("  Best trade-offs (first 5):")
        for p in pareto_points[:5]:
            lines.append("    %s=%.2f, %s=%.2f" % (x_col, p["x"], y_col, p["y"]))

    return {"figures": [path], "stats": stats, "summary": "\n".join(lines)}


def sensitivity_analysis(df: pd.DataFrame, target_col: str, feature_cols: list = None,
                         output_dir: str = "output") -> dict:
    """
    Tornado chart showing sensitivity of target to each feature (via correlation).

    Returns:
        {"figures": [path], "stats": {sensitivities: {col: corr}}, "summary": str}
    """
    if feature_cols is None:
        feature_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                        if c != target_col]
    feature_cols = [c for c in feature_cols if c in df.columns]

    sensitivities = {}
    for col in feature_cols:
        valid = df[[col, target_col]].dropna()
        if len(valid) > 10:
            corr = float(valid[col].corr(valid[target_col]))
            sensitivities[col] = round(corr, 4)

    # Sort by absolute correlation
    sorted_sens = dict(sorted(sensitivities.items(), key=lambda x: abs(x[1]), reverse=True))

    # Tornado chart
    fig, ax = plt.subplots(figsize=(10, max(4, len(sorted_sens) * 0.4)))
    cols = list(sorted_sens.keys())
    vals = list(sorted_sens.values())

    colors = ["#e74c3c" if v < 0 else "#2ecc71" for v in vals]
    ax.barh(range(len(cols)), vals, color=colors, edgecolor="white", alpha=0.8)
    ax.set_yticks(range(len(cols)))
    ax.set_yticklabels(cols, fontsize=9)
    ax.set_xlabel("Correlation with %s" % target_col)
    ax.set_title("Sensitivity Analysis (Tornado) -- %s" % target_col,
                 fontsize=12, fontweight="bold")
    ax.axvline(0, color="black", linewidth=0.5)
    ax.grid(True, alpha=0.3, axis="x")
    plt.tight_layout()

    path = os.path.join(output_dir, "sensitivity_%s.png" % target_col)
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()

    lines = ["Sensitivity Analysis for %s:" % target_col]
    for col, val in list(sorted_sens.items())[:10]:
        direction = "positive" if val > 0 else "negative"
        lines.append("  %s: r=%.3f (%s)" % (col, val, direction))

    return {
        "figures": [path],
        "stats": {"sensitivities": sorted_sens},
        "summary": "\n".join(lines),
    }


def optimal_windows(df: pd.DataFrame, target_col: str, feature_cols: list = None,
                    target_quantile: float = 0.9, output_dir: str = "output") -> dict:
    """
    Find operating windows where the target variable performs best.
    Compares feature distributions in top-quantile vs rest.

    Returns:
        {"figures": [path], "stats": {optimal_ranges: {col: {low, high}}}, "summary": str}
    """
    if feature_cols is None:
        feature_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                        if c != target_col][:8]
    feature_cols = [c for c in feature_cols if c in df.columns]

    data = df[feature_cols + [target_col]].dropna()
    if len(data) < 50:
        return {"figures": [], "stats": {}, "summary": "Insufficient data for optimal windows."}

    threshold = data[target_col].quantile(target_quantile)
    top_mask = data[target_col] >= threshold
    top_data = data[top_mask]

    optimal_ranges = {}
    for col in feature_cols:
        q10 = round(float(top_data[col].quantile(0.1)), 3)
        q90 = round(float(top_data[col].quantile(0.9)), 3)
        full_mean = round(float(data[col].mean()), 3)
        top_mean = round(float(top_data[col].mean()), 3)
        optimal_ranges[col] = {"low": q10, "high": q90, "full_mean": full_mean, "top_mean": top_mean}

    # Plot: compare distributions
    n = len(feature_cols)
    ncols = min(3, n)
    nrows = (n + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 4 * nrows))
    if n == 1:
        axes = np.array([axes])
    axes = axes.flatten() if hasattr(axes, "flatten") else [axes]

    for i, col in enumerate(feature_cols):
        ax = axes[i]
        ax.hist(data[col], bins=40, alpha=0.4, color="steelblue", label="All", density=True)
        ax.hist(top_data[col], bins=40, alpha=0.6, color="green", label="Top %d%%" % int(target_quantile * 100), density=True)
        r = optimal_ranges[col]
        ax.axvline(r["low"], color="red", linestyle="--", alpha=0.7)
        ax.axvline(r["high"], color="red", linestyle="--", alpha=0.7)
        ax.set_title(col, fontsize=10, fontweight="bold")
        ax.legend(fontsize=7)

    for i in range(n, len(axes)):
        axes[i].set_visible(False)

    fig.suptitle("Optimal Operating Windows (top %d%% of %s)" % (int(target_quantile * 100), target_col),
                 fontsize=12, fontweight="bold", y=1.02)
    plt.tight_layout()

    path = os.path.join(output_dir, "optimal_windows_%s.png" % target_col)
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()

    lines = ["Optimal Operating Windows (top %d%% of %s >= %.2f):" % (int(target_quantile * 100), target_col, threshold)]
    for col, r in optimal_ranges.items():
        lines.append("  %s: [%.2f, %.2f] (all mean=%.2f, top mean=%.2f)" % (col, r["low"], r["high"], r["full_mean"], r["top_mean"]))

    return {
        "figures": [path],
        "stats": {"optimal_ranges": optimal_ranges, "target_threshold": round(float(threshold), 3)},
        "summary": "\n".join(lines),
    }
