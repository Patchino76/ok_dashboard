"""
tools/skill_runner.py — Direct skill invocation MCP tool.
=========================================================
Exposes `run_skill`, a typed entry point that lets an agent call a tested
function from the skills library WITHOUT writing glue code in execute_python.
This reduces hallucinated arguments / column names and makes the manager's
heuristic auto-accept deterministic.

The tool resolves the skill function by name, binds the loaded DataFrame and the
per-analysis OUTPUT_DIR automatically, forwards any extra JSON params, and
returns the skill's standardized {figures, stats, summary} dict.

Best for single-DataFrame skills. Multi-DataFrame skills (e.g.
skills.oee.multi_mill_oee, which expects a dict of DataFrames) cannot receive
DataFrames through JSON — use execute_python for those.
"""

import inspect
import json

import mcp.types as types

from tools.db_tools import get_dataframe, list_dataframes
from tools.output_dir import get_output_dir
from tools.skill_registry import get_discovered_modules


def _resolve_function(module_name: str, function_name: str):
    """Return the (unwrapped-name) skill function or raise a clear error."""
    import skills as _skills

    if module_name not in (_skills.__all__ or []):
        raise ValueError(
            f"Unknown skill module '{module_name}'. "
            f"Available: {', '.join(_skills.__all__)}."
        )
    module = getattr(_skills, module_name, None)
    func = getattr(module, function_name, None)
    if func is None or not callable(func):
        public = [n for n in dir(module) if not n.startswith("_") and callable(getattr(module, n))]
        raise ValueError(
            f"Unknown function '{function_name}' in skills.{module_name}. "
            f"Available: {', '.join(public)}."
        )
    return func


run_skill_tool = types.Tool(
    name="run_skill",
    description=(
        "Run a tested function from the skills library directly, without writing "
        "Python glue code. Resolves the function, binds the loaded DataFrame and "
        "OUTPUT_DIR automatically, and returns the skill's {figures, stats, summary}. "
        "Call list_skills first to see exact function names and parameters. "
        "Best for single-DataFrame skills; for multi-mill skills that need a dict "
        "of DataFrames, use execute_python instead."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "module": {
                "type": "string",
                "description": "Skill module name (e.g. 'eda', 'spc').",
                **({"enum": get_discovered_modules()} if get_discovered_modules() else {}),
            },
            "function": {
                "type": "string",
                "description": "Function name within the module (e.g. 'descriptive_stats').",
            },
            "df": {
                "type": "string",
                "description": (
                    "Name of the loaded DataFrame to analyze (e.g. 'mill_data_8'). "
                    "Defaults to 'default' / the first loaded frame if omitted."
                ),
            },
            "params": {
                "type": "object",
                "description": (
                    "Extra keyword arguments for the skill (e.g. "
                    "{\"columns\": [\"Ore\", \"PSI80\"]}). OUTPUT_DIR is injected "
                    "automatically; do not pass it here."
                ),
            },
        },
        "required": ["module", "function"],
    },
)


async def run_skill(arguments: dict) -> list[types.TextContent]:
    module_name = (arguments.get("module") or "").strip()
    function_name = (arguments.get("function") or "").strip()
    df_name = (arguments.get("df") or "").strip()
    params = arguments.get("params") or {}

    if not module_name or not function_name:
        raise ValueError("Both 'module' and 'function' are required.")
    if not isinstance(params, dict):
        raise ValueError("'params' must be a JSON object of keyword arguments.")

    try:
        func = _resolve_function(module_name, function_name)
    except ValueError as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}, ensure_ascii=False))]

    # Resolve the DataFrame from the in-memory store.
    loaded = list_dataframes()
    if not df_name:
        df_name = "default" if get_dataframe("default") is not None else next(iter(loaded), "")
    dataframe = get_dataframe(df_name) if df_name else None
    if dataframe is None:
        return [types.TextContent(type="text", text=json.dumps({
            "error": f"DataFrame '{df_name or '(none)'}' not loaded. "
                     f"Available: {list(loaded.keys())}.",
        }, ensure_ascii=False))]

    sig = inspect.signature(func)
    call_kwargs = dict(params)
    # Auto-bind OUTPUT_DIR when the skill accepts it.
    if "output_dir" in sig.parameters and "output_dir" not in call_kwargs:
        call_kwargs["output_dir"] = get_output_dir()

    # Bind the DataFrame to the first positional parameter when the caller did
    # not already supply it via params.
    first_param = next(iter(sig.parameters), None)
    call_args = []
    if first_param and first_param not in call_kwargs:
        call_args.append(dataframe)

    try:
        result = func(*call_args, **call_kwargs)
    except TypeError as e:
        return [types.TextContent(type="text", text=json.dumps({
            "error": f"Bad arguments for skills.{module_name}.{function_name}: {e}. "
                     f"Expected signature: {function_name}{sig}.",
        }, ensure_ascii=False, default=str))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({
            "error": f"skills.{module_name}.{function_name} failed: {e}",
        }, ensure_ascii=False, default=str))]

    # Normalize the standardized {figures, stats, summary} dict for return.
    if isinstance(result, dict):
        payload = {
            "skill": f"{module_name}.{function_name}",
            "df": df_name,
            "summary": result.get("summary", ""),
            "stats": result.get("stats", {}),
            "figures": [
                f.replace("\\", "/").rsplit("/", 1)[-1] for f in result.get("figures", [])
            ],
        }
    else:
        payload = {"skill": f"{module_name}.{function_name}", "df": df_name, "result": result}

    return [types.TextContent(type="text", text=json.dumps(payload, ensure_ascii=False, default=str))]
