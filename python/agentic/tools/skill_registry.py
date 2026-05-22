"""
tools/skill_registry.py — Skill discovery tool for agents.
===========================================================
Provides a list_skills MCP tool that agents can call to discover available
skill functions, their signatures, and descriptions. This enables agents to
choose the right skill dynamically without relying solely on prompt examples.
"""

import inspect
import json
import mcp.types as types


# ── Build skill catalog at import time ──────────────────────────────────────

def _build_skill_catalog() -> dict:
    """Introspect all skills modules and build a catalog of available functions."""
    catalog = {}
    try:
        import skills as _skills
    except ImportError:
        return catalog

    for module_name in _skills.__all__:
        module = getattr(_skills, module_name, None)
        if module is None:
            continue

        funcs = {}
        for name, obj in inspect.getmembers(module, inspect.isfunction):
            if name.startswith("_"):
                continue

            sig = inspect.signature(obj)
            params = []
            for pname, param in sig.parameters.items():
                p_info = {"name": pname}
                # Annotation
                if param.annotation != inspect.Parameter.empty:
                    try:
                        p_info["type"] = str(param.annotation)
                    except Exception:
                        pass
                # Default value
                if param.default != inspect.Parameter.empty:
                    try:
                        p_info["default"] = repr(param.default)
                    except Exception:
                        pass
                params.append(p_info)

            # Extract first paragraph of docstring as description
            doc = inspect.getdoc(obj) or ""
            desc_lines = []
            for line in doc.split("\n"):
                stripped = line.strip()
                if stripped == "" and desc_lines:
                    break
                if stripped:
                    desc_lines.append(stripped)
            description = " ".join(desc_lines)

            # Extract return info from docstring
            returns = ""
            in_returns = False
            for line in doc.split("\n"):
                stripped = line.strip()
                if stripped.lower().startswith("returns:"):
                    in_returns = True
                    rest = stripped[len("returns:"):].strip()
                    if rest:
                        returns = rest
                    continue
                if in_returns:
                    if stripped and not stripped.endswith(":"):
                        returns = stripped
                    break

            funcs[name] = {
                "signature": f"skills.{module_name}.{name}({', '.join(p['name'] for p in params)})",
                "description": description,
                "parameters": params,
                "returns": returns,
            }

        if funcs:
            catalog[module_name] = funcs

    return catalog


_SKILL_CATALOG = _build_skill_catalog()


def _format_catalog(module_filter: str | None = None) -> str:
    """Format the skill catalog as readable text for the agent."""
    if not _SKILL_CATALOG:
        return "No skills available. The skills library could not be loaded."

    lines = ["=== Available Skills Library ===", ""]
    lines.append("Usage: result = skills.<module>.<function>(df, ..., output_dir=OUTPUT_DIR)")
    lines.append("All functions return: {\"figures\": [paths], \"stats\": {dict}, \"summary\": \"text\"}")
    lines.append("")

    modules = _SKILL_CATALOG
    if module_filter and module_filter in _SKILL_CATALOG:
        modules = {module_filter: _SKILL_CATALOG[module_filter]}

    for mod_name, funcs in modules.items():
        lines.append(f"── skills.{mod_name} ──")
        for func_name, info in funcs.items():
            lines.append(f"  {info['signature']}")
            if info["description"]:
                lines.append(f"    {info['description']}")
            if info["returns"]:
                lines.append(f"    → {info['returns']}")
            lines.append("")

    return "\n".join(lines)


# ── MCP Tool Definition ────────────────────────────────────────────────────
#
# Module list is reflected from the actually-discovered catalog at import time
# so new skill modules registered in `skills/__init__.py` automatically appear
# in this tool's description and parameter schema — no manual edits needed.

_DISCOVERED_MODULES = sorted(_SKILL_CATALOG.keys())
_MODULE_LIST_TEXT = ", ".join(_DISCOVERED_MODULES) or "(none)"

_module_property: dict = {
    "type": "string",
    "description": (
        f"Optional: filter by module name. Available: {_MODULE_LIST_TEXT}. "
        "If omitted, returns all skills."
    ),
}
# Only attach an enum constraint when we actually have modules; an empty enum
# (or `null`) is invalid JSON Schema and will reject every call.
if _DISCOVERED_MODULES:
    _module_property["enum"] = _DISCOVERED_MODULES

list_skills_tool = types.Tool(
    name="list_skills",
    description=(
        "List all available skill functions from the skills library. "
        "Returns function signatures, descriptions, parameters, and return types. "
        "Use this to discover which tested analysis functions are available before "
        f"writing code. Discovered modules: {_MODULE_LIST_TEXT}."
    ),
    inputSchema={
        "type": "object",
        "properties": {"module": _module_property},
        "required": [],
    },
)


def get_discovered_modules() -> list[str]:
    """Public accessor for the list of auto-discovered skill modules. Used by
    the planner / specialist prompts so they can reference the live catalogue
    instead of hard-coded module names."""
    return list(_DISCOVERED_MODULES)


async def list_skills(arguments: dict) -> list[types.TextContent]:
    """Handler for the list_skills MCP tool."""
    module_filter = arguments.get("module", "").strip() or None
    text = _format_catalog(module_filter)
    return [types.TextContent(type="text", text=text)]
