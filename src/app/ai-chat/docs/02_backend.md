# 02 — Backend Architecture

This document covers the two backend servers that power the agentic system: the **FastAPI REST API** and the **MCP Tool Server**.

---

## Two Servers, Two Roles

The backend runs as two separate processes:

| Server          | Port | Role                                                                   | File                                               |
| --------------- | ---- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| **FastAPI API** | 8000 | REST endpoints for the UI (submit analysis, check status, serve files) | `python/api.py` + `python/agentic/api_endpoint.py` |
| **MCP Server**  | 8003 | Tool server for the AI agents (query data, run Python, write reports)  | `python/agentic/server.py`                         |

```
Browser ──HTTP──► FastAPI (:8000) ──MCP──► MCP Server (:8003) ──SQL──► PostgreSQL
```

The FastAPI server is what the browser talks to. When an analysis is requested, FastAPI connects to the MCP server internally (via the MCP client) to orchestrate the AI agents.

---

## FastAPI REST API

### File: `python/agentic/api_endpoint.py`

This file defines an `APIRouter` mounted at `/api/v1/agentic/` in the main FastAPI app. It exposes these endpoints:

### Endpoints

#### `POST /api/v1/agentic/analyze`

**Starts an analysis.** This is the main entry point.

1. Receives a JSON body with a `question` (and optional `mill_number`, `start_date`, `end_date`)
2. Generates a unique 8-character `analysis_id` (e.g. `51329fe7`)
3. Stores the analysis in an in-memory dictionary `_analyses`
4. Launches the analysis pipeline as a **background task** (`asyncio.create_task`)
5. Returns immediately with the `analysis_id` so the UI can start polling

```python
# Simplified flow:
analysis_id = str(uuid.uuid4())[:8]
_analyses[analysis_id] = {"status": "running", ...}
asyncio.create_task(_run_analysis_background(analysis_id, prompt))
return {"analysis_id": analysis_id, "status": "running"}
```

#### `GET /api/v1/agentic/status/{analysis_id}`

**Checks progress.** The frontend polls this every 4 seconds.

- Returns the current `status` ("running", "completed", or "failed")
- When completed: includes `final_answer`, `report_files` (`.md`), and `chart_files` (`.png`)
- Lists files by scanning the output directory `python/agentic/output/{analysis_id}/`

#### `GET /api/v1/agentic/reports/{analysis_id}/{filename}`

**Serves output files.** Returns the actual `.md` report or `.png` chart as a `FileResponse`.

The frontend uses this to:

- Fetch the Markdown report content for rendering
- Load chart images inside the report

#### `GET /api/v1/agentic/reports`

**Lists all reports** across all analyses (used for browsing past outputs).

#### `DELETE /api/v1/agentic/analysis/{analysis_id}`

**Cleanup.** Deletes the output folder and removes the analysis from memory. Called when the user deletes a conversation.

---

### Background Analysis Runner

#### Function: `_run_analysis_background(analysis_id, prompt)`

This is where the magic happens. It runs as an `asyncio` background task:

```
1. Load GOOGLE_API_KEY from environment
2. Connect to MCP Server at localhost:8003
3. Call set_output_directory tool → configure output/{analysis_id}/
4. Fetch all tools from MCP Server → wrap as LangChain tools
5. Build the multi-agent graph (graph_v2.build_graph)
6. Run the graph with the user's prompt
7. Extract the final answer from the last message
8. Update _analyses[id] with status="completed" + final_answer
```

If anything fails, it catches the exception and sets `status="failed"` with the error message.

---

## MCP Server

### File: `python/agentic/server.py`

The MCP (Model Context Protocol) server provides **tools** that AI agents can call. Think of it like a function-call API designed specifically for LLMs.

### How It Works

```
┌──────────────────────────────────────────┐
│  MCP Server (port 8003)                  │
│                                          │
│  Starlette App                           │
│    └── /mcp  (StreamableHTTPSession)     │
│          │                               │
│          ├── list_tools()  → 7 tools     │
│          └── call_tool(name, args)       │
│                │                         │
│                ▼                         │
│          Tool Registry (tools/__init__)  │
│            ├── db_tools.py              │
│            ├── python_executor.py       │
│            ├── report_tools.py          │
│            └── session_tools.py         │
└──────────────────────────────────────────┘
```

### Key Components

**`Server`** — The low-level MCP Server instance. Registers two handlers:

- `list_tools()` — Returns all 7 tool descriptors
- `call_tool(name, args)` — Dispatches to the correct tool handler

**`StreamableHTTPSessionManager`** — Wraps the server for HTTP transport. This is what makes the MCP server accessible via HTTP at `/mcp`.

**`Starlette App`** — Mounts the session manager and runs on uvicorn.

### Lifespan

```python
@asynccontextmanager
async def server_lifespan(server: Server):
    print("🏭 Agentic Data Analysis MCP Server starting...")
    print(f"   Tools registered: {list(tools.keys())}")
    yield {}
    print("🏭 Agentic Data Analysis MCP Server shutting down.")
```

The lifespan prints which tools are registered at startup — useful for debugging.

---

## MCP Client Bridge

### File: `python/agentic/client.py`

The MCP Client sits between LangGraph and the MCP Server. Its job: **convert MCP tools into LangChain tools** so the agents can use them.

### Key Functions

#### `get_mcp_tools(session) → list[BaseTool]`

Called once when an analysis starts. It:

1. Calls `session.list_tools()` to get all 7 tool descriptors from the MCP server
2. Wraps each one as a LangChain `StructuredTool` using `mcp_tool_to_langchain()`
3. Returns the list for use in the agent graph

#### `mcp_tool_to_langchain(tool, session) → BaseTool`

Wraps a single MCP tool:

1. Converts the JSON Schema `inputSchema` to a Pydantic model (for LangChain compatibility)
2. Creates an async closure that calls `session.call_tool()` on the live MCP connection
3. Returns a `StructuredTool` with the name, description, and args schema

#### `_json_schema_to_pydantic(schema, model_name) → Type[BaseModel]`

A helper that converts JSON Schema properties into a dynamically-created Pydantic model. This is needed because LangChain requires `args_schema` to be a Pydantic class.

---

## How the Two Servers Interact

```
User clicks "Analyze" in the browser
        │
        ▼
  FastAPI receives POST /analyze
        │
        ▼
  _run_analysis_background() starts
        │
        ▼
  Connects to MCP Server (:8003) via streamable HTTP
        │
        ▼
  Fetches tools → wraps as LangChain tools
        │
        ▼
  Builds and runs the LangGraph multi-agent pipeline
  (agents call tools → tools execute on MCP server)
        │
        ▼
  Pipeline completes → final_answer stored
        │
        ▼
  Frontend polls GET /status → gets "completed"
        │
        ▼
  Frontend fetches report via GET /reports/{id}/{file}
```

---

## In-Memory State

The FastAPI server keeps analysis state in a simple Python dictionary:

```python
_analyses: dict[str, dict] = {}

# Example entry:
_analyses["51329fe7"] = {
    "status": "completed",          # running | completed | failed
    "question": "Compare mills...", # original prompt
    "started_at": "2025-03-19T10:00:00",
    "completed_at": "2025-03-19T10:02:30",
    "final_answer": "The analysis shows...",
    "error": None,
}
```

> ⚠️ **Note:** This is in-memory only. If the FastAPI server restarts, running analyses are lost. The output files on disk are preserved, but the status tracking is gone.

---

## File Serving

Output files are stored at:

```
python/agentic/output/{analysis_id}/
    ├── Mill_Analysis_Report.md
    ├── ore_comparison_chart.png
    ├── downtime_analysis.png
    └── ...
```

The `GET /reports/{analysis_id}/{filename}` endpoint serves these as `FileResponse`, which the frontend uses to:

- Fetch `.md` content as text for rendering in the chat
- Display `.png` charts embedded in the Markdown via `![](image.png)` syntax

---

## Next

→ **[03 — Multi-Agent Graph](./03_multi_agent_graph.md)** — How the four agents work together
