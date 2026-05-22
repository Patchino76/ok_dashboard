"""
skills/causal.py — Causal effect estimation for MV → Target relationships.
==========================================================================
Goes beyond correlations: estimates the AVERAGE TREATMENT EFFECT (ATE) of an
MV (Ore, WaterMill, WaterZumpf, MotorAmp) on a Target (PSI80, PSI200) while
adjusting for confounders (DVs and other MVs).

Three light-weight estimators (no PyMC / DoWhy dependency):
  • naive_ate        — mean-difference between high/low treatment groups
                       (biased; included as a baseline for comparison)
  • adjusted_ate     — OLS coefficient with confounder controls + 95% CI
                       (interpreted as ∂Target/∂MV, holding confounders fixed)
  • ipw_ate          — Inverse Probability Weighting using a logistic propensity
                       model (binarised treatment at the median)

A natural-experiment plot compares the unadjusted vs adjusted effect so the
reporter can show users why simple correlations can mislead.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats as scipy_stats


def _safe_float(x, default=None):
    try:
        v = float(x)
        if not np.isfinite(v):
            return default
        return round(v, 4)
    except Exception:
        return default


def _bootstrap_ci(values: np.ndarray, n_boot: int = 2000, alpha: float = 0.05) -> tuple[float, float]:
    if len(values) < 5:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(42)
    idx = rng.integers(0, len(values), size=(n_boot, len(values)))
    means = values[idx].mean(axis=1)
    lo = float(np.quantile(means, alpha / 2))
    hi = float(np.quantile(means, 1 - alpha / 2))
    return (round(lo, 4), round(hi, 4))


def naive_vs_adjusted_ate(
    df: pd.DataFrame,
    treatment: str,
    target: str,
    confounders: list[str] | None = None,
    output_dir: str = "output",
) -> dict:
    """
    Compare naive (unadjusted) vs OLS-adjusted causal effect of `treatment`
    on `target`, holding `confounders` fixed.

    Parameters
    ----------
    df         : DataFrame with the columns
    treatment  : MV column name (e.g. 'WaterMill')
    target     : Target column name (e.g. 'PSI80')
    confounders: list of columns to adjust for (default: all numeric except
                 treatment, target, Power, and obviously-derived metrics)
    """
    os.makedirs(output_dir, exist_ok=True)

    if treatment not in df.columns or target not in df.columns:
        return {
            "figures": [], "stats": {},
            "summary": f"causal: column missing ({treatment} or {target}).",
        }

    if confounders is None:
        skip = {treatment, target, "Power"}
        confounders = [c for c in df.select_dtypes(include=[np.number]).columns
                       if c not in skip]

    cols = [treatment, target] + [c for c in confounders if c in df.columns]
    sub = df[cols].dropna()
    n = len(sub)
    if n < 30:
        return {
            "figures": [], "stats": {"n": n},
            "summary": f"causal: too few rows ({n}) to estimate.",
        }

    # 1) Naive ATE — high vs low treatment, no adjustment
    median_t = float(sub[treatment].median())
    high = sub[sub[treatment] >= median_t][target].values
    low  = sub[sub[treatment] <  median_t][target].values
    naive_ate = float(np.mean(high) - np.mean(low)) if len(high) and len(low) else float("nan")
    naive_ci = _bootstrap_ci(np.asarray(high) - np.mean(low)) if len(high) >= 5 else (float("nan"), float("nan"))

    # 2) Adjusted ATE — OLS with confounders (∂Y/∂T)
    # Build design matrix: [intercept, T, C1, C2, ...]
    T = sub[treatment].values.reshape(-1, 1)
    C = sub[[c for c in confounders if c in sub.columns]].values
    X = np.hstack([np.ones((n, 1)), T, C])
    y = sub[target].values

    try:
        beta, *_ = np.linalg.lstsq(X, y, rcond=None)
        # Standard error of the treatment coefficient via OLS residuals
        resid = y - X @ beta
        sigma2 = float(np.sum(resid ** 2) / max(n - X.shape[1], 1))
        XtX_inv = np.linalg.pinv(X.T @ X)
        se_beta = float(np.sqrt(sigma2 * XtX_inv[1, 1]))
        adj_coef = float(beta[1])
        # 95% CI via t-distribution
        t_crit = float(scipy_stats.t.ppf(0.975, max(n - X.shape[1], 1)))
        adj_ci = (round(adj_coef - t_crit * se_beta, 4),
                  round(adj_coef + t_crit * se_beta, 4))
        # Translate to a comparable ATE scale: coefficient × IQR(treatment)
        iqr_t = float(sub[treatment].quantile(0.75) - sub[treatment].quantile(0.25))
        adj_ate = float(adj_coef * iqr_t)
        # Significance
        t_stat = adj_coef / se_beta if se_beta > 0 else float("nan")
        p_value = 2 * (1 - scipy_stats.t.cdf(abs(t_stat), max(n - X.shape[1], 1))) if np.isfinite(t_stat) else float("nan")
    except Exception as e:
        adj_coef = float("nan"); adj_ate = float("nan"); adj_ci = (float("nan"), float("nan"))
        p_value = float("nan"); iqr_t = float("nan")

    # 3) IPW ATE — binarised treatment, logistic propensity
    ipw_ate = float("nan")
    try:
        from sklearn.linear_model import LogisticRegression
        T_bin = (sub[treatment].values >= median_t).astype(int)
        if C.shape[1] > 0 and len(np.unique(T_bin)) == 2:
            lr = LogisticRegression(max_iter=200)
            lr.fit(C, T_bin)
            ps = lr.predict_proba(C)[:, 1].clip(0.05, 0.95)  # truncate extreme weights
            w1 = T_bin / ps
            w0 = (1 - T_bin) / (1 - ps)
            mu1 = float(np.sum(w1 * y) / np.sum(w1))
            mu0 = float(np.sum(w0 * y) / np.sum(w0))
            ipw_ate = float(mu1 - mu0)
    except Exception:
        pass

    # ── Plot: naive vs adjusted vs IPW
    fig_path = os.path.join(output_dir, f"causal_{treatment}_to_{target}.png")
    fig, ax = plt.subplots(figsize=(8, 4.5))
    estimators = ["Naive (no adj.)", "OLS-adjusted (×IQR)", "IPW"]
    values = [naive_ate, adj_ate, ipw_ate]
    cis_lo = [naive_ci[0], adj_ci[0] * iqr_t if np.isfinite(iqr_t) else float("nan"), float("nan")]
    cis_hi = [naive_ci[1], adj_ci[1] * iqr_t if np.isfinite(iqr_t) else float("nan"), float("nan")]
    colors = ["#94a3b8", "#10b981", "#6366f1"]
    bars = ax.bar(estimators, values, color=colors, edgecolor="black")
    for b, lo, hi in zip(bars, cis_lo, cis_hi):
        if np.isfinite(lo) and np.isfinite(hi):
            ax.errorbar(b.get_x() + b.get_width() / 2, b.get_height(),
                        yerr=[[b.get_height() - lo], [hi - b.get_height()]],
                        fmt="none", color="black", capsize=4, lw=1.2)
    ax.axhline(0, color="black", lw=0.8)
    ax.set_ylabel(f"Δ {target} per IQR change in {treatment}")
    ax.set_title(f"Causal effect: {treatment} → {target}  (n={n})")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    stats = {
        "n": int(n),
        "treatment": treatment,
        "target": target,
        "naive_ate": _safe_float(naive_ate),
        "naive_ci_lo": _safe_float(naive_ci[0]),
        "naive_ci_hi": _safe_float(naive_ci[1]),
        "ols_coef": _safe_float(adj_coef),
        "ols_ate_per_iqr": _safe_float(adj_ate),
        "ols_ci_lo_per_iqr": _safe_float(adj_ci[0] * iqr_t if np.isfinite(iqr_t) else float("nan")),
        "ols_ci_hi_per_iqr": _safe_float(adj_ci[1] * iqr_t if np.isfinite(iqr_t) else float("nan")),
        "ols_p_value": _safe_float(p_value),
        "ipw_ate": _safe_float(ipw_ate),
        "iqr_treatment": _safe_float(iqr_t),
        "n_confounders": int(C.shape[1]),
    }

    sig = "значим" if (stats["ols_p_value"] is not None and stats["ols_p_value"] < 0.05) else "несигнификантен"
    summary = (
        f"Causal effect of {treatment} on {target} (n={n}, "
        f"{stats['n_confounders']} confounders):\n"
        f"  Naive Δ (high − low) = {stats['naive_ate']}, "
        f"95% CI [{stats['naive_ci_lo']}, {stats['naive_ci_hi']}]\n"
        f"  OLS coefficient β = {stats['ols_coef']} per unit of {treatment}, p = {stats['ols_p_value']} ({sig})\n"
        f"  OLS Δ per IQR change = {stats['ols_ate_per_iqr']}, "
        f"95% CI [{stats['ols_ci_lo_per_iqr']}, {stats['ols_ci_hi_per_iqr']}]\n"
        f"  IPW estimator Δ (high − low) = {stats['ipw_ate']}\n"
        f"  Interpretation: large gap between naive and adjusted ⇒ confounders matter."
    )

    return {"figures": [fig_path], "stats": stats, "summary": summary}


def all_mv_effects(
    df: pd.DataFrame,
    target: str = "PSI80",
    mvs: list[str] | None = None,
    output_dir: str = "output",
) -> dict:
    """
    Run naive_vs_adjusted_ate for every MV against the target and produce
    one comparison chart of OLS-adjusted effects (per-IQR change).
    """
    os.makedirs(output_dir, exist_ok=True)
    if mvs is None:
        mvs = [c for c in ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"] if c in df.columns]

    rows = []
    figures = []
    for mv in mvs:
        # Use OTHER MVs + DV-like columns as confounders
        other_mvs = [m for m in ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"]
                     if m != mv and m in df.columns]
        dvs = [c for c in ["Shisti", "Daiki", "Grano", "Class_12", "Class_15"]
               if c in df.columns]
        confounders = other_mvs + dvs
        res = naive_vs_adjusted_ate(df, mv, target, confounders=confounders,
                                    output_dir=output_dir)
        figures.extend(res.get("figures", []))
        s = res.get("stats", {})
        if s:
            rows.append({
                "mv": mv,
                "ols_ate_per_iqr": s.get("ols_ate_per_iqr"),
                "ols_p_value": s.get("ols_p_value"),
                "naive_ate": s.get("naive_ate"),
                "ipw_ate": s.get("ipw_ate"),
                "n": s.get("n"),
            })

    if not rows:
        return {"figures": figures, "stats": {"effects": []},
                "summary": f"causal: no MVs available for {target}."}

    # Comparison plot
    fig_path = os.path.join(output_dir, f"causal_all_mv_to_{target}.png")
    fig, ax = plt.subplots(figsize=(8, 5))
    rows_sorted = sorted(rows, key=lambda r: abs(r["ols_ate_per_iqr"] or 0), reverse=True)
    names = [r["mv"] for r in rows_sorted]
    ates = [r["ols_ate_per_iqr"] or 0 for r in rows_sorted]
    pvals = [r["ols_p_value"] for r in rows_sorted]
    colors = ["#10b981" if (p is not None and p < 0.05) else "#cbd5e1" for p in pvals]
    bars = ax.barh(names, ates, color=colors, edgecolor="black")
    for b, p in zip(bars, pvals):
        label = "p<0.001" if (p is not None and p < 0.001) else (f"p={p:.3f}" if p is not None else "p=?")
        ax.text(b.get_width(), b.get_y() + b.get_height() / 2,
                f"  {label}", va="center", fontsize=9)
    ax.axvline(0, color="black", lw=0.8)
    ax.set_xlabel(f"Δ {target} per IQR change in MV (OLS-adjusted)")
    ax.set_title(f"Adjusted causal effects of MVs on {target}")
    ax.grid(axis="x", alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    figures.append(fig_path)

    summary_lines = [f"Adjusted MV effects on {target} (sorted by |effect|):"]
    for r in rows_sorted:
        sig = "*" if (r["ols_p_value"] is not None and r["ols_p_value"] < 0.05) else " "
        summary_lines.append(
            f"  {r['mv']:<12} Δ/IQR = {r['ols_ate_per_iqr']:+.3f}  "
            f"(naive {r['naive_ate']:+.3f}, IPW {r['ipw_ate']:+.3f})  "
            f"p={r['ols_p_value']} {sig}"
        )

    return {
        "figures": figures,
        "stats": {"effects": rows_sorted, "target": target},
        "summary": "\n".join(summary_lines),
    }
