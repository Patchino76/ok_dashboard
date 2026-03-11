"""
tools/__init__.py — Tool registry for the Agentic MCP Server
==============================================================
Registry mapping tool name -> {"tool": types.Tool, "handler": callable}
To add a new tool: create its descriptor + handler in the appropriate file,
then add one entry here. server.py and client.py need zero changes.
"""

from tools.db_tools import (
    get_db_schema_tool, get_db_schema,
    query_mill_data_tool, query_mill_data,
    query_combined_data_tool, query_combined_data,
)
from tools.python_executor import (
    execute_python_tool, execute_python,
)
from tools.report_tools import (
    list_output_files_tool, list_output_files,
    write_markdown_report_tool, write_markdown_report,
)

# Registry mapping tool name -> {"tool": types.Tool, "handler": callable}
tools = {
    get_db_schema_tool.name:        {"tool": get_db_schema_tool,        "handler": get_db_schema},
    query_mill_data_tool.name:      {"tool": query_mill_data_tool,      "handler": query_mill_data},
    query_combined_data_tool.name:  {"tool": query_combined_data_tool,  "handler": query_combined_data},
    execute_python_tool.name:       {"tool": execute_python_tool,       "handler": execute_python},
    list_output_files_tool.name:    {"tool": list_output_files_tool,    "handler": list_output_files},
    write_markdown_report_tool.name:{"tool": write_markdown_report_tool,"handler": write_markdown_report},
}
