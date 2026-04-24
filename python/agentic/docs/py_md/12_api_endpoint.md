# 12 — API Endpoint (`api_endpoint.py`)

`api_endpoint.py` is a FastAPI `APIRouter` mounted under `/api/v1/agentic` on
the main app (`python/api.py`). It is the entire public surface of the
agentic system.

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/analyze` | Start a new analysis; returns an `analysis_id`. |
| `GET` | `/status/{analysis_id}` | Poll progress + final result for an analysis or follow-up. |
| `POST` | `/followup/{analysis_id}` | Ask a follow-up against a completed analysis. |
| `GET` | `/reports` | Flat list of every generated file across all analyses. |
| `GET` | `/reports/{analysis_id}/{filename}` | Download one file (PNG or MD). |
| `GET` | `/templates` | List available analysis templates. |
| `DELETE` | `/analysis/{analysis_id}` | Delete output folder and in-memory tracking. |

All responses are JSON except `/reports/{id}/{file}`, which uses `FileResponse`
to stream PNGs / MDs with the correct content-type.

## Request / response models

```python
class AnalysisSettings(BaseModel):
    maxToolOutputChars:      int = 4000
    maxAiMessageChars:       int = 4000
    maxMessagesWindow:       int = 20
    maxSpecialistIterations: int = 5

class AnalysisRequest(BaseModel):
    question:    str
    mill_number: Optional[int]   = None   # 1..12
    start_date:  Optional[str]   = None   # ISO date
    end_date:    Optional[str]   = None
    settings:    Optional[AnalysisSettings] = None
    template_id: Optional[str]   = None

class AnalysisResponse(BaseModel):
    analysis_id: str
    status:      str            # "running"
    message:     str
    started_at:  str

class AnalysisResult(BaseModel):
    analysis_id:   str
    status:        str          # "running" | "completed" | "failed"
    question:      str
    final_answer:  Optional[str]
    report_files:  list[str]    # .md files in output/{parent_id}/
    chart_files:   list[str]    # .png files in output/{parent_id}/
    progress:      list[ProgressMessage]
    started_at:    str
    completed_at:  Optional[str]
    error:         Optional[str]

class FollowUpRequest(BaseModel):
    question: str
```

## `POST /analyze`

```http
POST /api/v1/agentic/analyze
{
  "question":   "Направи пълен анализ на мелница 8.",
  "mill_number": 8,
  "start_date":  "2025-03-01",
  "end_date":    "2025-03-08",
  "template_id": "comprehensive",
  "settings":   { "maxToolOutputChars": 6000, "maxSpecialistIterations": 3 }
}
```

Flow:

1. Generate an 8-char `analysis_id` (`uuid4()[:8]`).
2. Build `full_prompt` by concatenating question + mill + dates.
3. Register `_analyses[id] = {status: "running", progress: [], …}`.
4. Fire-and-forget `asyncio.create_task(_run_analysis_background(...))`.
5. Return `AnalysisResponse(analysis_id, status="running", …)` immediately.

The endpoint itself never blocks — the UI polls status independently.

## `GET /status/{analysis_id}`

On every call:

- Resolve the folder: follow-ups use `parent_analysis_id`, primary analyses
  use their own id.
- List every `.md` (→ `report_files`) and `.png` (→ `chart_files`) in that
  folder.
- Normalise `final_answer` via `_content_to_str` (Gemini occasionally returns
  content as a list of `{type:"text", text:"…"}` dicts).
- Return the full `AnalysisResult`.

The UI polls every 4 s. Each poll is cheap: a single `os.listdir` + an
in-memory dict lookup.

## `POST /followup/{analysis_id}`

```http
POST /api/v1/agentic/followup/ab12cd34
{ "question": "Add a PSI200 SPC chart to the report." }
```

- Verifies the parent analysis exists and is `completed` or `failed`
  (prevents racing against a still-running analysis).
- Generates `followup_id = f"{analysis_id}-f{uuid[:4]}"`.
- Registers the follow-up entry with `parent_analysis_id = analysis_id`.
- Starts `_run_followup_background(...)` in the background.
- Returns the follow-up id so the UI can poll it.

See **10 — Follow-Up Conversations** for how the follow-up graph runs.

## `GET /reports` and `GET /reports/{id}/{filename}`

- `/reports` scans all `output/*/` subfolders and returns a flat list of files
  with `{name, analysis_id, size_kb, type: "report"|"chart"|"other"}`.
- `/reports/{id}/{filename}` serves one file. Falls back to the flat
  `output/{filename}` path for backward compatibility with pre-subfolder
  files.
- The UI's ReactMarkdown renderer rewrites `![caption](chart.png)` references
  so they point at `/api/v1/agentic/reports/{id}/chart.png`.

## `GET /templates`

Thin wrapper around `analysis_templates.list_templates()`. Returns every
template with its id, labels, description, and specialist list.

## `DELETE /analysis/{analysis_id}`

- `shutil.rmtree(output/{id})` to remove charts and reports.
- `_analyses.pop(id, None)` to clear the in-memory entry.
- Idempotent — deleting a non-existent id returns success.

## Background runner internals

### `_run_analysis_background(analysis_id, prompt, settings, template_id)`

```python
async with streamable_http_client(SERVER_URL) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()

        # 1. Scope the output dir on the MCP server
        await session.call_tool("set_output_directory", {"analysis_id": analysis_id})

        # 2. Fetch MCP tools as LangChain tools
        langchain_tools = await get_mcp_tools(session)

        # 3. Build the graph with progress callback + settings
        graph = build_graph(
            langchain_tools, api_key,
            on_progress=on_progress,
            settings=settings,
            template_id=template_id,
        )

        # 4. Run end-to-end
        final_state = await graph.ainvoke(
            {"messages": [HumanMessage(content=prompt)]},
            config={"configurable": {"thread_id": analysis_id},
                    "recursion_limit": 150},
        )

        # 5. Persist conversation for potential follow-ups
        _analyses[id]["conversation_history"] = _serialize_messages(final_state["messages"])
        _analyses[id]["status"] = "completed"
        _analyses[id]["final_answer"] = _content_to_str(final_state["messages"][-1].content)
```

### `_run_followup_background(analysis_id, followup_id, question)`

- Loads the stored `conversation_history` and rebuilds up to 30 messages.
- Points the output dir back at the original `analysis_id`.
- Builds `build_followup_graph`, invokes with `prior_messages + [HumanMessage(question)]`.
- Updates **the parent's** `conversation_history` so chained follow-ups see
  each other's context.
- `recursion_limit` is **50** (vs 150 for main analysis) because the
  follow-up graph is much shorter.

### Error handling

Both runners have broad `except Exception` / `except BaseException` blocks.
They:

- Print the full traceback to server stdout.
- If the error is an `ExceptionGroup` (common with LangGraph concurrency),
  iterate `e.exceptions` and log each sub-exception.
- Set `status = "failed"`, store `error` and `traceback` in `_analyses[id]`.
- Emit a Bulgarian progress message: `"✗ Грешка при анализа: {…}"`.

The UI surfaces the error inline in the chat bubble.

## Progress callback wiring

```python
def _make_progress_callback(analysis_id):
    def on_progress(stage, message):
        _analyses[analysis_id]["progress"].append({
            "timestamp": datetime.now().isoformat(),
            "stage":     stage,
            "message":   message,
        })
    return on_progress
```

`on_progress` is passed to `build_graph`/`build_followup_graph`. Each
specialist / planner / manager calls it on entry and exit. The UI renders
the `progress[]` array as an animated checklist.

## Message serialisation helpers

### `_content_to_str(content) -> str`

Flattens three possible content shapes:

- `str` → returned as-is.
- `list[dict]` (Gemini) → concatenates `item["text"]` / `item["content"]`.
- anything else → `str(content)`.

Required because `AnalysisResult.final_answer` is a Pydantic `Optional[str]`
field; it rejects list values.

### `_serialize_messages(messages) -> list[dict]`

- Skips `ToolMessage` (orphaned tool_call_id on replay).
- Skips `AIMessage`s that only have tool_calls.
- Returns `[{"type": "HumanMessage"|"AIMessage"|…, "content": "…", "name": "…"}]`.

Used when persisting history at the end of an analysis.

### `_rebuild_messages(history) -> list[BaseMessage]`

Reverse of `_serialize_messages`:

- Tolerates legacy entries (no type → defaults to `HumanMessage`).
- Skips empty-content entries defensively.
- Imports `AIMessage` / `SystemMessage` lazily from `langchain_core.messages`
  to keep top-level import cost low.

## Mounting

In `python/api.py`, the router is imported conditionally on
`GOOGLE_API_KEY` being set:

```python
if os.getenv("GOOGLE_API_KEY"):
    from agentic.api_endpoint import router as agentic_router
    app.include_router(agentic_router)
```

So if no key is configured, the main API starts without the agentic endpoints
and the `/ai-chat` page gracefully disables itself.
