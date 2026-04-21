# Database Layer

## database.py — SQL Server Connection Manager

**File:** `python/database.py`

### Overview

Manages connections to the Pulse SCADA SQL Server database containing real-time and historical tag data from the plant control system.

### Class: `DatabaseManager`

| Method | Description |
|--------|-------------|
| `get_tag_value(tag_id)` | Get the latest value for a single tag |
| `get_tag_values(tag_ids)` | Batch fetch latest values for multiple tags (single query with `ROW_NUMBER()`) |
| `get_tag_trend(tag_id, hours=8)` | Historical trend data spanning multiple archive tables |
| `get_tag_history_range(tag_id, start_time, end_time)` | Range-based history query across archive tables |
| `get_tag_states(state_tag_ids)` | Boolean state values for on/off tags |
| `get_tag_details(tag_id)` | Tag metadata (name, description, unit) from dashboard-tags.ts or fallback list |

### Connection Details

- **Driver:** ODBC Driver 17 for SQL Server
- **Server:** `10.20.2.10` (default)
- **Database:** `pulse`
- **Engine:** SQLAlchemy with connection pooling (`pool_size=10`, `max_overflow=20`)
- **Timezone:** UTC+3 (`DATEADD(hour, 3, IndexTime)` applied to all queries)

### Archive Table Strategy

Tag data is stored across monthly archive tables:
- `LoggerValues` — current month
- `LoggerValues_Archive_Nov2025`, `LoggerValues_Archive_Oct2025`, etc. — previous months

The `_get_archive_table_names()` method generates the list of tables needed for a given time range. Queries are executed per-table and results are merged and sorted.

### Tag Details Resolution

Tag metadata is resolved in priority order:
1. Frontend `dashboard-tags.ts` file (parsed with regex)
2. `tags_definition.py` fallback list (`sql_tags`)
3. Auto-generated basic tag (`Tag_{id}`)

### Class: `MockDatabaseManager`

Fallback when SQL Server is unavailable. Returns zero values and empty trends. Allows the API to start gracefully without a database connection.

### Factory: `create_db_manager(config=None)`

Creates a `DatabaseManager` with fallback to `MockDatabaseManager` on connection failure.

---

## config.py — Environment Configuration

**File:** `python/config.py`

| Variable | Development | Production |
|----------|-------------|------------|
| `HOST` | `127.0.0.1` | `0.0.0.0` |
| `PORT` | `8000` | `8001` |
| `CORS_ORIGINS` | `localhost:3000` | `localhost:3000` + `profimine.ellatzite-med.com` |

Environment is determined by `NODE_ENV` (default: `development`).

---

## data_utils.py — Data Processing Utilities

**File:** `python/data_utils.py`

| Function | Description |
|----------|-------------|
| `clean_array_outliers(values, threshold=3.0)` | Z-score outlier removal on numpy arrays (replaces with NaN) |
| `clean_df_outliers(df, column, threshold=3.0)` | Z-score outlier removal on a DataFrame column |

---

## tags_definition.py — Tag ID Definitions

**File:** `python/tags_definition.py`

### `sql_tags`

Fallback tag metadata list with basic process tags (temperature, pressure, flow, motor speed, tank level).

### `millsNames`

English-to-Bulgarian mill name translations (`Mill01` → `Мелница 01`).

### `mills_tags`

Shift-level tag ID mappings for all 12 mills:

| Category | Description | Example Tag ID (Mill08) |
|----------|-------------|------------------------|
| `shift1` | Shift 1 total | 503 |
| `shift2` | Shift 2 total | 504 |
| `shift3` | Shift 3 total | 505 |
| `total` | All-shifts total | 1202 |
| `ore` | Ore consumption | 467 |

These tag IDs are used by `MillsUtils` and the ore-daily endpoint to fetch per-mill production data from SQL Server.
