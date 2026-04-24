# 02 — Architecture

## Component view

```
                ┌─────────────────────────────────────────────┐
                │               Next.js frontend               │
                │   src/app/ai-chat/*  (Zustand chat-store)     │
                └───────────────┬─────────────────────────────┘
                                │ HTTP (JSON)
                ┌───────────────▼─────────────────────────────┐
                │       FastAPI agentic router                 │
                │       api_endpoint.py    /api/v1/agentic/*   │
                │   ─ starts background asyncio tasks          │
                │   ─ tracks _analyses[id] in-memory           │
                │   ─ serves reports/charts from output/{id}/  │
                └───────────────┬─────────────────────────────┘
                                │ build_graph / build_followup_graph
                ┌───────────────▼─────────────────────────────┐
                │        LangGraph pipeline (graph_v3.py)      │
                │                                              │
                │   data_loader → planner →                    │
                │     [analyst | forecaster | anomaly_detective│
                │      bayesian_analyst | optimizer |          │
                │      shift_reporter]* →                      │
                │   code_reviewer → reporter → END             │
                │                                              │
                │   manager_review is woven between every stage│
                └───────────────┬─────────────────────────────┘
                                │ LangChain StructuredTool
                ┌───────────────▼─────────────────────────────┐
                │       MCP client bridge (client.py)          │
                │    session.call_tool(name, args) over        │
                │    streamable HTTP to localhost:8003/mcp     │
                └───────────────┬─────────────────────────────┘
                                │ MCP JSON-RPC / streamable HTTP
                ┌───────────────▼─────────────────────────────┐
                │         MCP server (server.py)               │
                │  Starlette + StreamableHTTPSessionManager    │
                │  registers tools/{db,python,report,session,  │
                │  domain_knowledge,skill_registry}            │
                └───────────────┬─────────────────────────────┘
                                │ in-process calls
                ┌───────────────▼─────────────────────────────┐
                │  Tools layer (tools/*.py)                    │
                │   • db_tools → SQLAlchemy → Postgres         │
                │   • python_executor → exec() with pandas/    │
                │                      numpy/Prophet/sklearn   │
                │   • report_tools → write .md / list files    │
                │   • session_tools + output_dir → per-id dir  │
                │   • domain_knowledge → PLANT_VARIABLES       │
                │   • skill_registry → introspects skills/     │
                └─────────────────────────────────────────────┘
```

## Process boundaries

The agentic system runs as **two cooperating processes**:

1. **MCP tool server** (`server.py`, port **8003**) — owns the pandas DataFrame
   store, the database connection, and the output directory state. It is
   stateful across all tool calls for the whole session.
2. **LangGraph driver** — either `main.py` (CLI) or the FastAPI background task
   in `api_endpoint.py`. It opens an MCP client session and is stateless w.r.t.
   data — everything it "knows" lives in the LangGraph `MessagesState` or in
   the dataframes on the MCP server side.

Both processes share the same `python/agentic/output/` directory on disk. The
server writes charts and reports there; the API reads them back for the client.

## Data flow (happy path)

```
user question
     │
     ▼
FastAPI /analyze  ───▶ asyncio.create_task(_run_analysis_background)
                             │
                             ▼
                    streamable_http_client → MCP session.initialize()
                             │
                             ▼
                    session.call_tool("set_output_directory", {id})      ← per-analysis folder
                             │
                             ▼
                    langchain_tools = await get_mcp_tools(session)       ← ~9 tools
                             │
                             ▼
                    graph = build_graph(tools, api_key, on_progress, …)
                             │
                             ▼
                    graph.ainvoke({messages: [HumanMessage(prompt)]})
                             │
               ┌─────────────┼──────────────────────────────────────┐
               ▼             ▼                                      ▼
        data_loader     planner                  [selected specialists …]
        loads SQL       picks                    each calls execute_python /
        into _dfs       specialists              list_skills / list_output_files
                                                       │
                                                       ▼
                                                manager_review (heuristic + optional LLM)
                                                       │
                                                       ▼
                                                next stage …
                             │
                             ▼
                    code_reviewer → reporter → write_markdown_report
                             │
                             ▼
                    _analyses[id].status = "completed"
                    _analyses[id].conversation_history = serialized msgs
```

## Shared mutable state

| State | Location | Lifetime |
|-------|----------|----------|
| `_dataframes` dict | `tools/db_tools.py` | MCP server process (shared across all analyses using that server) |
| `_current_output_dir` | `tools/output_dir.py` | MCP server process; **mutated** at the start of each analysis via `set_output_directory` |
| `_analyses` dict | `api_endpoint.py` | FastAPI process; holds status, progress, conversation history |
| `output/{id}/*.png` + `*.md` | disk | persistent; cleaned up on `DELETE /analysis/{id}` |
| LangGraph checkpoint | `checkpoints.db` (optional SqliteSaver) | persistent if `checkpointer` is passed |

> ⚠️ Because `_dataframes` and `_current_output_dir` are **process-global on the
> MCP server**, running two analyses concurrently against the same MCP server
> will interfere with each other. The current deployment assumes serial use per
> MCP server.

## Why MCP at all?

The same tools could be called directly from LangGraph via plain Python imports.
MCP is used because:

- The tools become usable by **any** MCP-compatible client (Claude Desktop,
  other LangChain graphs, CLI inspectors like `mcp-cli`).
- The server can be restarted independently of the LangGraph driver.
- It matches the pattern in the sibling `python/mcp_example/` project so the
  team only needs to learn one idiom.

## Why LangGraph and not a single ReAct agent?

- **Domain specialisation**: six distinct system prompts keep each agent
  focused; a single prompt that lists everything would saturate the context
  window.
- **Deterministic routing**: the planner produces a fixed specialist sequence,
  so a comprehensive analysis is reproducible.
- **Quality control**: `manager_review` can inject rework loops per stage
  without touching other agents.
- **Context compression**: `build_focused_context` rewrites message history for
  each specialist, keeping only what that specialist needs.
