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

Structured Output (2C integration):
    Every skill function automatically prints a STRUCTURED_OUTPUT:{json} line
    after execution. This feeds the downstream context builder so subsequent
    agents receive structured data instead of raw text.
"""

import json as _json
import functools as _functools
import inspect as _inspect


def _structured_output_wrapper(func, module_name):
    """Wrap a skill function to auto-emit STRUCTURED_OUTPUT after each call."""
    @_functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        # Only emit for dicts with the standard {figures, stats, summary} shape
        if isinstance(result, dict) and "stats" in result:
            try:
                # Build a compact structured payload
                payload = {
                    "skill": f"{module_name}.{func.__name__}",
                    "stats": result.get("stats", {}),
                    "figures": [f.rsplit("/", 1)[-1] if "/" in f else f.rsplit("\\", 1)[-1] if "\\" in f else f
                                for f in result.get("figures", [])],
                }
                # Emit the structured output line (picked up by graph_v3 _extract_structured_output)
                print(f"STRUCTURED_OUTPUT:{_json.dumps(payload, ensure_ascii=False, default=str)}")
            except Exception:
                pass  # Never break the skill function due to serialization issues
        return result
    return wrapper


def _wrap_module(module, module_name):
    """Wrap all public functions in a module with structured output emission."""
    for name in dir(module):
        if name.startswith("_"):
            continue
        obj = getattr(module, name)
        if _inspect.isfunction(obj):
            setattr(module, name, _structured_output_wrapper(obj, module_name))


from skills import eda
from skills import spc
from skills import anomaly
from skills import forecasting
from skills import shift_kpi
from skills import optimization

__all__ = ["eda", "spc", "anomaly", "forecasting", "shift_kpi", "optimization"]

# Apply structured output wrappers to all skill modules
for _mod_name in __all__:
    _wrap_module(globals()[_mod_name], _mod_name)
