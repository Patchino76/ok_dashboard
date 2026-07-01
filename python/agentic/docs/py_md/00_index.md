# Agentic Subproject — Documentation Index (Beginner Edition)

> **Who is this for?** Junior developers, operators, and anyone who wants to understand **how the AI analysis system works under the hood** without assuming prior knowledge of LangGraph, MCP, or FastAPI.

## What is this system, in plain English?

Imagine a junior data-scientist teammate who:

- Never sleeps
- Speaks Bulgarian and English
- Knows every mill, sensor, and shift schedule at the plant
- Can write Python data-analysis code on demand
- Returns a polished report with charts in 2–5 minutes

That teammate is not a human. It is a **team of AI agents** (specialists) that talk to each other, query the database, run Python code, and write a final report. This folder explains exactly how that team is built.

## The three big ideas you must understand

| Idea                             | Analogy                                                                                                                                                                           | File                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **MCP** (Model Context Protocol) | A USB port for AI tools. Any AI client can plug in and use the tools without knowing how they work inside.                                                                        | `03_mcp_deep_dive.md`                       |
| **LangGraph**                    | A factory assembly line. Each station (node) is an AI specialist. A conveyor belt (state) carries the work-in-progress between stations.                                          | `04_langgraph_deep_dive.md`                 |
| **FastAPI + React**              | A restaurant. The customer (React UI) places an order. The waiter (FastAPI) hands it to the kitchen (LangGraph). The customer checks every 4 seconds to see if the meal is ready. | `05_api_deep_dive.md`, `06_ui_deep_dive.md` |

## Reading order (designed for beginners)

| #   | Document                    | Why read it?                                                                   |
| --- | --------------------------- | ------------------------------------------------------------------------------ |
| 00  | `00_index.md`               | This file.                                                                     |
| 01  | `01_concepts_simple.md`     | **Start here.** What is an agent? What is a tool? What is state? No code.      |
| 02  | `02_architecture.md`        | The big picture: which process talks to which, and where data lives.           |
| 03  | `03_mcp_deep_dive.md`       | Deep but gentle walkthrough of `server.py`, `client.py`, and every tool.       |
| 04  | `04_langgraph_deep_dive.md` | Deep but gentle walkthrough of `graph.py`: nodes, edges, routing, specialists. |
| 05  | `05_api_deep_dive.md`       | Every FastAPI endpoint explained line-by-line. Background tasks, auth, SSE.    |
| 06  | `06_ui_deep_dive.md`        | The React side: `page.tsx`, `chat-store.ts`, polling, components.              |
| 07  | `07_request_lifecycle.md`   | Follow one request from button-click to final chart. Exact code references.    |
| 08  | `08_output_management.md`   | How charts and reports are saved, served, and cleaned up.                      |
| 09  | `09_configuration.md`       | Environment variables, context budgets, UI settings.                           |
| 10  | `10_extending.md`           | How to add a new tool, skill, specialist, or template.                         |

## File-to-doc map (source code → explanation)

| Source file                            | Explained in                | What it does                                                      |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `server.py`                            | `03_mcp_deep_dive.md`       | Runs the MCP tool server on port 8003.                            |
| `client.py`                            | `03_mcp_deep_dive.md`       | Bridges MCP tools into LangChain tools so LangGraph can use them. |
| `tools/__init__.py`                    | `03_mcp_deep_dive.md`       | The tool registry (name → handler).                               |
| `tools/python_executor.py`             | `03_mcp_deep_dive.md`       | The most important tool: runs AI-generated Python code.           |
| `tools/db_tools.py`                    | `03_mcp_deep_dive.md`       | Reads the PostgreSQL database into pandas DataFrames.             |
| `graph.py`                             | `04_langgraph_deep_dive.md` | Builds the multi-agent pipeline with dynamic routing.             |
| `api_endpoint.py`                      | `05_api_deep_dive.md`       | FastAPI router with `/analyze`, `/status`, `/followup`, etc.      |
| `src/app/ai-chat/page.tsx`             | `06_ui_deep_dive.md`        | The React page the user sees.                                     |
| `src/app/ai-chat/stores/chat-store.ts` | `06_ui_deep_dive.md`        | Zustand store: polling, messages, conversations.                  |

## One diagram to rule them all

```mermaid
flowchart LR
    subgraph Browser["🌐 Browser"]
        UI["Next.js /ai-chat<br/>React + Zustand"]
    end

    subgraph FastAPI_Process["🐍 Python FastAPI process"]
        API["api_endpoint.py<br/>port 8000"]
        LG["graph.py<br/>LangGraph team"]
        CB["client.py<br/>MCP bridge"]
    end

    subgraph MCP_Process["🐍 Python MCP process"]
        SRV["server.py<br/>port 8003"]
        TOOLS["tools/*.py<br/>DB queries, Python exec, reports"]
        DFS["_dataframes dict<br/>in-memory"]
    end

    subgraph DataSources["🗄️ Data"]
        DB[(PostgreSQL<br/>mill data)]
        OUT[/output/{id}/<br/>charts + .md/]
    end

    UI -->|HTTP POST /analyze| API
    UI -->|GET /status every 4s| API
    API -->|spawns background task| LG
    LG -->|tool calls| CB
    CB -->|JSON-RPC over HTTP| SRV
    SRV --> TOOLS
    TOOLS -->|SQLAlchemy| DB
    TOOLS --> DFS
    TOOLS --> OUT
    API -->|FileResponse| UI

    style UI fill:#dbeafe,stroke:#1d4ed8
    style API fill:#fef3c7,stroke:#d97706
    style LG fill:#fce7f3,stroke:#be185d
    style SRV fill:#dcfce7,stroke:#16a34a
```

## Quick start

```powershell
# 1. Install Python dependencies
pip install -r python/agentic/requirements.txt

# 2. Create a .env file in the repo root
# GOOGLE_API_KEY=your_key_here
# DB_HOST=your_db_host
# DB_NAME=em_pulse_data
# DB_USER=your_user
# DB_PASSWORD=your_password

# 3. Start the MCP server (in one terminal)
python python/agentic/server.py

# 4. Start the main API (in another terminal)
python python/api.py

# 5. Open the Next.js app in your browser and navigate to /ai-chat
```

> **Tip:** If you are new to the project, read `01_concepts_simple.md` first. If you prefer to learn by following a concrete request, jump to `07_request_lifecycle.md`.
