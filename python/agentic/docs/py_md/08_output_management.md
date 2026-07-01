# 08 — Output Management (Beginner Edition)

> **Goal:** Understand where charts and reports are saved, how the UI fetches them, and how cleanup works when a conversation is deleted.

---

## One folder per analysis

Every analysis gets its own subfolder inside `python/agentic/output/`.

```
python/agentic/output/
├── ab12cd34/                  ← analysis_id (8-char UUID)
│   ├── distribution_plots.png
│   ├── correlation_heatmap.png
│   ├── anomaly_timeline.png
│   └── mill_8_analysis.md
├── ef56gh78/                  ← another analysis
│   └── …
```

**Why separate folders?** So two users analyzing different mills at the same time do not overwrite each other's charts.

---

## How the folder is created

When `POST /analyze` runs, the background task calls an MCP tool before the pipeline starts:

```python
# Inside api_endpoint.py — _run_analysis_background
await session.call_tool("set_output_directory", {"analysis_id": analysis_id})
```

The MCP server receives this and updates its internal state:

```python
# Inside tools/output_dir.py
_current_output_dir = Path("python/agentic/output") / analysis_id
_current_output_dir.mkdir(parents=True, exist_ok=True)
```

From this moment on, every chart and report saved by the AI lands inside `output/ab12cd34/`.

---

## The state machine

```mermaid
stateDiagram-v2
    [*] --> Default : MCP server boots
    Default : output_dir = agentic/output/

    Default --> Scoped : POST /analyze
    Scoped : output_dir = agentic/output/{id}/

    Scoped --> Scoped : AI saves .png + .md
    Scoped --> Scoped : Follow-up re-uses same folder

    Scoped --> Deleted : DELETE /analysis/{id}
    Deleted --> [*]
```

**Key rule:** Follow-ups re-use the parent's folder. If the user asks "Add a forecast chart" after the first report, the new chart lands in the same folder. The Markdown report is updated in place.

---

## How the UI fetches files

The frontend does not know file paths. It only knows the `analysis_id`. When polling `/status/{id}` returns `"completed"`, the response includes a list of files:

```json
{
  "status": "completed",
  "report_files": ["mill_8_analysis.md"],
  "chart_files": [
    "distribution_plots.png",
    "correlation_heatmap.png"
  ]
}
```

The UI then requests each file:

```
GET /api/v1/agentic/reports/ab12cd34/mill_8_analysis.md
GET /api/v1/agentic/reports/ab12cd34/distribution_plots.png
```

FastAPI serves them with `FileResponse`, which streams the bytes directly from disk.

---

## Cleanup

When the user deletes a conversation in the UI, two things happen:

1. **Frontend:** The conversation is removed from Zustand state and localStorage.
2. **Backend:** The UI calls `DELETE /api/v1/agentic/analysis/ab12cd34`.

FastAPI handles the backend cleanup:

```python
# inside api_endpoint.py
shutil.rmtree(output_dir / analysis_id, ignore_errors=True)
```

This removes the folder and all charts/reports inside it. The analysis entry is also deleted from the SQLite database.

---

## What survives a server restart?

| Survives restart | Does NOT survive restart |
|------------------|--------------------------|
| `.png` and `.md` files on disk | `_analyses` dict in memory |
| SQLite conversation history | MCP `_current_output_dir` variable |
| localStorage in the browser | MCP `_dataframes` dict |

---

> **Next step:** `09_configuration.md` to learn about environment variables, context budgets, and UI settings.
