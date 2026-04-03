"""
graph_v3.py — Enhanced Multi-Agent LangGraph with Dynamic Specialist Pool
==========================================================================
Planner-driven architecture that selects only the relevant specialists:

  [START] → [data_loader] → [manager_review] →
            [planner] →
            [specialist_1] ↔ [tools] → [manager_review] →
            [specialist_2] ↔ [tools] → [manager_review] →
            ...
            [code_reviewer] ↔ [tools] → [manager_review] →
            [reporter] ↔ [tools] → [END]

The planner examines the user's request + loaded data summary and decides
which specialists (from a pool of 6) to invoke. This avoids wasting LLM
calls on irrelevant specialists while enabling deep domain-specific analysis.

Specialist Pool:
  - analyst           : Basic EDA, SPC, correlations, distributions
  - forecaster        : Time series forecasting, changepoints, seasonality
  - anomaly_detective : Multivariate anomaly detection, root cause, regimes
  - bayesian_analyst  : Bayesian inference, credible intervals, causal analysis
  - optimizer         : Pareto frontiers, what-if simulation, optimal setpoints
  - shift_reporter    : Shift KPIs, benchmarking, energy efficiency, handover reports
"""

from datetime import datetime
from typing import Callable, Optional

from langchain_core.messages import (
    SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage,
)
from langchain_core.tools import BaseTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, MessagesState, END, START

GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

# Token-budget controls
MAX_TOOL_OUTPUT_CHARS = 2000
MAX_AI_MSG_CHARS = 3000
MAX_MESSAGES_WINDOW = 14
MAX_SPECIALIST_ITERS = 5


# ── State ────────────────────────────────────────────────────────────────────

class AnalysisState(MessagesState):
    current_stage: str
    stages_to_run: list[str]   # set by planner — dynamic per analysis
    stage_attempts: dict       # track rework attempts per stage


# ── Specialist pool ──────────────────────────────────────────────────────────

SPECIALIST_POOL = [
    "analyst", "forecaster", "anomaly_detective",
    "bayesian_analyst", "optimizer", "shift_reporter",
]

FIXED_PREFIX = ["data_loader", "planner"]
FIXED_SUFFIX = ["code_reviewer", "reporter"]

MAX_REWORKS_PER_STAGE = 1


# ══════════════════════════════════════════════════════════════════════════════
# System Prompts
# ══════════════════════════════════════════════════════════════════════════════

DOMAIN_CONTEXT = """You are working on data from an ore dressing (mineral processing) factory with 12 ball mills.
Data is in MILL_XX tables (minute-level time-series) with columns:
TimeStamp (index), Ore (t/h feed rate), WaterMill (water to mill), WaterZumpf (water to sump),
Power (kW), ZumpfLevel (sump level), PressureHC (hydrocyclone pressure), DensityHC (hydrocyclone density),
FE (iron content), PulpHC (hydrocyclone pulp), PumpRPM, MotorAmp (mill motor current),
PSI80 (product fineness 80% passing, μm), PSI200 (product fineness 200 mesh, %).
Ore quality lab data (ore_quality table): Shisti (schist %), Daiki (dacite %), Grano (granodiorite %),
Class_12 (fraction <12mm %), Class_15 (fraction <15mm %).

Process relationships:
- MVs (Manipulated Variables): Ore, WaterMill, WaterZumpf, MotorAmp — operators control these
- CVs (Controlled Variables): PressureHC, DensityHC, PulpHC — respond to MV changes
- DVs (Disturbance Variables): Shisti, Daiki, Grano, Class_12, Class_15 — ore properties, uncontrollable
- Targets: PSI80, PSI200 — grinding quality that must stay within specification
- Energy: Power / Ore = specific energy consumption (kWh/ton)
- Shifts: Shift 1 (06:00-14:00), Shift 2 (14:00-22:00), Shift 3 (22:00-06:00 next day)"""

# ── Data Loader ──────────────────────────────────────────────────────────────

DATA_LOADER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Loader. Your ONLY job is to call query_mill_data or query_combined_data to load data.

CRITICAL: ALWAYS compute start_date and end_date to filter at SQL level. Never load full tables.
- "last 24 hours" → end_date = today's date, start_date = yesterday's date (ISO format YYYY-MM-DD)
- "last 30 days" → end_date = today, start_date = 30 days ago
- "last week" → end_date = today, start_date = 7 days ago
- Today's date: {{TODAY_DATE}}. Use this to compute date ranges.
- If no time range is mentioned, default to last 30 days.

RULES:
- Extract mill number(s) from the request. If "all mills" → load mills 1 through 12.
- ALWAYS pass start_date and end_date to every query call.
- Use query_combined_data when ore quality analysis is needed (mentions Shisti, Daiki, ore hardness, etc.)
- Each mill is stored automatically as 'mill_data_N' or 'combined_data'.
- After loading, write a brief summary: mills loaded, rows per mill, date range, columns available.
- Do NOT analyze the data. Do NOT call any other tool."""

# ── Planner ──────────────────────────────────────────────────────────────────

PLANNER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Analysis Planner. Based on the user's request and the data that was loaded,
decide which specialist agents should run. Available specialists:

1. **analyst** — Basic EDA: descriptive statistics, distributions, SPC control charts (Xbar, UCL/LCL),
   correlation heatmaps, missing data assessment, process capability (Cp, Cpk). USE for any general
   data overview, exploratory analysis, or statistical summary request.

2. **forecaster** — Time series analysis: Prophet forecasts for key parameters (Ore, PSI80, PSI200),
   ARIMA/SARIMAX modeling, seasonal decomposition (shift/daily patterns), changepoint detection,
   trend extrapolation with confidence intervals. USE when the user asks about predictions, trends,
   forecasts, "what will happen", seasonality, or future performance.

3. **anomaly_detective** — Multivariate anomaly detection: Isolation Forest across all sensors,
   DBSCAN clustering of operating regimes, SHAP-based root cause analysis explaining WHY anomalies
   occurred, rolling anomaly scores, event timeline reconstruction. USE when the user asks about
   anomalies, unusual events, equipment problems, root causes, or regime changes.

4. **bayesian_analyst** — Bayesian statistical inference: posterior distributions for parameter effects,
   credible intervals for optimal setpoints, Bayesian A/B testing between operating conditions,
   probabilistic process capability. USE when the user asks about uncertainty, confidence levels,
   "how sure are we", comparing regimes/conditions statistically, or causal relationships.

5. **optimizer** — Process optimization: Pareto frontier analysis (throughput vs quality tradeoffs),
   what-if simulation with Gaussian Process surrogates, optimal operating windows per ore type,
   constraint-aware setpoint recommendations, Monte Carlo risk quantification. USE when the user
   asks about optimization, best settings, setpoint recommendations, tradeoffs, or "what if".

6. **shift_reporter** — Shift & operational KPIs: per-shift performance summaries, shift-over-shift
   statistical comparisons (t-tests, Mann-Whitney), mill ranking/benchmarking across all 12 mills,
   energy efficiency analysis (kWh/ton), OEE-style metrics, downtime quantification, structured
   handover reports. USE when the user asks about shifts, performance comparison, KPIs, energy,
   efficiency, benchmarking, or operational reports.

RESPOND with exactly this format (nothing else):
SPECIALISTS: agent1, agent2, agent3
RATIONALE: One sentence explaining why these specialists were chosen.

RULES:
- Always include "analyst" for general/vague requests
- Select 1-4 specialists, never all 6 (keep analysis focused)
- Order matters: put foundational analysis first (analyst), then specialized
- For "comprehensive report" or "full analysis" → analyst, anomaly_detective, shift_reporter
- For "forecast" or "predict" → analyst, forecaster
- For "optimize" or "best settings" → analyst, optimizer
- For "compare shifts" or "KPI report" → shift_reporter
- For "anomaly" or "root cause" → anomaly_detective
- For "uncertainty" or "how confident" → analyst, bayesian_analyst"""

# ── Analyst (enhanced from v2) ───────────────────────────────────────────────

ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Analyst. Data has been loaded by the data_loader.

ACCESSING DATA:
- Call list_dfs() first to see all loaded DataFrames and their shapes
- Single mill: df = get_df('mill_data_8') — for mill 8
- Multiple mills: for i in range(1, 13): df = get_df(f'mill_data_{{i}}')
- The variable `df` is pre-set to the first loaded DataFrame

ALWAYS start your code with:
```
print("Loaded DataFrames:", list_dfs())
```

ANALYSIS TO PERFORM:
1. **Descriptive Statistics**: df.describe() for key variables (Ore, PSI80, PSI200, DensityHC, MotorAmp)
2. **Distributions**: Histograms with KDE for PSI80, Ore, DensityHC
3. **SPC Control Charts**: X-bar chart with UCL/LCL (mean ± 3σ) for PSI80 and Ore
4. **Correlation Heatmap**: df[key_cols].corr() visualized as annotated heatmap
5. **Process Capability**: Cp, Cpk for PSI80 (spec: 65-85μm) and PSI200 (spec: 55-75%)
6. **Missing Data**: Percentage of NaN per column, visualize gaps
7. **Time Series Overview**: Rolling mean (1h window) for PSI80 and Ore

For MULTI-MILL comparison: build summary DataFrame with stats per mill, create bar charts.

CHART QUALITY RULES (CRITICAL):
- Use `sns.set_theme(style='whitegrid', font_scale=1.2)` at the start
- Figure sizes: bar charts (14,7), distributions (10,6), SPC (14,5), heatmap (12,10)
- All axes MUST have labels with units: 'Ore Feed Rate (t/h)', 'PSI80 (μm)', etc.
- All charts MUST have descriptive titles
- Save ALL charts: plt.savefig(os.path.join(OUTPUT_DIR, 'filename.png'), dpi=150, bbox_inches='tight')
- ALWAYS call plt.close() after each savefig

OUTPUT: Print all key statistics to stdout. The reporter will use these numbers."""

# ── Forecaster ───────────────────────────────────────────────────────────────

FORECASTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Time Series Forecaster. Your job is to model temporal patterns and generate forecasts.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded
- Data has TimeStamp index at minute resolution

AVAILABLE LIBRARIES (already imported in your namespace):
- `Prophet` from prophet — Facebook's forecasting library
- `sm` (statsmodels.api), `tsa` (statsmodels.tsa.api) — ARIMA, seasonal decomposition
- `pmdarima` — auto_arima for automatic order selection
- `pd`, `np`, `plt`, `sns`, `scipy_stats`

ANALYSIS TO PERFORM:

1. **Seasonal Decomposition** (always do this first):
```python
from statsmodels.tsa.seasonal import seasonal_decompose
# Resample to hourly first for cleaner decomposition
hourly = df['PSI80'].resample('1h').mean().dropna()
decomp = seasonal_decompose(hourly, model='additive', period=24)
fig = decomp.plot()
fig.set_size_inches(14, 10)
plt.suptitle('PSI80 Seasonal Decomposition (24h period)', fontsize=14)
plt.savefig(os.path.join(OUTPUT_DIR, 'seasonal_decomposition.png'), dpi=150, bbox_inches='tight')
plt.close()
```

2. **Prophet Forecast** (primary forecasting tool):
```python
# Prepare data for Prophet (requires 'ds' and 'y' columns)
prophet_df = df[['PSI80']].reset_index()
prophet_df.columns = ['ds', 'y']
prophet_df = prophet_df.dropna()

model = Prophet(
    changepoint_prior_scale=0.05,
    seasonality_prior_scale=10,
    daily_seasonality=True,
)
model.fit(prophet_df)

# Forecast next 8 hours
future = model.make_future_dataframe(periods=480, freq='min')
forecast = model.predict(future)

# Plot
fig = model.plot(forecast)
plt.title('PSI80 Forecast — Next 8 Hours')
plt.ylabel('PSI80 (μm)')
plt.savefig(os.path.join(OUTPUT_DIR, 'prophet_forecast.png'), dpi=150, bbox_inches='tight')
plt.close()

# Components plot (trend + seasonality)
fig2 = model.plot_components(forecast)
plt.savefig(os.path.join(OUTPUT_DIR, 'prophet_components.png'), dpi=150, bbox_inches='tight')
plt.close()
```

3. **Changepoint Detection**:
```python
# Prophet automatically detects changepoints
changepoints = model.changepoints
print(f"Detected changepoints: {{len(changepoints)}}")
for cp in changepoints[:10]:
    print(f"  {{cp}}")
```

4. **Shift-Level Patterns**: Resample to shift-level, show if Shift 1/2/3 have different averages

5. **Multi-Variable Forecast**: If time permits, also forecast Ore throughput

CRITICAL RULES:
- Always resample to hourly or 15-min before Prophet (minute data is too noisy)
- Handle NaN: dropna() before fitting
- Print forecast summary: predicted value at +4h, +8h with confidence intervals
- Save all charts to OUTPUT_DIR
- If Prophet is not available, fall back to ARIMA from statsmodels"""

# ── Anomaly Detective ────────────────────────────────────────────────────────

ANOMALY_DETECTIVE_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Anomaly Detective. Find unusual events, explain root causes, and identify operating regimes.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded

AVAILABLE LIBRARIES:
- `IsolationForest`, `DBSCAN`, `StandardScaler` from sklearn
- `shap` — SHAP explainer for feature importance
- `pd`, `np`, `plt`, `sns`, `scipy_stats`

ANALYSIS TO PERFORM:

1. **Multivariate Anomaly Detection with Isolation Forest**:
```python
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Select key process variables
features = ['Ore', 'WaterMill', 'WaterZumpf', 'PressureHC', 'DensityHC', 'MotorAmp', 'PSI80']
df_clean = df[features].dropna()

# Scale and fit
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df_clean)
iso_forest = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
df_clean['anomaly'] = iso_forest.fit_predict(X_scaled)
df_clean['anomaly_score'] = iso_forest.decision_function(X_scaled)

anomaly_count = (df_clean['anomaly'] == -1).sum()
anomaly_pct = anomaly_count / len(df_clean) * 100
print(f"Anomalies detected: {{anomaly_count}} ({{anomaly_pct:.1f}}% of data)")
```

2. **Anomaly Timeline Visualization**:
```python
fig, axes = plt.subplots(3, 1, figsize=(16, 10), sharex=True)
anomalies = df_clean[df_clean['anomaly'] == -1]

axes[0].plot(df_clean.index, df_clean['PSI80'], alpha=0.7, linewidth=0.5)
axes[0].scatter(anomalies.index, anomalies['PSI80'], c='red', s=10, label='Anomaly')
axes[0].set_ylabel('PSI80 (μm)')
axes[0].legend()
axes[0].set_title('Anomaly Detection — Process Variables')

axes[1].plot(df_clean.index, df_clean['Ore'], alpha=0.7, linewidth=0.5)
axes[1].scatter(anomalies.index, anomalies['Ore'], c='red', s=10)
axes[1].set_ylabel('Ore (t/h)')

axes[2].plot(df_clean.index, df_clean['anomaly_score'], alpha=0.7, linewidth=0.5)
axes[2].axhline(y=0, color='red', linestyle='--', alpha=0.5)
axes[2].set_ylabel('Anomaly Score')
axes[2].set_xlabel('Time')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'anomaly_timeline.png'), dpi=150, bbox_inches='tight')
plt.close()
```

3. **Root Cause Analysis with SHAP** (if shap is available):
```python
try:
    import shap
    explainer = shap.TreeExplainer(iso_forest)
    shap_values = explainer.shap_values(X_scaled[:1000])  # sample for speed
    
    fig, ax = plt.subplots(figsize=(10, 6))
    shap.summary_plot(shap_values, df_clean[features].iloc[:1000], show=False)
    plt.title('SHAP Feature Importance — Anomaly Detection')
    plt.savefig(os.path.join(OUTPUT_DIR, 'shap_anomaly_importance.png'), dpi=150, bbox_inches='tight')
    plt.close()
except Exception as e:
    print(f"SHAP analysis skipped: {{e}}")
    # Fallback: use feature importance from anomaly scores
```

4. **Operating Regime Detection with DBSCAN**:
```python
from sklearn.cluster import DBSCAN

# Use key operating parameters
regime_features = ['Ore', 'DensityHC', 'MotorAmp', 'PSI80']
X_regime = StandardScaler().fit_transform(df_clean[regime_features].values)
clustering = DBSCAN(eps=0.8, min_samples=50).fit(X_regime)
df_clean['regime'] = clustering.labels_

n_regimes = len(set(clustering.labels_)) - (1 if -1 in clustering.labels_ else 0)
print(f"Operating regimes detected: {{n_regimes}}")
for label in sorted(set(clustering.labels_)):
    if label == -1:
        continue
    mask = df_clean['regime'] == label
    print(f"  Regime {{label}}: {{mask.sum()}} points, Ore={{df_clean.loc[mask, 'Ore'].mean():.1f}}, PSI80={{df_clean.loc[mask, 'PSI80'].mean():.1f}}")
```

5. **Anomaly Cluster Analysis**: Group anomalies by time proximity, report top 5 anomaly events with duration and affected variables.

CRITICAL: Print detailed findings. The reporter needs specific numbers, timestamps, and root cause explanations."""

# ── Bayesian Analyst ─────────────────────────────────────────────────────────

BAYESIAN_ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Bayesian Analyst. Quantify uncertainty and provide probabilistic insights.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded

AVAILABLE LIBRARIES:
- `scipy_stats` (scipy.stats) — distributions, hypothesis tests, Bayesian-like inference
- `pd`, `np`, `plt`, `sns`
- Standard sklearn for comparisons

NOTE: Use scipy.stats for Bayesian-style analysis. Do NOT try to import PyMC or bambi.

ANALYSIS TO PERFORM:

1. **Bayesian-Style Parameter Estimation** (using conjugate priors with scipy):
```python
# Estimate PSI80 distribution with uncertainty
psi80 = df['PSI80'].dropna().values

# Bootstrap for posterior-like distribution of the mean
n_bootstrap = 5000
boot_means = np.array([np.mean(np.random.choice(psi80, size=len(psi80), replace=True)) for _ in range(n_bootstrap)])

mean_estimate = np.mean(boot_means)
ci_lower = np.percentile(boot_means, 2.5)
ci_upper = np.percentile(boot_means, 97.5)
print(f"PSI80 mean estimate: {{mean_estimate:.2f}} μm")
print(f"95% credible interval: [{{ci_lower:.2f}}, {{ci_upper:.2f}}] μm")

fig, ax = plt.subplots(figsize=(10, 6))
ax.hist(boot_means, bins=50, density=True, alpha=0.7, color='steelblue', edgecolor='white')
ax.axvline(mean_estimate, color='red', linestyle='--', label=f'Mean: {{mean_estimate:.2f}}')
ax.axvline(ci_lower, color='orange', linestyle=':', label=f'95% CI: [{{ci_lower:.2f}}, {{ci_upper:.2f}}]')
ax.axvline(ci_upper, color='orange', linestyle=':')
ax.set_xlabel('PSI80 Mean (μm)')
ax.set_ylabel('Density')
ax.set_title('Bootstrap Posterior Distribution of PSI80 Mean')
ax.legend()
plt.savefig(os.path.join(OUTPUT_DIR, 'bayesian_psi80_posterior.png'), dpi=150, bbox_inches='tight')
plt.close()
```

2. **Bayesian A/B Testing Between Operating Conditions**:
```python
# Compare PSI80 under high vs low Ore feed
median_ore = df['Ore'].median()
psi_high_ore = df.loc[df['Ore'] > median_ore, 'PSI80'].dropna().values
psi_low_ore = df.loc[df['Ore'] <= median_ore, 'PSI80'].dropna().values

# Bootstrap difference in means
n_boot = 5000
diffs = []
for _ in range(n_boot):
    mean_high = np.mean(np.random.choice(psi_high_ore, size=min(1000, len(psi_high_ore)), replace=True))
    mean_low = np.mean(np.random.choice(psi_low_ore, size=min(1000, len(psi_low_ore)), replace=True))
    diffs.append(mean_high - mean_low)
diffs = np.array(diffs)

prob_higher = np.mean(diffs > 0)
print(f"P(PSI80 higher with high Ore) = {{prob_higher:.3f}}")
print(f"Mean difference: {{np.mean(diffs):.2f}} μm, 95% CI: [{{np.percentile(diffs, 2.5):.2f}}, {{np.percentile(diffs, 97.5):.2f}}]")
```

3. **Probabilistic Process Capability**:
```python
# Bootstrap Cpk for PSI80 (spec: 65-85 μm)
USL, LSL = 85, 65
n_boot = 5000
cpk_samples = []
for _ in range(n_boot):
    sample = np.random.choice(psi80, size=len(psi80), replace=True)
    mu, sigma = np.mean(sample), np.std(sample, ddof=1)
    cpk = min((USL - mu) / (3 * sigma), (mu - LSL) / (3 * sigma))
    cpk_samples.append(cpk)

cpk_samples = np.array(cpk_samples)
print(f"Cpk estimate: {{np.mean(cpk_samples):.3f}}")
print(f"P(Cpk > 1.0) = {{np.mean(cpk_samples > 1.0):.3f}}")
print(f"P(Cpk > 1.33) = {{np.mean(cpk_samples > 1.33):.3f}}")
```

4. **Effect Size Estimation**: For each MV, estimate its effect on PSI80 with credible intervals using bootstrap regression coefficients.

5. **Conditional Probability Analysis**: P(PSI80 out of spec | DensityHC > threshold), P(PSI80 out of spec | Ore > 160 t/h), etc.

CRITICAL: Always report probabilities and credible intervals, not just point estimates.
Print all numerical results clearly for the reporter."""

# ── Process Optimizer ────────────────────────────────────────────────────────

OPTIMIZER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Process Optimizer. Find optimal operating setpoints and analyze tradeoffs.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded

AVAILABLE LIBRARIES:
- `scipy_stats`, `scipy.optimize` (via scipy_stats parent)
- `pd`, `np`, `plt`, `sns`
- sklearn (for Gaussian Process if needed)

ANALYSIS TO PERFORM:

1. **Pareto Frontier Analysis** (Throughput vs Quality):
```python
# Find the Pareto-optimal operating points: maximize Ore while minimizing PSI80
df_opt = df[['Ore', 'PSI80']].dropna()

# Resample to hourly to reduce noise
hourly = df_opt.resample('1h').mean().dropna()

# Find Pareto front: non-dominated points
def pareto_front(df, col_max, col_min):
    \"\"\"Find Pareto-optimal points: maximize col_max, minimize col_min.\"\"\"
    sorted_df = df.sort_values(col_max, ascending=False)
    pareto = []
    min_so_far = float('inf')
    for _, row in sorted_df.iterrows():
        if row[col_min] < min_so_far:
            pareto.append(row)
            min_so_far = row[col_min]
    return pd.DataFrame(pareto)

pareto = pareto_front(hourly, 'Ore', 'PSI80')
print(f"Pareto-optimal operating points: {{len(pareto)}}")

fig, ax = plt.subplots(figsize=(10, 7))
ax.scatter(hourly['Ore'], hourly['PSI80'], alpha=0.3, s=10, label='All operating points')
ax.scatter(pareto['Ore'], pareto['PSI80'], c='red', s=30, zorder=5, label='Pareto front')
ax.plot(pareto['Ore'], pareto['PSI80'], 'r--', alpha=0.7)
ax.set_xlabel('Ore Feed Rate (t/h)')
ax.set_ylabel('PSI80 (μm)')
ax.set_title('Pareto Frontier: Throughput vs Grinding Quality')
ax.legend()
plt.savefig(os.path.join(OUTPUT_DIR, 'pareto_frontier.png'), dpi=150, bbox_inches='tight')
plt.close()
```

2. **Optimal Operating Windows per Ore Type**:
```python
# If ore quality data available, find optimal settings per ore hardness
if 'Daiki' in df.columns and 'Shisti' in df.columns:
    # Classify ore types by Daiki content
    df['ore_type'] = pd.cut(df['Daiki'], bins=3, labels=['Soft', 'Medium', 'Hard'])
    
    for ore_type in ['Soft', 'Medium', 'Hard']:
        subset = df[df['ore_type'] == ore_type]
        if len(subset) < 100:
            continue
        # Find conditions where PSI80 is within spec and Ore is maximized
        good = subset[(subset['PSI80'] >= 65) & (subset['PSI80'] <= 85)]
        if len(good) > 0:
            print(f"\\n{{ore_type}} ore — optimal MV ranges (PSI80 in spec):")
            for mv in ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']:
                if mv in good.columns:
                    print(f"  {{mv}}: {{good[mv].quantile(0.25):.1f}} — {{good[mv].quantile(0.75):.1f}} (median: {{good[mv].median():.1f}})")
```

3. **What-If Analysis** (sensitivity study):
```python
# Correlation-based sensitivity: how does each MV affect PSI80?
mvs = ['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp']
target = 'PSI80'
sensitivities = {{}}
for mv in mvs:
    valid = df[[mv, target]].dropna()
    if len(valid) > 100:
        corr = valid[mv].corr(valid[target])
        # Regression slope for quantitative effect
        slope = np.polyfit(valid[mv].values, valid[target].values, 1)[0]
        sensitivities[mv] = {{'correlation': corr, 'slope_per_unit': slope}}
        print(f"{{mv}} → PSI80: r={{corr:.3f}}, slope={{slope:.4f}} μm per unit {{mv}}")

# Visualize as tornado chart
fig, ax = plt.subplots(figsize=(10, 5))
mvs_sorted = sorted(sensitivities.keys(), key=lambda x: abs(sensitivities[x]['correlation']))
colors = ['#e74c3c' if sensitivities[mv]['correlation'] > 0 else '#3498db' for mv in mvs_sorted]
ax.barh(mvs_sorted, [sensitivities[mv]['correlation'] for mv in mvs_sorted], color=colors)
ax.set_xlabel('Correlation with PSI80')
ax.set_title('Sensitivity Analysis: MV Impact on PSI80')
ax.axvline(x=0, color='black', linewidth=0.5)
plt.savefig(os.path.join(OUTPUT_DIR, 'sensitivity_tornado.png'), dpi=150, bbox_inches='tight')
plt.close()
```

4. **Monte Carlo Risk Quantification**: Simulate 1000 scenarios of operating at proposed setpoints with historical variability to estimate probability of PSI80 excursion.

5. **Constraint-Aware Recommendations**: Print specific setpoint recommendations that keep PSI80 in spec while maximizing Ore throughput.

CRITICAL: Always provide SPECIFIC numbers — "Set WaterMill to 22-25 m³/h" not "increase water"."""

# ── Shift Reporter ───────────────────────────────────────────────────────────

SHIFT_REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Shift Reporter. Generate structured operational KPIs and shift performance reports.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded
- For multi-mill: use get_df(f'mill_data_{{i}}') in a loop

SHIFT DEFINITIONS:
- Shift 1: 06:00 — 14:00
- Shift 2: 14:00 — 22:00
- Shift 3: 22:00 — 06:00 (next day)

ANALYSIS TO PERFORM:

1. **Assign Shifts and Calculate Per-Shift KPIs**:
```python
# Assign shift labels
def assign_shift(timestamp):
    hour = timestamp.hour
    if 6 <= hour < 14:
        return 'Shift 1 (06-14)'
    elif 14 <= hour < 22:
        return 'Shift 2 (14-22)'
    else:
        return 'Shift 3 (22-06)'

df['shift'] = df.index.map(assign_shift)
df['date'] = df.index.date

# Per-shift KPIs
shift_kpis = df.groupby(['date', 'shift']).agg(
    ore_mean=('Ore', 'mean'),
    ore_total=('Ore', lambda x: x.mean() * len(x) / 60),  # tons per shift (approx)
    psi80_mean=('PSI80', 'mean'),
    psi80_std=('PSI80', 'std'),
    motor_amp_mean=('MotorAmp', 'mean'),
    density_mean=('DensityHC', 'mean'),
    power_mean=('Power', 'mean'),
    uptime_pct=('Ore', lambda x: (x > 10).mean() * 100),  # % time with Ore > 10 t/h
).round(2)

# Energy efficiency
shift_kpis['energy_kwh_per_ton'] = (shift_kpis['power_mean'] / shift_kpis['ore_mean'].replace(0, np.nan)).round(2)

print("=== SHIFT KPI SUMMARY ===")
print(shift_kpis.to_string())
```

2. **Shift-over-Shift Statistical Comparison**:
```python
from scipy import stats

shifts = df['shift'].unique()
for i, s1 in enumerate(sorted(shifts)):
    for s2 in sorted(shifts)[i+1:]:
        psi1 = df.loc[df['shift'] == s1, 'PSI80'].dropna()
        psi2 = df.loc[df['shift'] == s2, 'PSI80'].dropna()
        
        # Mann-Whitney U test (non-parametric)
        stat, pval = stats.mannwhitneyu(psi1, psi2, alternative='two-sided')
        sig = "SIGNIFICANT" if pval < 0.05 else "not significant"
        print(f"{{s1}} vs {{s2}} — PSI80: mean {{psi1.mean():.1f}} vs {{psi2.mean():.1f}}, p={{pval:.4f}} ({{sig}})")
```

3. **Mill Ranking / Benchmarking** (if multiple mills loaded):
```python
# For multi-mill analysis
mill_summary = []
for i in range(1, 13):
    mill_df = get_df(f'mill_data_{{i}}')
    if mill_df is not None and len(mill_df) > 0:
        mill_summary.append({{
            'Mill': f'Mill {{i}}',
            'Ore_mean': mill_df['Ore'].mean(),
            'PSI80_mean': mill_df['PSI80'].mean(),
            'Uptime_%': (mill_df['Ore'] > 10).mean() * 100,
            'Energy_kWh_per_ton': (mill_df['Power'] / mill_df['Ore'].replace(0, np.nan)).mean(),
        }})
summary_df = pd.DataFrame(mill_summary).round(2)
summary_df = summary_df.sort_values('Ore_mean', ascending=False)
print("\\n=== MILL RANKING ===")
print(summary_df.to_string(index=False))
```

4. **Downtime Analysis**: Detect periods where Ore < 10 t/h, quantify duration, group by shift.

5. **Shift Handover Summary**: For the most recent shift, print a structured handover:
   - Average Ore, PSI80, DensityHC for the shift
   - Number of anomalous periods
   - Any process alarms (PSI80 > 85 or < 65)
   - Recommended actions for next shift

6. **Energy Efficiency Visualization**: Bar chart of kWh/ton per shift, trend over days.

CHART REQUIREMENTS:
- Shift comparison bar chart: side-by-side bars for each shift with value labels
- Mill ranking bar chart: horizontal bars sorted by performance
- Energy trend: line chart over time with shift-level granularity
- Save ALL to OUTPUT_DIR, plt.close() after each

CRITICAL: Structure output as a formal shift report. Use clear sections and actual numbers."""

# ── Code Reviewer ────────────────────────────────────────────────────────────

CODE_REVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Code Reviewer. Validate ALL analysis outputs from ALL specialists that ran.

1. Call list_output_files to see what charts were generated
2. Review the stdout from previous steps for errors or warnings
3. Check for:
   - Missing or failed charts (analysts that ran but produced no charts)
   - Statistical errors or unreasonable values
   - Incomplete analysis (key findings without supporting charts)
   - Inconsistent numbers between different specialists
4. If critical issues found, call execute_python to fix them
5. If everything looks good, write a brief validation summary listing all outputs

Do NOT regenerate charts that already exist. Only fix errors or fill critical gaps."""

# ── Reporter ─────────────────────────────────────────────────────────────────

REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Reporter. Write a COMPREHENSIVE professional Markdown analysis report.

STEPS:
1. Call list_output_files to get the exact chart filenames
2. Read through ALL previous messages to extract statistics and findings from EVERY specialist
3. Call write_markdown_report with the full report content

Report MUST include:
- **Title** matching the analysis request
- **Executive Summary**: 4-6 sentences with key findings and actual numbers from all specialists
- **Data Overview**: what data was loaded, time range, number of records
- **Findings sections** — one section per specialist that ran:
  - If analyst ran: "Statistical Overview" section with EDA, SPC, correlations
  - If forecaster ran: "Forecast & Trends" section with predictions and confidence intervals
  - If anomaly_detective ran: "Anomaly Analysis" section with detected events and root causes
  - If bayesian_analyst ran: "Uncertainty & Probability" section with credible intervals
  - If optimizer ran: "Optimization Recommendations" section with specific setpoints
  - If shift_reporter ran: "Operational KPIs" section with shift comparisons and rankings
- **Charts**: embed EVERY .png file from list_output_files using ![description](exact_filename.png)
- **Conclusions & Recommendations**: 5-8 specific actionable items prioritized by impact

CRITICAL RULES:
- Use EXACT filenames from list_output_files — only reference charts that actually exist
- Include ACTUAL numbers from the analysis (means, stds, probabilities, CIs) — extract from prior messages
- Do NOT use placeholder text — use real numbers from the analysis
- Every section must have substantive content with numbers, not just headers
- The report should be at least 1500 words
- Write in professional technical English suitable for plant managers and process engineers"""

# ── Manager Review ───────────────────────────────────────────────────────────

MANAGER_REVIEW_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Quality Manager reviewing the output of a specialist agent.
Your job is to decide if the work is ACCEPTABLE or needs REWORK.

Evaluate the last specialist's output for:
- Completeness: did they produce charts AND numerical results?
- Quality: are charts well-formatted? Are numbers reasonable for the process?
- Correctness: are there errors, NaN results, or unreasonable values?
- Actionability: for optimizer/shift_reporter — did they provide specific recommendations?

Respond with EXACTLY one of:
- ACCEPT: [brief reason] — if the work is good enough to proceed
- REWORK: [specific instructions on what to fix] — if improvements are needed

Be concise. One line is enough."""


# ══════════════════════════════════════════════════════════════════════════════
# Graph Builder
# ══════════════════════════════════════════════════════════════════════════════

# ── Human-readable stage labels for progress messages ────────────────────
_STAGE_LABELS: dict[str, str] = {
    "data_loader":       "Data Loader",
    "planner":           "Planner",
    "analyst":           "Analyst",
    "forecaster":        "Forecaster",
    "anomaly_detective": "Anomaly Detective",
    "bayesian_analyst":  "Bayesian Analyst",
    "optimizer":         "Optimizer",
    "shift_reporter":    "Shift Reporter",
    "code_reviewer":     "Code Reviewer",
    "reporter":          "Reporter",
    "manager":           "Manager",
}

def _label(stage: str) -> str:
    return _STAGE_LABELS.get(stage, stage)


def build_graph(
    tools: list[BaseTool],
    api_key: str,
    on_progress: Optional[Callable[[str, str], None]] = None,
) -> StateGraph:
    # No-op fallback if caller doesn't supply a callback
    _progress = on_progress or (lambda stage, msg: None)

    llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=api_key)

    # ── Per-specialist tool binding ─────────────────────────────────────
    tools_by_name = {t.name: t for t in tools}

    # All specialists that do analysis share the same tool set
    ANALYSIS_TOOLS = ["execute_python", "list_output_files"]
    DATA_TOOLS = ["query_mill_data", "query_combined_data", "get_db_schema"]
    REPORT_TOOLS = ["list_output_files", "write_markdown_report"]

    TOOL_SETS = {
        "data_loader":       DATA_TOOLS,
        "analyst":           ANALYSIS_TOOLS,
        "forecaster":        ANALYSIS_TOOLS,
        "anomaly_detective": ANALYSIS_TOOLS,
        "bayesian_analyst":  ANALYSIS_TOOLS,
        "optimizer":         ANALYSIS_TOOLS,
        "shift_reporter":    ANALYSIS_TOOLS,
        "code_reviewer":     ANALYSIS_TOOLS,
        "reporter":          REPORT_TOOLS,
    }

    specialist_llms = {}
    for stage_name, tool_names in TOOL_SETS.items():
        stage_tools = [tools_by_name[n] for n in tool_names if n in tools_by_name]
        specialist_llms[stage_name] = llm.bind_tools(stage_tools)

    # ── Message helpers ─────────────────────────────────────────────────
    def truncate(text: str, limit: int) -> str:
        return text[:limit] + "\n... [truncated]" if len(text) > limit else text

    def normalize_content(content) -> str:
        if isinstance(content, list):
            texts = [item.get("text", "") if isinstance(item, dict) else str(item) for item in content]
            return "\n".join(texts).strip()
        return str(content) if content else ""

    def compress_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        if len(messages) > MAX_MESSAGES_WINDOW + 1:
            messages = [messages[0]] + messages[-(MAX_MESSAGES_WINDOW):]

        compressed = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = normalize_content(msg.content)
                compressed.append(ToolMessage(
                    content=truncate(content, MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
            elif isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if len(content) > MAX_AI_MSG_CHARS:
                    compressed.append(AIMessage(
                        content=truncate(content, MAX_AI_MSG_CHARS),
                        name=getattr(msg, "name", None),
                        tool_calls=msg.tool_calls if msg.tool_calls else [],
                    ))
                else:
                    compressed.append(msg)
            else:
                compressed.append(msg)
        return compressed

    def strip_tool_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        clean = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = normalize_content(msg.content)
                clean.append(AIMessage(
                    content=f"[Tool result from {msg.name}]: {truncate(content, 800)}",
                    name=msg.name,
                ))
            elif isinstance(msg, AIMessage) and msg.tool_calls:
                text = normalize_content(msg.content) or f"[{getattr(msg, 'name', 'agent')} requested tools]"
                clean.append(AIMessage(content=text, name=getattr(msg, "name", None)))
            else:
                clean.append(msg)
        return clean

    # ── Focused context builder ─────────────────────────────────────────
    def build_focused_context(all_msgs: list[BaseMessage], stage_name: str) -> list[BaseMessage]:
        user_msg = None
        prior_summary_parts = []
        current_stage_msgs = []

        my_tool_call_ids = set()
        for msg in all_msgs:
            if isinstance(msg, AIMessage) and getattr(msg, "name", None) == stage_name and msg.tool_calls:
                for tc in msg.tool_calls:
                    my_tool_call_ids.add(tc.get("id"))

        for msg in all_msgs:
            if isinstance(msg, HumanMessage) and user_msg is None:
                user_msg = msg
                continue

            msg_name = getattr(msg, "name", None)

            if msg_name == stage_name:
                current_stage_msgs.append(msg)
                continue

            if isinstance(msg, ToolMessage) and msg.tool_call_id in my_tool_call_ids:
                content = normalize_content(msg.content)
                current_stage_msgs.append(ToolMessage(
                    content=truncate(content, MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
                continue

            # Summarize prior stages compactly
            if isinstance(msg, ToolMessage) and msg.name in ("query_mill_data", "query_combined_data"):
                content = normalize_content(msg.content)
                if "loaded" in content.lower():
                    prior_summary_parts.append(truncate(content, 200))
            elif isinstance(msg, ToolMessage) and msg.name == "execute_python":
                content = normalize_content(msg.content)
                prior_summary_parts.append(f"[python output]: {truncate(content, 1200)}")
            elif isinstance(msg, AIMessage) and msg_name and msg_name not in ("manager", "planner") and not msg.tool_calls:
                content = normalize_content(msg.content)
                if content:
                    prior_summary_parts.append(f"[{msg_name}]: {truncate(content, 400)}")
            elif msg_name == "manager" and isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if "REWORK" in content and stage_name in content:
                    current_stage_msgs.append(msg)

        result = []
        if user_msg:
            result.append(user_msg)

        if prior_summary_parts:
            summary = "[Prior analysis context]:\n" + "\n".join(prior_summary_parts[-8:])
            result.append(HumanMessage(content=summary))

        result.extend(compress_messages(current_stage_msgs))
        return result

    # ── Specialist node factory ────────────────────────────────────────
    today = datetime.now().strftime("%Y-%m-%d")

    ALL_PROMPTS = {
        "data_loader":       DATA_LOADER_PROMPT.replace("{TODAY_DATE}", today),
        "analyst":           ANALYST_PROMPT,
        "forecaster":        FORECASTER_PROMPT,
        "anomaly_detective": ANOMALY_DETECTIVE_PROMPT,
        "bayesian_analyst":  BAYESIAN_ANALYST_PROMPT,
        "optimizer":         OPTIMIZER_PROMPT,
        "shift_reporter":    SHIFT_REPORTER_PROMPT,
        "code_reviewer":     CODE_REVIEWER_PROMPT,
        "reporter":          REPORTER_PROMPT,
    }

    ALL_STAGES = list(ALL_PROMPTS.keys())

    def make_specialist_node(name: str):
        system_prompt = ALL_PROMPTS[name]
        stage_llm = specialist_llms[name]

        def specialist_node(state: AnalysisState) -> dict:
            iteration = sum(1 for m in state["messages"] if getattr(m, "name", None) == name) + 1
            print(f"\n  [{name}] iteration {iteration}/{MAX_SPECIALIST_ITERS} — processing...")
            _progress(name, f"{_label(name)} working (step {iteration}/{MAX_SPECIALIST_ITERS})...")

            if iteration > MAX_SPECIALIST_ITERS:
                print(f"  [{name}] Iteration cap reached, advancing.")
                _progress(name, f"{_label(name)} finished (iteration cap).")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Done (iteration cap). Moving on.",
                        name=name,
                    )],
                }

            raw_msgs = state["messages"]
            focused = build_focused_context(raw_msgs, name)
            messages = [SystemMessage(content=system_prompt)] + focused

            print(f"  [{name}] Context: {len(focused)} msgs, types: {[type(m).__name__ for m in focused]}")

            try:
                response = stage_llm.invoke(messages)
            except Exception as e:
                error_str = str(e)
                print(f"  [{name}] LLM error: {error_str[:200]}")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Error: {error_str[:150]}. Moving on.",
                        name=name,
                    )],
                }

            response.content = normalize_content(response.content)

            if response.tool_calls:
                tool_names = [tc["name"] for tc in response.tool_calls]
                print(f"  [{name}] Calling tools: {tool_names}")
                _progress(name, f"{_label(name)} calling tools: {', '.join(tool_names)}")
            else:
                preview = (response.content[:120] + "...") if response.content and len(response.content) > 120 else response.content
                print(f"  [{name}] Done: \"{preview}\"")
                _progress(name, f"{_label(name)} completed.")

            response.name = name
            return {"messages": [response]}

        return specialist_node

    # ── Planner node ──────────────────────────────────────────────────
    def planner_node(state: AnalysisState) -> dict:
        print("\n  [planner] Analyzing request to determine specialists needed...")
        _progress("planner", "Planning analysis — selecting specialists...")

        compressed = compress_messages(state["messages"])
        messages = [SystemMessage(content=PLANNER_PROMPT)] + strip_tool_messages(compressed)

        try:
            response = llm.invoke(messages)
        except Exception as e:
            print(f"  [planner] Error: {str(e)[:150]}. Defaulting to analyst only.")
            return {
                "messages": [AIMessage(content="SPECIALISTS: analyst\nRATIONALE: Fallback due to planning error.", name="planner")],
                "stages_to_run": ["data_loader", "planner", "analyst", "code_reviewer", "reporter"],
                "current_stage": "planner",
            }

        content = normalize_content(response.content)
        print(f"  [planner] Response: {content}")

        # Parse SPECIALISTS: line
        selected = []
        for line in content.strip().split("\n"):
            line = line.strip()
            if line.upper().startswith("SPECIALISTS:"):
                specialists_str = line.split(":", 1)[1].strip()
                for s in specialists_str.split(","):
                    s = s.strip().lower().replace(" ", "_")
                    if s in SPECIALIST_POOL:
                        selected.append(s)

        if not selected:
            selected = ["analyst"]
            print("  [planner] No valid specialists parsed, defaulting to analyst.")

        # Build full stage list
        stages = FIXED_PREFIX + selected + FIXED_SUFFIX
        print(f"  [planner] Pipeline: {' → '.join(stages)}")
        readable = ' → '.join(_label(s) for s in selected)
        _progress("planner", f"Pipeline: {readable}")

        return {
            "messages": [AIMessage(content=content, name="planner")],
            "stages_to_run": stages,
            "current_stage": "planner",
        }

    # ── Manager review node ──────────────────────────────────────────
    def manager_review_node(state: AnalysisState) -> dict:
        current = state.get("current_stage", "data_loader")
        attempts = state.get("stage_attempts", {})
        attempt_count = attempts.get(current, 0)

        print(f"\n  [manager] Reviewing {current} output (attempt {attempt_count + 1})...")
        _progress("manager", f"Reviewing {_label(current)} output...")

        # Auto-accept data_loader and planner
        if current in ("data_loader", "planner"):
            print(f"  [manager] {current} — auto-accepting.")
            return {
                "messages": [AIMessage(content=f"ACCEPT: {current} completed.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        if attempt_count >= MAX_REWORKS_PER_STAGE:
            print(f"  [manager] Max reworks reached for {current} — accepting.")
            return {
                "messages": [AIMessage(content=f"ACCEPT: Max reworks reached for {current}.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        compressed = compress_messages(state["messages"])
        messages = [SystemMessage(content=MANAGER_REVIEW_PROMPT)] + strip_tool_messages(compressed)

        try:
            response = llm.invoke(messages)
        except Exception as e:
            print(f"  [manager] Review error: {str(e)[:150]}")
            return {
                "messages": [AIMessage(content="ACCEPT: Review skipped due to error.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        raw = response.content
        content = normalize_content(raw).strip()

        if content.upper().startswith("REWORK") or "REWORK:" in content.upper():
            decision = "REWORK"
            stamped = f"REWORK: {content}"
        else:
            decision = "ACCEPT"
            stamped = f"ACCEPT: {content}"

        print(f"  [manager] Decision: {decision} — {content[:150]}")
        if decision == "REWORK":
            _progress("manager", f"{_label(current)} — rework requested.")
        else:
            _progress("manager", f"{_label(current)} — accepted.")

        return {
            "messages": [AIMessage(content=stamped, name="manager")],
            "stage_attempts": {**attempts, current: attempt_count + 1},
        }

    # ── Tool execution node ──────────────────────────────────────────
    async def tool_node(state: AnalysisState) -> dict:
        last_message = state["messages"][-1]
        results = []
        for tc in last_message.tool_calls:
            tool = tools_by_name.get(tc["name"])
            if tool is None:
                results.append(ToolMessage(
                    content=f"Error: unknown tool '{tc['name']}'",
                    tool_call_id=tc["id"], name=tc["name"],
                ))
                continue
            try:
                print(f"    [tool] Executing {tc['name']}...")
                _progress("tools", f"Executing tool: {tc['name']}")
                output = await tool.ainvoke(tc["args"])
                results.append(ToolMessage(
                    content=str(output), tool_call_id=tc["id"], name=tc["name"],
                ))
            except Exception as e:
                results.append(ToolMessage(
                    content=f"Error: {e}", tool_call_id=tc["id"], name=tc["name"],
                ))
        return {"messages": results}

    # ── Routing logic ────────────────────────────────────────────────

    def specialist_router(state: AnalysisState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "manager_review"

    def after_tools(state: AnalysisState) -> str:
        for msg in reversed(state["messages"]):
            if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
                return msg.name
        return "data_loader"

    def manager_router(state: AnalysisState) -> str:
        """After manager review: advance to next stage in stages_to_run or rework current."""
        last = state["messages"][-1]
        content = last.content if isinstance(last.content, str) else str(last.content)
        current = state.get("current_stage", "data_loader")
        stages = state.get("stages_to_run", FIXED_PREFIX + ["analyst"] + FIXED_SUFFIX)

        # REWORK → send back to current stage
        if content.startswith("REWORK:"):
            print(f"  [manager] Sending {current} back for rework.")
            return f"{current}_entry"

        # ACCEPT → advance to next stage
        if current in stages:
            idx = stages.index(current)
            if idx + 1 < len(stages):
                next_stage = stages[idx + 1]
                print(f"\n  ──→ Advancing: {current} → {next_stage}")
                _progress("system", f"Advancing: {_label(current)} → {_label(next_stage)}")
                return f"{next_stage}_entry"

        print(f"\n  ──→ Pipeline complete!")
        return "end"

    # ── Stage entry nodes ────────────────────────────────────────
    def make_stage_entry(stage_name: str):
        def entry_node(state: AnalysisState) -> dict:
            return {"current_stage": stage_name}
        return entry_node

    # ── Graph assembly ───────────────────────────────────────────────
    graph = StateGraph(AnalysisState)

    # Register entry + specialist nodes for ALL possible stages
    for stage in ALL_STAGES:
        graph.add_node(f"{stage}_entry", make_stage_entry(stage))
        graph.add_node(stage, make_specialist_node(stage))

    # Planner is special — not a specialist, no tools
    graph.add_node("planner_entry", make_stage_entry("planner"))
    graph.add_node("planner", planner_node)

    graph.add_node("tools", tool_node)
    graph.add_node("manager_review", manager_review_node)

    # Entry point
    graph.set_entry_point("data_loader_entry")

    # Wire: entry → node (for all stages + planner)
    for stage in ALL_STAGES:
        graph.add_edge(f"{stage}_entry", stage)
    graph.add_edge("planner_entry", "planner")

    # Wire: planner → manager_review (planner doesn't use tools)
    graph.add_edge("planner", "manager_review")

    # Wire: specialist → tools or manager_review
    for stage in ALL_STAGES:
        graph.add_conditional_edges(
            stage,
            specialist_router,
            {"tools": "tools", "manager_review": "manager_review"},
        )

    # Wire: tools → back to specialist
    graph.add_conditional_edges(
        "tools",
        after_tools,
        {stage: stage for stage in ALL_STAGES},
    )

    # Wire: manager_review → next stage or rework or END
    manager_targets = {f"{stage}_entry": f"{stage}_entry" for stage in ALL_STAGES}
    manager_targets["planner_entry"] = "planner_entry"
    manager_targets["end"] = END
    graph.add_conditional_edges(
        "manager_review",
        manager_router,
        manager_targets,
    )

    return graph.compile()
