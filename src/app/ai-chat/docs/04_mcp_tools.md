# 04 — MCP Tools

This document explains every tool registered on the MCP server. These are the "hands" of the AI agents — the concrete actions they can perform.

---

## Tool Registry

All tools are registered in `python/agentic/tools/__init__.py`:

```python
tools = {
    "get_db_schema":        {...},   # db_tools.py
    "query_mill_data":      {...},   # db_tools.py
    "query_combined_data":  {...},   # db_tools.py
    "execute_python":       {...},   # python_executor.py
    "list_output_files":    {...},   # report_tools.py
    "write_markdown_report":{...},   # report_tools.py
    "set_output_directory": {...},   # session_tools.py
}
```

Each entry has:

- **`tool`** — An `mcp.types.Tool` descriptor (name, description, input schema)
- **`handler`** — An async function that executes the tool

When the MCP server receives a `call_tool` request, it looks up the handler by name and calls it.

---

## Tool 1: `get_db_schema`

**File:** `tools/db_tools.py`

**Purpose:** Let agents understand the database structure before querying.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `schema_name` | string | No | Database schema to inspect (default: `"mills"`) |

**What it does:**

1. Creates a SQLAlchemy engine connected to PostgreSQL
2. Uses `inspect()` to list all tables in the schema
3. Shows column details for one sample `MILL_XX` table and `ore_quality`
4. Returns a compact JSON summary

**Output example:**

```json
{
  "schema": "mills",
  "table_count": 14,
  "tables": ["MILL_01", "MILL_02", ..., "MILL_12", "ore_quality"],
  "column_details": {
    "MILL_01": ["TimeStamp", "Ore", "WaterMill", "Power", ...],
    "MILL_02": "same columns as MILL_01",
    "ore_quality": ["TimeStamp", "Shisti", "Daiki", "Grano", ...]
  }
}
```

**Used by:** Data Loader agent (to understand the schema before loading data)

---

## Tool 2: `query_mill_data`

**File:** `tools/db_tools.py`

**Purpose:** Load time-series sensor data for a specific mill into memory.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mill_number` | integer | Yes | Mill number (1–12) |
| `start_date` | string | No | Start date ISO format (e.g. `"2025-01-01"`) |
| `end_date` | string | No | End date ISO format |
| `store_name` | string | No | Name to store the DataFrame under (default: `"mill_data_{N}"`) |

**What it does:**

1. Builds a SQL query: `SELECT * FROM mills."MILL_08" WHERE "TimeStamp" >= ... AND "TimeStamp" <= ...`
2. Loads the result into a pandas DataFrame
3. Sets `TimeStamp` as the index (for time-series operations)
4. Stores the DataFrame in the **in-memory dataframe store** (`_dataframes` dict)
5. Returns a compact summary with row count, columns, date range, and key statistics

**In-memory store:**

```python
_dataframes: dict[str, pd.DataFrame] = {}

# After query_mill_data(mill_number=8):
_dataframes["mill_data_8"] = <DataFrame with 43200 rows>
```

This store is shared across all tools in the server process. The `execute_python` tool accesses it via `get_df("mill_data_8")`.

**Available columns:**
`TimeStamp`, `Ore`, `WaterMill`, `WaterZumpf`, `Power`, `ZumpfLevel`, `PressureHC`, `DensityHC`, `FE`, `PulpHC`, `PumpRPM`, `MotorAmp`, `PSI80`, `PSI200`

**Used by:** Data Loader agent

---

## Tool 3: `query_combined_data`

**File:** `tools/db_tools.py`

**Purpose:** Load mill sensor data joined with ore quality (lab) data.

**Input:** Same as `query_mill_data`, plus `store_name` defaults to `"combined_data"`.

**What it does:**

1. Loads mill sensor data (same as `query_mill_data`)
2. Loads `ore_quality` table (lab measurements: Shisti, Daiki, Grano, Class_12, Class_15)
3. Joins them on TimeStamp using a left join
4. Stores the combined DataFrame in memory

**When to use:** For analyses that need both process variables and ore quality metrics.

**Used by:** Data Loader agent

---

## Tool 4: `execute_python`

**File:** `tools/python_executor.py`

**Purpose:** Run arbitrary Python code for data analysis, chart generation, and statistical computation.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Python code to execute |

**What it does:**

1. Resolves the current output directory (per-analysis subfolder)
2. Tracks which files exist before execution
3. Builds an execution namespace with pre-injected variables:

```python
namespace = {
    "df":           <first loaded DataFrame>,
    "get_df":       get_dataframe,          # get_df("mill_data_8")
    "list_dfs":     list_dataframes,        # list_dfs() → {"mill_data_8": (43200, 14)}
    "pd":           pandas,
    "np":           numpy,
    "plt":          matplotlib.pyplot,
    "sns":          seaborn,
    "scipy_stats":  scipy.stats,
    "os":           os,
    "json":         json,
    "OUTPUT_DIR":   "/path/to/output/{analysis_id}/",
    "__builtins__": __builtins__,
}
```

4. Captures stdout (anything the code `print()`s)
5. Runs the code with `exec(code, namespace)`
6. Detects newly created files (charts saved to `OUTPUT_DIR`)
7. Returns stdout, new files list, loaded dataframes, and any errors

**Output example:**

```json
{
  "stdout": "Mean Ore: 152.3 t/h\nStd: 23.1\n...",
  "new_files": ["ore_comparison.png", "downtime_chart.png"],
  "loaded_dataframes": { "mill_data_8": [43200, 14] },
  "error": null
}
```

**Security note:** This runs `exec()` without sandboxing. It's intended for internal use only.

**Used by:** Analyst agent, Code Reviewer agent

---

## Tool 5: `list_output_files`

**File:** `tools/report_tools.py`

**Purpose:** List all files in the current analysis output directory.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `extension_filter` | string | No | Filter by extension (e.g. `"png"`, `"md"`) |

**What it does:**

1. Scans the output directory `output/{analysis_id}/`
2. Optionally filters by file extension
3. Returns file names and sizes

**Output example:**

```json
{
  "count": 3,
  "files": [
    { "name": "downtime_analysis.png", "size_kb": 45.2 },
    { "name": "ore_comparison.png", "size_kb": 38.7 },
    { "name": "Mill_Report.md", "size_kb": 12.1 }
  ]
}
```

**Used by:** Analyst (to check what charts exist), Code Reviewer (to validate), Reporter (to get exact filenames for embedding)

---

## Tool 6: `write_markdown_report`

**File:** `tools/report_tools.py`

**Purpose:** Write the final Markdown report file to disk.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | Report filename (e.g. `"Mill_Analysis_Report.md"`) |
| `content` | string | Yes | Full Markdown content |

**What it does:**

1. Ensures the filename ends with `.md`
2. Writes the content to `output/{analysis_id}/{filename}`
3. Returns confirmation with file path and size

**Output example:**

```json
{
  "status": "written",
  "file": "Mill_Analysis_Report.md",
  "path": "/path/to/output/51329fe7/Mill_Analysis_Report.md",
  "size_kb": 12.1,
  "lines": 187
}
```

**Used by:** Reporter agent

---

## Tool 7: `set_output_directory`

**File:** `tools/session_tools.py`

**Purpose:** Configure the per-analysis output subfolder.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysis_id` | string | Yes | The analysis ID to use as subfolder name |

**What it does:**

1. Sets the module-level `_current_output_dir` to `output/{analysis_id}/`
2. Creates the directory if it doesn't exist
3. All subsequent tool calls (`execute_python`, `write_markdown_report`, `list_output_files`) will use this directory

**Called by:** The API endpoint (`api_endpoint.py`) at the very start of each analysis, before the agent graph runs.

### Shared State: `output_dir.py`

```python
# Module-level mutable state
_current_output_dir: str = _DEFAULT_OUTPUT_DIR

def get_output_dir() -> str:      # Used by execute_python, report_tools
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir

def set_output_dir(subdir: str):  # Called by set_output_directory tool
    global _current_output_dir
    _current_output_dir = os.path.join(_DEFAULT_OUTPUT_DIR, subdir)
```

---

## In-Memory DataFrame Store

The dataframe store in `db_tools.py` is a simple dict that all tools share:

```
┌──────────────────────────────────────────────┐
│  _dataframes (shared in-process)             │
│                                              │
│  "mill_data_1"  → DataFrame (43200 × 14)    │
│  "mill_data_6"  → DataFrame (41000 × 14)    │
│  "mill_data_8"  → DataFrame (43200 × 14)    │
│  "combined_data"→ DataFrame (43200 × 19)    │
└──────────────────────────────────────────────┘
        ▲                          ▲
        │                          │
  query_mill_data            execute_python
  (writes)                   (reads via get_df)
```

**Helper functions:**

- `set_dataframe(df, name)` — Store a DataFrame
- `get_dataframe(name)` — Retrieve a DataFrame (returns `None` if not found)
- `list_dataframes()` — Returns `{name: (rows, cols)}` for all loaded DataFrames

---

## Tool ↔ Agent Mapping

| Tool                    | Data Loader | Analyst | Code Reviewer | Reporter |
| ----------------------- | :---------: | :-----: | :-----------: | :------: |
| `get_db_schema`         |     ✅      |         |               |          |
| `query_mill_data`       |     ✅      |         |               |          |
| `query_combined_data`   |     ✅      |         |               |          |
| `execute_python`        |             |   ✅    |      ✅       |          |
| `list_output_files`     |             |   ✅    |      ✅       |    ✅    |
| `write_markdown_report` |             |         |               |    ✅    |
| `set_output_directory`  |      —      |    —    |       —       |    —     |

> `set_output_directory` is called by the API layer before agents run, not by any agent.

---

## Next

→ **[05 — Frontend](./05_frontend.md)** — The chat UI and how it connects to the backend
