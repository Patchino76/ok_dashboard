# 02 — Architecture

## Component view

```mermaid
flowchart TB
    subgraph FE["🌐 Browser"]
        UI[Next.js /ai-chat<br/>Zustand chat-store<br/>polls every 4s]
    end

    subgraph PY["🐍 Python (FastAPI process)"]
        API[api_endpoint.py<br/>/api/v1/agentic/*<br/>tracks _analyses dict]
        LG[graph.py<br/>LangGraph StateGraph<br/>data_loader → planner →<br/>specialists* → code_reviewer<br/>→ reporter]
        CB[client.py<br/>MCP → LangChain<br/>StructuredTool bridge]
    end

    subgraph MCP_PROC["🐍 Python (MCP server process, port 8003)"]
        SRV[server.py<br/>Starlette + Streamable HTTP]
        TOOLS[tools/*<br/>db • python_executor<br/>report • session<br/>domain • skill_registry]
        DFS[(_dataframes dict<br/>in-memory)]
        OUT[/output/{id}//<br/>charts + report.md/]
    end

    subgraph DATA["🗄️ Data sources"]
        DB[(PostgreSQL<br/>em_pulse_data<br/>mills.MILL_01..12<br/>mills.ore_quality)]
    end

    UI -->|HTTP JSON| API
    API -->|build_graph<br/>ainvoke| LG
    LG -->|tool_calls<br/>(Gemini decides)| CB
    CB -->|MCP JSON-RPC<br/>streamable HTTP| SRV
    SRV --> TOOLS
    TOOLS --> DFS
    TOOLS --> OUT
    TOOLS -->|SQLAlchemy| DB
    OUT -.served by.-> API
    API -.GET /reports/{id}/file.-> UI

    style UI fill:#dbeafe,stroke:#1d4ed8
    style API fill:#fef3c7,stroke:#d97706
    style LG fill:#fce7f3,stroke:#be185d
    style SRV fill:#dcfce7,stroke:#16a34a
    style DB fill:#f3e8ff,stroke:#7e22ce
    style OUT fill:#fef2f2,stroke:#dc2626
```

**How to read it:**

- **Top half** = the FastAPI process the browser talks to. It owns the analysis
  state (in-memory `_analyses` dict) and runs the LangGraph pipeline.
- **Bottom half** = a separate Python process — the **MCP server** — that
  actually owns the data (loaded DataFrames) and writes files. It speaks
  JSON-RPC over a long-lived HTTP connection.
- **One arrow per concern**: HTTP for the UI, MCP for tool calls, SQL for
  reading the plant database.

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

```mermaid
flowchart TD
    Q[POST /analyze<br/>question + optional template_id]
    BG[asyncio.create_task<br/>_run_analysis_background]
    INIT["streamable_http_client<br/>→ session.initialize()"]
    SETOUT["session.call_tool<br/>set_output_directory(id)"]
    TOOLS[get_mcp_tools(session)<br/>→ ~9 LangChain tools]
    BUILD["build_graph(tools, api_key,<br/>on_progress, settings, template_id)"]
    INVOKE["graph.ainvoke<br/>messages=[HumanMessage(prompt)]"]

    DL[data_loader<br/>SQL → _dataframes]
    PL[planner<br/>picks 1–4 specialists]
    SP["specialist N<br/>(analyst | forecaster |<br/>anomaly_detective | …)"]
    EX[execute_python<br/>list_skills, list_output_files]
    MR{manager_review}
    NEXT[next specialist…]
    CR[code_reviewer]
    RP[reporter<br/>write_markdown_report]
    DONE[_analyses id status=completed<br/>conversation_history saved<br/>final_answer set]

    Q --> BG --> INIT --> SETOUT --> TOOLS --> BUILD --> INVOKE
    INVOKE --> DL --> PL --> SP
    SP --> EX --> SP
    SP --> MR
    MR -->|REWORK<br/>(once)| SP
    MR -->|ACCEPT &<br/>more left| NEXT --> SP
    MR -->|ACCEPT &<br/>last specialist| CR --> RP --> DONE

    style Q fill:#dbeafe,stroke:#1d4ed8
    style DL fill:#fef3c7,stroke:#d97706
    style PL fill:#fef3c7,stroke:#d97706
    style RP fill:#dcfce7,stroke:#16a34a
    style DONE fill:#dcfce7,stroke:#16a34a
    style MR fill:#fce7f3,stroke:#be185d
```

**Plain English:** the API spawns a background task. The task opens an MCP
session, scopes the output folder to the analysis ID, then asks LangGraph to
run the pipeline. Each specialist talks to the LLM, calls `execute_python`,
gets reviewed by the manager, and either retries once or hands off to the next
specialist. The reporter writes the final Markdown; the runner stores the
conversation so the user can ask follow-ups later.

## Shared mutable state

| State                        | Location                                | Lifetime                                                                                 |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `_dataframes` dict           | `tools/db_tools.py`                     | MCP server process (shared across all analyses using that server)                        |
| `_current_output_dir`        | `tools/output_dir.py`                   | MCP server process; **mutated** at the start of each analysis via `set_output_directory` |
| `_analyses` dict             | `api_endpoint.py`                       | FastAPI process; holds status, progress, conversation history                            |
| `output/{id}/*.png` + `*.md` | disk                                    | persistent; cleaned up on `DELETE /analysis/{id}`                                        |
| LangGraph checkpoint         | `checkpoints.db` (optional SqliteSaver) | persistent if `checkpointer` is passed                                                   |

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
