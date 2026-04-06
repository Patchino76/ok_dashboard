"""
tools/db_tools.py — MCP tools for loading data from PostgreSQL
================================================================
Three tools:
  - get_db_schema     : Return table/column metadata from the mills schema
  - query_mill_data   : Load mill sensor data into in-memory store
  - query_combined    : Load combined mill + ore quality data into store

All tools return DataFrames to the in-memory store for subsequent
analysis with execute_python. No analysis is done here — only data loading.
"""

import json
import os
import sys
from typing import Any

import pandas as pd
from mcp import types
from sqlalchemy import create_engine, text, inspect

# ── Add parent paths so we can import MillsDataConnector ─────────────────────
AGENTIC_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_DIR = os.path.dirname(AGENTIC_DIR)
MILLS_XGBOOST_DIR = os.path.join(PYTHON_DIR, "mills-xgboost")
DATABASE_DIR = os.path.join(MILLS_XGBOOST_DIR, "app", "database")
CONFIG_DIR = os.path.join(MILLS_XGBOOST_DIR, "config")

for p in [MILLS_XGBOOST_DIR, DATABASE_DIR, CONFIG_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

from db_connector import MillsDataConnector


# ── In-memory dataframe store ────────────────────────────────────────────────
# Shared across all tools in this server process.
_dataframes: dict[str, pd.DataFrame] = {}


def get_dataframe(name: str = "default") -> pd.DataFrame | None:
    return _dataframes.get(name)


def set_dataframe(df: pd.DataFrame, name: str = "default") -> None:
    _dataframes[name] = df


def list_dataframes() -> dict[str, tuple[int, int]]:
    """Return {name: (rows, cols)} for all loaded dataframes."""
    return {name: (df.shape[0], df.shape[1]) for name, df in _dataframes.items()}


# ── Database connection helper ───────────────────────────────────────────────

def _get_db_connector() -> MillsDataConnector:
    """Create a MillsDataConnector using environment variables or defaults."""
    from dotenv import load_dotenv
    _project_root = os.path.dirname(os.path.dirname(AGENTIC_DIR))
    load_dotenv(os.path.join(_project_root, ".env"))

    host = os.getenv("DB_HOST", "em-m-db4.ellatzite-med.com")
    port = int(os.getenv("DB_PORT", "5432"))
    dbname = os.getenv("DB_NAME", "em_pulse_data")
    user = os.getenv("DB_USER", "s.lyubenov")
    password = os.getenv("DB_PASSWORD", "tP9uB7sH7mK6zA7t")

    return MillsDataConnector(host, port, dbname, user, password)


def _get_engine():
    """Create a raw SQLAlchemy engine for schema introspection."""
    from dotenv import load_dotenv
    _project_root = os.path.dirname(os.path.dirname(AGENTIC_DIR))
    load_dotenv(os.path.join(_project_root, ".env"))

    host = os.getenv("DB_HOST", "em-m-db4.ellatzite-med.com")
    port = int(os.getenv("DB_PORT", "5432"))
    dbname = os.getenv("DB_NAME", "em_pulse_data")
    user = os.getenv("DB_USER", "s.lyubenov")
    password = os.getenv("DB_PASSWORD", "tP9uB7sH7mK6zA7t")

    conn_str = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"
    return create_engine(conn_str)


# ══════════════════════════════════════════════════════════════════════════════
# Tool 1: get_db_schema
# ══════════════════════════════════════════════════════════════════════════════

get_db_schema_input_schema = {
    "type": "object",
    "properties": {
        "schema_name": {
            "type": "string",
            "description": "Database schema to inspect. Default: 'mills'.",
        },
    },
    "required": [],
}

get_db_schema_tool = types.Tool(
    name="get_db_schema",
    description=(
        "Return the database schema metadata: all tables and their columns "
        "with data types. Use this to understand what data is available before "
        "loading it. Default schema is 'mills' which contains MOTIFS_XX tables "
        "(mill sensor data for mills 01-12) and ore_quality table."
    ),
    inputSchema=get_db_schema_input_schema,
)


async def get_db_schema(arguments: dict) -> list[types.TextContent]:
    schema_name = arguments.get("schema_name", "mills").strip()

    engine = _get_engine()
    inspector = inspect(engine)

    table_names = sorted(inspector.get_table_names(schema=schema_name))

    # Compact output: show columns for one MILL table + ore_quality
    tables_summary = {}
    sample_mill = None
    for t in table_names:
        cols = inspector.get_columns(t, schema=schema_name)
        col_names = [c["name"] for c in cols]
        if t.startswith("MILL_") and "MOTIFS" not in t.upper() and sample_mill is None:
            sample_mill = t
            tables_summary[t] = col_names  # show columns for one MILL table
        elif "ore" in t.lower() or "quality" in t.lower():
            tables_summary[t] = col_names  # show columns for ore_quality
        elif t.startswith("MILL_") and "MOTIFS" not in t.upper():
            tables_summary[t] = f"same columns as {sample_mill}"
        else:
            tables_summary[t] = f"{len(col_names)} columns (MOTIFS table, used for ML training)"

    result = {
        "schema": schema_name,
        "tables": table_names,
        "table_count": len(table_names),
        "column_details": tables_summary,
        "usage_hint": (
            "Use query_mill_data(mill_number=N) or query_combined_data(mill_number=N) "
            "to load data. Do NOT call get_db_schema again — you already have the info."
        ),
    }

    engine.dispose()
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


# ══════════════════════════════════════════════════════════════════════════════
# Tool 2: query_mill_data
# ══════════════════════════════════════════════════════════════════════════════

query_mill_data_input_schema = {
    "type": "object",
    "properties": {
        "mill_number": {
            "type": "integer",
            "description": "Mill number (1-12). Each mill has its own MILL_XX table.",
        },
        "start_date": {
            "type": "string",
            "description": "Start date ISO format, e.g. '2025-01-01'. Optional.",
        },
        "end_date": {
            "type": "string",
            "description": "End date ISO format, e.g. '2025-03-31'. Optional.",
        },
        "store_name": {
            "type": "string",
            "description": "Name to store the DataFrame under. Default: 'mill_data_{mill_number}' (e.g. 'mill_data_8'). Use get_df('mill_data_8') in execute_python to access it.",
        },
    },
    "required": ["mill_number"],
}

query_mill_data_tool = types.Tool(
    name="query_mill_data",
    description=(
        "Load time-series process data for a specific mill (1-12) into memory. "
        "MILL_XX tables contain minute-level sensor data with TimeStamp index. "
        "Columns: TimeStamp, Ore, WaterMill, WaterZumpf, Power, ZumpfLevel, "
        "PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200. "
        "Optionally filter by date range. Data is stored as a pandas DataFrame "
        "with TimeStamp as the index for time-series analysis."
    ),
    inputSchema=query_mill_data_input_schema,
)


async def query_mill_data(arguments: dict) -> list[types.TextContent]:
    mill_number = arguments.get("mill_number")
    start_date = arguments.get("start_date")
    end_date = arguments.get("end_date")
    store_name = arguments.get("store_name") or f"mill_data_{mill_number}"

    if mill_number is None or not (1 <= mill_number <= 12):
        raise ValueError("mill_number is required and must be between 1 and 12")

    engine = _get_engine()
    mill_table = f"MILL_{mill_number:02d}"
    query = f'SELECT * FROM mills."{mill_table}"'

    conditions = []
    if start_date:
        conditions.append(f'"TimeStamp" >= \'{start_date}\'')
    if end_date:
        conditions.append(f'"TimeStamp" <= \'{end_date}\'')
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += ' ORDER BY "TimeStamp"'

    df = pd.read_sql_query(query, engine, parse_dates=["TimeStamp"])
    engine.dispose()

    if df.empty:
        return [types.TextContent(type="text", text=json.dumps({
            "status": "empty",
            "message": f"No data in mills.{mill_table} for the given date range.",
        }))]

    # Set TimeStamp as index for time-series analysis
    df = df.set_index("TimeStamp")
    set_dataframe(df, store_name)

    # Compact summary
    key_cols = [c for c in ["Ore", "PSI80", "PSI200", "DensityHC", "MotorAmp"] if c in df.columns]
    stats = {}
    if key_cols:
        desc = df[key_cols].describe().round(2)
        stats = {col: {"mean": float(desc.at["mean", col]), "std": float(desc.at["std", col])}
                 for col in key_cols}

    result = {
        "status": "loaded",
        "store_name": store_name,
        "mill_number": mill_number,
        "rows": df.shape[0],
        "columns": list(df.columns),
        "date_range": {"start": str(df.index.min()), "end": str(df.index.max())},
        "key_stats": stats,
    }
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


# ══════════════════════════════════════════════════════════════════════════════
# Tool 3: query_combined_data
# ══════════════════════════════════════════════════════════════════════════════

query_combined_data_input_schema = {
    "type": "object",
    "properties": {
        "mill_number": {
            "type": "integer",
            "description": "Mill number (1-12).",
        },
        "start_date": {
            "type": "string",
            "description": "Start date ISO format, e.g. '2025-01-01'. Optional.",
        },
        "end_date": {
            "type": "string",
            "description": "End date ISO format, e.g. '2025-03-31'. Optional.",
        },
        "store_name": {
            "type": "string",
            "description": "Name to store the DataFrame under. Default: 'combined_data'.",
        },
    },
    "required": ["mill_number"],
}

query_combined_data_tool = types.Tool(
    name="query_combined_data",
    description=(
        "Load mill process data + ore quality data joined on TimeStamp. "
        "Combines MILL_XX (sensor data) with ore_quality (lab data: Shisti, Daiki, "
        "Grano, Class_12, Class_15). The joined DataFrame has all process variables "
        "plus ore quality columns. Use this for comprehensive analysis that needs "
        "both sensor and lab data. TimeStamp is the index."
    ),
    inputSchema=query_combined_data_input_schema,
)


async def query_combined_data(arguments: dict) -> list[types.TextContent]:
    mill_number = arguments.get("mill_number")
    start_date = arguments.get("start_date")
    end_date = arguments.get("end_date")
    store_name = arguments.get("store_name", "combined_data")

    if mill_number is None or not (1 <= mill_number <= 12):
        raise ValueError("mill_number is required and must be between 1 and 12")

    engine = _get_engine()

    # Load mill data
    mill_table = f"MILL_{mill_number:02d}"
    mill_query = f'SELECT * FROM mills."{mill_table}"'
    conditions = []
    if start_date:
        conditions.append(f'"TimeStamp" >= \'{start_date}\'')
    if end_date:
        conditions.append(f'"TimeStamp" <= \'{end_date}\'')
    if conditions:
        mill_query += " WHERE " + " AND ".join(conditions)
    mill_query += ' ORDER BY "TimeStamp"'

    df_mill = pd.read_sql_query(mill_query, engine, parse_dates=["TimeStamp"])

    if df_mill.empty:
        engine.dispose()
        return [types.TextContent(type="text", text=json.dumps({
            "status": "empty",
            "message": f"No data in mills.{mill_table} for the given date range.",
        }))]

    # Load ore quality data
    ore_query = "SELECT * FROM mills.ore_quality"
    ore_conditions = []
    if start_date:
        ore_conditions.append(f'"TimeStamp" >= \'{start_date}\'')
    if end_date:
        ore_conditions.append(f'"TimeStamp" <= \'{end_date}\'')
    if ore_conditions:
        ore_query += " WHERE " + " AND ".join(ore_conditions)

    df_ore = pd.read_sql_query(ore_query, engine, parse_dates=["TimeStamp"])
    engine.dispose()

    # Join on TimeStamp (nearest-time merge)
    df_mill = df_mill.set_index("TimeStamp")
    if not df_ore.empty and "TimeStamp" in df_ore.columns:
        df_ore = df_ore.set_index("TimeStamp")
        # Keep only numeric ore quality columns
        ore_cols = [c for c in ["Shisti", "Daiki", "Grano", "Class_12", "Class_15"] if c in df_ore.columns]
        if ore_cols:
            df_ore_subset = df_ore[ore_cols]
            df_ore_subset = df_ore_subset[~df_ore_subset.index.duplicated(keep="first")]
            df_mill = df_mill.join(df_ore_subset, how="left")

    set_dataframe(df_mill, store_name)

    # Compact summary
    key_cols = [c for c in ["Ore", "PSI80", "PSI200", "DensityHC", "MotorAmp"] if c in df_mill.columns]
    stats = {}
    if key_cols:
        desc = df_mill[key_cols].describe().round(2)
        stats = {col: {"mean": float(desc.at["mean", col]), "std": float(desc.at["std", col])}
                 for col in key_cols}

    result = {
        "status": "loaded",
        "store_name": store_name,
        "mill_number": mill_number,
        "rows": df_mill.shape[0],
        "columns": list(df_mill.columns),
        "date_range": {"start": str(df_mill.index.min()), "end": str(df_mill.index.max())},
        "ore_quality_joined": any(c in df_mill.columns for c in ["Shisti", "Daiki", "Grano"]),
        "key_stats": stats,
    }
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
