# AI Chat System - Backend Integration

## Table of Contents

- [Introduction](#introduction)
- [Architecture Overview](#architecture-overview)
- [FastAPI Endpoints](#fastapi-endpoints)
- [Next.js API Routes](#nextjs-api-routes)
- [Analysis Lifecycle](#analysis-lifecycle)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Integration Points](#integration-points)

## Introduction

The backend integration consists of two layers:

1. **Next.js API Routes** - Proxy routes that forward requests to FastAPI
2. **FastAPI Endpoints** - Core API that manages analysis lifecycle and LangGraph execution

This architecture provides:

- Clean separation between frontend and backend
- Easy testing and debugging
- Ability to swap backend implementations
- Proper error handling and status tracking

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    chat-store.ts                                            │ │
│  │  - sendAnalysis() → POST /api/agentic/analyze                             │ │
│  │  - pollStatus() → GET /api/agentic/status/{id}                             │ │
│  │  - File downloads → GET /api/agentic/reports/{id}/{filename}              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTES (Proxies)                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  src/app/api/agentic/analyze/route.ts                                      │ │
│  │  └─ POST /api/agentic/analyze → FastAPI                                   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  src/app/api/agentic/status/[id]/route.ts                                  │ │
│  │  └─ GET /api/agentic/status/{id} → FastAPI                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  src/app/api/agentic/reports/[filename]/route.ts                           │ │
│  │  └─ GET /api/agentic/reports/{analysis_id}/{filename} → FastAPI            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FASTAPI BACKEND                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  python/agentic/api_endpoint.py                                            │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  POST /api/v1/agentic/analyze                                          │ │ │
│  │  │  - Generate analysis_id (UUID)                                         │ │ │
│  │  │  - Store in _analyses dict                                             │ │ │
│  │  │  - Start background task with asyncio.create_task()                     │ │ │
│  │  │  - Return analysis_id immediately                                     │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  GET /api/v1/agentic/status/{id}                                      │ │ │
│  │  │  - Check _analyses dict for status                                   │ │ │
│  │  │  - List files from output/{analysis_id}/                             │ │ │
│  │  │  - Return current status, files, error                               │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  GET /api/v1/agentic/reports/{id}/{filename}                         │ │ │
│  │  │  - Serve file from output/{id}/{filename}                           │ │ │
│  │  │  - Fallback to output/{filename} for backward compat                 │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  DELETE /api/v1/agentic/analysis/{id}                               │ │ │
│  │  │  - Remove output/{id}/ folder via shutil.rmtree()                    │ │ │
│  │  │  - Remove from _analyses dict                                        │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                          │
│                                      ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Background Task: _run_analysis_background()                              │ │
│  │  - Connect to MCP server (port 8003)                                      │ │
│  │  - Call set_output_directory tool                                         │ │
│  │  - Build LangGraph with MCP tools                                        │ │
│  │  - Execute graph.ainvoke()                                               │ │
│  │  - Update _analyses dict with results                                    │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## FastAPI Endpoints

### File: `python/agentic/api_endpoint.py`

#### Configuration

```python
from dotenv import load_dotenv

# Load .env from the agentic directory
_env_path = Path(__file__).parent / ".env"
load_dotenv(_env_path)

router = APIRouter(prefix="/api/v1/agentic", tags=["agentic"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
SERVER_URL = "http://localhost:8003/mcp"

# In-flight analysis tracking
_analyses: dict[str, dict] = {}
```

**Purpose**: Configuration for API router, output directory, and MCP server URL.

### Data Models

```python
class AnalysisRequest(BaseModel):
    question: str = Field(..., description="Analysis question or request for the agents")
    mill_number: Optional[int] = Field(None, description="Specific mill number (1-12) if relevant")
    start_date: Optional[str] = Field(None, description="Start date ISO format")
    end_date: Optional[str] = Field(None, description="End date ISO format")


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    message: str
    started_at: str


class AnalysisResult(BaseModel):
    analysis_id: str
    status: str
    question: str
    final_answer: Optional[str] = None
    report_files: list[str] = []
    chart_files: list[str] = []
    started_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
```

**Purpose**: Pydantic models for request/response validation.

### Endpoint 1: Start Analysis

```python
@router.post("/analyze", response_model=AnalysisResponse)
async def start_analysis(request: AnalysisRequest):
    """Submit an analysis request. Returns an analysis_id to track progress."""
    analysis_id = str(uuid.uuid4())[:8]

    # Build the full prompt from the request
    prompt_parts = [request.question]
    if request.mill_number:
        prompt_parts.append(f"Focus on Mill {request.mill_number}.")
    if request.start_date:
        prompt_parts.append(f"Start date: {request.start_date}.")
    if request.end_date:
        prompt_parts.append(f"End date: {request.end_date}.")

    full_prompt = " ".join(prompt_parts)

    _analyses[analysis_id] = {
        "status": "running",
        "question": full_prompt,
        "started_at": datetime.now().isoformat(),
        "final_answer": None,
        "error": None,
        "completed_at": None,
    }

    # Run analysis in background
    asyncio.create_task(_run_analysis_background(analysis_id, full_prompt))

    return AnalysisResponse(
        analysis_id=analysis_id,
        status="running",
        message="Analysis started. Use GET /api/v1/agentic/status/{analysis_id} to check progress.",
        started_at=_analyses[analysis_id]["started_at"],
    )
```

**Purpose**: Submit analysis request and start background task.

**Key Features:**

- Generates short UUID (8 chars) for analysis_id
- Builds full prompt from question + optional parameters
- Stores analysis state in \_analyses dict
- Uses asyncio.create_task() for non-blocking execution
- Returns immediately with analysis_id

### Endpoint 2: Get Status

```python
@router.get("/status/{analysis_id}", response_model=AnalysisResult)
async def get_analysis_status(analysis_id: str):
    """Check the status of a running or completed analysis."""
    if analysis_id not in _analyses:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")

    entry = _analyses[analysis_id]

    # List files from this analysis's subfolder: output/{analysis_id}/
    analysis_dir = os.path.join(OUTPUT_DIR, analysis_id)
    report_files = []
    chart_files = []
    if os.path.exists(analysis_dir):
        for f in sorted(os.listdir(analysis_dir)):
            if not os.path.isfile(os.path.join(analysis_dir, f)):
                continue
            if f.endswith(".md"):
                report_files.append(f)
            elif f.endswith(".png"):
                chart_files.append(f)

    return AnalysisResult(
        analysis_id=analysis_id,
        status=entry["status"],
        question=entry["question"],
        final_answer=entry.get("final_answer"),
        report_files=report_files,
        chart_files=chart_files,
        started_at=entry["started_at"],
        completed_at=entry.get("completed_at"),
        error=entry.get("error"),
    )
```

**Purpose**: Check analysis status and list generated files.

**Key Features:**

- Returns current status (running/completed/failed)
- Lists files from per-analysis output folder
- Separates report files (.md) from chart files (.png)
- Returns timestamps and error information

### Endpoint 3: List All Reports

```python
@router.get("/reports")
async def list_reports():
    """List all generated reports and charts across all analyses."""
    if not os.path.exists(OUTPUT_DIR):
        return {"files": [], "count": 0}

    files = []
    for subdir in sorted(os.listdir(OUTPUT_DIR)):
        sub_path = os.path.join(OUTPUT_DIR, subdir)
        if not os.path.isdir(sub_path):
            continue
        for f in sorted(os.listdir(sub_path)):
            full_path = os.path.join(sub_path, f)
            if os.path.isfile(full_path) and not f.startswith("."):
                files.append({
                    "name": f,
                    "analysis_id": subdir,
                    "size_kb": round(os.path.getsize(full_path) / 1024, 1),
                    "type": "report" if f.endswith(".md") else "chart" if f.endswith(".png") else "other",
                })

    return {"count": len(files), "files": files}
```

**Purpose**: List all files across all analyses.

**Key Features:**

- Iterates through all subdirectories in output/
- Returns file metadata (name, analysis_id, size, type)
- Useful for admin/debugging views

### Endpoint 4: Download File

```python
@router.get("/reports/{analysis_id}/{filename}")
async def get_report_file(analysis_id: str, filename: str):
    """Download a specific report or chart file from an analysis subfolder."""
    file_path = os.path.join(OUTPUT_DIR, analysis_id, filename)
    if not os.path.exists(file_path):
        # Fallback: try flat output dir for backward compat with old files
        fallback = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(fallback):
            return FileResponse(fallback)
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    return FileResponse(file_path)
```

**Purpose**: Serve files from per-analysis output folders.

**Key Features:**

- Looks in output/{analysis_id}/{filename} first
- Falls back to output/{filename} for backward compatibility
- Uses FastAPI FileResponse for efficient file serving

### Endpoint 5: Delete Analysis

```python
@router.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str):
    """Delete an analysis and its output files."""
    # Remove output subfolder
    analysis_dir = os.path.join(OUTPUT_DIR, analysis_id)
    if os.path.exists(analysis_dir):
        shutil.rmtree(analysis_dir)

    # Remove from in-memory tracking
    _analyses.pop(analysis_id, None)

    return {"status": "deleted", "analysis_id": analysis_id}
```

**Purpose**: Cleanup analysis output and memory.

**Key Features:**

- Removes entire output subfolder via shutil.rmtree()
- Removes from \_analyses dict
- Called by frontend when conversation is deleted

### Background Task

```python
async def _run_analysis_background(analysis_id: str, prompt: str) -> None:
    """Run the multi-agent analysis pipeline in the background."""
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not configured")

        async with streamable_http_client(SERVER_URL) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # Configure per-analysis output subfolder on the MCP server
                await session.call_tool(
                    "set_output_directory",
                    {"analysis_id": analysis_id},
                )

                langchain_tools = await get_mcp_tools(session)
                graph = build_graph(langchain_tools, api_key)

                final_state = await graph.ainvoke(
                    {"messages": [HumanMessage(content=prompt)]},
                    config={
                        "configurable": {"thread_id": analysis_id},
                        "recursion_limit": 50,
                    },
                )

                final_answer = final_state["messages"][-1].content
                _analyses[analysis_id]["status"] = "completed"
                _analyses[analysis_id]["final_answer"] = final_answer
                _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()

    except Exception as e:
        _analyses[analysis_id]["status"] = "failed"
        _analyses[analysis_id]["error"] = str(e)
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
```

**Purpose**: Execute LangGraph multi-agent pipeline in background.

**Key Features:**

- Connects to MCP server on port 8003
- Configures per-analysis output directory
- Builds LangGraph with MCP tools
- Executes graph with thread_id for state persistence
- Updates \_analyses dict with results or errors

## Next.js API Routes

### Route 1: Analyze Proxy

**File: `src/app/api/agentic/analyze/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/v1/agentic/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic analyze proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
```

**Purpose**: Proxy POST requests to FastAPI analyze endpoint.

**Key Features:**

- Forwards request body to FastAPI
- Returns FastAPI response with same status
- Handles errors gracefully

### Route 2: Status Proxy

**File: `src/app/api/agentic/status/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(`${API_URL}/api/v1/agentic/status/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic status proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
```

**Purpose**: Proxy GET requests to FastAPI status endpoint.

**Key Features:**

- Extracts analysis_id from URL params
- Uses cache: "no-store" to prevent caching
- Returns real-time status

### Route 3: Reports Proxy

**File: `src/app/api/agentic/reports/[filename]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const response = await fetch(
      `${API_URL}/api/v1/agentic/reports/${encodeURIComponent(filename)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `File not found: ${filename}` },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    // For images, stream the binary data through
    if (contentType.startsWith("image/")) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // For text/markdown, return as text
    const text = await response.text();
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic reports proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
```

**Purpose**: Proxy file downloads from FastAPI.

**Key Features:**

- Handles both images (binary) and text files
- Streams binary data for images
- Sets appropriate Content-Type headers
- Caches images for 1 hour (3600s)

## Analysis Lifecycle

### Complete Flow

```
1. User submits question
   Frontend: sendAnalysis(question)
   ↓
2. Create conversation
   Frontend: createConversation() → UUID
   ↓
3. Add user message
   Frontend: addMessage({ role: "user", content: question })
   ↓
4. Add assistant placeholder
   Frontend: addMessage({ role: "assistant", status: "pending" })
   ↓
5. POST to analyze endpoint
   Frontend: POST /api/agentic/analyze { question }
   ↓
6. Next.js proxy forwards
   Next.js: POST http://localhost:8000/api/v1/agentic/analyze
   ↓
7. FastAPI receives request
   FastAPI: start_analysis() → Generate analysis_id
   ↓
8. Store in memory
   FastAPI: _analyses[analysis_id] = { status: "running", ... }
   ↓
9. Start background task
   FastAPI: asyncio.create_task(_run_analysis_background())
   ↓
10. Return analysis_id
   FastAPI: Returns { analysis_id, status: "running", ... }
   ↓
11. Frontend receives response
   Frontend: Store analysis_id, update message status to "running"
   ↓
12. Start polling
   Frontend: pollStatus() → setInterval(4000ms)
   ↓
13. Poll loop (every 4s)
   Frontend: GET /api/agentic/status/{analysis_id}
   ↓
14. Next.js proxy forwards
   Next.js: GET http://localhost:8000/api/v1/agentic/status/{id}
   ↓
15. FastAPI checks status
   FastAPI: get_analysis_status() → Return current status
   ↓
16. Background task executes
   FastAPI: _run_analysis_background()
   ├─ Connect to MCP server
   ├─ Set output directory
   ├─ Build LangGraph
   ├─ Execute agents
   └─ Update _analyses with results
   ↓
17. Poll detects completion
   Frontend: status === "completed"
   ↓
18. Fetch report markdown
   Frontend: GET /api/agentic/reports/{id}/{report.md}
   ↓
19. Update message with results
   Frontend: updateMessage() → Add reportFiles, chartFiles, reportMarkdown
   ↓
20. Stop polling
   Frontend: stopPolling() → clearInterval()
   ↓
21. Render completed analysis
   Frontend: Display markdown with embedded charts
```

## Data Models

### Analysis Request

```typescript
{
  "question": "Сравни средното натоварване по руда на всички мелници за последните 72 часа.",
  "mill_number": 8,
  "start_date": "2025-01-01",
  "end_date": "2025-03-18"
}
```

### Analysis Response

```typescript
{
  "analysis_id": "abc12345",
  "status": "running",
  "message": "Analysis started. Use GET /api/v1/agentic/status/{analysis_id} to check progress.",
  "started_at": "2025-03-18T14:30:00.123456"
}
```

### Analysis Result (Running)

```typescript
{
  "analysis_id": "abc12345",
  "status": "running",
  "question": "Сравни средното натоварване по руда на всички мелници за последните 72 часа.",
  "final_answer": null,
  "report_files": [],
  "chart_files": [],
  "started_at": "2025-03-18T14:30:00.123456",
  "completed_at": null,
  "error": null
}
```

### Analysis Result (Completed)

```typescript
{
  "analysis_id": "abc12345",
  "status": "completed",
  "question": "Сравни средното натоварване по руда на всички мелници за последните 72 часа.",
  "final_answer": "Анализът е завършен успешно. Генерирани са сравнителни графики за всички 12 мелници.",
  "report_files": ["mill_comparison_report.md"],
  "chart_files": ["ore_comparison.png", "ore_histogram.png", "psI80_comparison.png"],
  "started_at": "2025-03-18T14:30:00.123456",
  "completed_at": "2025-03-18T14:32:45.678901",
  "error": null
}
```

### Analysis Result (Failed)

```typescript
{
  "analysis_id": "abc12345",
  "status": "failed",
  "question": "Сравни средното натоварване по руда на всички мелници за последните 72 часа.",
  "final_answer": null,
  "report_files": [],
  "chart_files": [],
  "started_at": "2025-03-18T14:30:00.123456",
  "completed_at": "2025-03-18T14:31:00.123456",
  "error": "GOOGLE_API_KEY not configured"
}
```

## Error Handling

### Frontend Error Handling

```typescript
// In sendAnalysis()
try {
  const res = await fetch("/api/v1/agentic/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `HTTP ${res.status}`);
  }
  // ... success handling
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : "Unknown error";
  updateMessage(assistantMsg.id, {
    status: "failed",
    content: `Грешка при стартиране на анализа: ${errorMsg}`,
    error: errorMsg,
  });
  set((s) => {
    const updated = s.conversations.map((c) =>
      c.id === convId ? { ...c, status: "failed" as const } : c,
    );
    saveConversations(updated);
    return { conversations: updated, isLoading: false };
  });
}
```

### Next.js Proxy Error Handling

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/v1/agentic/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic analyze proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
```

### FastAPI Error Handling

```python
@router.get("/status/{analysis_id}", response_model=AnalysisResult)
async def get_analysis_status(analysis_id: str):
    """Check the status of a running or completed analysis."""
    if analysis_id not in _analyses:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    # ... rest of implementation
```

### Background Task Error Handling

```python
async def _run_analysis_background(analysis_id: str, prompt: str) -> None:
    """Run the multi-agent analysis pipeline in the background."""
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not configured")
        # ... execute analysis
        _analyses[analysis_id]["status"] = "completed"
        # ... success handling
    except Exception as e:
        _analyses[analysis_id]["status"] = "failed"
        _analyses[analysis_id]["error"] = str(e)
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
```

## Integration Points

### 1. API URL Configuration

```typescript
// Frontend
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```

```python
# Backend
SERVER_URL = "http://localhost:8003/mcp"
```

**Purpose**: Centralized API URL configuration for easy environment switching.

### 2. Per-Analysis Output Folders

```python
# Backend
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
analysis_dir = os.path.join(OUTPUT_DIR, analysis_id)
```

```typescript
// Frontend
const baseUrl = analysisId
  ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
  : `/api/v1/agentic/reports`;
```

**Purpose**: Isolate output files per analysis for cleanup and organization.

### 3. MCP Server Connection

```python
async with streamable_http_client(SERVER_URL) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        # ... use session
```

**Purpose**: Connect to MCP server for tool execution.

### 4. LangGraph Configuration

```python
langchain_tools = await get_mcp_tools(session)
graph = build_graph(langchain_tools, api_key)

final_state = await graph.ainvoke(
    {"messages": [HumanMessage(content=prompt)]},
    config={
        "configurable": {"thread_id": analysis_id},
        "recursion_limit": 50,
    },
)
```

**Purpose**: Build and execute LangGraph with MCP tools.

### 5. File Serving

```python
# FastAPI
@router.get("/reports/{analysis_id}/{filename}")
async def get_report_file(analysis_id: str, filename: str):
    file_path = os.path.join(OUTPUT_DIR, analysis_id, filename)
    if not os.path.exists(file_path):
        fallback = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(fallback):
            return FileResponse(fallback)
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    return FileResponse(file_path)
```

```typescript
// Next.js
if (contentType.startsWith("image/")) {
  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

**Purpose**: Efficient file serving with caching for images.

## Key Patterns

### 1. Background Task Pattern

```python
asyncio.create_task(_run_analysis_background(analysis_id, full_prompt))
```

**Purpose**: Non-blocking execution of long-running tasks.

### 2. In-Memory State Tracking

```python
_analyses: dict[str, dict] = {}
```

**Purpose**: Fast access to analysis state without database overhead.

### 3. Per-Analysis Output Isolation

```python
await session.call_tool("set_output_directory", {"analysis_id": analysis_id})
```

**Purpose**: Prevent file conflicts between concurrent analyses.

### 4. Proxy Pattern

```typescript
const response = await fetch(`${API_URL}/api/v1/agentic/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
```

**Purpose**: Clean separation between frontend and backend.

### 5. Polling Pattern

```typescript
const interval = setInterval(async () => {
  const res = await fetch(`/api/v1/agentic/status/${analysisId}`);
  const data = await res.json();
  if (data.status === "completed") {
    // ... handle completion
    stop();
  }
}, POLL_INTERVAL_MS);
```

**Purpose**: Simple status checking without WebSocket complexity.

## Next Steps

For more details on specific aspects:

- [Overview](./ai-chat-overview.md)
- [Frontend Components](./ai-chat-frontend.md)
- [MCP Server & LangGraph](./ai-chat-mcp-langgraph.md)
