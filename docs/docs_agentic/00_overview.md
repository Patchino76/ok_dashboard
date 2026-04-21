# OK Dashboard — Python Backend Overview

## Architecture

The Python backend consists of several interconnected subsystems serving a Next.js frontend dashboard for monitoring and optimizing ball mill operations at a mineral processing plant (Ellatzite-Med).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│                   (localhost:3000 / proxy)                       │
└──────────┬──────────────────────────────┬───────────────────────┘
           │  REST API                    │  REST API (proxied)
           ▼                              ▼
┌─────────────────────┐        ┌─────────────────────────┐
│   FastAPI Server     │        │   MCP Server (Agentic)  │
│   (api.py :8000)     │        │   (server.py :8003)     │
│                      │        │                         │
│  ├─ Tag endpoints    │        │  Tools:                 │
│  ├─ Mills endpoints  │        │  ├─ db_tools            │
│  ├─ ML router        │◄───────┤  ├─ python_executor     │
│  ├─ Multi-output     │        │  ├─ report_tools        │
│  ├─ Cascade optim.   │        │  └─ session_tools       │
│  ├─ Agentic router   │        └────────────┬────────────┘
│  ├─ Balls router     │                     │
│  └─ Prompts router   │                     │ MCP Protocol
│                      │                     ▼
└──────┬───────────────┘        ┌─────────────────────────┐
       │                        │   LangGraph Agents      │
       │                        │   (graph_v3.py)         │
       │                        │                         │
       ▼                        │  Planner → Specialists  │
┌──────────────┐                │  → Manager → Reporter   │
│  Databases   │                └─────────────────────────┘
│              │
│  SQL Server  │  ← Tag values (Pulse SCADA)
│  PostgreSQL  │  ← Mill process data (mills schema)
│  SQLite      │  ← User prompts (local)
└──────────────┘
```

## Subsystem Summary

| Subsystem | Entry Point | Port | Purpose |
|-----------|-------------|------|---------|
| **Main API** | `python/api.py` | 8000 | Central FastAPI server, mounts all routers |
| **MCP Server** | `python/agentic/server.py` | 8003 | Tool server for agentic analysis |
| **LangGraph Agents** | `python/agentic/graph_v3.py` | — | Multi-agent analysis pipeline |
| **Mills XGBoost** | `python/mills-xgboost/` | — | ML training, prediction, optimization |
| **Cascade Optimization** | `python/mills-xgboost/app/optimization_cascade/` | — | Multi-stage cascade optimization |

## Key Data Sources

- **SQL Server (Pulse SCADA)** — Real-time tag values, trends, and states from the plant control system. Connected via `database.py` using ODBC Driver 17.
- **PostgreSQL** — Historical mill process data (tables `MILL_01`–`MILL_12`) and ore quality data. Connected via SQLAlchemy/psycopg2.
- **SQLite** — Local storage for user-saved prompts (`prompts.db`).

## Configuration

- `python/config.py` — Environment-based config (HOST, PORT, CORS_ORIGINS)
- `python/agentic/.env` — API keys (GOOGLE_API_KEY) and DB credentials for agentic system
- `python/mills-xgboost/config/settings.py` — PostgreSQL connection settings for ML subsystem

## File Index

| File | Description |
|------|-------------|
| `api.py` | Main FastAPI application — mounts all routers, defines tag/mills/ML endpoints |
| `config.py` | Environment configuration (host, port, CORS) |
| `database.py` | SQL Server database manager (tag values, trends, states) |
| `data_utils.py` | Outlier cleaning utilities (z-score method) |
| `tags_definition.py` | Tag ID definitions for mills (shifts, totals, ore consumption) |
| `balls_router.py` | Balls consumption data router (CSV-based) |
| `prompts_router.py` | User-saved prompts CRUD (SQLite) |
| `mills_ml_router.py` | Adapter router mounting mills-xgboost + cascade endpoints |
| `api_utils/mills_utils.py` | Mill data helper class (ore totals, trends, parameter fetching) |
| `mills_analysis/mills_fetcher.py` | Cross-mill parameter comparison (PostgreSQL) |
| `agentic/server.py` | MCP tool server (Starlette + uvicorn) |
| `agentic/client.py` | MCP-to-LangChain tool bridge |
| `agentic/graph_v3.py` | Multi-agent LangGraph (planner, specialists, manager) |
| `agentic/api_endpoint.py` | FastAPI router for agentic analysis (analyze, status, reports) |
| `agentic/main.py` | CLI entry point for running analyses directly |
| `agentic/tools/` | MCP tool implementations (db, python, reports, session) |
| `mills-xgboost/` | XGBoost ML subsystem (training, prediction, optimization) |
