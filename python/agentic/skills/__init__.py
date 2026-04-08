"""
skills/ — Reusable analysis functions for agentic specialists.
================================================================
Pre-built, tested Python functions that agents call via execute_python
instead of generating analysis code from scratch.

Usage in execute_python:
    import skills
    results = skills.spc.xbar_chart(df, 'PSI80', output_dir=OUTPUT_DIR)
    results = skills.eda.descriptive_stats(df)

Each function returns a standardized dict:
    {"figures": [list of saved file paths],
     "stats": {dict of numeric results},
     "summary": "human-readable summary text"}
"""

from skills import eda
from skills import spc
from skills import anomaly
from skills import forecasting
from skills import shift_kpi
from skills import optimization

__all__ = ["eda", "spc", "anomaly", "forecasting", "shift_kpi", "optimization"]
