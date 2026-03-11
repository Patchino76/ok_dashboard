"""
tools/python_executor.py — MCP tool for executing Python code
===============================================================
One tool:
  - execute_python : Run Python code with access to loaded DataFrames,
                     pandas, numpy, scipy, seaborn, matplotlib.

The code runs in a namespace that pre-injects:
  - df             : the 'default' loaded dataframe (convenience alias)
  - get_df(name)   : function to get any named dataframe from the store
  - list_dfs()     : function to list all loaded dataframes
  - pd, np, plt, sns, scipy.stats
  - OUTPUT_DIR     : path to the output/ folder for saving charts

Returns stdout, any saved figure paths, and errors.

Security note: This is for internal use. In production, sandbox the execution.
"""

import io
import json
import os
import sys
import traceback

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for server use
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from scipy import stats as scipy_stats
from mcp import types

from tools.db_tools import get_dataframe, list_dataframes

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ── execute_python ───────────────────────────────────────────────────────────

execute_python_input_schema = {
    "type": "object",
    "properties": {
        "code": {
            "type": "string",
            "description": (
                "Python code to execute for data analysis. The code has access to:\n"
                "  - df: the default loaded DataFrame (from last query_mill_data or query_combined_data)\n"
                "  - get_df(name): get any named DataFrame from the store (e.g. get_df('mill_8_jan'))\n"
                "  - list_dfs(): list all loaded DataFrames with shapes\n"
                "  - pd, np, plt, sns, scipy_stats (scipy.stats)\n"
                "  - OUTPUT_DIR: path to save charts\n\n"
                "To save charts:\n"
                "  plt.savefig(os.path.join(OUTPUT_DIR, 'chart_name.png'), dpi=150, bbox_inches='tight')\n"
                "  plt.close()\n\n"
                "Print results to stdout for the agent to see. Always plt.close() after each figure."
            ),
        },
    },
    "required": ["code"],
}

execute_python_tool = types.Tool(
    name="execute_python",
    description=(
        "Execute Python code for data analysis on the loaded DataFrames. "
        "The code runs with access to: df (default DataFrame), get_df(name) for named DataFrames, "
        "list_dfs() to see all loaded data, plus pandas (pd), numpy (np), seaborn (sns), "
        "matplotlib.pyplot (plt), scipy.stats, and OUTPUT_DIR for saving charts. "
        "Use this for EDA, SPC charts, correlation analysis, anomaly detection, "
        "statistical tests, and any pandas/numpy computation. "
        "Print results to stdout. Save charts to OUTPUT_DIR. "
        "Returns stdout output, list of saved chart files, and any errors."
    ),
    inputSchema=execute_python_input_schema,
)


async def execute_python(arguments: dict) -> list[types.TextContent]:
    code = arguments.get("code", "").strip()
    if not code:
        raise ValueError("code is required")

    # Track which files exist before execution
    existing_files = set(os.listdir(OUTPUT_DIR)) if os.path.exists(OUTPUT_DIR) else set()

    # Build execution namespace with analysis-friendly tools
    namespace = {
        # DataFrames
        "df": get_dataframe("default") or get_dataframe(next(iter(list_dataframes()), "default")),
        "get_df": get_dataframe,
        "list_dfs": list_dataframes,
        # Core libraries
        "pd": pd,
        "np": np,
        "plt": plt,
        "sns": sns,
        "scipy_stats": scipy_stats,
        "os": os,
        "json": json,
        # Paths
        "OUTPUT_DIR": OUTPUT_DIR,
        # Builtins
        "__builtins__": __builtins__,
    }

    # If no default df, try to get the first available one
    if namespace["df"] is None:
        loaded = list_dataframes()
        if loaded:
            first_name = next(iter(loaded))
            namespace["df"] = get_dataframe(first_name)

    # Capture stdout
    old_stdout = sys.stdout
    sys.stdout = captured_stdout = io.StringIO()

    error_msg = None
    try:
        exec(code, namespace)
    except Exception:
        error_msg = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        # Ensure all figures are closed to free memory
        plt.close("all")

    stdout_output = captured_stdout.getvalue()

    # Detect newly created files
    current_files = set(os.listdir(OUTPUT_DIR)) if os.path.exists(OUTPUT_DIR) else set()
    new_files = sorted(current_files - existing_files)

    result: dict = {
        "stdout": stdout_output[:8000] if stdout_output else "",
        "new_files": new_files,
        "loaded_dataframes": list_dataframes(),
    }
    if error_msg:
        result["error"] = error_msg[:4000]

    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
