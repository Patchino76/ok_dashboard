# 08 — Specialists

Six "specialist" LLM personas form the analysis pool. They share the same
Gemini model, tool set (`execute_python` + `list_output_files` + `list_skills`)
and context-compression plumbing, but each has a distinct system prompt that
defines its domain focus and a preferred skill chain.

## The pool

```python
SPECIALIST_POOL = [
    "analyst",            # EDA, SPC, correlations
    "forecaster",         # Prophet / ARIMA / seasonality
    "anomaly_detective",  # Isolation Forest, regimes, root cause
    "bayesian_analyst",   # bootstrap credible intervals
    "optimizer",          # Pareto, sensitivity, setpoints
    "shift_reporter",     # shift KPIs, downtime, benchmarking
]
```

The planner picks **1–4** of these per analysis. Two other "specialists" bracket
the pool and always run: `data_loader` (before) and `code_reviewer` + `reporter`
(after).

```
data_loader  →  planner  →  [ N chosen specialists ]  →  code_reviewer  →  reporter
   (fixed)                       (dynamic, 1-4)                  (fixed)
```

## Shared preamble: `DOMAIN_CONTEXT`

Every specialist prompt starts with the same paragraph:

```
You are working on data from an ore dressing (mineral processing) factory with 12 ball mills.
Data is in MILL_XX tables (minute-level time-series) with columns:
TimeStamp (index), Ore (t/h), WaterMill, WaterZumpf, Power, ZumpfLevel,
PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200.
…
Process relationships:
- MVs: Ore, WaterMill, WaterZumpf, MotorAmp — operators control these
- CVs: PressureHC, DensityHC, PulpHC — respond to MV changes
- DVs: Shisti, Daiki, Grano, Class_12, Class_15 — ore properties
- Targets: PSI80, PSI200
- Shifts: 06-14 / 14-22 / 22-06
```

This alone keeps the LLM grounded even on the first call before any tool has
run.

## Specialist details

### `data_loader`

- **Tool set:** `get_db_schema`, `query_mill_data`, `query_combined_data`.
- **Purpose:** compute a date window from the user's wording ("last 72 hours"
  → explicit `start_date`/`end_date`) and load exactly what's needed.
- **Prompt injects** `{TODAY_DATE}` so it can do the math.
- **Critical rules:** always pass `start_date` and `end_date` at SQL level,
  never load full tables; use `query_combined_data` when ore-quality
  variables are involved; "all mills" → load 1..12 in sequence.
- **Output:** a one-paragraph summary of what was loaded (mills, rows,
  columns, date range). It does **not** analyse.

### `analyst`

- **Chain (preferred):**
  1. `skills.eda.descriptive_stats(df, [...])`
  2. `skills.eda.distribution_plots(...)`
  3. `skills.eda.correlation_heatmap(...)`
  4. `skills.spc.xbar_chart(...)` + `skills.spc.process_capability(...)`
     using `get_spec_limits('PSI80')`.
  5. `skills.eda.time_series_overview(...)`
- **Role:** foundational numbers. Everything downstream (forecasts, anomaly
  comments, reporter narrative) leans on the analyst's stats.
- The planner defaults to including `analyst` for any vague request.

### `forecaster`

- **Chain:**
  1. `skills.forecasting.seasonal_decomposition(df, 'PSI80')` and for `Ore`
     if relevant.
  2. `skills.forecasting.prophet_forecast(..., periods=480, freq='1min')`
     — 8-hour horizon by default.
  3. `skills.shift_kpi.assign_shifts` + `shift_kpis` for shift-level trends.
- Raw `sm` / `tsa` / `pmdarima` are available in the namespace for ARIMA
  tweaks, but the prompt explicitly tells it **not** to write raw Prophet code
  when the skill exists.

### `anomaly_detective`

- **Chain:**
  1. `skills.anomaly.isolation_forest_analysis(df, features=[...],
     contamination=0.05)`
  2. `skills.anomaly.regime_detection(df, features=[...])`
  3. Raw code (SHAP or feature-importance based) for **root cause analysis**
     — the one area explicitly allowed to bypass skills.
- Grouping anomalies by time proximity and reporting "top 5 events with
  duration and affected variables" is part of the prompt contract.

### `bayesian_analyst`

- **No PyMC / bambi** (deliberately — deployment constraint).
- Uses `scipy_stats` + bootstrap for:
  1. 5000-resample credible intervals for PSI80 mean.
  2. A/B comparison at median `Ore` split.
  3. Bootstrap `Cpk` with `P(Cpk > 1.0)` and `P(Cpk > 1.33)`.
  4. Effect sizes per MV via bootstrap regression coefficients.
  5. Conditional probabilities like `P(PSI80 out of spec | DensityHC > X)`.
- Charts are hand-written with matplotlib; no skill helpers for this one yet.

### `optimizer`

- **Chain:**
  1. `skills.optimization.pareto_frontier(hourly, 'Ore', 'PSI80')` after
     hourly resampling.
  2. `skills.optimization.sensitivity_analysis(df, 'PSI80', [...])`.
  3. `skills.optimization.optimal_windows(df, 'PSI80', [...])`.
  4. Raw Monte-Carlo code for risk quantification.
  5. Constraint-aware recommendations expressed as **specific setpoint
     ranges** — the prompt explicitly forbids vague phrases like "increase
     water"; it must say e.g. "set WaterMill to 22–25 m³/h".

### `shift_reporter`

- **Chain:**
  1. `skills.shift_kpi.assign_shifts(df)` → adds `shift` + `shift_date`.
  2. `skills.shift_kpi.shift_kpis(df, [...])`.
  3. `skills.shift_kpi.shift_comparison_chart(...)`.
  4. `skills.shift_kpi.downtime_analysis(..., threshold=10)`.
  5. Pairwise Mann-Whitney U between shifts (raw scipy).
  6. If multiple mills are loaded: benchmark across mills with
     `Ore mean / PSI80 mean / Uptime % / Energy kWh/ton`.
  7. A formal shift-handover summary for the most recent shift.

### `code_reviewer`

- **Purpose:** last gate before the reporter.
- **Expected actions:** call `list_output_files`, check stdout for errors,
  look for missing or failed charts, fix anything with one more
  `execute_python` call if truly necessary.
- **Explicit prohibition:** *"Do NOT regenerate charts that already exist."*
- Auto-accepted by `manager_review` (no LLM judgement needed).

### `reporter`

- **Tool set:** `list_output_files`, `write_markdown_report` (no analysis
  tools — it cannot run more code).
- **Required report sections:** Title · Executive Summary · Data Overview ·
  one **Findings** section per specialist that ran · Charts (every PNG
  embedded) · Conclusions & Recommendations.
- **Mandatory rules:** extract real numbers from prior messages (not
  placeholders); use **exact filenames** from `list_output_files`; target
  ≥ 1 500 words.
- Auto-accepted by `manager_review` — once the `.md` file is on disk, the
  pipeline moves straight to `END`.

## Stage labels and descriptions

`graph_v3._STAGE_LABELS` and `_STAGE_DESCRIPTIONS` provide Bulgarian friendly
names used in progress messages:

| Stage | Label | Description shown to the user |
|-------|-------|-------------------------------|
| `data_loader` | Зареждане на данни | Зареждане на данни от базата... |
| `analyst` | Анализатор | Статистически анализ, разпределения и SPC диаграми... |
| `forecaster` | Прогнозиране | Прогнозиране на трендове и сезонност... |
| `anomaly_detective` | Детектор на аномалии | Търсене на аномалии и причини... |
| `bayesian_analyst` | Байесов анализ | Байесов анализ и доверителни интервали... |
| `optimizer` | Оптимизатор | Оптимизация на настройки и препоръки... |
| `shift_reporter` | Сменен отчет | Анализ по смени и KPI показатели... |
| `code_reviewer` | Проверка на резултати | Проверка на диаграми и резултати... |
| `reporter` | Генериране на отчет | Писане на краен отчет... |

## Adding a new specialist

See **16 — Extending** for the full procedure. The short version:

1. Write a `NEW_SPECIALIST_PROMPT = f"""{DOMAIN_CONTEXT} ..."""` string.
2. Add it to `ALL_PROMPTS` in `build_graph`.
3. Add the name to `SPECIALIST_POOL`.
4. Add it to `TOOL_SETS` (usually `ANALYSIS_TOOLS`).
5. Add friendly labels in `_STAGE_LABELS` and `_STAGE_DESCRIPTIONS`.
6. Extend the planner prompt with a "USE when …" line.
7. Optional: add it to one or more templates in `analysis_templates.py`.
