# Agentic Data Analysis — Ore Dressing Plant

Multi-agent system for analyzing process data from an ore dressing factory with 12 ball mills.
Uses **MCP** (Model Context Protocol) for tool communication and **LangGraph** for agent
orchestration. The LLM is **Google Gemini** (`langchain-google-genai`).

## Architecture

```
[MCP Server :8003]            [LangGraph Pipeline (graph.py)]
  ├─ db_tools                   data_loader  → load data (SQL-filtered)
  │   ├─ get_db_schema          planner      → pick relevant specialists
  │   ├─ query_mill_data        ── specialist pool (dynamic) ──
  │   └─ query_combined_data        analyst, forecaster, anomaly_detective,
  ├─ python_executor               bayesian_analyst, optimizer, shift_reporter
  │   └─ execute_python         code_reviewer → validate outputs
  ├─ report_tools               critic        → cross-specialist consistency + vision
  │   ├─ list_output_files      reporter      → write Bulgarian .md report
  │   └─ write_markdown_report
  ├─ domain_knowledge (get_domain_knowledge)
  ├─ skill_registry   (list_skills)
  ├─ vision_tools     (review_chart — Gemini multimodal)
  └─ session_tools    (set_output_directory)
```

Between stages a `manager_review` node performs a heuristic QA check (auto-accept on
charts + structured output with no errors) and falls back to an LLM review only for
ambiguous cases. The `planner` selects the smallest useful set of specialists; the
`critic` may request up to 2 pipeline extensions.

## Data Flow

```
PostgreSQL (em_pulse_data)
  → MillsDataConnector → DataFrame in memory (per-analysis store)
  → execute_python (pandas/numpy/scipy/matplotlib + skills library)
  → charts in output/{analysis_id}/ + markdown report
```

## Setup

1. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Configure `.env` at the **project root** (`ok_dashboard/.env`):

   ```
   GOOGLE_API_KEY=your_gemini_api_key_here
   DB_HOST=em-m-db4.ellatzite-med.com
   DB_PORT=5432
   DB_NAME=em_pulse_data
   DB_USER=s.lyubenov
   DB_PASSWORD=your_password_here
   MCP_SERVER_URL=http://localhost:8003/mcp   # optional, this is the default
   ```

3. Start the MCP server (port 8003):

   ```
   python server.py
   ```

4. Run an analysis:
   - **Via the UI**: the FastAPI app (`python/api.py`) mounts the agentic router at
     `/api/v1/agentic/*`; the Next.js page at `/ai-chat` drives it.
   - **Via CLI demo** (no UI): `python main.py` runs the demo requests in `main.py`.

## Analysis Capabilities

Specialists draw on the `skills/` library (tested pandas/sklearn/statsmodels functions):

- **EDA** (`skills.eda`): descriptive stats, distributions, correlation heatmaps, time-series overview
- **SPC** (`skills.spc`): Xbar control charts, process capability (Cp, Cpk), control-limit tables
- **Anomaly** (`skills.anomaly`): Isolation Forest, DBSCAN regime detection, anomaly timelines
- **Forecasting** (`skills.forecasting`): Prophet forecasts, seasonal decomposition
- **Shift KPIs** (`skills.shift_kpi`): per-shift KPIs, comparison charts, downtime analysis
- **Optimization** (`skills.optimization`): Pareto frontier, sensitivity, optimal windows
- **OEE** (`skills.oee`): plant-configured Availability × Performance × Quality
- **Causal** (`skills.causal`), **Changepoint** (`skills.changepoint`),
  **Energy** (`skills.energy`), **Benchmark** (`skills.benchmark`)

## Database Schema

- `mills.MILL_XX` — Minute-level time-series sensor data (XX = 01..12), columns: TimeStamp, Ore, WaterMill, WaterZumpf, Power, ZumpfLevel, PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200
- `mills.ore_quality` — Ore quality lab data: TimeStamp, Shift, Class_15, Class_12, Grano, Daiki, Shisti
- `mills.MOTIFS_XX` — Motif-pattern data (used for ML training, not for analysis)

## API Endpoints (`api_endpoint.py`, prefix `/api/v1/agentic`)

- `POST /analyze` — submit an analysis request (optional `template_id`, `settings`); returns `analysis_id`
- `GET /status/{analysis_id}` — poll status + progress messages
- `POST /followup/{analysis_id}` — refine/extend an existing analysis
- `GET /conversations`, `GET /conversations/{id}/messages` — role-scoped history
- `GET /reports/{analysis_id}/{filename}` — fetch a generated chart/report
- `GET /templates` — list pre-defined analysis pipelines
- `DELETE /analysis/{id}`, `POST /cancel/{id}` — cleanup / cancellation

Requests are role-scoped via the `X-User-Role` header (`mechanic`, `technologist`, `manager`).

## Key Modules

| File | Responsibility |
|------|----------------|
| `graph.py` | Main LangGraph pipeline + `build_followup_graph`, all specialist prompts |
| `api_endpoint.py` | FastAPI router, background runner, persistence |
| `client.py` | MCP → LangChain StructuredTool bridge |
| `server.py` | MCP server exposing the tools |
| `tools/` | MCP tool implementations (db, python_executor, reports, domain knowledge, vision) |
| `skills/` | Reusable analysis functions used inside `execute_python` |
| `analysis_templates.py` | Fixed specialist sequences that bypass the planner |
| `db.py` | SQLite persistence (`analyses.db`) for conversations + long-term memory |
| `main.py` | CLI demo runner (no UI) |
