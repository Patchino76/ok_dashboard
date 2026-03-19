# 06 — Data Flow

This document traces a complete analysis request from the moment the user clicks "Send" to the final report appearing in the chat. Follow along with the flow diagrams!

---

## End-to-End Flow Diagram

```
USER                    BROWSER (Next.js)           FASTAPI (:8000)         MCP SERVER (:8003)         POSTGRESQL
 │                           │                           │                        │                        │
 │  Types question           │                           │                        │                        │
 │  & clicks Send            │                           │                        │                        │
 │──────────────────────────►│                           │                        │                        │
 │                           │                           │                        │                        │
 │                    ┌──────┴──────┐                    │                        │                        │
 │                    │ Zustand     │                    │                        │                        │
 │                    │ sendAnalysis│                    │                        │                        │
 │                    └──────┬──────┘                    │                        │                        │
 │                           │                           │                        │                        │
 │                           │  1. Create conversation   │                        │                        │
 │                           │  2. Add user message      │                        │                        │
 │                           │  3. Add placeholder msg   │                        │                        │
 │                           │  4. Save to localStorage  │                        │                        │
 │                           │                           │                        │                        │
 │                           │  POST /api/v1/agentic/    │                        │                        │
 │                           │       analyze             │                        │                        │
 │                           │──────────────────────────►│                        │                        │
 │                           │                           │                        │                        │
 │                           │                    ┌──────┴──────┐                 │                        │
 │                           │                    │ Create      │                 │                        │
 │                           │                    │ analysis_id │                 │                        │
 │                           │                    │ Start bg    │                 │                        │
 │                           │                    │ task        │                 │                        │
 │                           │                    └──────┬──────┘                 │                        │
 │                           │                           │                        │                        │
 │                           │  {"analysis_id":"51329fe7"│                        │                        │
 │                           │    "status":"running"}    │                        │                        │
 │                           │◄──────────────────────────│                        │                        │
 │                           │                           │                        │                        │
 │                    ┌──────┴──────┐                    │                        │                        │
 │                    │ Start       │                    │                        │                        │
 │                    │ polling     │              ┌─────┴─────┐                  │                        │
 │                    │ every 4s    │              │ BG TASK:  │                  │                        │
 │                    └──────┬──────┘              │           │                  │                        │
 │                           │                    │ Connect to│                  │                        │
 │                           │                    │ MCP server│                  │                        │
 │                           │                    │───────────┼─────────────────►│                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ set_output │  call_tool      │                        │
 │                           │                    │ _directory │─────────────────►                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ Fetch tools│ list_tools      │                        │
 │                           │                    │───────────┼─────────────────►│                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ Build      │                 │                        │
 │                           │                    │ LangGraph  │                 │                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ ═══ AGENT PIPELINE STARTS ═══│                        │
 │                           │                    │           │                  │                        │
 │  (sees "Agents working")  │                    │ data_loader│ query_mill_data │                        │
 │◄──────────────────────────│                    │───────────┼─────────────────►│  SELECT * FROM mills   │
 │                           │                    │           │                  │──────────────────────►│
 │                           │                    │           │                  │◄──────────────────────│
 │                           │                    │           │◄─────────────────│  DataFrame stored      │
 │                           │                    │           │                  │                        │
 │  GET /status (poll)       │                    │ analyst   │ execute_python   │                        │
 │                           │──────────────────► │───────────┼─────────────────►│                        │
 │                           │ "status":"running" │           │  (runs pandas,   │                        │
 │                           │◄──────────────────│           │   saves charts)  │                        │
 │                           │                    │           │◄─────────────────│                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ manager   │                  │                        │
 │                           │                    │ review    │ (no tools)       │                        │
 │                           │                    │ → ACCEPT  │                  │                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ code_     │ list_output_files│                        │
 │                           │                    │ reviewer  │─────────────────►│                        │
 │                           │                    │           │◄─────────────────│                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ reporter  │ write_markdown   │                        │
 │                           │                    │───────────┼─────────────────►│                        │
 │                           │                    │           │◄─────────────────│  .md file written      │
 │                           │                    │           │                  │                        │
 │                           │                    │ ═══ PIPELINE COMPLETE ════════│                        │
 │                           │                    │           │                  │                        │
 │                           │                    │ Store      │                 │                        │
 │                           │                    │ final_answer                 │                        │
 │                           │                    │ status=    │                 │                        │
 │                           │                    │ "completed"│                 │                        │
 │                           │                    └─────┬─────┘                  │                        │
 │                           │                          │                        │                        │
 │  GET /status (poll)       │                          │                        │                        │
 │                           │─────────────────────────►│                        │                        │
 │                           │  {"status":"completed",  │                        │                        │
 │                           │   "report_files":["R.md"]│                        │                        │
 │                           │   "chart_files":[...]}   │                        │                        │
 │                           │◄─────────────────────────│                        │                        │
 │                           │                          │                        │                        │
 │                    ┌──────┴──────┐                   │                        │                        │
 │                    │ Stop polling│                   │                        │                        │
 │                    │ Fetch .md   │                   │                        │                        │
 │                    └──────┬──────┘                   │                        │                        │
 │                           │                          │                        │                        │
 │                           │  GET /reports/{id}/R.md  │                        │                        │
 │                           │─────────────────────────►│                        │                        │
 │                           │  (markdown text)         │                        │                        │
 │                           │◄─────────────────────────│                        │                        │
 │                           │                          │                        │                        │
 │                    ┌──────┴──────┐                   │                        │                        │
 │                    │ Render with │                   │                        │                        │
 │                    │ ReactMD     │                   │                        │                        │
 │                    │ + remark-gfm│                   │                        │                        │
 │                    └──────┬──────┘                   │                        │                        │
 │                           │                          │                        │                        │
 │  Sees completed report    │                          │                        │                        │
 │  with charts & tables     │                          │                        │                        │
 │◄──────────────────────────│                          │                        │                        │
```

---

## Phase 1: User Submits a Question

**What happens in the browser:**

1. User types a question (or clicks a suggestion card)
2. `handleSend()` or `handleSuggestion()` is called
3. Zustand's `sendAnalysis(question)` fires:
   - Creates a new `Conversation` object with a truncated title
   - Adds a user message (green bubble)
   - Adds a placeholder assistant message (with `status: "pending"`)
   - Saves everything to `localStorage`

**What happens on the network:**

4. `POST /api/v1/agentic/analyze` with `{"question": "..."}`
5. FastAPI generates `analysis_id = "51329fe7"`, stores it in `_analyses` dict
6. Launches `_run_analysis_background()` as an `asyncio.create_task`
7. Returns `{"analysis_id": "51329fe7", "status": "running"}` immediately

**Back in the browser:**

8. Stores `analysisId` on the conversation
9. Updates assistant message to `status: "running"`
10. Starts polling `GET /status/51329fe7` every 4 seconds

---

## Phase 2: Agent Pipeline Runs (Background)

The background task does this:

```
1. Connect to MCP Server at localhost:8003
2. Call set_output_directory("51329fe7")
   → Creates output/51329fe7/ folder
3. Fetch all 7 tools from MCP Server
4. Wrap them as LangChain StructuredTools
5. Build the LangGraph: build_graph(tools, api_key)
6. Invoke the graph with the user's question
```

### Agent Execution Detail

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  data_loader_entry                                   │
│    └── Sets current_stage = "data_loader"            │
│                                                      │
│  data_loader                                         │
│    ├── LLM decides: "Load mills 6, 7, 8"            │
│    ├── Calls query_mill_data(6)  → tool_node         │
│    ├── Calls query_mill_data(7)  → tool_node         │
│    ├── Calls query_mill_data(8)  → tool_node         │
│    └── Returns summary → manager_review              │
│                                                      │
│  manager_review                                      │
│    └── Skips for data_loader → ACCEPT                │
│    └── Advances to analyst                           │
│                                                      │
│  analyst_entry                                       │
│    └── Sets current_stage = "analyst"                │
│                                                      │
│  analyst                                             │
│    ├── Calls execute_python("""                      │
│    │     import pandas as pd                         │
│    │     for i in [6,7,8]:                           │
│    │       df = get_df(f'mill_data_{i}')             │
│    │       print(f"Mill {i}: mean={df.Ore.mean()}")  │
│    │     plt.savefig(...)                            │
│    │   """) → tool_node                              │
│    ├── Gets back stdout + new_files                  │
│    ├── May call execute_python again for more charts │
│    └── Returns analysis summary → manager_review     │
│                                                      │
│  manager_review                                      │
│    ├── Reviews analyst output                        │
│    ├── ACCEPT or REWORK (max 1 rework)               │
│    └── Advances to code_reviewer                     │
│                                                      │
│  code_reviewer                                       │
│    ├── Calls list_output_files("png")                │
│    ├── Checks: are there chart files?                │
│    ├── If missing → calls execute_python to fix      │
│    └── Returns validation summary                    │
│                                                      │
│  manager_review → ACCEPT → reporter                  │
│                                                      │
│  reporter                                            │
│    ├── Calls list_output_files() → gets filenames    │
│    ├── Reads all prior messages for statistics       │
│    ├── Calls write_markdown_report(                  │
│    │     filename="Mill_Report.md",                  │
│    │     content="# Mill Analysis Report\n..."       │
│    │   )                                             │
│    └── Returns → manager_review → ACCEPT → END       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Phase 3: Frontend Receives the Result

**Polling detects completion:**

```javascript
// Every 4 seconds:
const data = await fetch(`/api/v1/agentic/status/${analysisId}`).then((r) =>
  r.json(),
);

if (data.status === "completed") {
  // 1. Get file lists
  const reportFiles = data.report_files; // ["Mill_Report.md"]
  const chartFiles = data.chart_files; // ["chart1.png", "chart2.png"]

  // 2. Fetch the markdown content
  const mdRes = await fetch(
    `/api/v1/agentic/reports/${analysisId}/${reportFiles[0]}`,
  );
  const reportMarkdown = await mdRes.text();

  // 3. Update the message in the store
  updateMessage(messageId, {
    status: "completed",
    content: data.final_answer,
    reportFiles,
    chartFiles,
    reportMarkdown, // ← This is what gets rendered
  });

  // 4. Stop polling
  stopPolling();
}
```

**Rendering the report:**

```
ReactMarkdown
  ├── remarkPlugins: [remarkGfm]    ← enables tables
  ├── components: {
  │     p: custom (div if contains img),
  │     img: CollapsibleImage (resolves paths to /api/v1/agentic/reports/{id}/{file})
  │   }
  └── children: reportMarkdown      ← the full .md text
```

**Image resolution:**

When the Markdown contains `![Chart](ore_comparison.png)`, the custom `img` component:

1. Sees that `src` doesn't start with `http` or `/`
2. Prepends the API base: `/api/v1/agentic/reports/51329fe7/ore_comparison.png`
3. The browser fetches the image from FastAPI's `FileResponse`

---

## Data Persistence Summary

| Data                           | Where                                     | Persists?                  |
| ------------------------------ | ----------------------------------------- | -------------------------- |
| Analysis status + final_answer | FastAPI `_analyses` dict (in-memory)      | ❌ Lost on server restart  |
| Output files (.md, .png)       | Disk: `python/agentic/output/{id}/`       | ✅ Survives restarts       |
| Conversations + messages       | Browser `localStorage`                    | ✅ Survives page refreshes |
| User-saved prompts             | SQLite: `python/prompts.db`               | ✅ Survives restarts       |
| Loaded DataFrames              | MCP Server `_dataframes` dict (in-memory) | ❌ Lost on MCP restart     |

---

## Error Flow

```
Error at any point in the pipeline
        │
        ▼
  _run_analysis_background catches exception
        │
        ▼
  _analyses[id]["status"] = "failed"
  _analyses[id]["error"] = str(e)
        │
        ▼
  Frontend polls → sees status="failed"
        │
        ▼
  Updates message: "Анализът е неуспешен: {error}"
  Sets conversation status = "failed"
  Stops polling
```

---

## Cleanup Flow

When the user deletes a conversation:

```
User clicks delete
        │
        ▼
  chat-store.deleteConversation(id)
        │
        ├── Stop polling (if running)
        ├── DELETE /api/v1/agentic/analysis/{analysisId}
        │       └── Removes output/{id}/ folder
        │       └── Removes from _analyses dict
        ├── Remove from conversations array
        └── Save to localStorage
```

---

## Next

→ **[07 — Code Reference](./07_code_reference.md)** — Key functions documented in detail
