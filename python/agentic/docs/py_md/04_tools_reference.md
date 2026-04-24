# 04 — Tools Reference

All tools are registered in `tools/__init__.py` and exposed over MCP. Each tool
has a `types.Tool` descriptor (name + description + input JSON Schema) and an
async handler returning a list of `TextContent`.

## Registry at a glance

| Tool | File | Purpose |
|------|------|---------|
| `get_db_schema` | `db_tools.py` | Inspect tables/columns in the `mills` schema. |
| `query_mill_data` | `db_tools.py` | Load `mills.MILL_XX` time-series into memory. |
| `query_combined_data` | `db_tools.py` | Load mill + `ore_quality` joined on TimeStamp. |
| `execute_python` | `python_executor.py` | Run arbitrary Python against loaded DataFrames. |
| `list_output_files` | `report_tools.py` | List files in the current output folder. |
| `write_markdown_report` | `report_tools.py` | Save a `.md` report to the output folder. |
| `set_output_directory` | `session_tools.py` | Point the output folder at `output/{analysis_id}/`. |
| `get_domain_knowledge` | `domain_knowledge.py` | Return plant specs (vars, units, ranges). |
| `list_skills` | `skill_registry.py` | Introspect the `skills/` library. |

## Data-loading tools

### `get_db_schema`

```json
{ "schema_name": "mills"   // optional, default "mills"
}
```

Returns the list of tables and, for one `MILL_XX` table plus `ore_quality`,
their full column list. Other `MILL_XX` tables are reported as "same columns as
MILL_01" to stay compact. `MOTIFS_*` tables are reported as "N columns (MOTIFS
table, used for ML training)".

The tool's description explicitly tells the agent **not to call it twice** — one
shot is enough to plan the rest of the analysis.

### `query_mill_data`

```json
{
  "mill_number": 8,                    // required, 1..12
  "start_date":  "2025-03-01",         // optional ISO date
  "end_date":    "2025-03-31",         // optional
  "store_name":  "mill_data_8"         // optional, default = mill_data_{n}
}
```

Behaviour:

- Builds `SELECT * FROM mills."MILL_08" WHERE "TimeStamp" BETWEEN … ORDER BY "TimeStamp"`.
- Parses `TimeStamp`, sets it as the DataFrame index (critical for all time-
  series analyses downstream).
- Stores the result in the in-memory dict `_dataframes[store_name]`.
- Returns a compact summary: row count, column list, date range, and `mean/std`
  for `Ore`, `PSI80`, `PSI200`, `DensityHC`, `MotorAmp`.

The full table is **never** returned to the LLM — only the summary.

### `query_combined_data`

Same interface as `query_mill_data` but also loads `mills.ore_quality` and
left-joins it on TimeStamp. Only numeric ore-quality columns (`Shisti`, `Daiki`,
`Grano`, `Class_12`, `Class_15`) are merged, and duplicate ore-quality
timestamps are deduplicated (`keep="first"`).

Use when the question mentions ore hardness, shisti/daiki/grano content, or
anything else lab-related.

## Python execution

### `execute_python`

```json
{ "code": "<python source string>" }
```

The handler:

1. Reads the current output dir from `tools/output_dir.get_output_dir()`.
2. Snapshots the set of files already in that dir.
3. Builds an execution namespace (see **06 — Skills Library** for the full
   list) that pre-injects pandas, numpy, Prophet, statsmodels, sklearn, SHAP,
   hmmlearn, the skills package, `PLANT_SPECS`, `SHIFTS`, `MILL_NAMES`,
   `get_spec_limits`, and the DataFrame store.
4. Captures stdout via `io.StringIO`, runs `exec(code, namespace)`, closes any
   leaked matplotlib figures.
5. Diffs the directory to compute `new_files`, returns:
   ```json
   {"stdout": "...", "new_files": ["chart.png"], "loaded_dataframes": {...},
    "error": "Traceback… (only on failure)"}
   ```

Output limits: `stdout` is truncated to **8 000** chars and `error` to **4 000**
chars by the tool. Additional compression is applied by `graph_v3.compress_messages`
once the result enters the message history.

### Security model

This tool runs with full Python builtins against the MCP server's process. It
is explicitly not sandboxed. The deployment assumption is that only trusted
internal users can reach port 8003.

## Output / reporting tools

### `set_output_directory`

```json
{ "analysis_id": "ab12cd34" }   // required
```

Mutates `tools/output_dir._current_output_dir` to
`output/{analysis_id}/` and creates the folder. Must be the very first tool
call of every analysis — `api_endpoint._run_analysis_background` does this
before building the graph.

### `list_output_files`

```json
{ "extension_filter": "png" }   // optional, e.g. "png" or "md"
```

Returns `{"count": N, "files": [{"name": "chart.png", "size_kb": 42.1}, …]}`.
Always scoped to the current output folder.

### `write_markdown_report`

```json
{
  "filename": "mill_8_analysis.md",  // .md is auto-appended if missing
  "content":  "# Title\n\n…"
}
```

Writes the file into the current output dir and returns status + size + line
count. Chart references in `content` must use bare filenames
(`![caption](chart.png)`) because the file sits in the same folder as the
charts; the API rewrites the URLs when serving the report.

## Reference tools

### `get_domain_knowledge`

```json
{ "variable": "PSI80" }   // optional
```

- With a `variable`: returns that variable's full spec dict (min/max/unit/notes/
  spec_low/spec_high/target, etc.).
- Without: returns the plain-text summary from `get_plant_summary()` — a
  compact line per variable, shift schedule and mill list.

See **05 — Domain Knowledge** for the full variable catalogue.

### `list_skills`

```json
{ "module": "spc" }   // optional: eda|spc|anomaly|forecasting|shift_kpi|optimization
```

Introspects the `skills/` package at tool-import time (cached) and returns a
human-readable catalogue like:

```
── skills.spc ──
  skills.spc.xbar_chart(df, column, spec_limits, window, n_sigma, output_dir)
    Generate an X-bar control chart with control limits and optional spec limits.
    → {"figures": [path], "stats": {…}, "summary": str}
```

This powers the "don't guess — list first" pattern in the specialist prompts:
each specialist is told to call `list_skills()` (or `list_skills('spc')`) before
writing code if unsure which skill to use.

## Tool-set gating per specialist

Not every specialist sees every tool. `graph_v3.build_graph` binds specialist-
specific tool subsets to the LLM so it cannot even attempt an out-of-role
action:

| Specialist | Tools available |
|------------|-----------------|
| `data_loader` | `get_db_schema`, `query_mill_data`, `query_combined_data` |
| `analyst`, `forecaster`, `anomaly_detective`, `bayesian_analyst`, `optimizer`, `shift_reporter`, `code_reviewer` | `execute_python`, `list_output_files`, `list_skills` |
| `reporter` | `list_output_files`, `write_markdown_report` |

`set_output_directory` and `get_domain_knowledge` are called by the **framework**
(via `session.call_tool`), not by the LLM, so they are never bound to any
specialist.
