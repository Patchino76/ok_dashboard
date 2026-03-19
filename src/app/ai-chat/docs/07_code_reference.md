# 07 — Code Reference

This document provides detailed explanations of the key functions across the codebase. Think of it as a guided tour through the most important code.

---

## Backend — `python/agentic/api_endpoint.py`

### `start_analysis(request: AnalysisRequest) → AnalysisResponse`

**Lines:** ~75–108

The REST endpoint that kicks off everything. Called when the user submits a question.

```python
@router.post("/analyze", response_model=AnalysisResponse)
async def start_analysis(request: AnalysisRequest):
```

**Step by step:**

1. Generates a short UUID: `analysis_id = str(uuid.uuid4())[:8]` → e.g. `"51329fe7"`
2. Builds the full prompt by appending optional fields (mill number, dates)
3. Stores initial state in `_analyses[analysis_id]` with `status: "running"`
4. Fires off the background task: `asyncio.create_task(_run_analysis_background(...))`
5. Returns immediately — the browser doesn't wait for the analysis to finish

**Why background task?** The agent pipeline takes 1–5 minutes. We can't block the HTTP response that long. Instead, the frontend polls `/status/{id}` every 4 seconds.

---

### `_run_analysis_background(analysis_id: str, prompt: str)`

**Lines:** ~198–235

The async function that runs the entire agent pipeline. Executed as a background task.

```python
async def _run_analysis_background(analysis_id: str, prompt: str) -> None:
```

**Step by step:**

1. Loads the `GOOGLE_API_KEY` from environment
2. Opens a streamable HTTP connection to the MCP server at `localhost:8003`
3. Creates an MCP `ClientSession` within that connection
4. Calls `set_output_directory` tool to create `output/{analysis_id}/`
5. Fetches all tools via `get_mcp_tools(session)` → returns LangChain tools
6. Builds the graph: `build_graph(langchain_tools, api_key)`
7. Invokes the graph: `graph.ainvoke({"messages": [HumanMessage(content=prompt)]}, ...)`
8. Extracts `final_answer` from the last message in the final state
9. Updates `_analyses[analysis_id]` with `status="completed"` and the answer

**Error handling:** The entire function is wrapped in try/except. Any failure sets `status="failed"` with the error message.

---

### `get_analysis_status(analysis_id: str) → AnalysisResult`

**Lines:** ~111–142

The polling endpoint. Scans the output directory for files each time it's called.

```python
@router.get("/status/{analysis_id}", response_model=AnalysisResult)
async def get_analysis_status(analysis_id: str):
```

**How it finds files:**

```python
analysis_dir = os.path.join(OUTPUT_DIR, analysis_id)
for f in sorted(os.listdir(analysis_dir)):
    if f.endswith(".md"):   report_files.append(f)
    elif f.endswith(".png"): chart_files.append(f)
```

This means the file lists are always fresh — if an agent generates a new chart mid-analysis, the next poll will see it.

---

## Backend — `python/agentic/client.py`

### `get_mcp_tools(session: ClientSession) → list[BaseTool]`

**Lines:** ~77–91

Bridges MCP tools to LangChain. Called once per analysis.

```python
async def get_mcp_tools(session: ClientSession) -> list[BaseTool]:
    tools_result = await session.list_tools()
    langchain_tools = [mcp_tool_to_langchain(t, session) for t in tools_result.tools]
    return langchain_tools
```

**What it returns:** A list of 7 `StructuredTool` objects, each wrapping an MCP tool with a Pydantic args schema.

---

### `mcp_tool_to_langchain(tool, session) → BaseTool`

**Lines:** ~49–72

Wraps a single MCP tool as a LangChain tool.

**Key detail — the closure:**

```python
async def _call(**kwargs: Any) -> str:
    clean_kwargs = {k: v for k, v in kwargs.items() if v is not None}
    result = await session.call_tool(name=tool.name, arguments=clean_kwargs)
    if result.isError:
        return f"Error: {result.content[0].text}"
    return result.content[0].text
```

This closure **captures `session`** — so when the LLM calls a tool, it goes through the live MCP connection without re-connecting.

---

### `_json_schema_to_pydantic(schema, model_name) → Type[BaseModel]`

**Lines:** ~26–46

Dynamically creates a Pydantic model from a JSON Schema dict. Needed because LangChain requires `args_schema` to be a Pydantic class, but MCP tools define their schema as plain JSON.

```python
# Input: {"properties": {"mill_number": {"type": "integer"}, ...}, "required": ["mill_number"]}
# Output: A Pydantic model class with mill_number: int field
```

**Type mapping:**

```python
{"integer": int, "number": float, "boolean": bool}.get(json_type, str)
```

Required fields get `(python_type, ...)`, optional fields get `(Optional[python_type], None)`.

---

## Backend — `python/agentic/graph_v2.py`

### `build_graph(tools, api_key) → StateGraph`

**Lines:** ~169–546

The main function that constructs the entire multi-agent graph. Returns a compiled LangGraph.

**What it does inside:**

1. Creates the Gemini LLM instance
2. Binds specific tool subsets to each specialist (via `llm.bind_tools()`)
3. Defines helper functions (truncate, normalize, compress, etc.)
4. Creates specialist node functions via `make_specialist_node()`
5. Creates the manager review node
6. Creates the tool execution node
7. Defines routing functions
8. Assembles the graph: adds nodes, edges, conditional edges
9. Returns `graph.compile()`

---

### `make_specialist_node(name: str) → Callable`

**Lines:** ~318–376

A factory function that creates a specialist agent node. Each call returns a function that handles one iteration of a specialist.

```python
def specialist_node(state: AnalysisState) -> dict:
```

**The iteration logic:**

1. Count how many times this specialist has already run
2. If past `MAX_SPECIALIST_ITERS` (5) → force advance
3. Build focused context via `build_focused_context()`
4. Prepend the system prompt
5. Call the LLM with tool bindings
6. Normalize Gemini's response content (list → string)
7. Tag the response with the specialist's `name`
8. Return `{"messages": [response]}`

**Why focused context matters:** Without it, each specialist would see the entire conversation history (including other specialists' tool calls). This wastes tokens and confuses the LLM. `build_focused_context` gives each specialist only what it needs.

---

### `build_focused_context(all_msgs, stage_name) → list[BaseMessage]`

**Lines:** ~240–307

The most important optimization function. It builds a minimal, focused context for each specialist.

**What each specialist sees:**

1. **User request** — the original HumanMessage
2. **Prior stage summary** — compact summaries of what other specialists did (data loaded, analysis results)
3. **Own messages** — this specialist's messages + its tool results (for the tool-call loop)

**How it identifies "own" messages:**

```python
# Collect tool_call_ids that belong to this stage
my_tool_call_ids = set()
for msg in all_msgs:
    if isinstance(msg, AIMessage) and msg.name == stage_name and msg.tool_calls:
        for tc in msg.tool_calls:
            my_tool_call_ids.add(tc.get("id"))
```

**Summary of prior stages:**

- `query_mill_data` results → truncated to 150 chars
- `execute_python` results → truncated to 800 chars
- Other specialists' text → truncated to 300 chars
- Manager REWORK feedback for this stage → included in full

---

### `normalize_content(content) → str`

**Lines:** ~189–194

Handles a Gemini quirk where the LLM sometimes returns a list of dicts instead of a string.

```python
def normalize_content(content) -> str:
    if isinstance(content, list):
        texts = [item.get("text", "") if isinstance(item, dict) else str(item) for item in content]
        return "\n".join(texts).strip()  # ← \n is critical for markdown tables!
    return str(content) if content else ""
```

**Why `\n` join?** If you join with spaces, markdown table rows merge into one line and tables break. This was a bug that was fixed — see the markdown table rendering fix.

---

### `manager_review_node(state) → dict`

**Lines:** ~379–435

The quality review step that runs between stages.

**Logic:**

1. Skip review for `data_loader` (always accept)
2. If already reworked max times → force accept
3. Strip tool messages (manager has no tools bound)
4. Call the LLM with `MANAGER_REVIEW_PROMPT`
5. Parse the response: if it starts with `REWORK` → rework, else → accept

**Default to ACCEPT:** Any ambiguous response is treated as ACCEPT to prevent the pipeline from getting stuck.

---

### `tool_node(state) → dict`

**Lines:** ~440–461

Executes tool calls from the last message. This is a shared node — all specialists route here when they request tools.

```python
async def tool_node(state: AnalysisState) -> dict:
    last_message = state["messages"][-1]
    results = []
    for tc in last_message.tool_calls:
        tool = tools_by_name.get(tc["name"])
        output = await tool.ainvoke(tc["args"])
        results.append(ToolMessage(content=str(output), tool_call_id=tc["id"], name=tc["name"]))
    return {"messages": results}
```

**Error handling:** Unknown tools and execution errors are caught and returned as error `ToolMessage`s so the specialist can see what went wrong.

---

### Routing Functions

**`specialist_router(state) → str`** (line ~464)

```python
if last.tool_calls: return "tools"    # Specialist needs tools
else:               return "manager_review"  # Done, go to review
```

**`after_tools(state) → str`** (line ~471)

```python
# Find which specialist called the tools (by msg.name)
# Return to that specialist so it can see the results
```

**`manager_router(state) → str`** (line ~478)

```python
if content.startswith("REWORK:"): return f"{current}_entry"  # Redo this stage
elif idx + 1 < len(STAGES):      return f"{next_stage}_entry"  # Advance
else:                              return "end"  # Pipeline complete
```

---

## Backend — `python/agentic/tools/python_executor.py`

### `execute_python(arguments) → list[TextContent]`

**Lines:** ~79–145

The most powerful tool. Runs arbitrary Python code with access to loaded DataFrames.

**Execution namespace:**

```python
namespace = {
    "df":           <first loaded DataFrame>,
    "get_df":       get_dataframe,
    "list_dfs":     list_dataframes,
    "pd": pd, "np": np, "plt": plt, "sns": sns,
    "scipy_stats":  scipy.stats,
    "os": os, "json": json,
    "OUTPUT_DIR":   "/path/to/output/{analysis_id}/",
}
```

**How it detects new files:**

```python
existing_files = set(os.listdir(output_dir))  # Before
exec(code, namespace)                          # Run code
current_files = set(os.listdir(output_dir))   # After
new_files = sorted(current_files - existing_files)  # Diff
```

**Safety:** `plt.close("all")` is always called in the `finally` block to prevent memory leaks from unclosed matplotlib figures.

---

## Frontend — `src/app/ai-chat/stores/chat-store.ts`

### `sendAnalysis(question: string)`

**Lines:** ~216–288

The main action that orchestrates the frontend side of an analysis request.

```typescript
sendAnalysis: async (question: string) => {
  const convId = createConversation(truncate(question));
  addMessage({ role: "user", content: question });
  const assistantMsg = addMessage({ role: "assistant", status: "pending" });
  // ... POST /analyze ... get analysis_id ... start polling
};
```

**Error handling:** If the POST request fails, the assistant message is updated with `status: "failed"` and the error message.

---

### `pollStatus(analysisId, messageId, convId)`

**Lines:** ~293–361

Sets up a `setInterval` that checks the analysis status every 4 seconds.

**On completion:**

1. Gets `report_files` and `chart_files` from the status response
2. Fetches the first `.md` file as text → `reportMarkdown`
3. Updates the assistant message with all data
4. Stops the interval

**On failure:**

1. Updates the message with the error
2. Stops the interval

---

### `hydrateFromStorage()`

**Lines:** ~371–377

Loads conversations from `localStorage` after the React component mounts. This is called in a `useEffect` in `page.tsx` to avoid SSR hydration mismatches.

```typescript
hydrateFromStorage: () => {
    const loaded = loadConversations();
    set({
        conversations: loaded,
        activeConversationId: loaded[0]?.id ?? null,
    });
},
```

**Why not initialize from localStorage directly?** Because during SSR (server-side rendering), `localStorage` doesn't exist. If we initialize with localStorage data, the server renders empty HTML but the client renders with data → hydration mismatch. So we start empty and hydrate after mount.

---

## Frontend — `src/app/ai-chat/page.tsx`

### `makeMarkdownComponents(analysisId) → Record<string, any>`

**Lines:** ~298–331 (approx)\*\*

Creates custom React components for `ReactMarkdown` rendering.

**`p` component:**

```typescript
p: ({ node, children, ...rest }) => {
    const hasImage = node?.children?.some(
        (child) => child.tagName === "img"
    );
    if (hasImage) return <div className="my-1" {...rest}>{children}</div>;
    return <p {...rest}>{children}</p>;
};
```

Uses the markdown AST to detect images. If a paragraph contains an image, it renders as `<div>` instead of `<p>` to avoid the `<div>` inside `<p>` hydration error (since `CollapsibleImage` renders a `<div>`).

**`img` component:**

```typescript
img: ({ src, alt }) => {
    const resolvedSrc = src.startsWith("http") || src.startsWith("/")
        ? src
        : `${baseUrl}/${encodeURIComponent(src)}`;
    return <CollapsibleImage src={resolvedSrc} alt={alt} />;
};
```

Resolves relative image paths (like `chart.png`) to the full API URL for that analysis.

---

### `ExportPdfButton` + `PrintableReport`

**`PrintableReport`** (forwardRef component):

- Renders the full markdown in a hidden container (`overflow: hidden; height: 0; width: 0`)
- Uses `makePrintMarkdownComponents` — images are always expanded (no collapsible wrappers)
- Sized at `210mm` width (A4)

**`ExportPdfButton`:**

```typescript
const handlePrint = useReactToPrint({
  contentRef,
  documentTitle: title.replace(/\s+/g, "_"),
  pageStyle: `@page { size: A4; margin: 15mm; }`,
});
```

Uses `react-to-print` which copies the ref'd element into an iframe and triggers the browser's print dialog.

---

### `CollapsibleUserMessage`

For user messages longer than 300 characters:

```typescript
const COLLAPSE_THRESHOLD = 300;

function CollapsibleUserMessage({ content }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = content.length > COLLAPSE_THRESHOLD;

    if (!isLong) return <p>{content}</p>;

    return (
        <div>
            <p className={expanded ? "" : "line-clamp-4"}>{content}</p>
            <button onClick={() => setExpanded(!expanded)}>
                {expanded ? "Свий" : "Покажи всичко"}
            </button>
        </div>
    );
}
```

---

## Backend — `python/prompts_router.py`

### Prompts CRUD

A lightweight FastAPI router with SQLite storage for user-saved prompts.

**Database schema:**

```sql
CREATE TABLE prompts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user        TEXT    NOT NULL DEFAULT 'Admin',
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
);
```

**Endpoints:**
| Method | Path | Function |
|--------|------|----------|
| `GET` | `/api/v1/prompts/` | `list_prompts()` — newest first |
| `POST` | `/api/v1/prompts/` | `create_prompt()` — title + description |
| `PUT` | `/api/v1/prompts/{id}` | `update_prompt()` — partial update |
| `DELETE` | `/api/v1/prompts/{id}` | `delete_prompt()` — removes row |

**Connection helper:**

```python
def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Dict-like row access
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrent access
    return conn
```

---

## Summary

That covers all the key functions in the system! Here's a quick reference map:

| What you want to understand | File                 | Function                              |
| --------------------------- | -------------------- | ------------------------------------- |
| How analysis starts         | `api_endpoint.py`    | `start_analysis()`                    |
| How agents run              | `api_endpoint.py`    | `_run_analysis_background()`          |
| How the graph is built      | `graph_v2.py`        | `build_graph()`                       |
| How agents think            | `graph_v2.py`        | `make_specialist_node()`              |
| How context is managed      | `graph_v2.py`        | `build_focused_context()`             |
| How tools are bridged       | `client.py`          | `mcp_tool_to_langchain()`             |
| How Python code runs        | `python_executor.py` | `execute_python()`                    |
| How reports are written     | `report_tools.py`    | `write_markdown_report()`             |
| How the frontend submits    | `chat-store.ts`      | `sendAnalysis()`                      |
| How polling works           | `chat-store.ts`      | `pollStatus()`                        |
| How markdown renders        | `page.tsx`           | `makeMarkdownComponents()`            |
| How PDF export works        | `page.tsx`           | `ExportPdfButton` + `PrintableReport` |
