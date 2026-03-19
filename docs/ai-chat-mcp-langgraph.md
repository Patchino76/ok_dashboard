# AI Chat System - MCP Server & LangGraph

## Table of Contents
- [Introduction](#introduction)
- [MCP Server Architecture](#mcp-server-architecture)
- [LangGraph Multi-Agent System](#langgraph-multi-agent-system)
- [MCP Tools](#mcp-tools)
- [Agent Pipeline](#agent-pipeline)
- [Integration](#integration)

## Introduction

The AI Chat system uses two key backend components:
- **MCP Server** - Model Context Protocol server providing tools for data analysis
- **LangGraph** - Multi-agent orchestration framework for executing analyses

## MCP Server Architecture

### Server Setup

**File: `python/agentic/server.py`**

```python
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.applications import Starlette
from starlette.routing import Mount
import uvicorn

# Create MCP server
server = Server("agentic-data-analysis-server", lifespan=server_lifespan)

# Register tool handlers
@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [entry["tool"] for entry in tools.values()]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    if name not in tools:
        raise ValueError(f"Unknown tool: {name}")
    handler = tools[name]["handler"]
    return await handler(arguments)

# Wrap in Streamable HTTP transport
session_manager = StreamableHTTPSessionManager(server)

# Mount on Starlette app
app = Starlette(
    routes=[Mount("/mcp", app=session_manager.handle_request)],
    lifespan=app_lifespan,
)

# Run on port 8003
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
```

**Key Features:**
- Low-level MCP server implementation
- Streamable HTTP transport for async communication
- Runs on port 8003
- Tool registry pattern for easy extension

## LangGraph Multi-Agent System

### Graph Structure

**File: `python/agentic/graph_v2.py`**

```python
class AnalysisState(MessagesState):
    current_stage: str
    stage_attempts: dict

# Deterministic stage order
STAGES = ["data_loader", "analyst", "code_reviewer", "reporter"]
MAX_REWORKS_PER_STAGE = 1
```

### Agent Pipeline Flow

```
START
  ↓
[data_loader_entry] → Set current_stage = "data_loader"
  ↓
[data_loader] → Load data from database
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
[code_reviewer] → Validate outputs
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

### Specialist Nodes

#### Data Loader

```python
DATA_LOADER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Loader. Your ONLY job is to call query_mill_data to load data.

CRITICAL: ALWAYS compute start_date and end_date to filter at SQL level.
- "last 24 hours" → end_date = today, start_date = yesterday
- "last 30 days" → end_date = today, start_date = 30 days ago
- Today's date: {{TODAY_DATE}}. Use this to compute date ranges.

RULES:
- Extract mill number(s) from the request
- ALWAYS pass start_date and end_date to every query_mill_data call
- Each mill is stored automatically as 'mill_data_N'
- After loading, write a brief summary
- Do NOT call any other tool. Do NOT analyze the data."""
```

**Purpose**: Load mill data from database with proper date filtering.

#### Analyst

```python
ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Analyst. Data has been loaded by the data_loader.

ACCESSING DATA:
- Call list_dfs() first to see all loaded DataFrames
- Single mill: df = get_df('mill_data_8')
- Multiple mills: loop through range(1, 13)

Call execute_python with a SINGLE block of Python code.
ALWAYS start your code with:
```
print("Loaded DataFrames:", list_dfs())
```

For MULTI-MILL comparison:
- Build summary dict/DataFrame with stats per mill
- Create bar charts comparing mills side-by-side

For SINGLE-MILL analysis:
- EDA: distributions for Ore, PSI80, DensityHC, MotorAmp
- SPC: control charts (mean ± 3σ) for PSI80 and Ore
- Correlations: heatmap of df.corr()
- Anomaly detection: Z-scores (threshold=3)
- Downtime: periods where Ore < 10 t/h

CHART QUALITY RULES:
- Use sns.set_theme(style='whitegrid', font_scale=1.2)
- Figure sizes: bar (14,7), distributions (10,6), SPC (14,5), heatmap (12,10)
- All axes MUST have labels with units
- Save charts: plt.savefig(os.path.join(OUTPUT_DIR, 'filename.png'), dpi=150, bbox_inches='tight')
- ALWAYS call plt.close() after each savefig"""
```

**Purpose**: Perform EDA, SPC, correlations, anomaly detection.

#### Code Reviewer

```python
CODE_REVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Code Reviewer. Validate the analysis outputs.

1. Call list_output_files to see what charts were generated
2. Review the stdout from previous steps for errors
3. If there are NO chart files (.png), call execute_python to regenerate them
4. If charts exist and stdout has meaningful results, write a short validation summary

Do NOT regenerate charts that already exist. Only fix errors or fill gaps."""
```

**Purpose**: Validate charts and outputs, regenerate if missing.

#### Reporter

```python
REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Reporter. Write a COMPREHENSIVE professional Markdown analysis report.

STEPS:
1. Call list_output_files to get the exact chart filenames
2. Read through ALL previous messages to extract statistics and findings
3. Call write_markdown_report with the full report content

Report MUST include:
- **Title** matching the analysis request
- **Executive Summary**: 3-4 sentences with key findings and actual numbers
- **Data Overview**: what data was loaded, time range, number of records
- **Findings sections**: organize by analyses performed, include actual numbers
- **Charts**: embed EVERY .png file from list_output_files using ![description](exact_filename.png)
- **Conclusions & Recommendations**: 3-5 specific actionable items

CRITICAL RULES:
- Use EXACT filenames from list_output_files
- Include ACTUAL numbers from the analysis
- Do NOT use placeholder text
- Every section must have substantive content
- Report should be at least 1000 words"""
```

**Purpose**: Write comprehensive markdown report with embedded charts.

#### Manager

```python
MANAGER_REVIEW_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Quality Manager reviewing the output of a specialist agent.

Evaluate the last specialist's output for:
- Completeness: did they do everything asked?
- Quality: are charts well-formatted? Is the report detailed with actual numbers?
- Correctness: are there errors or unreasonable values?

Respond with EXACTLY one of:
- ACCEPT: [brief reason] — if the work is good enough to proceed
- REWORK: [specific instructions on what to fix] — if improvements are needed

Be concise. One line is enough."""
```

**Purpose**: QA review after each stage, decide ACCEPT or REWORK.

## MCP Tools

### Database Tools

**File: `python/agentic/tools/db_tools.py`**

```python
# In-memory DataFrame store
_dataframes: dict[str, pd.DataFrame] = {}

# Tool 1: get_db_schema
async def get_db_schema(arguments: dict) -> list[types.TextContent]:
    schema_name = arguments.get("schema_name", "mills").strip()
    engine = _get_engine()
    inspector = inspect(engine)
    table_names = sorted(inspector.get_table_names(schema=schema_name))
    # ... return schema metadata
```

**Purpose**: Return database schema metadata.

```python
# Tool 2: query_mill_data
async def query_mill_data(arguments: dict) -> list[types.TextContent]:
    mill_number = arguments.get("mill_number")
    start_date = arguments.get("start_date")
    end_date = arguments.get("end_date")
    store_name = arguments.get("store_name") or f"mill_data_{mill_number}"

    # Build query with date filtering
    query = f'SELECT * FROM mills."MILL_{mill_number:02d}"'
    conditions = []
    if start_date:
        conditions.append(f'"TimeStamp" >= \'{start_date}\'')
    if end_date:
        conditions.append(f'"TimeStamp" <= \'{end_date}\'')
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += ' ORDER BY "TimeStamp"'

    df = pd.read_sql_query(query, engine, parse_dates=["TimeStamp"])
    df = df.set_index("TimeStamp")
    set_dataframe(df, store_name)
    # ... return summary
```

**Purpose**: Load mill sensor data into memory.

```python
# Tool 3: query_combined_data
async def query_combined_data(arguments: dict) -> list[types.TextContent]:
    # Load mill data
    df_mill = pd.read_sql_query(mill_query, engine, parse_dates=["TimeStamp"])
    
    # Load ore quality data
    df_ore = pd.read_sql_query(ore_query, engine, parse_dates=["TimeStamp"])
    
    # Join on TimeStamp (nearest-time merge)
    df_mill = df_mill.set_index("TimeStamp")
    df_ore = df_ore.set_index("TimeStamp")
    df_mill = df_mill.join(df_ore[ore_cols], how="left")
    
    set_dataframe(df_mill, store_name)
    # ... return summary
```

**Purpose**: Load mill + ore quality data joined.

### Python Executor

**File: `python/agentic/tools/python_executor.py`**

```python
async def execute_python(arguments: dict) -> list[types.TextContent]:
    code = arguments.get("code", "").strip()
    output_dir = get_output_dir()
    
    # Track existing files
    existing_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()
    
    # Build namespace
    namespace = {
        "df": get_dataframe("default"),
        "get_df": get_dataframe,
        "list_dfs": list_dataframes,
        "pd": pd,
        "np": np,
        "plt": plt,
        "sns": sns,
        "scipy_stats": scipy_stats,
        "OUTPUT_DIR": output_dir,
        "__builtins__": __builtins__,
    }
    
    # Capture stdout
    old_stdout = sys.stdout
    sys.stdout = captured_stdout = io.StringIO()
    
    try:
        exec(code, namespace)
    except Exception:
        error_msg = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        plt.close("all")
    
    stdout_output = captured_stdout.getvalue()
    
    # Detect newly created files
    current_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()
    new_files = sorted(current_files - existing_files)
    
    return [types.TextContent(type="text", text=json.dumps({
        "stdout": stdout_output[:8000],
        "new_files": new_files,
        "loaded_dataframes": list_dataframes(),
        "error": error_msg[:4000] if error_msg else None,
    }, indent=2, default=str))]
```

**Purpose**: Execute Python code with pandas/numpy/matplotlib.

### Report Tools

**File: `python/agentic/tools/report_tools.py`**

```python
# Tool 1: list_output_files
async def list_output_files(arguments: dict) -> list[types.TextContent]:
    ext_filter = arguments.get("extension_filter", "").strip().lower()
    output_dir = get_output_dir()
    
    files = []
    for f in sorted(os.listdir(output_dir)):
        if ext_filter and not f.lower().endswith(f".{ext_filter}"):
            continue
        full_path = os.path.join(output_dir, f)
        if os.path.isfile(full_path):
            files.append({
                "name": f,
                "size_kb": round(os.path.getsize(full_path) / 1024, 1),
            })
    
    return [types.TextContent(type="text", text=json.dumps({
        "count": len(files),
        "files": files
    }, indent=2))]
```

**Purpose**: List files in output directory.

```python
# Tool 2: write_markdown_report
async def write_markdown_report(arguments: dict) -> list[types.TextContent]:
    filename = arguments.get("filename", "").strip()
    content = arguments.get("content", "").strip()
    
    if not filename.endswith(".md"):
        filename += ".md"
    
    output_dir = get_output_dir()
    file_path = os.path.join(output_dir, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    return [types.TextContent(type="text", text=json.dumps({
        "status": "written",
        "file": filename,
        "path": file_path,
        "size_kb": round(os.path.getsize(file_path) / 1024, 1),
        "lines": content.count("\n") + 1,
    }, indent=2))]
```

**Purpose**: Write markdown report to output directory.

### Session Tools

**File: `python/agentic/tools/session_tools.py`**

```python
async def set_output_directory(arguments: dict) -> list[types.TextContent]:
    analysis_id = arguments.get("analysis_id", "").strip()
    full_path = set_output_dir(analysis_id)
    
    return [types.TextContent(type="text", text=json.dumps({
        "status": "configured",
        "analysis_id": analysis_id,
        "output_dir": full_path,
    }, indent=2))]
```

**Purpose**: Configure per-analysis output subfolder.

### Output Directory

**File: `python/agentic/tools/output_dir.py`**

```python
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_OUTPUT_DIR = os.path.join(BASE_DIR, "output")

# Module-level mutable state
_current_output_dir: str = _DEFAULT_OUTPUT_DIR

def get_output_dir() -> str:
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir

def set_output_dir(subdir: str) -> str:
    global _current_output_dir
    _current_output_dir = os.path.join(_DEFAULT_OUTPUT_DIR, subdir)
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir
```

**Purpose**: Shared mutable output directory state.

## Agent Pipeline

### Graph Assembly

```python
def build_graph(tools: list[BaseTool], api_key: str) -> StateGraph:
    llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=api_key)
    
    # Per-specialist tool binding
    tools_by_name = {t.name: t for t in tools}
    TOOL_SETS = {
        "data_loader": ["query_mill_data", "query_combined_data", "get_db_schema"],
        "analyst":     ["execute_python", "list_output_files"],
        "code_reviewer": ["execute_python", "list_output_files"],
        "reporter":    ["list_output_files", "write_markdown_report"],
    }
    specialist_llms = {}
    for stage_name, tool_names in TOOL_SETS.items():
        stage_tools = [tools_by_name[n] for n in tool_names if n in tools_by_name]
        specialist_llms[stage_name] = llm.bind_tools(stage_tools)
    
    # Build graph
    graph = StateGraph(AnalysisState)
    
    # Add nodes
    for stage in STAGES:
        graph.add_node(f"{stage}_entry", make_stage_entry(stage))
        graph.add_node(stage, make_specialist_node(stage))
    
    graph.add_node("tools", tool_node)
    graph.add_node("manager_review", manager_review_node)
    
    # Wire edges
    graph.set_entry_point("data_loader_entry")
    
    for stage in STAGES:
        graph.add_edge(f"{stage}_entry", stage)
        graph.add_conditional_edges(stage, specialist_router, {
            "tools": "tools",
            "manager_review": "manager_review",
        })
    
    graph.add_conditional_edges("tools", after_tools, {
        stage: stage for stage in STAGES
    })
    
    manager_targets = {f"{stage}_entry": f"{stage}_entry" for stage in STAGES}
    manager_targets["end"] = END
    graph.add_conditional_edges("manager_review", manager_router, manager_targets)
    
    return graph.compile()
```

### Routing Logic

```python
def specialist_router(state: AnalysisState) -> str:
    """After specialist: go to tools if tool_calls, else to manager review."""
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "manager_review"

def after_tools(state: AnalysisState) -> str:
    """After tool execution, return to the specialist that called them."""
    for msg in reversed(state["messages"]):
        if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
            return msg.name
    return "data_loader"

def manager_router(state: AnalysisState) -> str:
    """After manager review: advance to next stage or rework current."""
    last = state["messages"][-1]
    content = last.content if isinstance(last.content, str) else str(last.content)
    current = state.get("current_stage", "data_loader")
    
    if content.startswith("REWORK:"):
        return f"{current}_entry"
    
    idx = STAGES.index(current) if current in STAGES else 0
    if idx + 1 < len(STAGES):
        return f"{STAGES[idx + 1]}_entry"
    return "end"
```

## Integration

### MCP Client Bridge

**File: `python/agentic/client.py`**

```python
async def get_mcp_tools(session: ClientSession) -> list[BaseTool]:
    """Fetch all tools from MCP server and return as LangChain tools."""
    tools_result = await session.list_tools()
    langchain_tools = [mcp_tool_to_langchain(t, session) for t in tools_result.tools]
    return langchain_tools

def mcp_tool_to_langchain(tool: mcp_types.Tool, session: ClientSession) -> BaseTool:
    """Wrap a single MCP tool as a LangChain StructuredTool."""
    args_schema = _json_schema_to_pydantic(tool.inputSchema, model_name=tool.name)
    
    async def _call(**kwargs: Any) -> str:
        clean_kwargs = {k: v for k, v in kwargs.items() if v is not None}
        result = await session.call_tool(name=tool.name, arguments=clean_kwargs)
        if result.isError:
            return f"Error: {result.content[0].text}"
        return result.content[0].text
    
    return StructuredTool.from_function(
        coroutine=_call,
        name=tool.name,
        description=tool.description,
        args_schema=args_schema,
    )
```

**Purpose**: Convert MCP tools to LangChain StructuredTools.

### Background Task Execution

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
                
                # Configure per-analysis output subfolder
                await session.call_tool("set_output_directory", {"analysis_id": analysis_id})
                
                # Get MCP tools and build graph
                langchain_tools = await get_mcp_tools(session)
                graph = build_graph(langchain_tools, api_key)
                
                # Execute graph
                final_state = await graph.ainvoke(
                    {"messages": [HumanMessage(content=prompt)]},
                    config={
                        "configurable": {"thread_id": analysis_id},
                        "recursion_limit": 50,
                    },
                )
                
                # Update analysis status
                final_answer = final_state["messages"][-1].content
                _analyses[analysis_id]["status"] = "completed"
                _analyses[analysis_id]["final_answer"] = final_answer
                _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
    
    except Exception as e:
        _analyses[analysis_id]["status"] = "failed"
        _analyses[analysis_id]["error"] = str(e)
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
```

**Purpose**: Execute LangGraph pipeline with MCP tools.

## Key Features

### 1. Deterministic Stage Order
- Fixed sequence: data_loader → analyst → code_reviewer → reporter
- Manager QA review after each stage
- Max 1 rework per stage prevents infinite loops

### 2. Focused Context Building
- Each specialist gets only relevant messages
- Original user request always included
- Compact summary of prior stages
- Current stage messages preserved for tool loop

### 3. Token Efficiency
- Message compression (truncate long outputs)
- Strip tool messages for manager (no tools bound)
- Max messages window: 14
- Max tool output: 2000 chars
- Max AI message: 3000 chars

### 4. Tool Binding Per Specialist
- Each stage has specific tool access
- Data loader: database tools
- Analyst: python executor + list files
- Code reviewer: python executor + list files
- Reporter: list files + write report

### 5. Per-Analysis Output Isolation
- Each analysis writes to output/{analysis_id}/
- MCP server has shared mutable output_dir state
- set_output_directory tool configures subfolder
- Enables cleanup when conversations deleted

## Next Steps

For complete documentation:
- [Overview](./ai-chat-overview.md)
- [Frontend Components](./ai-chat-frontend.md)
- [Backend Integration](./ai-chat-backend.md)
