# Agentic Data Analysis System — Overview

## What Is This System?

This is a **multi-agent AI system** for analyzing industrial data from an ore-processing factory with 12 ball mills. A user asks a question in plain language (e.g., "Why did Mill 8 have high PSI80 last week?"), and a team of AI specialists — each with a different expertise — collaborates to load data, run analyses, generate charts, validate results, and write a final report in Bulgarian.

## The Four Layers

Each layer is handled by one of the four core files:

| Layer              | File              | Role                                                      |
| ------------------ | ----------------- | --------------------------------------------------------- |
| REST API           | `api_endpoint.py` | Receives user requests, manages lifecycle, serves results |
| MCP Bridge         | `client.py`       | Converts MCP tools to LangChain format                    |
| MCP Server         | `server.py`       | Hosts the actual tool implementations                     |
| Agent Orchestrator | `graph.py`        | Defines the multi-agent pipeline with LangGraph           |

## Architecture Diagram

```mermaid
graph TD
    User["👤 User (Web Browser)<br/>asks a question"]
    API["api_endpoint.py<br/>(FastAPI REST API)<br/>• Receives question<br/>• Starts background task<br/>• Returns analysis_id"]
    Client["client.py<br/>(MCP→LangChain Bridge)<br/>• Connects to MCP server<br/>• Fetches tool list<br/>• Wraps as StructuredTool"]
    Graph["graph.py<br/>(LangGraph Orchestrator)<br/>• Planner picks specialists<br/>• Specialists run analysis<br/>• Manager reviews<br/>• Critic validates<br/>• Reporter writes report"]
    Server["server.py<br/>(MCP Server :8003)<br/>• Holds tool implementations<br/>• query_mill_data<br/>• execute_python<br/>• write_markdown_report"]
    DB["db.py<br/>(SQLite Persistence)<br/>• Analysis metadata<br/>• Conversation history"]
    Tools["tools/*<br/>(11 Tool Modules)<br/>• db_tools, python_executor<br/>• report_tools, vision_tools<br/>• skill_registry, skill_runner<br/>• domain_knowledge, etc."]
    Frontend["Frontend<br/>(Next.js ai-chat)<br/>• Polls /status or SSE stream<br/>• Renders charts + report"]

    User -->|HTTP POST| API
    API -->|opens MCP session| Client
    Client -->|fetches tools| Server
    Client -->|passes LangChain tools| Graph
    Graph -->|calls tools via MCP| Server
    Server -->|dispatches to| Tools
    API -->|persists| DB
    API -->|SSE / polling| Frontend
    Frontend -->|displays results| User
```

## End-to-End Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant A as api_endpoint.py
    participant C as client.py
    participant S as server.py (MCP)
    participant G as graph.py (LangGraph)
    participant D as db.py (SQLite)

    U->>A: POST /analyze {"question": "Why is PSI80 high?"}
    A->>D: create_analysis(id, role, question)
    A-->>U: 200 {analysis_id, status: "running"}
    A->>A: asyncio.create_task(_run_analysis_background)

    Note over A,S: Background task starts
    A->>S: Open MCP session (port 8003)
    A->>S: call_tool("set_output_directory", {analysis_id})
    A->>C: get_mcp_tools(session)
    C->>S: session.list_tools()
    S-->>C: [11 tool descriptors]
    C-->>A: [11 LangChain StructuredTools]
    A->>G: build_graph(tools, api_key, ...)
    A->>G: graph.ainvoke({messages: [HumanMessage]})

    Note over G,S: LangGraph executes (2-5 minutes)
    G->>S: data_loader calls query_mill_data
    S-->>G: mill data
    G->>G: planner picks specialists
    G->>S: analyst calls execute_python
    S-->>G: stdout + structured output
    G->>G: manager_review → ACCEPT
    G->>S: anomaly_detective calls execute_python
    S-->>G: anomaly results
    G->>G: critic calls review_chart (vision)
    S-->>G: chart assessment
    G->>S: reporter calls write_markdown_report
    S-->>G: report saved to disk

    G-->>A: final_state (messages list)
    A->>D: update_status(completed), append_messages
    A-->>U: SSE "done" event with results
    U->>A: GET /reports/{id}/{filename}
    A-->>U: PNG chart / MD report
```

## File Connection Map

```mermaid
graph LR
    subgraph "Core Files"
        EP["api_endpoint.py"]
        CL["client.py"]
        SR["server.py"]
        GR["graph.py"]
        DB["db.py"]
    end

    subgraph "Supporting Files"
        PR["prompts.py"]
        AT["analysis_templates.py"]
    end

    subgraph "Tools (11 modules)"
        TI["tools/__init__.py"]
        T1["db_tools.py"]
        T2["python_executor.py"]
        T3["report_tools.py"]
        T4["vision_tools.py"]
        T5["skill_registry.py"]
        T6["skill_runner.py"]
        T7["domain_knowledge.py"]
        T8["session_tools.py"]
        T9["output_dir.py"]
    end

    subgraph "External"
        FE["Frontend (Next.js)"]
        API2["python/api.py"]
    end

    EP -->|imports| CL
    EP -->|imports| GR
    EP -->|uses| DB
    CL -->|connects to| SR
    SR -->|serves from| TI
    TI --> T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9
    GR -->|imports| PR
    GR -->|imports| AT
    GR -->|uses| DB
    EP -->|mounted into| API2
    EP -->|HTTP/SSE| FE
```

## Key Programming Techniques Summary

| Technique                    | File                        | Purpose                                                   |
| ---------------------------- | --------------------------- | --------------------------------------------------------- |
| Closures                     | `client.py`                 | Per-tool call functions that capture MCP session          |
| Dynamic Pydantic models      | `client.py`                 | Build typed schemas at runtime from JSON Schema           |
| Factory pattern              | `graph.py`                  | `make_specialist_node()` creates 6 customized nodes       |
| Async background tasks       | `api_endpoint.py`           | Run 2-5 min analysis without blocking HTTP                |
| Pub/Sub with asyncio.Queue   | `api_endpoint.py`           | SSE real-time progress to multiple clients                |
| Dual storage                 | `api_endpoint.py` + `db.py` | In-memory dict (speed) + SQLite (durability)              |
| FastAPI dependency injection | `api_endpoint.py`           | Role-based access control                                 |
| Adaptive pipeline            | `graph.py`                  | Critic can extend pipeline with new specialists           |
| Parallel fan-out with `Send` | `graph.py`                  | Specialists run concurrently                              |
| Defensive LLM parsing        | `graph.py`                  | Multiple fallback formats for LLM output                  |
| Heuristic short-circuit      | `graph.py`                  | Skip LLM review when output is clearly good               |
| Token budget management      | `graph.py`                  | `build_focused_context()` curates messages per specialist |
| Lifespan hooks               | `server.py`                 | Server startup/shutdown resource management               |

## Documents in This Series

- [00 — Overview](00_overview.md) (this file)
- [01 — server.py: MCP Tool Provider](01_server.md)
- [02 — client.py: MCP-to-LangChain Bridge](02_client.md)
- [03 — api_endpoint.py: REST API Layer](03_api_endpoint.md)
- [04 — graph.py: Multi-Agent Orchestrator](04_graph.md)
- [05 — db.py & tools/: Persistence and Tool Implementations](05_db_and_tools.md)
