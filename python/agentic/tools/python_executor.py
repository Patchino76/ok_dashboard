"""
tools/python_executor.py — MCP tool for executing Python code
===============================================================
One tool:
  - execute_python : Run Python code with access to loaded DataFrames,
                     pandas, numpy, scipy, seaborn, matplotlib, and
                     advanced scientific libraries (Prophet, statsmodels,
                     sklearn, shap, etc.)

The code runs in a namespace that pre-injects:
  - df             : the 'default' loaded dataframe (convenience alias)
  - get_df(name)   : function to get any named dataframe from the store
  - list_dfs()     : function to list all loaded dataframes
  - pd, np, plt, sns, scipy_stats (scipy.stats)
  - Prophet        : Facebook Prophet for time series forecasting
  - sm, tsa        : statsmodels API and time series API
  - pmdarima       : auto_arima for automatic ARIMA order selection
  - IsolationForest, DBSCAN, StandardScaler : sklearn anomaly/clustering
  - shap           : SHAP explainability
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

# ── Advanced scientific libraries (graceful fallback if not installed) ────────

_ADVANCED_LIBS = {}  # populated at import time, injected into exec namespace

# Time series forecasting
try:
    from prophet import Prophet
    _ADVANCED_LIBS["Prophet"] = Prophet
except ImportError:
    pass

try:
    import statsmodels.api as _sm
    import statsmodels.tsa.api as _tsa
    _ADVANCED_LIBS["sm"] = _sm
    _ADVANCED_LIBS["tsa"] = _tsa
except ImportError:
    pass

try:
    import pmdarima as _pmdarima
    _ADVANCED_LIBS["pmdarima"] = _pmdarima
except ImportError:
    pass

# Anomaly detection & clustering
try:
    from sklearn.ensemble import IsolationForest as _IF
    from sklearn.cluster import DBSCAN as _DBSCAN
    from sklearn.preprocessing import StandardScaler as _SS
    from sklearn.linear_model import LinearRegression as _LR
    _ADVANCED_LIBS["IsolationForest"] = _IF
    _ADVANCED_LIBS["DBSCAN"] = _DBSCAN
    _ADVANCED_LIBS["StandardScaler"] = _SS
    _ADVANCED_LIBS["LinearRegression"] = _LR
except ImportError:
    pass

# SHAP explainability
try:
    import shap as _shap
    _ADVANCED_LIBS["shap"] = _shap
except ImportError:
    pass

# Hidden Markov Models
try:
    import hmmlearn.hmm as _hmm
    _ADVANCED_LIBS["hmm"] = _hmm
except ImportError:
    pass

print(f"[python_executor] Advanced libs available: {list(_ADVANCED_LIBS.keys())}")

from tools.db_tools import get_dataframe, list_dataframes
from tools.output_dir import get_output_dir
from tools.domain_knowledge import PLANT_VARIABLES, SHIFTS, MILL_NAMES, get_spec_limits
from tools.skill_registry import _format_catalog as _skill_catalog_formatter

# Import skills library for agent use
try:
    import skills as _skills_module
    _ADVANCED_LIBS["skills"] = _skills_module
    print(f"[python_executor] Skills library loaded: {_skills_module.__all__}")
except ImportError as e:
    print(f"[python_executor] Skills library not available: {e}")
    _skills_module = None


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
                "  - Prophet: Facebook Prophet for time series forecasting\n"
                "  - sm (statsmodels.api), tsa (statsmodels.tsa.api): ARIMA, decomposition\n"
                "  - pmdarima: auto_arima for automatic order selection\n"
                "  - IsolationForest, DBSCAN, StandardScaler, LinearRegression: sklearn\n"
                "  - shap: SHAP explainability for feature importance\n"
                "  - hmm (hmmlearn.hmm): Hidden Markov Models for regime detection\n"
                "  - PLANT_SPECS: dict of all plant variables with min/max/unit/varType\n"
                "  - get_spec_limits(var): get spec limits for SPC analysis\n"
                "  - skills: skill library with tested functions (skills.eda, skills.spc, etc.)\n"
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
        "Advanced libraries also available: Prophet (forecasting), statsmodels (sm, tsa), "
        "pmdarima (auto_arima), sklearn (IsolationForest, DBSCAN, StandardScaler, LinearRegression), "
        "shap (explainability), hmmlearn (hmm). "
        "Domain knowledge: PLANT_SPECS (dict of all variables with min/max/unit/varType), "
        "SHIFTS (shift schedule), MILL_NAMES (list of 12 mills), get_spec_limits(var). "
        "Skill library: import skills — then use skills.eda, skills.spc, skills.anomaly, "
        "skills.forecasting, skills.shift_kpi, skills.optimization for tested analysis functions. "
        "Use this for EDA, SPC, time series forecasting, anomaly detection, Bayesian analysis, "
        "process optimization, and any scientific computation. "
        "Print results to stdout. Save charts to OUTPUT_DIR. "
        "Returns stdout output, list of saved chart files, and any errors."
    ),
    inputSchema=execute_python_input_schema,
)


async def execute_python(arguments: dict) -> list[types.TextContent]:
    code = arguments.get("code", "").strip()
    if not code:
        raise ValueError("code is required")

    # Resolve the current per-analysis output directory
    output_dir = get_output_dir()

    # Track which files exist before execution
    existing_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()

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
        # Paths — points to the per-analysis subfolder
        "OUTPUT_DIR": output_dir,
        # Domain knowledge
        "PLANT_SPECS": PLANT_VARIABLES,
        "SHIFTS": SHIFTS,
        "MILL_NAMES": MILL_NAMES,
        "get_spec_limits": get_spec_limits,
        # Skill discovery — call list_skills() or list_skills('spc') in code
        "list_skills": lambda module=None: print(_skill_catalog_formatter(module)),
        # Builtins
        "__builtins__": __builtins__,
    }

    # Inject all available advanced libraries into the namespace
    namespace.update(_ADVANCED_LIBS)

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
    current_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()
    new_files = sorted(current_files - existing_files)

    result: dict = {
        "stdout": stdout_output[:8000] if stdout_output else "",
        "new_files": new_files,
        "loaded_dataframes": list_dataframes(),
    }
    if error_msg:
        result["error"] = error_msg[:4000]

    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
