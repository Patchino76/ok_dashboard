# Agentic Skills Enhancement

## Overview

This document tracks the skill upgrades applied to the multi-agent analysis system.
The agents use LangGraph + MCP tools to perform data analysis on ore dressing plant data.

## Changes Summary

| ID | Feature | Files Created/Modified | Status |
|----|---------|----------------------|--------|
| 1D | Domain Knowledge Reference | `tools/domain_knowledge.py`, `tools/__init__.py`, `tools/python_executor.py` | ✅ |
| 1A | Skill Library | `skills/__init__.py`, `skills/eda.py`, `skills/spc.py`, `skills/anomaly.py`, `skills/forecasting.py`, `skills/shift_kpi.py`, `skills/optimization.py`, `tools/python_executor.py` | ✅ |
| 1C | Context Budget UI Settings | `src/app/ai-chat/stores/settings-store.ts`, `src/app/ai-chat/components/settings-panel.tsx`, `src/app/ai-chat/page.tsx`, `api_endpoint.py`, `graph_v3.py` | ✅ |
| 2C | Structured Output Protocol | `graph_v3.py` | ✅ |
| 2D | Analysis Templates | `analysis_templates.py`, `api_endpoint.py`, `graph_v3.py`, `src/app/ai-chat/page.tsx` | ✅ |

---

## 1D — Domain Knowledge Reference

**Purpose**: Give agents access to plant specifications (variable ranges, units, types, operational
thresholds) so they use correct specs instead of guessing.

**File**: `python/agentic/tools/domain_knowledge.py`

- `PLANT_VARIABLES` dict: every process variable with min, max, unit, varType (MV/CV/DV/TARGET),
  description in Bulgarian, spec limits, and operational notes.
- `SHIFTS` dict: shift schedule (3 shifts × 8 hours).
- `MILL_NAMES`: list of all 12 mills.
- MCP tool `get_domain_knowledge`: agents can call it to retrieve the full reference.
- Also injected directly into `execute_python` namespace as `PLANT_SPECS`.

**Source**: Values extracted from `src/app/mills-ai/data/mills-parameters.ts`.

---

## 1A — Skill Library

**Purpose**: Pre-built, tested Python functions that agents call instead of generating code from
scratch. Each function returns a standardized dict: `{"figures": [...], "stats": {...}, "summary": "..."}`.

**Package**: `python/agentic/skills/`

| Module | Key Functions |
|--------|--------------|
| `eda.py` | `descriptive_stats()`, `distribution_plots()`, `correlation_heatmap()`, `time_series_overview()` |
| `spc.py` | `xbar_chart()`, `process_capability()`, `control_limits_table()` |
| `anomaly.py` | `isolation_forest_analysis()`, `anomaly_timeline()`, `regime_detection()` |
| `forecasting.py` | `prophet_forecast()`, `seasonal_decomposition()` |
| `shift_kpi.py` | `assign_shifts()`, `shift_kpis()`, `shift_comparison_chart()`, `downtime_analysis()` |
| `optimization.py` | `pareto_frontier()`, `sensitivity_analysis()`, `optimal_windows()` |

**Injection**: Available in `execute_python` as `import skills` or via `skills.spc.xbar_chart(...)`.

---

## 1C — Context Budget UI Settings

**Purpose**: Let users control how much context agents use (affects quality vs. speed).

**Frontend**:
- `src/app/ai-chat/stores/settings-store.ts` — Zustand store, persisted in localStorage.
- `src/app/ai-chat/components/settings-panel.tsx` — Collapsible settings panel.
- Settings: max_tool_output_chars, max_ai_message_chars, max_messages_window, max_specialist_iterations.

**Backend**:
- `POST /analyze` accepts optional `settings` dict.
- `api_endpoint.py` passes settings to `build_graph()`.
- `graph_v3.py` uses settings instead of hardcoded constants.

---

## 2C — Structured Output Protocol

**Purpose**: Pass structured data (not truncated free-form text) between specialists → reporter.

**Convention**: Specialists append to stdout:
```
STRUCTURED_OUTPUT:{"psi80_mean": 72.3, "cpk": 1.12, "charts": ["file.png"]}
```

**In graph_v3.py**: `build_focused_context()` extracts these JSON blocks from prior messages and
injects them as compact structured summaries for downstream agents.

---

## 2D — Analysis Templates

**Purpose**: Pre-defined analysis pipelines that skip the planner and use exact specialist sequences.

**File**: `python/agentic/analysis_templates.py`

| Template ID | Label | Specialists |
|-------------|-------|------------|
| `comprehensive` | Пълен анализ | analyst, anomaly_detective, shift_reporter |
| `forecast` | Прогноза | analyst, forecaster |
| `quality` | Качество на смилане | analyst, optimizer |
| `shift_comparison` | Сравнение на смени | shift_reporter |
| `anomaly_investigation` | Разследване на аномалии | anomaly_detective, bayesian_analyst |

**Frontend**: Template selector shown on the chat empty state page.
**API**: `POST /analyze` accepts optional `template_id`. If provided, planner is skipped.
