# 16 — Extending the System

Four kinds of extension are common: adding a **tool**, adding a **skill**,
adding a **specialist**, and adding a **template**. Each has a fixed
checklist.

## 1. Adding a new MCP tool

Goal: expose a new server-side capability (e.g. "upload file to S3", "fetch
lab CSV", "query a second database").

### Files to touch

1. **Create** `tools/my_tool.py`:

```python
import json
from mcp import types

my_tool_input_schema = {
    "type": "object",
    "properties": {
        "arg1": {"type": "string", "description": "…"},
        "arg2": {"type": "integer", "description": "…"},
    },
    "required": ["arg1"],
}

my_tool_tool = types.Tool(
    name="my_tool",
    description="Short verb-phrase, then detailed usage hints for the LLM.",
    inputSchema=my_tool_input_schema,
)

async def my_tool(arguments: dict) -> list[types.TextContent]:
    arg1 = arguments.get("arg1", "").strip()
    # … do work …
    result = {"status": "ok", "details": "…"}
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
```

2. **Register** in `tools/__init__.py`:

```python
from tools.my_tool import my_tool_tool, my_tool

tools = {
    …
    my_tool_tool.name: {"tool": my_tool_tool, "handler": my_tool},
}
```

3. **Gate** in `graph_v3.build_graph.TOOL_SETS` — decide which specialists
   may call it. Omit it from `TOOL_SETS` entirely if it should only be
   called by the framework (like `set_output_directory`).

### Conventions

- **Input schema**: stick to `string`, `integer`, `number`, `boolean` — the
  `_json_schema_to_pydantic` converter in `client.py` only handles those.
- **Return format**: always `list[types.TextContent]` with a single JSON
  string. Multi-part content confuses the message flattener.
- **Error handling**: raise `ValueError` for bad input; the MCP framework
  wraps it into an `isError=True` response that `client.py` surfaces as
  `"Error: …"`.
- **Large outputs**: truncate server-side. Agents already pay for truncation
  downstream; pre-truncating saves bandwidth.

### Test

Restart the server (`python agentic/server.py`) — new tools print on startup
(`Tools registered: [...]`). Then call it from any specialist via
`execute_python` *only* if it's in the specialist's `TOOL_SETS`.

## 2. Adding a new skill

Goal: add a reusable analysis function that specialists call from
`execute_python` (e.g. a new SPC rule, a new forecasting model).

### Files to touch

1. **Create** `skills/my_module.py` (or add a function to an existing
   module):

```python
"""skills/my_module.py — Brief module description."""
import os
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def my_skill(df: pd.DataFrame, column: str, output_dir: str = "output") -> dict:
    """
    One-paragraph description. First paragraph goes into list_skills catalogue.

    Args:
        df: DataFrame with DatetimeIndex.
        column: target column to analyse.
        output_dir: destination for saved charts.

    Returns:
        {"figures": [path], "stats": {metric: value}, "summary": str}
    """
    if column not in df.columns:
        return {"figures": [], "stats": {}, "summary": f"{column} not in df."}

    # … analysis …
    fig, ax = plt.subplots()
    # … draw …
    path = os.path.join(output_dir, f"my_skill_{column}.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()

    return {
        "figures": [path],
        "stats":   {"my_metric": 1.23},
        "summary": f"my_skill on {column}: metric=1.23",
    }
```

2. **Register** in `skills/__init__.py`:

```python
from skills import my_module
__all__ = ["eda", "spc", …, "my_module"]
# The loop at the bottom of __init__.py auto-wraps it with STRUCTURED_OUTPUT.
```

### Conventions

- Return `{figures, stats, summary}` — the wrapper only emits
  `STRUCTURED_OUTPUT:` for dicts containing a `stats` key.
- `plt.close()` after every `savefig` — the executor closes any leaks at
  end of run, but good hygiene keeps stderr warnings away.
- Keep `stats` JSON-serialisable (numpy scalars are fine thanks to
  `default=str` in the wrapper, but nested numpy arrays break it).
- First-paragraph docstring is the tool description in `list_skills`. A
  `Returns:` section is pulled verbatim; make it short and precise.

### Test

```python
# in python/agentic
import skills
skills.my_module.my_skill(df, "PSI80", output_dir="output/test")
```

Then run a full analysis — the skill should appear in the specialist prompt
hint if you add a reference, or at worst appear in `list_skills()` output.

## 3. Adding a new specialist

Goal: introduce a new LLM persona (e.g. `maintenance_advisor`,
`energy_auditor`).

### Files to touch — all in `graph_v3.py`

1. **Write the system prompt** alongside existing ones:

```python
MAINTENANCE_ADVISOR_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Maintenance Advisor. Correlate motor amps, power draw, and
vibration proxies to flag likely bearing/gear issues.

ACCESSING DATA:
- df = get_df('mill_data_8') or whichever mill was loaded

MANDATORY: Use the skills library. Call list_skills() to discover functions.

ANALYSIS TO PERFORM (use one execute_python call per group):
1. … your chain here …

RULES:
- ALWAYS print result['summary'] so the reporter can extract numbers.
- Save ALL charts to OUTPUT_DIR.

OUTPUT: Print maintenance flags with timestamps, severities, and recommended actions."""
```

2. **Add to the pool and prompt dict**:

```python
SPECIALIST_POOL = [
    "analyst", "forecaster", "anomaly_detective",
    "bayesian_analyst", "optimizer", "shift_reporter",
    "maintenance_advisor",                               # ← new
]

# inside build_graph:
TOOL_SETS["maintenance_advisor"] = ANALYSIS_TOOLS

ALL_PROMPTS = {
    …,
    "maintenance_advisor": MAINTENANCE_ADVISOR_PROMPT,
}
```

3. **Labels + descriptions** for UX:

```python
_STAGE_LABELS["maintenance_advisor"]       = "Поддръжка"
_STAGE_DESCRIPTIONS["maintenance_advisor"] = "Анализ за прогнозна поддръжка..."
```

4. **Teach the planner** — add a paragraph in `PLANNER_PROMPT`:

```
7. **maintenance_advisor** — Correlate motor amps, power, and vibration proxies.
   USE when the user asks about equipment health, bearings, gearboxes,
   predictive maintenance, or "is Mill X degrading?".
```

And update the shortcut rules near the end.

### Test

- Ask a question that hits the new specialist ("Има ли признаци на износване
  в мелница 7?").
- Watch the planner output: `SPECIALISTS: analyst, maintenance_advisor`.
- Check the stage appears in the pipeline log and in the UI progress panel.

## 4. Adding a new template

Goal: curate a fixed pipeline users can pick from the UI gallery.

### Files to touch

`analysis_templates.py`:

```python
TEMPLATES = {
    …,
    "maintenance_report": {
        "label":       "Поддръжка и износване",
        "label_en":    "Maintenance Report",
        "description": "Анализ на износване на двигатели + ефективност по смени",
        "specialists": ["analyst", "maintenance_advisor", "shift_reporter"],
    },
}
```

Constraints:

- Each `specialist` must exist in `SPECIALIST_POOL` — otherwise the entry is
  silently dropped by the planner.
- Don't include `data_loader`, `planner`, `code_reviewer`, or `reporter` —
  they are appended automatically.

### Test

- Restart the FastAPI process.
- `GET /api/v1/agentic/templates` should list the new entry.
- The UI template gallery (data-driven) picks it up automatically.

## Common mistakes to avoid

| Mistake | Consequence |
|---------|-------------|
| Registering a tool without adding it to `TOOL_SETS` | Tool is live on the MCP server but no specialist can call it. |
| Adding a specialist without updating `_STAGE_LABELS` | Progress UI shows the raw snake_case name. |
| Template specialist name doesn't match `SPECIALIST_POOL` | Template silently falls back to LLM planning. |
| Skill returns a non-`dict` result | STRUCTURED_OUTPUT is skipped; downstream specialists lose structured context. |
| Skill uses interactive `plt.show()` | Works locally but hangs in the server (no display). Use `plt.savefig` + `plt.close`. |
| Tool handler returns multiple `TextContent` items | `client.py` only reads `result.content[0].text`; extras are dropped. |
| MCP tool input schema uses `array` or `object` types | `_json_schema_to_pydantic` defaults them to `str`; the LLM will pass JSON strings. Either stick to scalars or extend the converter. |
| Hard-coding a path instead of reading `get_output_dir()` | Files land in the wrong per-analysis folder. |

## Regression testing checklist

After any extension:

1. Start the MCP server. Confirm the tool registry in its startup log.
2. `curl http://localhost:8000/api/v1/agentic/templates` — should not 500.
3. Run one analysis with the new feature exercised; watch the server log for
   tracebacks.
4. Run one **unrelated** analysis (`forecast` template) to check you didn't
   break the happy path.
5. Run a follow-up on the new analysis to check history serialisation still
   works.
6. Delete the analysis via `DELETE /analysis/{id}` and confirm the folder is
   removed.
