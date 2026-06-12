# Agentic Skills & Pipeline Reference

This document describes the skills library and the multi-agent pipeline that powers the
ore-dressing-plant analysis system. The LLM is **Google Gemini** (`GOOGLE_API_KEY`).

## Pipeline (graph.py)

```
data_loader → planner → [specialists*] → code_reviewer → critic → reporter
```

- **data_loader** — loads SQL-filtered mill data into the per-analysis DataFrame store.
- **planner** — selects the smallest useful set of specialists for the request.
- **specialists** (dynamic pool, may run in parallel): `analyst`, `forecaster`,
  `anomaly_detective`, `bayesian_analyst`, `optimizer`, `shift_reporter`.
- **code_reviewer** — validates outputs (files exist, no errors, gaps filled).
- **critic** — cross-specialist numerical consistency, plausibility vs process physics,
  chart vision review (`review_chart`), confidence flags, optional `EXTEND_PIPELINE`.
- **reporter** — writes one comprehensive Markdown report **in Bulgarian**.

A `manager_review` node sits between stages: it auto-accepts on a heuristic
(charts + `STRUCTURED_OUTPUT` + no errors) and only invokes an LLM review for
ambiguous cases. The critic may extend the pipeline with up to 2 extra specialists.

## Skills Library (skills/)

Pre-built, tested functions called inside `execute_python` so specialists don't
re-write boilerplate. Each returns a standardized dict
`{"figures": [...], "stats": {...}, "summary": "..."}` and auto-emits a
`STRUCTURED_OUTPUT:{json}` line consumed by `graph._extract_structured_output`.

| Module | Key Functions |
|--------|--------------|
| `eda` | `descriptive_stats`, `distribution_plots`, `correlation_heatmap`, `time_series_overview` |
| `spc` | `xbar_chart`, `process_capability`, `control_limits_table` |
| `anomaly` | `isolation_forest_analysis`, `anomaly_timeline`, `regime_detection` |
| `forecasting` | `prophet_forecast`, `seasonal_decomposition` |
| `shift_kpi` | `assign_shifts`, `shift_kpis`, `shift_comparison_chart`, `downtime_analysis` |
| `optimization` | `pareto_frontier`, `sensitivity_analysis`, `optimal_windows` |
| `oee` | `shift_oee` and plant-configured Availability × Performance × Quality |
| `causal` | causal / lead-lag relationship helpers |
| `changepoint` | structural break / changepoint detection |
| `energy` | specific energy (kWh/t) analysis (ratio-of-totals) |
| `benchmark` | cross-mill ranking / benchmarking |

Discover available functions at runtime with `list_skills()` (or the `list_skills`
MCP tool), which is auto-generated from the registry in `tools/skill_registry.py`.

## Domain Knowledge (tools/domain_knowledge.py)

- `PLANT_VARIABLES` — every process variable with min/max/unit/varType/description.
- `SHIFTS` — 3 × 8-hour shift schedule. `MILL_NAMES` — all 12 mills. `OEE_CONFIG`.
- Injected into the `execute_python` namespace as `PLANT_SPECS`, `SHIFTS`,
  `MILL_NAMES`, `OEE_CONFIG`, `get_spec_limits(var)`.
- Also exposed as the `get_domain_knowledge` MCP tool.

## Context Budget (UI settings)

- Frontend: `src/app/ai-chat/stores/settings-store.ts` + `components/settings-panel.tsx`.
- Settings: `maxToolOutputChars`, `maxAiMessageChars`, `maxMessagesWindow`,
  `maxSpecialistIterations`.
- `POST /analyze` accepts an optional `settings` dict; `api_endpoint.py` forwards it to
  `build_graph()`, which uses it instead of the module-level defaults in `graph.py`.

## Structured Output Protocol

Skill functions print `STRUCTURED_OUTPUT:{json}` after each call.
`build_focused_context()` extracts these blocks and injects compact
`[structured data]: {…}` summaries for downstream agents (critic, reporter) instead of
raw stdout.

## Analysis Templates (analysis_templates.py)

Pre-defined specialist sequences that skip the planner. `POST /analyze` accepts an
optional `template_id`; `GET /templates` lists them.

| Template ID | Specialists |
|-------------|------------|
| `comprehensive` | analyst, anomaly_detective, shift_reporter |
| `forecast` | analyst, forecaster |
| `quality` | analyst, optimizer |
| `shift_comparison` | shift_reporter |
| `anomaly_investigation` | anomaly_detective, bayesian_analyst |
| `optimization` | analyst, optimizer |
