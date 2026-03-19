# AI Chat System - Overview

## Table of Contents

- [Introduction](#introduction)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Key Components](#key-components)
- [Communication Protocol](#communication-protocol)
- [Technology Stack](#technology-stack)

## Introduction

The AI Chat system is a sophisticated multi-agent data analysis platform designed for analyzing ore dressing plant data. It enables users to ask natural language questions about mill performance, process data, and operational metrics, and receive comprehensive analyses with visualizations and reports.

**Key Features:**

- Natural language interface for data analysis
- Multi-agent AI system with specialized roles
- Real-time polling for long-running analyses
- Automatic chart generation and markdown reports
- Per-analysis output isolation
- Conversation history management

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                         /ai-chat/page.tsx                                   │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    chat-store.ts (Zustand)                            │ │ │
│  │  │  - Conversation management                                             │ │ │
│  │  │  - Message handling                                                   │ │ │
│  │  │  - Polling logic (4s intervals)                                        │ │ │
│  │  │  - localStorage persistence                                            │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                   Next.js API Routes (Proxies)                            │ │
│  │  - POST   /api/agentic/analyze                                            │ │
│  │  - GET    /api/agentic/status/{id}                                         │ │
│  │  - GET    /api/agentic/reports/{analysis_id}/{filename}                   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (FastAPI)                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    api_endpoint.py                                          │ │
│  │  - POST /api/v1/agentic/analyze  → Start background analysis               │ │
│  │  - GET  /api/v1/agentic/status/{id} → Check analysis status                │ │
│  │  - GET  /api/v1/agentic/reports/{id}/{filename} → Serve files              │ │
│  │  - DELETE /api/v1/agentic/analysis/{id} → Cleanup output folder            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    LangGraph Multi-Agent System                            │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     graph_v2.py                                        │ │ │
│  │  │  Deterministic stage order:                                            │ │ │
│  │  │  data_loader → analyst → code_reviewer → reporter                      │ │ │
│  │  │  Manager QA review after each stage                                    │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  │                                      │                                      │ │
│  │                                      ▼                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     client.py                                          │ │ │
│  │  │  MCP → LangChain tool bridge                                          │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  │                                      │                                      │ │
│  │                                      ▼                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     MCP Server (:8003)                                 │ │ │
│  │  │  server.py + tools/                                                    │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL Database                                      │ │
│  │  - mills.MILL_XX (01-12): Minute-level sensor data                         │ │
│  │  - mills.ore_quality: Lab quality data                                    │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    File System                                              │ │
│  │  - output/{analysis_id}/: Per-analysis output folders                     │ │
│  │  - Charts (.png) and reports (.md)                                         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### User Request Flow

```
1. User types question
   ↓
2. Frontend: sendAnalysis() creates conversation
   ↓
3. POST /api/v1/agentic/analyze
   ↓
4. Backend: Generate analysis_id, start background task
   ↓
5. Frontend: Start polling every 4 seconds
   ↓
6. Backend: LangGraph executes multi-agent pipeline
   ├─ Data Loader: Query database, load DataFrames
   ├─ Analyst: Execute Python, generate charts
   ├─ Code Reviewer: Validate outputs
   └─ Reporter: Write markdown report
   ↓
7. Frontend: Poll detects "completed" status
   ↓
8. Frontend: Fetch report markdown and display
   ↓
9. User views analysis with embedded charts
```

### Agent Pipeline Flow (LangGraph)

```
START
  ↓
[data_loader_entry] → Set current_stage = "data_loader"
  ↓
[data_loader] → Query database, load data
  ├─ Has tool_calls? → [tools] → Execute query_mill_data
  └─ No tools → [manager_review]
  ↓
[manager_review] → QA check
  ├─ ACCEPT → [analyst_entry]
  └─ REWORK → [data_loader] (max 1 rework)
  ↓
[analyst_entry] → Set current_stage = "analyst"
  ↓
[analyst] → Execute Python, generate charts
  ├─ Has tool_calls? → [tools] → Execute execute_python
  └─ No tools → [manager_review]
  ↓
[manager_review] → QA check
  ├─ ACCEPT → [code_reviewer_entry]
  └─ REWORK → [analyst] (max 1 rework)
  ↓
[code_reviewer_entry] → Set current_stage = "code_reviewer"
  ↓
[code_reviewer] → Validate charts and outputs
  ├─ Has tool_calls? → [tools] → Execute execute_python
  └─ No tools → [manager_review]
  ↓
[manager_review] → QA check
  ├─ ACCEPT → [reporter_entry]
  └─ REWORK → [code_reviewer] (max 1 rework)
  ↓
[reporter_entry] → Set current_stage = "reporter"
  ↓
[reporter] → Write markdown report
  ├─ Has tool_calls? → [tools] → Execute write_markdown_report
  └─ No tools → [manager_review]
  ↓
[manager_review] → QA check
  ├─ ACCEPT → END
  └─ REWORK → [reporter] (max 1 rework)
  ↓
END
```

## Key Components

### Frontend Components

#### 1. Main Page (`src/app/ai-chat/page.tsx`)

- **Purpose**: Main UI container for the AI Chat interface
- **Key Features**:
  - Chat message display with user/assistant bubbles
  - Input textarea with auto-resize
  - Suggestion cards for common queries
  - History sidebar with conversation list
  - Status badges (pending, running, completed, failed)
  - Markdown rendering with embedded charts
  - File download links for reports and charts

#### 2. Chat Store (`src/app/ai-chat/stores/chat-store.ts`)

- **Purpose**: State management using Zustand
- **Key Features**:
  - Conversation CRUD operations
  - Message management
  - Polling logic (4-second intervals)
  - localStorage persistence
  - Analysis lifecycle tracking
  - Per-analysis output folder management

### Backend Components

#### 1. API Endpoint (`python/agentic/api_endpoint.py`)

- **Purpose**: FastAPI REST API for UI integration
- **Endpoints**:
  - `POST /api/v1/agentic/analyze` - Submit analysis request
  - `GET /api/v1/agentic/status/{id}` - Check analysis status
  - `GET /api/v1/agentic/reports/{id}/{filename}` - Download files
  - `DELETE /api/v1/agentic/analysis/{id}` - Cleanup output folder
- **Key Features**:
  - Background task execution with asyncio
  - In-memory analysis tracking
  - Per-analysis output subfolders

#### 2. LangGraph System (`python/agentic/graph_v2.py`)

- **Purpose**: Multi-agent orchestration with deterministic stages
- **Agents**:
  - **Data Loader**: Loads mill data from database
  - **Analyst**: Performs EDA, SPC, correlations, anomaly detection
  - **Code Reviewer**: Validates charts and outputs
  - **Reporter**: Writes comprehensive markdown reports
  - **Manager**: QA review after each stage (max 1 rework per stage)
- **Key Features**:
  - Focused context building per specialist
  - Message compression for token efficiency
  - Tool binding per specialist
  - Iteration caps (max 5 per specialist)

#### 3. MCP Server (`python/agentic/server.py`)

- **Purpose**: Model Context Protocol server for tool execution
- **Port**: 8003
- **Tools**:
  - `get_db_schema` - Database schema introspection
  - `query_mill_data` - Load mill sensor data
  - `query_combined_data` - Load mill + ore quality data
  - `execute_python` - Execute Python code with pandas/numpy/matplotlib
  - `list_output_files` - List generated files
  - `write_markdown_report` - Write markdown report
  - `set_output_directory` - Configure per-analysis output folder

#### 4. MCP Client Bridge (`python/agentic/client.py`)

- **Purpose**: Convert MCP tools to LangChain StructuredTools
- **Key Features**:
  - JSON Schema to Pydantic model conversion
  - Async tool invocation
  - Session management

### MCP Tools

#### Database Tools (`tools/db_tools.py`)

- **In-memory DataFrame store**: Shared across tools
- **get_db_schema**: Returns table/column metadata
- **query_mill_data**: Loads MILL_XX tables with date filtering
- **query_combined_data**: Joins mill data with ore quality

#### Python Executor (`tools/python_executor.py`)

- **Namespace injection**: df, get_df(), list_dfs(), pd, np, plt, sns, scipy_stats, OUTPUT_DIR
- **Chart tracking**: Detects newly created files
- **Error handling**: Captures traceback and stdout

#### Report Tools (`tools/report_tools.py`)

- **list_output_files**: Lists files in output directory
- **write_markdown_report**: Writes markdown with embedded chart references

#### Session Tools (`tools/session_tools.py`)

- **set_output_directory**: Configures per-analysis output subfolder

#### Output Directory (`tools/output_dir.py`)

- **Mutable state**: Module-level \_current_output_dir
- **Per-analysis isolation**: output/{analysis_id}/

## Communication Protocol

### Request-Response Pattern

**1. Submit Analysis**

```typescript
// Frontend
POST /api/v1/agentic/analyze
{
  "question": "Сравни средното натоварване по руда на всички мелници за последните 72 часа."
}

// Backend Response
{
  "analysis_id": "abc12345",
  "status": "running",
  "message": "Analysis started. Use GET /api/v1/agentic/status/{analysis_id} to check progress.",
  "started_at": "2025-03-18T14:30:00"
}
```

**2. Poll Status**

```typescript
// Frontend (every 4 seconds)
GET /api/v1/agentic/status/abc12345

// Backend Response (while running)
{
  "analysis_id": "abc12345",
  "status": "running",
  "question": "...",
  "final_answer": null,
  "report_files": [],
  "chart_files": [],
  "started_at": "2025-03-18T14:30:00",
  "completed_at": null,
  "error": null
}

// Backend Response (when completed)
{
  "analysis_id": "abc12345",
  "status": "completed",
  "question": "...",
  "final_answer": "Анализът е завършен успешно.",
  "report_files": ["mill_comparison_report.md"],
  "chart_files": ["ore_comparison.png", "ore_histogram.png"],
  "started_at": "2025-03-18T14:30:00",
  "completed_at": "2025-03-18T14:32:45",
  "error": null
}
```

**3. Fetch Report**

```typescript
// Frontend
GET /api/v1/agentic/report/abc12345/mill_comparison_report.md

// Backend Response (text/markdown)
# Сравнение на натоварване по руда

## Executive Summary
...

![Ore Comparison](ore_comparison.png)
```

**4. Fetch Chart**

```typescript
// Frontend (via markdown image reference)
GET /api/v1/agentic/report/abc12345/ore_comparison.png

// Backend Response (binary image)
Content-Type: image/png
[Binary data]
```

### Polling Strategy

- **Interval**: 4 seconds
- **Duration**: Until status is "completed" or "failed"
- **Timeout**: None (runs until completion)
- **Rationale**: Suitable for 2-5 minute agent runs, simpler than WebSocket/SSE

## Technology Stack

### Frontend

- **Framework**: Next.js (App Router)
- **UI Library**: React + Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Markdown**: react-markdown
- **TypeScript**: Full type safety

### Backend

- **API Framework**: FastAPI
- **Agent Orchestration**: LangGraph
- **LLM**: Google Gemini 3.1 Flash Lite
- **MCP Server**: Model Context Protocol
- **Database**: PostgreSQL
- **Data Analysis**: pandas, numpy, scipy, seaborn, matplotlib

### Integration

- **API Proxy**: Next.js API routes → FastAPI
- **Transport**: HTTP (no WebSocket/SSE)
- **File Storage**: Local filesystem with per-analysis subfolders
- **Persistence**: localStorage (frontend), in-memory (backend)

## Key Design Decisions

### 1. Polling vs WebSocket

**Decision**: Simple HTTP polling every 4 seconds
**Rationale**:

- Simpler implementation
- Suitable for 2-5 minute analysis duration
- No need for real-time updates
- Easier debugging and monitoring

### 2. Per-Analysis Output Isolation

**Decision**: Each analysis writes to `output/{analysis_id}/`
**Rationale**:

- Prevents file conflicts between concurrent analyses
- Enables cleanup when conversations are deleted
- Clear separation of concerns
- Supports file serving via analysis_id

### 3. Deterministic Agent Pipeline

**Decision**: Fixed stage order with manager QA review
**Rationale**:

- Predictable execution flow
- Quality assurance at each stage
- Limited rework (max 1 per stage) prevents infinite loops
- Focused context per specialist reduces token usage

### 4. MCP for Tool Communication

**Decision**: Use Model Context Protocol for tool execution
**Rationale**:

- Standardized tool interface
- Separates agent logic from tool implementation
- Easy to add new tools
- Async tool execution support

### 5. In-Memory Analysis Tracking

**Decision**: Store analysis state in Python dict
**Rationale**:

- Fast access for status checks
- No database dependency for tracking
- Simple implementation
- Sufficient for single-server deployment

## Next Steps

For detailed documentation on specific components, see:

- [Frontend Components](./ai-chat-frontend.md)
- [Backend Integration](./ai-chat-backend.md)
- [MCP Server & LangGraph](./ai-chat-mcp-langgraph.md)
- [API Routing](./ai-chat-api-routing.md)
