"""
skills/anomaly.py — Anomaly detection and regime analysis functions.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def isolation_forest_analysis(df: pd.DataFrame, features: list[str] | None = None,
                              contamination: float = 0.05,
                              output_dir: str = "output") -> dict:
    """
    Run Isolation Forest anomaly detection on multivariate data.
    
    Args:
        df: DataFrame with process variables
        features: columns to use (default: all numeric)
        contamination: expected fraction of anomalies (0-0.5)
        output_dir: where to save charts
    
    Returns:
        {"figures": [paths], "stats": {anomaly_count, anomaly_pct, ...}, "summary": str}
    """
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    
    if features is None:
        features = df.select_dtypes(include=[np.number]).columns.tolist()
    features = [f for f in features if f in df.columns]
    
    df_clean = df[features].dropna()
    if len(df_clean) < 50:
        return {"figures": [], "stats": {}, "summary": f"Insufficient data ({len(df_clean)} rows)."}
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df_clean)
    
    iso = IsolationForest(contamination=contamination, random_state=42, n_jobs=-1)
    labels = iso.fit_predict(X_scaled)
    scores = iso.decision_function(X_scaled)
    
    df_result = df_clean.copy()
    df_result["anomaly"] = labels
    df_result["anomaly_score"] = scores
    
    anomaly_count = int((labels == -1).sum())
    anomaly_pct = round(anomaly_count / len(df_clean) * 100, 2)
    
    # Feature importance via mean absolute score difference
    normal_mask = labels == 1
    feature_importance = {}
    for i, feat in enumerate(features):
        normal_vals = X_scaled[normal_mask, i]
        anomaly_vals = X_scaled[~normal_mask, i]
        if len(anomaly_vals) > 0:
            feature_importance[feat] = round(float(abs(anomaly_vals.mean() - normal_vals.mean())), 4)
    feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
    
    # Plot anomaly timeline
    figures = []
    n_plot = min(3, len(features))
    fig, axes = plt.subplots(n_plot + 1, 1, figsize=(16, 3 * (n_plot + 1)), sharex=True)
    
    anomalies = df_result[df_result["anomaly"] == -1]
    
    for i in range(n_plot):
        col = features[i]
        axes[i].plot(df_result.index, df_result[col], alpha=0.5, linewidth=0.5, color='steelblue')
        axes[i].scatter(anomalies.index, anomalies[col], c='red', s=8, zorder=5, label='Anomaly')
        axes[i].set_ylabel(col, fontsize=9)
        axes[i].legend(fontsize=7)
        axes[i].grid(True, alpha=0.3)
    
    axes[0].set_title(f"Isolation Forest Anomaly Detection ({anomaly_count} anomalies, {anomaly_pct}%)",
                      fontsize=11, fontweight='bold')
    
    axes[-1].plot(df_result.index, df_result["anomaly_score"], alpha=0.7, linewidth=0.5, color='purple')
    axes[-1].axhline(y=0, color='red', linestyle='--', alpha=0.5)
    axes[-1].set_ylabel("Anomaly Score")
    axes[-1].set_xlabel("Time")
    axes[-1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    path = os.path.join(output_dir, "anomaly_timeline.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    figures.append(path)
    
    stats = {
        "anomaly_count": anomaly_count,
        "anomaly_pct": anomaly_pct,
        "total_points": len(df_clean),
        "features_used": features,
        "contamination": contamination,
        "feature_importance": feature_importance,
    }
    
    lines = [f"Isolation Forest Anomaly Detection:"]
    lines.append(f"  Anomalies: {anomaly_count} / {len(df_clean)} ({anomaly_pct}%)")
    lines.append(f"  Features: {', '.join(features)}")
    lines.append(f"  Top contributors: {', '.join(list(feature_importance.keys())[:5])}")
    
    return {"figures": figures, "stats": stats, "summary": "\n".join(lines)}


def anomaly_timeline(df: pd.DataFrame, anomaly_col: str = "anomaly",
                     score_col: str = "anomaly_score",
                     target_cols: list[str] | None = None,
                     output_dir: str = "output") -> dict:
    """
    Visualize pre-computed anomaly labels on a timeline.
    Expects df to already have 'anomaly' and 'anomaly_score' columns.
    """
    if anomaly_col not in df.columns:
        return {"figures": [], "stats": {}, "summary": "No anomaly column found. Run isolation_forest_analysis first."}
    
    if target_cols is None:
        target_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                       if c not in [anomaly_col, score_col]][:4]
    
    anomalies = df[df[anomaly_col] == -1]
    n_plots = len(target_cols)
    
    fig, axes = plt.subplots(n_plots, 1, figsize=(16, 3 * n_plots), sharex=True)
    if n_plots == 1:
        axes = [axes]
    
    for i, col in enumerate(target_cols):
        axes[i].plot(df.index, df[col], alpha=0.5, linewidth=0.5)
        if len(anomalies) > 0 and col in anomalies.columns:
            axes[i].scatter(anomalies.index, anomalies[col], c='red', s=8, zorder=5)
        axes[i].set_ylabel(col, fontsize=9)
        axes[i].grid(True, alpha=0.3)
    
    axes[0].set_title(f"Anomaly Timeline ({len(anomalies)} anomalies marked)", fontsize=11, fontweight='bold')
    plt.tight_layout()
    
    path = os.path.join(output_dir, "anomaly_timeline_detail.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return {
        "figures": [path],
        "stats": {"anomaly_count": len(anomalies), "variables_shown": target_cols},
        "summary": f"Anomaly timeline plotted for {', '.join(target_cols)}.",
    }


def regime_detection(df: pd.DataFrame, features: list[str] | None = None,
                     eps: float = 0.8, min_samples: int = 50,
                     output_dir: str = "output") -> dict:
    """
    Detect operating regimes using DBSCAN clustering.
    
    Returns:
        {"figures": [path], "stats": {n_regimes, regime_stats: [...]}, "summary": str}
    """
    from sklearn.cluster import DBSCAN
    from sklearn.preprocessing import StandardScaler
    
    if features is None:
        features = df.select_dtypes(include=[np.number]).columns.tolist()[:6]
    features = [f for f in features if f in df.columns]
    
    df_clean = df[features].dropna()
    if len(df_clean) < min_samples * 2:
        return {"figures": [], "stats": {}, "summary": f"Insufficient data ({len(df_clean)} rows)."}
    
    X = StandardScaler().fit_transform(df_clean.values)
    clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(X)
    df_clean = df_clean.copy()
    df_clean["regime"] = clustering.labels_
    
    labels = set(clustering.labels_)
    n_regimes = len(labels) - (1 if -1 in labels else 0)
    noise_count = int((clustering.labels_ == -1).sum())
    
    regime_stats = []
    for label in sorted(labels):
        if label == -1:
            continue
        mask = df_clean["regime"] == label
        count = int(mask.sum())
        regime_info = {"regime": int(label), "count": count, "pct": round(count / len(df_clean) * 100, 1)}
        for feat in features:
            regime_info[f"{feat}_mean"] = round(float(df_clean.loc[mask, feat].mean()), 2)
        regime_stats.append(regime_info)
    
    # Scatter plot of first two features colored by regime
    fig, ax = plt.subplots(figsize=(10, 7))
    scatter = ax.scatter(df_clean[features[0]], df_clean[features[1]],
                         c=df_clean["regime"], cmap='tab10', s=3, alpha=0.5)
    ax.set_xlabel(features[0])
    ax.set_ylabel(features[1])
    ax.set_title(f"Operating Regimes ({n_regimes} detected, {noise_count} noise points)",
                 fontsize=11, fontweight='bold')
    plt.colorbar(scatter, ax=ax, label='Regime')
    plt.tight_layout()
    
    path = os.path.join(output_dir, "regime_detection.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    lines = [f"Operating Regime Detection (DBSCAN eps={eps}, min_samples={min_samples}):"]
    lines.append(f"  Regimes found: {n_regimes}, Noise points: {noise_count}")
    for rs in regime_stats:
        feat_str = ", ".join(f"{f}={rs[f'{f}_mean']:.1f}" for f in features[:3])
        lines.append(f"  Regime {rs['regime']}: {rs['count']} pts ({rs['pct']}%) — {feat_str}")
    
    return {
        "figures": [path],
        "stats": {"n_regimes": n_regimes, "noise_count": noise_count, "regime_stats": regime_stats},
        "summary": "\n".join(lines),
    }
