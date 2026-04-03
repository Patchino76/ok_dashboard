# api.py — Main FastAPI Server

**File:** `python/api.py`
**Port:** 8000 (dev) / 8001 (prod)
**Run:** `python python/api.py`

## Overview

Central FastAPI application that serves the Next.js frontend. It mounts all sub-routers and defines core endpoints for tag data, mill operations, and ML systems.

## Startup Flow

1. Loads configuration from `config.py` (HOST, PORT, CORS)
2. Creates the FastAPI app with CORS middleware
3. Mounts sub-routers:
   - `mills_ml_router` at `/api/v1/ml` — XGBoost + cascade optimization
   - `multi_output_router` at `/api/v1/ml/multi-output` — Multi-output optimization
   - `agentic_router` at `/api/v1/agentic` — AI agent analysis (graceful fallback)
   - `balls_router` at `/api` — Balls consumption data
   - `prompts_router` at `/api/v1/prompts` — User-saved prompts
4. Creates shared `DatabaseManager` instance for SQL Server
5. Initializes PostgreSQL connector lazily via `_get_pg_connector()`

## Endpoints

### Health & Info

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health check — reports availability of ML, multi-output, cascade, and agentic subsystems |
| GET | `/api/ml/info` | ML system capabilities and available endpoints |

### Tag Data (SQL Server — Pulse SCADA)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tag-value/{tag_id}` | Current value of a single tag |
| GET | `/api/tag-values?tag_ids=1,2,3` | Batch current values for multiple tags |
| GET | `/api/tag-trend/{tag_id}?hours=8` | Historical trend data for a tag |
| GET | `/api/tag-states?state_tag_ids=1,2` | Boolean states for multiple tags |

### Mills Data (SQL Server + PostgreSQL)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mills/{mill}/ore` | Shift totals and ore consumption for a specific mill |
| GET | `/api/mills/ore-by-mill?mill=Mill01` | Same as above, query parameter variant |
| GET | `/api/mills/ore-daily?start_date=...&end_date=...` | Daily ore production for all mills in date range |
| GET | `/api/mills/trend-by-tag?mill=Mill01&tag=ore` | Trend data for a mill's tag category |
| GET | `/api/mills/by-parameter?parameter=ore` | Values for all 12 mills for a given parameter |
| GET | `/api/mills/all_mills_by_param?parameter=Ore&start_ts=...&end_ts=...` | Historical data for all mills (PostgreSQL) |
| GET | `/api/mills/series?mill_number=8&parameter=PSI80&start_ts=...&end_ts=...` | Time-bucketed series data with aggregation (PostgreSQL) |

### Multi-Output Optimization

Prefix: `/api/v1/ml/multi-output`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/info` | Model info (features, targets, constraints) |
| GET | `/status` | Training status |
| POST | `/train` | Train multi-output XGBoost model |
| POST | `/predict` | Predict CVs from MotorAmp value |
| POST | `/optimize` | Optimize MotorAmp to minimize PSI200 |

### Mounted Routers

| Prefix | Router | See |
|--------|--------|-----|
| `/api/v1/ml` | `mills_ml_router` | [05_routers.md](05_routers.md) |
| `/api/v1/ml/cascade` | `cascade_router` | [04_mills_xgboost.md](04_mills_xgboost.md) |
| `/api/v1/agentic` | `agentic_router` | [03_agentic.md](03_agentic.md) |
| `/api` | `balls_router` | [05_routers.md](05_routers.md) |
| `/api/v1/prompts` | `prompts_router` | [05_routers.md](05_routers.md) |

## PostgreSQL Mill Series Endpoint

The `/api/mills/series` endpoint is the most complex endpoint. It queries PostgreSQL directly with:

- **Time bucketing** — groups data into configurable resolution buckets (`1min`, `5min`, `1h`, `1d`)
- **Aggregation** — `avg`, `sum`, `min`, `max` within each bucket
- **Period aggregation** — optional secondary grouping by `day`, `month`, or `year`
- **Production day offset** — configurable start hour (default: 06:00) for daily aggregation

Valid mill parameters: `Ore`, `WaterMill`, `WaterZumpf`, `Power`, `ZumpfLevel`, `PressureHC`, `DensityHC`, `FE`, `PulpHC`, `PumpRPM`, `MotorAmp`, `PSI80`, `PSI200`.

## Key Internals

- **`_get_pg_connector()`** — Lazy singleton for PostgreSQL connection via `MillsDataConnector`
- **`_parse_resolution_to_seconds()`** — Parses resolution strings like `5min`, `1h`, `1d`
- **`_bucket_expr_for_resolution()`** — Builds SQL time-bucketing expressions for PostgreSQL
- **`_normalize_agg()` / `_normalize_period()`** — Input validation helpers
- **`db_manager`** — Global `DatabaseManager` instance (SQL Server), injected via FastAPI `Depends`
