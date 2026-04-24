# 14 — Request Lifecycle

End-to-end walkthrough of a single analysis, from the Next.js button click to
the final Markdown report. The example assumes the user picked the
`comprehensive` template for Mill 8, last 72 hours.

## Timeline (condensed)

```
t = 0      UI:      POST /analyze {question, mill_number=8, template_id="comprehensive"}
t = 0.01   API:     analysis_id = "ab12cd34"; _analyses[id] = {status:"running"}; asyncio.create_task(...)
t = 0.02   API:     returns {analysis_id, status:"running"} → UI starts polling
t = 0.10   bg:      MCP session.initialize()
t = 0.12   bg:      set_output_directory("ab12cd34")  → output/ab12cd34/
t = 0.25   bg:      get_mcp_tools(session) → 9 LangChain tools
t = 0.30   bg:      build_graph(template_id="comprehensive") → graph ready
t = 0.40   bg:      graph.ainvoke({messages:[HumanMessage(...)]})

 ── data_loader stage ──
t = 1.0    llm:     data_loader reads prompt, decides dates, calls query_mill_data(mill=8, start, end)
t = 1.8    mcp:     SELECT * FROM mills."MILL_08" WHERE TimeStamp BETWEEN … → DataFrame
t = 1.9    mcp:     _dataframes["mill_data_8"] = df ; returns compact summary
t = 2.5    llm:     data_loader writes one-paragraph summary → "Loaded 4320 rows, …"
t = 2.6    manager: auto-accept (infrastructure stage)

 ── planner stage ──
t = 2.7    planner: template override detected → skip Gemini; stages_to_run =
           [data_loader, planner, analyst, anomaly_detective, shift_reporter, code_reviewer, reporter]
t = 2.8    manager: auto-accept

 ── analyst stage ──
t = 3.2    llm:     analyst calls execute_python("result = skills.eda.descriptive_stats(df, [...])")
t = 3.5    mcp:     exec in namespace → stdout includes summary + STRUCTURED_OUTPUT:{...}
t = 3.6    llm:     analyst calls execute_python("skills.eda.distribution_plots(...)") → distribution_plots.png
t = …      llm:     correlation_heatmap.png, spc chart, process capability, time_series_overview.png
t = 30     llm:     analyst emits final text summary (no more tool calls)
t = 30.1   manager: heuristic pass (files produced, no errors) → ACCEPT

 ── anomaly_detective stage ──
t = 35-60  llm:     isolation_forest_analysis, regime_detection, optional SHAP root-cause code
t = 60.1   manager: heuristic pass → ACCEPT

 ── shift_reporter stage ──
t = 65-90  llm:     assign_shifts, shift_kpis, shift_comparison_chart, downtime_analysis, handover
t = 90.1   manager: heuristic pass → ACCEPT

 ── code_reviewer stage ──
t = 92     llm:     list_output_files → sees all charts; writes a validation summary
t = 92.1   manager: auto-accept (infrastructure stage)

 ── reporter stage ──
t = 94     llm:     list_output_files; composes full report using numbers from [structured data] context
t = 97     llm:     write_markdown_report("mill_8_analysis.md", "# Title\n…")
t = 97.1   mcp:     output/ab12cd34/mill_8_analysis.md written
t = 97.2   manager: auto-accept → END

 ── finalisation ──
t = 97.3   bg:      _analyses[id].status = "completed"
           bg:      _analyses[id].conversation_history = _serialize_messages(final_state["messages"])
           bg:      _analyses[id].final_answer = <last AI message text>
           progress callback: "✓ Анализът е завършен."

 ── UI observes completion ──
t = 97.x   UI:      GET /status/ab12cd34 → {status:"completed", report_files:["mill_8_analysis.md"], chart_files:[…]}
t = 97.y   UI:      GET /reports/ab12cd34/mill_8_analysis.md → inlined in chat
t = 97.z   UI:      GET /reports/ab12cd34/*.png for every embedded image
```

Real wall-clock varies heavily with Gemini latency: typical range **60–300 s**
for a comprehensive analysis.

## Sequence diagram (compact)

```
 UI            FastAPI           asyncio       LangGraph        MCP server        Postgres
  │               │                  │             │                │                │
  │ POST /analyze │                  │             │                │                │
  ├──────────────▶│                  │             │                │                │
  │               │ create_task()    │             │                │                │
  │               ├─────────────────▶│             │                │                │
  │ id, running   │                  │             │                │                │
  │◀──────────────┤                  │             │                │                │
  │               │                  │ MCP init    │                │                │
  │               │                  ├─────────────┼───────────────▶│                │
  │               │                  │ set_output_directory("id")   │                │
  │               │                  ├─────────────┼───────────────▶│                │
  │               │                  │ build_graph()              │                │
  │               │                  │             │                │                │
  │               │                  │ graph.ainvoke()              │                │
  │               │                  ├────────────▶│                │                │
  │               │                  │             │ data_loader.llm()              │
  │               │                  │             │ query_mill_data              │
  │               │                  │             ├───────────────▶│ SELECT …      │
  │               │                  │             │                ├───────────────▶│
  │               │                  │             │                │◀───────────────┤
  │               │                  │             │◀───────────────┤ summary JSON  │
  │               │                  │             │ analyst.llm()  │                │
  │               │                  │             │ execute_python │                │
  │               │                  │             ├───────────────▶│ exec in ns    │
  │               │                  │             │◀───────────────┤ stdout+new_files│
  │               │                  │             │ … more tool rounds            │
  │               │                  │             │ (anomaly, shift, code_review)  │
  │               │                  │             │ reporter.llm() │                │
  │               │                  │             │ write_markdown_report          │
  │               │                  │             ├───────────────▶│ write .md     │
  │               │                  │             │◀───────────────┤               │
  │               │                  │◀────────────┤ final_state     │                │
  │               │                  │ _analyses[id].status="completed"             │
  │               │                  │                                              │
  │ GET /status/id│                  │                                              │
  ├──────────────▶│ listdir + dict lookup                                           │
  │ result JSON   │                                                                 │
  │◀──────────────┤                                                                 │
  │ GET /reports/id/mill_8_analysis.md                                              │
  ├──────────────▶│ FileResponse                                                    │
  │◀──────────────┤                                                                 │
  │ GET /reports/id/chart.png (× N)                                                 │
  ├──────────────▶│                                                                 │
  │◀──────────────┤                                                                 │
```

## What each actor can see

| Actor | Can see | Cannot see |
|-------|---------|------------|
| UI | `status`, `progress[]`, `report_files`, `chart_files`, `final_answer`, served files | Raw DataFrames, raw stdout, intermediate tool messages |
| FastAPI `_analyses[id]` | Progress log, final answer, serialised messages, error | Live DataFrames (those live in the MCP server) |
| LangGraph state | Full message history (possibly compressed), stages_to_run | DataFrames by reference only (via the `execute_python` tool) |
| MCP server | DataFrames, output dir, tool registry | Nothing about LangGraph's plan — it just executes tool calls |
| Specialist LLM | Focused message window built by `build_focused_context` | Other specialists' raw output (only structured summaries) |

## Bidirectional truncation points

Along the whole path, content shrinks in stages:

1. **SQL → DataFrame**: no truncation; full rows land in memory.
2. **DataFrame → tool summary** (`query_mill_data`): only shape, columns,
   date range, and 5 key-column stats. The full table never goes to the LLM.
3. **stdout → ToolMessage**: capped at 8 000 chars by `execute_python`.
4. **ToolMessage → focused context**: 4 000 chars per tool output (or the
   `STRUCTURED_OUTPUT:` extract, whichever is present).
5. **Focused context → LLM**: last 20 messages, trimmed to 4 000 chars per
   AI message.
6. **LLM → `final_answer` string**: `_content_to_str` flattens Gemini's
   list-of-dicts format.

All six limits are tunable via `AnalysisSettings` per request.

## Failure modes

| Failure | Observable effect | Recovery |
|---------|-------------------|----------|
| MCP server down | `streamable_http_client` raises; `status="failed"` with `error: "[Errno] …"`. | Start `python agentic/server.py`. |
| `GOOGLE_API_KEY` missing | `ValueError("GOOGLE_API_KEY not configured")` from the runner. | Set key in `.env`, restart API. |
| Postgres unreachable | `query_mill_data` handler raises during `pd.read_sql_query`. | Check VPN / credentials. |
| LLM returns malformed plan | Planner falls back to `['analyst']` only. | None needed — pipeline still runs. |
| Specialist loops on broken tool | Iteration cap fires → `[{name}] Done (iteration cap).` | Manager accepts; reporter works with whatever exists. |
| Reporter can't find charts | It still calls `list_output_files` — if empty, it produces a text-only report. | Re-run analysis or fix upstream specialist. |
| LangGraph `recursion_limit=150` hit | Graph aborts, runner marks `status="failed"`. | Increase `maxSpecialistIterations` / simplify request. |
