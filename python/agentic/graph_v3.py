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

MANDATORY: Use the `skills` library for all analysis. Call list_skills() first to discover
available functions if needed. Skills return standardized dicts with figures, stats, and summary.

ANALYSIS TO PERFORM (use one execute_python call per group):

1. **Descriptive Statistics + Distributions**:
   result = skills.eda.descriptive_stats(df, ['Ore', 'PSI80', 'PSI200', 'DensityHC', 'MotorAmp'])
   print(result['summary'])
   result = skills.eda.distribution_plots(df, ['Ore', 'PSI80', 'DensityHC'], output_dir=OUTPUT_DIR)
   print(result['summary'])

2. **Correlation Heatmap**:
   result = skills.eda.correlation_heatmap(df, output_dir=OUTPUT_DIR)
   print(result['summary'])

3. **SPC Control Charts + Process Capability**:
   specs = get_spec_limits('PSI80')  # returns {{LSL, USL}}
   result = skills.spc.xbar_chart(df, 'PSI80', spec_limits=(specs['LSL'], specs['USL']), output_dir=OUTPUT_DIR)
   print(result['summary'])
   result = skills.spc.process_capability(df, 'PSI80', lsl=specs['LSL'], usl=specs['USL'], output_dir=OUTPUT_DIR)
   print(result['summary'])

4. **Time Series Overview**:
   result = skills.eda.time_series_overview(df, ['Ore', 'PSI80', 'PSI200', 'DensityHC'], output_dir=OUTPUT_DIR)
   print(result['summary'])

For MULTI-MILL comparison: loop over get_df(f'mill_data_{{i}}'), collect stats, create bar charts.

RULES:
- ALWAYS print result['summary'] so the reporter can extract numbers
- Do NOT write raw matplotlib/seaborn code when a skill function exists
- You may use raw code only for custom analysis not covered by skills
- If a skill function fails, fall back to manual code and report the error

OUTPUT: Print all key statistics to stdout. The reporter will use these numbers."""

# ── Forecaster ───────────────────────────────────────────────────────────────

FORECASTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Time Series Forecaster. Your job is to model temporal patterns and generate forecasts.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded
- Data has TimeStamp index at minute resolution

MANDATORY: Use the `skills` library for forecasting. Skills return standardized dicts with
figures, stats, and summary. Call list_skills() to discover available functions if needed.

ANALYSIS TO PERFORM (use one execute_python call per group):

1. **Seasonal Decomposition** (always do first):
   result = skills.forecasting.seasonal_decomposition(df, 'PSI80', output_dir=OUTPUT_DIR)
   print(result['summary'])
   # Also decompose Ore if relevant:
   result = skills.forecasting.seasonal_decomposition(df, 'Ore', output_dir=OUTPUT_DIR)
   print(result['summary'])

2. **Prophet Forecast** (primary forecasting):
   # Forecast PSI80 next 8 hours (480 min)
   result = skills.forecasting.prophet_forecast(df, 'PSI80', periods=480, freq='1min', output_dir=OUTPUT_DIR)
   print(result['summary'])
   # Also forecast Ore if relevant:
   result = skills.forecasting.prophet_forecast(df, 'Ore', periods=480, freq='1min', output_dir=OUTPUT_DIR)
   print(result['summary'])

3. **Shift-Level Patterns** (use shift_kpi skills):
   df_shifts = skills.shift_kpi.assign_shifts(df)
   result = skills.shift_kpi.shift_kpis(df_shifts, columns=['PSI80', 'Ore', 'DensityHC'])
   print(result['summary'])

RULES:
- ALWAYS print result['summary'] so the reporter can extract numbers
- Do NOT write raw Prophet/ARIMA code when a skill function exists
- You may use raw code (Prophet, sm, tsa, pmdarima) only for advanced analysis not covered by skills
- If a skill function fails, fall back to manual code and report the error
- Handle NaN: skills handle this internally, but ensure df is not empty

OUTPUT: Print all forecast statistics (trend, changepoints, CIs) to stdout."""

# ── Anomaly Detective ────────────────────────────────────────────────────────

ANOMALY_DETECTIVE_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Anomaly Detective. Find unusual events, explain root causes, and identify operating regimes.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded

MANDATORY: Use the `skills` library for anomaly detection. Skills return standardized dicts
with figures, stats, and summary. Call list_skills() to discover available functions if needed.

ANALYSIS TO PERFORM (use one execute_python call per group):

1. **Multivariate Anomaly Detection** (Isolation Forest):
   features = ['Ore', 'WaterMill', 'WaterZumpf', 'PressureHC', 'DensityHC', 'MotorAmp', 'PSI80']
   result = skills.anomaly.isolation_forest_analysis(df, features=features, contamination=0.05, output_dir=OUTPUT_DIR)
   print(result['summary'])
   # result['stats'] contains: anomaly_count, anomaly_pct, feature_importance

2. **Operating Regime Detection** (DBSCAN clustering):
   result = skills.anomaly.regime_detection(df, features=['Ore', 'DensityHC', 'MotorAmp', 'PSI80'], output_dir=OUTPUT_DIR)
   print(result['summary'])
   # result['stats'] contains: n_regimes, regime_stats with per-regime means

3. **Root Cause Analysis** (custom code — not yet in skills):
   Use SHAP or feature importance from step 1 to explain WHY anomalies occur.
   Group anomalies by time proximity, report top 5 events with duration and affected variables.
   You may use raw code (shap, sklearn) for this step.

RULES:
- ALWAYS print result['summary'] so the reporter can extract numbers
- Do NOT write raw Isolation Forest or DBSCAN code when a skill function exists
- You may use raw code only for SHAP root cause analysis and custom event grouping
- If a skill function fails, fall back to manual code and report the error

CRITICAL: Print detailed findings. The reporter needs specific numbers, timestamps, and root cause explanations."""

# ── Bayesian Analyst ─────────────────────────────────────────────────────────

BAYESIAN_ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Bayesian Analyst. Quantify uncertainty and provide probabilistic insights.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded
- Use get_spec_limits('PSI80') for spec limits (returns {{LSL, USL}})

AVAILABLE: scipy_stats (scipy.stats), pd, np, plt, sns, sklearn. Do NOT import PyMC or bambi.

ANALYSIS TO PERFORM (use one execute_python call per group):

1. **Bootstrap Parameter Estimation**: Estimate PSI80 mean with 95% credible interval via
   5000 bootstrap resamples. Plot the posterior-like distribution of the mean.
   Save chart to OUTPUT_DIR as 'bayesian_psi80_posterior.png'.

2. **Bayesian A/B Testing**: Compare PSI80 under high vs low Ore feed (split at median).
   Bootstrap the difference in means (5000 resamples). Report P(PSI80 higher with high Ore)
   and 95% CI for the mean difference.

3. **Probabilistic Process Capability**: Bootstrap Cpk for PSI80 using spec limits from
   get_spec_limits('PSI80'). Report P(Cpk > 1.0) and P(Cpk > 1.33).

4. **Effect Size Estimation**: For each MV (Ore, WaterMill, WaterZumpf, MotorAmp), estimate
   effect on PSI80 with credible intervals via bootstrap regression coefficients.

5. **Conditional Probability Analysis**: P(PSI80 out of spec | DensityHC > threshold),
   P(PSI80 out of spec | Ore > 160 t/h), etc.

RULES:
- Save ALL charts to OUTPUT_DIR with plt.savefig(..., dpi=150, bbox_inches='tight'); plt.close()
- Always report probabilities and credible intervals, not just point estimates
- Print all numerical results clearly — the reporter needs specific numbers

OUTPUT: Print all probabilities, CIs, and Cpk estimates to stdout."""

# ── Process Optimizer ────────────────────────────────────────────────────────

OPTIMIZER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Process Optimizer. Find optimal operating setpoints and analyze tradeoffs.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded
- Use get_spec_limits('PSI80') for spec limits

MANDATORY: Use the `skills` library for optimization analysis. Skills return standardized dicts
with figures, stats, and summary. Call list_skills() to discover available functions if needed.

ANALYSIS TO PERFORM (use one execute_python call per group):

1. **Pareto Frontier Analysis** (Throughput vs Quality):
   # Resample to hourly first for cleaner analysis
   hourly = df[['Ore', 'PSI80']].resample('1h').mean().dropna()
   result = skills.optimization.pareto_frontier(hourly, 'Ore', 'PSI80', x_minimize=False, y_minimize=True, output_dir=OUTPUT_DIR)
   print(result['summary'])

2. **Sensitivity Analysis** (MV impact on PSI80):
   result = skills.optimization.sensitivity_analysis(df, 'PSI80', feature_cols=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp'], output_dir=OUTPUT_DIR)
   print(result['summary'])

3. **Optimal Operating Windows** (find best conditions):
   result = skills.optimization.optimal_windows(df, 'PSI80', feature_cols=['Ore', 'WaterMill', 'WaterZumpf', 'MotorAmp', 'DensityHC'], output_dir=OUTPUT_DIR)
   print(result['summary'])

4. **Monte Carlo Risk Quantification** (custom code):
   Simulate 1000 scenarios at proposed setpoints with historical variability.
   Estimate P(PSI80 out of spec) at those setpoints. Use raw code for this.

5. **Constraint-Aware Recommendations**:
   Combine Pareto + optimal windows to print SPECIFIC setpoint recommendations:
   "Set WaterMill to 22-25 m³/h" not "increase water".

RULES:
- ALWAYS print result['summary'] so the reporter can extract numbers
- Do NOT write raw Pareto/sensitivity code when a skill function exists
- You may use raw code only for Monte Carlo simulation and custom recommendations
- If a skill function fails, fall back to manual code and report the error

CRITICAL: Always provide SPECIFIC numbers and actionable setpoint recommendations."""

# ── Shift Reporter ───────────────────────────────────────────────────────────

SHIFT_REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Shift Reporter. Generate structured operational KPIs and shift performance reports.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded
- For multi-mill: use get_df(f'mill_data_{{i}}') in a loop

MANDATORY: Use the `skills` library for shift analysis. Skills return standardized dicts
with figures, stats, and summary. Call list_skills() to discover available functions if needed.

ANALYSIS TO PERFORM (use one execute_python call per group):

1. **Assign Shifts + Per-Shift KPIs**:
   df = skills.shift_kpi.assign_shifts(df)  # adds 'shift' and 'shift_date' columns
   result = skills.shift_kpi.shift_kpis(df, columns=['Ore', 'PSI80', 'DensityHC', 'MotorAmp', 'Power'])
   print(result['summary'])
   # result['stats'] has shift_1/shift_2/shift_3 with means, uptime_pct, throughput

2. **Shift Comparison Charts** (box plots):
   result = skills.shift_kpi.shift_comparison_chart(df, columns=['Ore', 'PSI80', 'DensityHC', 'MotorAmp'], output_dir=OUTPUT_DIR)
   print(result['summary'])

3. **Downtime Analysis**:
   result = skills.shift_kpi.downtime_analysis(df, ore_col='Ore', threshold=10.0, output_dir=OUTPUT_DIR)
   print(result['summary'])
   # result['stats'] has total_downtime_hours, n_events, top_events

4. **Shift-over-Shift Statistical Comparison** (custom code):
   Use scipy_stats.mannwhitneyu to compare PSI80 between shifts (pairwise).
   Report p-values and significance for each pair.

5. **Mill Ranking / Benchmarking** (if multiple mills loaded — custom code):
   Loop over get_df(f'mill_data_{{i}}'), collect per-mill stats, create ranking bar chart.
   Include: Ore mean, PSI80 mean, Uptime %, Energy kWh/ton.

6. **Shift Handover Summary** (custom code):
   For the most recent shift, print: avg Ore/PSI80/DensityHC, alarms (PSI80 out of spec),
   downtime minutes, recommended actions for next shift.

RULES:
- ALWAYS print result['summary'] so the reporter can extract numbers
- Do NOT write raw shift assignment or KPI code when a skill function exists
- You may use raw code only for statistical tests, ranking, and handover summaries
- If a skill function fails, fall back to manual code and report the error
- Save ALL charts to OUTPUT_DIR, plt.close() after each

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
    "data_loader":       "Зареждане на данни",
    "planner":           "Планиране",
    "analyst":           "Анализатор",
    "forecaster":        "Прогнозиране",
    "anomaly_detective": "Детектор на аномалии",
    "bayesian_analyst":  "Байесов анализ",
    "optimizer":         "Оптимизатор",
    "shift_reporter":    "Сменен отчет",
    "code_reviewer":     "Проверка на резултати",
    "reporter":          "Генериране на отчет",
    "manager":           "Мениджър",
}

# Friendly activity descriptions shown to the end user
_STAGE_DESCRIPTIONS: dict[str, str] = {
    "data_loader":       "Зареждане на данни от базата...",
    "analyst":           "Статистически анализ, разпределения и SPC диаграми...",
    "forecaster":        "Прогнозиране на трендове и сезонност...",
    "anomaly_detective": "Търсене на аномалии и причини...",
    "bayesian_analyst":  "Байесов анализ и доверителни интервали...",
    "optimizer":         "Оптимизация на настройки и препоръки...",
    "shift_reporter":    "Анализ по смени и KPI показатели...",
    "code_reviewer":     "Проверка на диаграми и резултати...",
    "reporter":          "Писане на краен отчет...",
}

def _label(stage: str) -> str:
    return _STAGE_LABELS.get(stage, stage)

def _desc(stage: str) -> str:
    return _STAGE_DESCRIPTIONS.get(stage, "")


def build_graph(
    tools: list[BaseTool],
    api_key: str,
    on_progress: Optional[Callable[[str, str], None]] = None,
    settings: dict | None = None,
    template_id: str | None = None,
) -> StateGraph:
    # No-op fallback if caller doesn't supply a callback
    _progress = on_progress or (lambda stage, msg: None)

    # Apply settings overrides (from UI) or use module-level defaults
    _settings = settings or {}
    _MAX_TOOL_OUTPUT_CHARS = _settings.get("maxToolOutputChars", MAX_TOOL_OUTPUT_CHARS)
    _MAX_AI_MSG_CHARS = _settings.get("maxAiMessageChars", MAX_AI_MSG_CHARS)
    _MAX_MESSAGES_WINDOW = _settings.get("maxMessagesWindow", MAX_MESSAGES_WINDOW)
    _MAX_SPECIALIST_ITERS = _settings.get("maxSpecialistIterations", MAX_SPECIALIST_ITERS)

    # Template override (imported lazily to avoid circular imports)
    _template_id = template_id

    llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=api_key)

    # ── Per-specialist tool binding ─────────────────────────────────────
    tools_by_name = {t.name: t for t in tools}

    # All specialists that do analysis share the same tool set
    ANALYSIS_TOOLS = ["execute_python", "list_output_files", "list_skills"]
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
        if len(messages) > _MAX_MESSAGES_WINDOW + 1:
            messages = [messages[0]] + messages[-(_MAX_MESSAGES_WINDOW):]

        compressed = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = normalize_content(msg.content)
                compressed.append(ToolMessage(
                    content=truncate(content, _MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
            elif isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if len(content) > _MAX_AI_MSG_CHARS:
                    compressed.append(AIMessage(
                        content=truncate(content, _MAX_AI_MSG_CHARS),
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

    # ── Structured output extraction (2C) ──────────────────────────────
    def _extract_structured_output(content: str) -> str | None:
        """Extract STRUCTURED_OUTPUT:JSON lines from execute_python stdout.
        Returns the JSON string if found, else None."""
        import json as _json
        lines = content.split("\n")
        structured_parts = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("STRUCTURED_OUTPUT:"):
                json_str = stripped[len("STRUCTURED_OUTPUT:"):].strip()
                try:
                    parsed = _json.loads(json_str)
                    structured_parts.append(_json.dumps(parsed, ensure_ascii=False))
                except _json.JSONDecodeError:
                    pass
        if structured_parts:
            return " | ".join(structured_parts)
        return None

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
                    content=truncate(content, _MAX_TOOL_OUTPUT_CHARS),
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
                # Extract STRUCTURED_OUTPUT blocks for structured data flow (2C)
                structured = _extract_structured_output(content)
                if structured:
                    prior_summary_parts.append(f"[structured data]: {structured}")
                else:
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
            print(f"\n  [{name}] iteration {iteration}/{_MAX_SPECIALIST_ITERS} — processing...")
            # Only show user-facing progress on first iteration (with description)
            if iteration == 1:
                desc = _desc(name)
                _progress(name, f"{_label(name)}: {desc}" if desc else f"{_label(name)}...")

            if iteration > _MAX_SPECIALIST_ITERS:
                print(f"  [{name}] Iteration cap reached, advancing.")
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
            else:
                preview = (response.content[:120] + "...") if response.content and len(response.content) > 120 else response.content
                print(f"  [{name}] Done: \"{preview}\"")
                _progress(name, f"✓ {_label(name)} завърши.")

            response.name = name
            return {"messages": [response]}

        return specialist_node

    # ── Planner node ──────────────────────────────────────────────────
    def planner_node(state: AnalysisState) -> dict:
        print("\n  [planner] Analyzing request to determine specialists needed...")
        _progress("planner", "Планиране: Избор на подходящи специалисти...")

        # Template override: skip LLM planning if a template was selected
        if _template_id:
            from analysis_templates import get_template_specialists
            tpl_specialists = get_template_specialists(_template_id)
            if tpl_specialists:
                selected = [s for s in tpl_specialists if s in SPECIALIST_POOL]
                if selected:
                    stages = FIXED_PREFIX + selected + FIXED_SUFFIX
                    readable = ' → '.join(_label(s) for s in selected)
                    print(f"  [planner] Using template '{_template_id}': {' → '.join(stages)}")
                    _progress("planner", f"Шаблон: {readable}")
                    return {
                        "messages": [AIMessage(content=f"Using template '{_template_id}'. SPECIALISTS: {', '.join(selected)}", name="planner")],
                        "stages_to_run": stages,
                        "current_stage": "planner",
                    }

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
        _progress("planner", f"Избрани специалисти: {readable}")

        return {
            "messages": [AIMessage(content=content, name="planner")],
            "stages_to_run": stages,
            "current_stage": "planner",
        }

    # ── Manager review node ──────────────────────────────────────────
    # Stages that are auto-accepted without LLM review
    _AUTO_ACCEPT_STAGES = {"data_loader", "planner", "code_reviewer", "reporter"}

    def _heuristic_check(messages: list[BaseMessage], stage_name: str) -> str | None:
        """Check if a specialist produced files and had no errors.
        Returns an auto-accept reason string, or None if LLM review is needed."""
        has_new_files = False
        has_error = False
        has_tool_output = False

        for msg in reversed(messages):
            msg_name = getattr(msg, "name", None)
            # Only inspect tool results from this specialist's iteration
            if isinstance(msg, ToolMessage) and msg.name == "execute_python":
                has_tool_output = True
                content = normalize_content(msg.content)
                if '"new_files":' in content:
                    # Check if new_files list is non-empty
                    try:
                        import re as _re
                        match = _re.search(r'"new_files":\s*\[([^\]]+)\]', content)
                        if match and match.group(1).strip():
                            has_new_files = True
                    except Exception:
                        pass
                if '"error":' in content.lower() or "Traceback" in content or "Error:" in content:
                    has_error = True
            # Stop scanning once we hit this specialist's first AI message
            if isinstance(msg, AIMessage) and msg_name == stage_name and not msg.tool_calls:
                break
            # Also stop if we hit a different stage's entry
            if isinstance(msg, AIMessage) and msg_name and msg_name != stage_name and msg_name != "manager":
                break

        if has_tool_output and has_new_files and not has_error:
            return f"Heuristic auto-accept: {stage_name} produced files with no errors."
        return None

    def manager_review_node(state: AnalysisState) -> dict:
        current = state.get("current_stage", "data_loader")
        attempts = state.get("stage_attempts", {})
        attempt_count = attempts.get(current, 0)

        print(f"\n  [manager] Reviewing {current} output (attempt {attempt_count + 1})...")

        # Auto-accept infrastructure stages (data_loader, planner, code_reviewer, reporter)
        if current in _AUTO_ACCEPT_STAGES:
            print(f"  [manager] {current} — auto-accepting (infrastructure stage).")
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

        # Heuristic: if specialist produced chart files with no errors, skip LLM review
        heuristic_reason = _heuristic_check(state["messages"], current)
        if heuristic_reason:
            print(f"  [manager] {heuristic_reason}")
            return {
                "messages": [AIMessage(content=f"ACCEPT: {heuristic_reason}", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        # Fall back to LLM review for ambiguous cases
        print(f"  [manager] Heuristic inconclusive for {current}, invoking LLM review...")
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
            _progress("manager", f"⟳ {_label(current)}: Необходима е корекция, повторен опит...")

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
