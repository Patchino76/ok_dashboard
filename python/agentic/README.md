# Agentic Data Analysis — Ore Dressing Plant

Multi-agent system for analyzing process data from an ore dressing factory with 12 ball mills.
Uses MCP (Model Context Protocol) for tool communication and LangGraph for agent orchestration.

## Architecture

```
[MCP Server :8003]         [LangGraph Agents]
  ├─ db_tools              ├─ Manager (orchestrator)
  │   ├─ get_db_schema     ├─ Data Loader (pulls data)
  │   ├─ query_mill_data   ├─ Analyst (EDA, SPC, correlations)
  │   └─ query_combined    ├─ Code Reviewer (validates outputs)
  ├─ python_executor       └─ Reporter (writes .md reports)
  │   └─ execute_python
  └─ report_tools
      ├─ list_output_files
      └─ write_markdown_report
```

## Data Flow

```
PostgreSQL (em_pulse_data)
  → MillsDataConnector → DataFrame in memory
  → execute_python (pandas/numpy/scipy/matplotlib)
  → charts in output/ + markdown report
```

## Setup

1. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Create `.env` file:

   ```
   GROQ_API_KEY=your_groq_api_key_here
   DB_HOST=em-m-db4.ellatzite-med.com
   DB_PORT=5432
   DB_NAME=em_pulse_data
   DB_USER=s.lyubenov
   DB_PASSWORD=your_password_here
   ```

3. Start the MCP server:

   ```
   python server.py
   ```

4. Run analysis (in a separate terminal):
   ```
   python main.py
   ```

## Analysis Capabilities

- **EDA**: Distribution analysis, missing values, outlier detection
- **SPC**: Control charts (Xbar-R, CUSUM), Nelson rules, process capability
- **Correlations**: Feature correlations, rolling window analysis
- **Anomaly Detection**: Z-score, IQR, statistical tests
- **Downtime Analysis**: Shift-based aggregations, production gaps
- **Reporting**: Markdown reports with embedded charts

## Database Schema

- `mills.MILL_XX` — Minute-level time-series sensor data (XX = 01..12), columns: TimeStamp, Ore, WaterMill, WaterZumpf, Power, ZumpfLevel, PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200
- `mills.ore_quality` — Ore quality lab data: TimeStamp, Shift, Class_15, Class_12, Grano, Daiki, Shisti
- `mills.MOTIFS_XX` — Motif-pattern data (used for ML training, not for analysis)

## Future: API Integration

The `api_endpoint.py` exposes a FastAPI endpoint for the UI:

- `POST /api/v1/agentic/analyze` — submit analysis request
- `GET /api/v1/agentic/reports/{id}` — retrieve generated report
