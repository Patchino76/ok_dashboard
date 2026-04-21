# Supporting Routers

## mills_ml_router.py — ML Integration Adapter

**File:** `python/mills_ml_router.py`
**Prefix:** `/api/v1/ml`

### Purpose

Adapter module that bridges the standalone `mills-xgboost` subsystem into the main FastAPI app. It imports endpoints from `mills-xgboost/app/api/endpoints.py` and re-exports them under the `/api/v1/ml` prefix.

### How It Works

1. Adds `mills-xgboost/` to `sys.path`
2. Imports `endpoints.router` from `mills-xgboost` and copies all routes
3. Imports `cascade_router` from `optimization_cascade/cascade_endpoints.py` and includes it under `/cascade` sub-prefix
4. Provides a custom `/info` endpoint with model listing

### Endpoints

| Method | Path | Source |
|--------|------|--------|
| POST | `/train` | mills-xgboost endpoints |
| POST | `/predict` | mills-xgboost endpoints |
| POST | `/optimize` | mills-xgboost endpoints |
| GET | `/models` | mills-xgboost endpoints |
| GET | `/info` | Custom — lists available model files |
| * | `/cascade/*` | cascade_endpoints router |

---

## balls_router.py — Balls Consumption Data

**File:** `python/balls_router.py`
**Prefix:** `/api`

### Purpose

Serves grinding ball consumption data from CSV files. This data tracks ball additions to each mill per shift.

### Data Source

CSV files in `python/mock_data/`:
- `balls_measures.csv` — Measurement records (date, ball type, mill, gross weight, operator)
- `balls_items.csv` — Ball type mapping (ID → Bulgarian name, dosmilane flag)

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/balls_data` | Query ball consumption data by date or date range |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `date` | Single date filter (`YYYY-MM-DD` or `M/D/YYYY`) |
| `start_date` | Range start (required if `date` not provided) |
| `end_date` | Range end (optional, defaults to `start_date`) |

### Response Model: `BallsDataRow`

| Field | Type | Description |
|-------|------|-------------|
| `MeasureDate` | string | ISO datetime of measurement |
| `BallsName` | string | Ball type name (Bulgarian) |
| `MillName` | int | Mill number |
| `Gross` | float | Weight in kg |
| `Operator` | string | Operator name |
| `IsDosmilane` | bool | Whether the ball type is "dosmilane" |
| `Shift` | int | Shift number (1, 2, or 3) |

### Shift Logic

Shifts are determined from the measurement datetime:
- **Shift 1:** 06:00–13:59
- **Shift 2:** 14:00–21:59
- **Shift 3:** 22:00–05:59

---

## prompts_router.py — User-Saved Prompts

**File:** `python/prompts_router.py`
**Prefix:** `/api/v1/prompts`

### Purpose

CRUD operations for user-saved analysis prompts, stored in a local SQLite database. Used by the AI chat UI to let users save and reuse frequently used analysis requests.

### Storage

- **Database:** `python/prompts.db` (SQLite with WAL journal mode)
- **Table:** `prompts` (id, user, title, description, created_at)
- **Default user:** `Admin`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all prompts for a user (newest first) |
| POST | `/` | Create a new prompt |
| PUT | `/{prompt_id}` | Update title and/or description |
| DELETE | `/{prompt_id}` | Delete a prompt |

### Request Models

| Model | Fields |
|-------|--------|
| `PromptCreate` | `title` (1-200 chars), `description` (1-5000 chars) |
| `PromptUpdate` | `title` (optional), `description` (optional) |
| `PromptOut` | `id`, `user`, `title`, `description`, `created_at` |

---

## api_utils/mills_utils.py — Mill Data Helpers

**File:** `python/api_utils/mills_utils.py`

### Class: `MillsUtils`

Utility class wrapping `DatabaseManager` for mill-specific operations.

| Method | Description |
|--------|-------------|
| `fetch_ore_totals_by_mill(mill)` | Get shift totals, ore consumption, and running state for a mill |
| `fetch_trend_by_tag(mill, tag, trend_points, hours)` | Get trend data for a specific mill + tag category |
| `fetch_all_mills_by_parameter(parameter, selected_date)` | Get values for all 12 mills for a given parameter |

### `fetch_ore_totals_by_mill` Response

```json
{
  "shift1": 450.0,
  "shift2": 380.0,
  "shift3": 420.0,
  "total": 1250.0,
  "ore": 125.5,
  "state": true,
  "title": "Мелница 08"
}
```

Mill running state: `true` if ore >= 10 t/h.

---

## mills_analysis/mills_fetcher.py — Cross-Mill Parameter Comparison

**File:** `python/mills_analysis/mills_fetcher.py`

### Function: `get_mills_by_param`

Fetches historical data for a specific parameter across all 12 mills from PostgreSQL.

| Parameter | Description |
|-----------|-------------|
| `parameter` | Column name (e.g., `PSI80`, `Ore`, `Power`) |
| `start_ts` | Start timestamp |
| `end_ts` | End timestamp |
| `freq` | Resampling frequency (default: `5min`) |
| `connection_config` | Optional custom DB connection |

### Process

1. Builds a `UNION ALL` query across all `MILL_01`–`MILL_12` tables
2. Pivots data to have mills as columns
3. Resamples to uniform frequency with forward-fill
4. Returns a DataFrame with `timestamp` + one column per mill

Used by the `/api/mills/all_mills_by_param` endpoint for cross-mill comparisons.
