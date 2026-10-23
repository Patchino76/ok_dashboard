# Mills-XGBoost Optimization — Improvement Roadmap

> Goal: improve prediction accuracy for grinding fineness targets (**PSI200 = +200 μm**, **PSI80 = -80 μm**),
> make Bayesian optimization trustworthy, clean the codebase, and improve operator UX.
>
> Context from discovery: models predict **poorly**, and the **MV→Target lag is unknown**.
> This roadmap is sequenced so that each phase de-risks the next.

---

## Guiding Principles

1. **Measure before changing.** We currently have no honest baseline (train/test split shuffles time-series → leakage). Every change is judged against a fixed, leak-free benchmark.
2. **Physics first, ML second.** The biggest accuracy gains here are almost certainly in *data alignment and quality*, not in the choice of ML algorithm.
3. **Uncertainty is a feature.** Poorly-predicting models must at least *know* they are uncertain, so optimization and operators can act accordingly.
4. **One clean path.** Collapse the sprawl (`simple_`, `gpr_`, `target_driven_`, `production_` optimizers; duplicate model managers) into a single maintained pipeline.

---

## Current-State Summary (as found in code)

| Area | File | Current approach | Key issue |
|------|------|------------------|-----------|
| Data extract | `database/db_connector.py` | MOTIFS tables, join on timestamp, 1-min resample, linear interp | **No MV→Target lag**; imputation not tracked; simultaneous-row assumption |
| Steady-state | `steady_state_extraction/` | STUMPY matrix profile + motif discovery | Strong asset; keep |
| Modeling | `cascade_models.py` | XGBoost per-CV + quality model, hardcoded params | Shuffled split (leakage), no HPO, mean-only |
| Uncertainty | `gpr_cascade_models.py` | GPR with std | Parallel/duplicated; not surfaced in UI |
| Optimization | `simple_cascade_optimizer.py` | Optuna TPE, soft penalty (×1000) | Single-objective; soft constraints allow infeasible optima |
| Variables | `variable_classifier.py` | MV/CV/DV/Target + bounds | Most DVs `enabled=False` |

---

## Phase 0 — Baseline & Diagnostics (foundation)
**Effort: S (1–2 days) · Impact: enabling · Risk: none**

Nothing improves reliably without a baseline. Deliver a diagnostic that reports the *true* current quality.

- [ ] **Leak-free evaluation harness.** Replace `train_test_split(shuffle)` with `TimeSeriesSplit` / blocked CV. Report per-CV and per-Target R², RMSE, MAE on held-out *future* data.
- [ ] **Full-chain metric.** Evaluate end-to-end MV→(predicted CV)→Target, not just each stage in isolation. This is the number that matters for optimization.
- [ ] **Data-quality report.** Per column: % missing, % interpolated/ffilled, sensor stuck/flatline detection, physically-impossible rows (mass balance, `CirculativeLoad` out of [1.5, 3.0]).
- [ ] Persist baseline metrics to JSON so every later phase can show delta.

**Exit criterion:** we have a single command that prints honest current accuracy + data-quality stats.

---

## Phase 1 — Lag Estimation & Time Alignment (highest expected accuracy win)
**Effort: M (2–4 days) · Impact: high · Risk: medium**

The MV→Target delay is unknown and currently assumed zero. Milling has real transport/residence delay (motif window already uses `residence_time_minutes=60`).

- [ ] **Estimate lag from data.** Per MV→CV and CV/DV→Target pair, compute cross-correlation / mutual information across candidate lags (0–120 min). Report the lag that maximizes association.
- [ ] **Validate against physics.** Cross-check estimated lags against known residence time; flag implausible results.
- [ ] **Lag-aligned feature builder.** Shift MVs forward by their estimated lag before training so row `t` pairs MV(t) with Target(t+lag).
- [ ] **Optional: lag features.** Add rolling means / lag windows of MVs (not just point values) to capture dynamics.
- [ ] Re-run Phase 0 harness → quantify accuracy gain.

**Exit criterion:** measurable R² improvement on the leak-free full-chain metric after alignment.

---

## Phase 2 — Data Quality & Weighting
**Effort: S–M (2–3 days) · Impact: medium-high · Risk: low**

- [ ] **Per-row quality weight** = fraction of real (non-imputed) values; pass as XGBoost `sample_weight`.
- [ ] **Physical sanity filters** before training (mass balance, density vs solids consistency, sensor cross-checks).
- [ ] **Outlier handling** tuned for sensor noise (robust z-score / Hampel filter rather than dropping blindly).
- [ ] Feed cleaner + weighted data through the same harness → quantify gain.

**Exit criterion:** improved metrics and a documented data-quality gate.

---

## Phase 3 — Modeling Upgrades
**Effort: M (3–5 days) · Impact: medium-high · Risk: low**

- [ ] **Hyperparameter optimization** with Optuna (already a dependency) per model, using leak-free CV + early stopping. Replaces hardcoded `n_estimators=200, max_depth=6, lr=0.1`.
- [ ] **Algorithm bake-off** on the harness: XGBoost vs **LightGBM** vs **CatBoost** (CatBoost is notably robust to noisy sensor data). Pick per-target winner.
- [ ] **Uncertainty quantification for the tree path:** quantile regression (`reg:quantileerror`) or **NGBoost** to produce prediction intervals — parity with the existing GPR path.
- [ ] **Fix cascade train/inference mismatch:** quality model trains on *measured* CVs but runs on *predicted* CVs. Train (or fine-tune) on predicted CVs, or explicitly validate/penalize the propagation error.
- [ ] **SHAP** feature attribution stored with each model (drives Phase 5 UI + operator trust).

**Exit criterion:** best model per target selected by honest metric, with prediction intervals available.

---

## Phase 4 — Optimization Quality
**Effort: M (3–4 days) · Impact: high (trust) · Risk: medium**

- [ ] **Hard constraints instead of soft penalty.** Current `penalty_factor=1000` quadratic penalty can return "optimal-but-infeasible" setpoints. Use Optuna constrained optimization (or reject/clip infeasible trials) so proposals always respect CV bounds.
- [ ] **Robust optimization under uncertainty.** Use the Phase 3 prediction intervals: prefer setpoints that are good *and* confident (e.g. optimize a risk-adjusted objective), not just the mean optimum.
- [ ] **Multi-objective (Pareto).** Optimize PSI200 target vs throughput (Ore) vs energy (MotorAmp) with Optuna `NSGAIISampler`; expose the Pareto front to the UI for operator trade-off selection.
- [ ] **Warm-start / feasibility seeding** from recent good operating points to speed convergence.
- [ ] **DV handling.** Re-evaluate the disabled DVs (Shisti/Daiki/Grano/FE). If ore composition drives fineness, enable + lag-align them; otherwise document why they stay off.

**Exit criterion:** optimizer returns only feasible, confidence-aware setpoints; optional Pareto output.

---

## Phase 5 — UI / UX
**Effort: M (3–5 days) · Impact: high (adoption) · Risk: low**

- [ ] **Confidence bands** on target trend charts (surface Phase 3 intervals / GPR std).
- [ ] **"Why this setpoint" panel** using SHAP — show which MVs drive the recommendation.
- [ ] **Feasibility indicator** — clear visual when proposed CVs approach/violate constraints.
- [ ] **Pareto trade-off selector** — let operators choose along fineness/throughput/energy front.
- [ ] **Model health badge** — show current model R²/freshness so operators know how much to trust it.

**Exit criterion:** operators can see prediction, confidence, reasoning, and feasibility at a glance.

---

## Phase 6 — Codebase Cleanup (run in parallel / continuous)
**Effort: M (ongoing) · Impact: maintainability · Risk: medium (regression)**

- [ ] **Consolidate optimizers:** merge `simple_cascade_optimizer.py`, `gpr_cascade_optimizer.py`, `target_driven_optimizer.py`, `production_cascade_optimizer.py` into one configurable optimizer.
- [ ] **Unify model managers:** single `CascadeModelManager` with pluggable backend (XGB/LGBM/CatBoost/GPR) instead of parallel classes.
- [ ] **Remove dead/backup dirs:** `BackupModels/`, `old_files_to_delete/` (referenced by `simple_cascade_optimizer.get_default_bounds`!), stray test scripts.
- [ ] **Fix broken import** in `simple_cascade_optimizer.get_default_bounds` → `from .old_files_to_delete.variable_classifier` (points at a delete folder).
- [ ] **Regression safety:** only refactor modules already covered by the Phase 0 harness.

**Exit criterion:** one clean pipeline; no duplicate/broken imports; dead code removed.

---

## Suggested Execution Order

```
Phase 0 (baseline)  ──►  Phase 1 (lag)  ──►  Phase 2 (data quality)  ──►  Phase 3 (models)
                                                                             │
                                                    Phase 6 (cleanup) runs alongside 1–3
                                                                             ▼
                                                          Phase 4 (optimization)  ──►  Phase 5 (UI)
```

Rationale: with lag unknown and accuracy poor, **Phase 0 + Phase 1 are the priority** — they will likely explain and fix most of the accuracy problem before we spend effort on fancier ML or UI.

---

## New Libraries Proposed (add to `requirements.txt` when adopted)

| Library | Purpose | Phase |
|---------|---------|-------|
| `catboost`, `lightgbm` | Robust gradient boosting bake-off | 3 |
| `ngboost` | Native probabilistic predictions | 3 |
| `shap` | Feature attribution / explainability | 3, 5 |
| `optuna` (have it) | HPO + multi-objective (NSGA-II) | 3, 4 |
| `stumpy` (have it) | Steady-state motif extraction | keep |

---

## Open Questions to Confirm Before Building

1. **Data volume & history** — how many months of MOTIFS data per mill are available for training/validation?
2. **Retraining cadence** — should models retrain automatically (e.g. weekly), or on-demand only?
3. **Deployment constraint** — is optimization latency important (real-time operator use) or is a few seconds fine?
4. **Ground truth for fineness** — how frequently is PSI200/PSI80 actually sampled/labeled (lab cadence)? This bounds achievable accuracy and lag estimation resolution.
