# 13 — Output Management

Every analysis gets its own subfolder of `python/agentic/output/`. Charts and
the final Markdown report land there and are served read-only to the
frontend. This page documents the full lifecycle of that folder.

## Directory layout

```
python/agentic/output/
├── ab12cd34/                  ← analysis_id (8-char UUID)
│   ├── distribution_plots.png
│   ├── correlation_heatmap.png
│   ├── psi80_xbar_chart.png
│   ├── process_capability_PSI80.png
│   ├── anomaly_timeline.png
│   ├── shift_comparison.png
│   └── mill_8_analysis.md
├── ef56gh78/                  ← another analysis
│   └── …
└── ab12cd34-f7e0/             ← follow-ups do NOT get their own folder;
                                 follow-up outputs land inside ab12cd34/
```

Follow-ups re-use the parent's folder (see **10 — Follow-Up Conversations**),
so the Markdown report's relative image links keep working when the user
asks for edits.

## The state machine

```
┌─────────────────────────────┐
│ server.py boots             │
│ _current_output_dir =       │
│   agentic/output            │
└──────────────┬──────────────┘
               │
               ▼ POST /analyze starts
 set_output_directory("ab12cd34")
               │
               ▼
┌─────────────────────────────┐
│ _current_output_dir =       │
│   agentic/output/ab12cd34   │
│ folder is makedirs()'d      │
└──────────────┬──────────────┘
               │
               ▼ all skill & agent code writes here
        charts + report
               │
               ▼ follow-up arrives
 set_output_directory("ab12cd34")   ← parent id, not followup id
               │
               ▼ new files land in the same folder
```

The server is **stateful across analyses** in this regard: if analysis A
finishes and analysis B doesn't call `set_output_directory`, B will write
into A's folder. The API always makes that call first, so in practice this
is not an issue — but it is a caveat for anyone running the server by hand.

## The owning module: `tools/output_dir.py`

```python
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_OUTPUT_DIR = os.path.join(BASE_DIR, "output")

_current_output_dir: str = _DEFAULT_OUTPUT_DIR

def get_output_dir() -> str:                 # read + ensure exists
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir

def set_output_dir(subdir: str) -> str:      # switch to subfolder
    global _current_output_dir
    _current_output_dir = os.path.join(_DEFAULT_OUTPUT_DIR, subdir)
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir

def reset_output_dir() -> None:              # back to default (unused in prod)
    global _current_output_dir
    _current_output_dir = _DEFAULT_OUTPUT_DIR
```

Every other output-aware tool reads `get_output_dir()` — never a hard-coded
path. This is why you can rewire the output location from a single place.

## Writers

| Writer | How it writes |
|--------|---------------|
| Skills | `plt.savefig(os.path.join(output_dir, "chart.png"), dpi=150, bbox_inches='tight')` + `plt.close()`. `output_dir` is passed explicitly by the agent (usually `OUTPUT_DIR`, injected into the `execute_python` namespace). |
| Raw agent code in `execute_python` | Same pattern. `OUTPUT_DIR` is always available in the namespace. |
| `write_markdown_report` | `open(os.path.join(get_output_dir(), filename), "w", encoding="utf-8")`. |
| `list_output_files` | `os.listdir(get_output_dir())` with optional extension filter. |

## Reading from the API

### `GET /reports`

Walks every subfolder of `output/` and returns:

```json
{
  "count": 42,
  "files": [
    {"name": "chart.png", "analysis_id": "ab12cd34", "size_kb": 87.3, "type": "chart"},
    {"name": "mill_8.md", "analysis_id": "ab12cd34", "size_kb": 12.1, "type": "report"},
    …
  ]
}
```

Unused by the current UI, but useful for admin / debugging.

### `GET /reports/{analysis_id}/{filename}`

```python
file_path = os.path.join(OUTPUT_DIR, analysis_id, filename)
if not os.path.exists(file_path):
    # backward-compat: files that were in output/ before subfolders existed
    fallback = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(fallback):
        return FileResponse(fallback)
    raise HTTPException(404)
return FileResponse(file_path)
```

Served via FastAPI's `FileResponse`, which sets correct content types
(`image/png`, `text/markdown`) and handles `ETag` / range requests.

### `GET /status/{analysis_id}`

Walks only the **parent** analysis's folder:

```python
parent_id    = entry.get("parent_analysis_id", analysis_id)
analysis_dir = os.path.join(OUTPUT_DIR, parent_id)

for f in sorted(os.listdir(analysis_dir)):
    if f.endswith(".md"):  report_files.append(f)
    elif f.endswith(".png"): chart_files.append(f)
```

`report_files` and `chart_files` are plain filenames (no path), which the UI
combines with the parent id to build `/reports/{id}/{file}` URLs.

## Chart references inside the Markdown

Agents are instructed to write image references as bare filenames:

```markdown
![X-bar control chart for PSI80](psi80_xbar_chart.png)
```

The frontend's `react-markdown` pipeline rewrites these to:

```
/api/v1/agentic/reports/ab12cd34/psi80_xbar_chart.png
```

This keeps the Markdown file portable — if you copy it out of the folder, the
images still live next to it and open correctly in any Markdown renderer.

## Cleanup

### `DELETE /api/v1/agentic/analysis/{analysis_id}`

```python
shutil.rmtree(os.path.join(OUTPUT_DIR, analysis_id))   # folder + contents
_analyses.pop(analysis_id, None)                       # in-memory tracking
return {"status": "deleted", "analysis_id": analysis_id}
```

Idempotent — if the folder or the entry is missing, it returns success.

### Manual cleanup

There is no automatic retention policy. Operators can delete old subfolders
manually:

```powershell
Remove-Item -Recurse python\agentic\output\* -Exclude .gitkeep
```

The only file name you must not clobber is `output/` itself (required by the
server's lifespan hook).

## Concurrency caveats

Because `_current_output_dir` is process-global on the MCP server:

- **Running analyses concurrently against the same MCP server corrupts
  outputs.** The second analysis's `set_output_directory` call switches the
  folder globally, and any tool call still in flight from the first analysis
  will write into the wrong place.
- The API serialises this naturally: the background task opens its own MCP
  session per analysis but shares the server process. If you need real
  concurrency, run multiple MCP server instances on different ports and pool
  them in the API.

The existing deployment serves a small team on a single server, so this is a
known limitation, not an urgent problem.

## New-file detection

`execute_python` diffs the output folder before and after each run:

```python
existing_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()
# … exec(code) …
current_files = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()
new_files     = sorted(current_files - existing_files)
```

`new_files` is returned inside the ToolMessage content. This is what
`manager_review._heuristic_check` uses to decide "this specialist produced
charts — auto-accept".

It also gives the reporter a reliable source of filenames via
`list_output_files`, so it never hallucinates image references.
