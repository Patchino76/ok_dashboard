"""
tools/session_tools.py — MCP tool for configuring the output directory per analysis
=====================================================================================
One tool:
  - set_output_directory : Set the output subfolder for the current analysis session
"""

import json

from mcp import types
from tools.output_dir import set_output_dir, get_output_dir

# ══════════════════════════════════════════════════════════════════════════════
# Tool: set_output_directory
# ══════════════════════════════════════════════════════════════════════════════

set_output_directory_input_schema = {
    "type": "object",
    "properties": {
        "analysis_id": {
            "type": "string",
            "description": "The analysis ID to use as the output subfolder name.",
        },
    },
    "required": ["analysis_id"],
}

set_output_directory_tool = types.Tool(
    name="set_output_directory",
    description=(
        "Set the output directory for the current analysis session. "
        "This MUST be called at the very start of every analysis with the analysis_id. "
        "All subsequent file operations (charts, reports) will write to output/{analysis_id}/. "
        "Returns the full path of the output directory."
    ),
    inputSchema=set_output_directory_input_schema,
)


async def set_output_directory(arguments: dict) -> list[types.TextContent]:
    analysis_id = arguments.get("analysis_id", "").strip()
    if not analysis_id:
        raise ValueError("analysis_id is required")

    full_path = set_output_dir(analysis_id)
    result = {
        "status": "configured",
        "analysis_id": analysis_id,
        "output_dir": full_path,
    }
    return [types.TextContent(type="text", text=json.dumps(result, indent=2))]
