# 15 — Configuration

Everything that varies between environments or runs is configurable through
one of three surfaces:

1. **`.env` file** at the repo root — secrets and connection strings.
2. **Module-level constants** in `graph_v3.py` and `tools/db_tools.py` —
   defaults for budgets and connections.
3. **`AnalysisSettings` per request** — the UI's settings panel overrides
   the per-analysis context budgets.

## Environment variables (`.env`)

Loaded with `python-dotenv` from the repo root:

```python
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)
```

| Variable | Used by | Default fallback | Required? |
|----------|---------|------------------|-----------|
| `GOOGLE_API_KEY` | `graph_v3.ChatGoogleGenerativeAI` | — | **Yes** |
| `MCP_SERVER_URL` | `api_endpoint.py`, `main.py`, `client.py` | `http://localhost:8003/mcp` | No |
| `DB_HOST` | `tools/db_tools._get_db_connector` / `_get_engine` | `em-m-db4.ellatzite-med.com` | No |
| `DB_PORT` | ↑ | `5432` | No |
| `DB_NAME` | ↑ | `em_pulse_data` | No |
| `DB_USER` | ↑ | `s.lyubenov` | No |
| `DB_PASSWORD` | ↑ | *(hard-coded fallback present — override in prod)* | No |

> The hard-coded database fallback in `db_tools.py` is a convenience for
> local development. In production set `DB_*` explicitly in `.env` so the
> fallback never matters.

### Minimum viable `.env`

```env
GOOGLE_API_KEY=AIza…
DB_HOST=em-m-db4.ellatzite-med.com
DB_PORT=5432
DB_NAME=em_pulse_data
DB_USER=your_user
DB_PASSWORD=your_password
# Optional:
# MCP_SERVER_URL=http://localhost:8003/mcp
```

## Model selection

```python
# graph_v3.py
GEMINI_MODEL = "gemini-3.1-flash-lite-preview"
```

Single place to switch Gemini variants. All agents (specialists, planner,
manager, follow-up router, follow-up executor) use the same model instance
built from this constant.

## Module-level budget defaults

`graph_v3.py`:

```python
MAX_TOOL_OUTPUT_CHARS  = 2000   # overridden to 4000 when settings are provided
MAX_AI_MSG_CHARS       = 3000   # overridden to 4000 when settings are provided
MAX_MESSAGES_WINDOW    = 14     # overridden to 20 via settings
MAX_SPECIALIST_ITERS   = 5

MAX_REWORKS_PER_STAGE  = 1
```

Note that the Pydantic model `AnalysisSettings` has *slightly different*
defaults (4000/4000/20/5). Those apply whenever the request carries a
`settings` block. The module constants are used when no settings are
supplied (e.g. the CLI `main.py`).

## Per-request `AnalysisSettings`

```python
class AnalysisSettings(BaseModel):
    maxToolOutputChars:      int = 4000
    maxAiMessageChars:       int = 4000
    maxMessagesWindow:       int = 20
    maxSpecialistIterations: int = 5
```

Passed through `POST /analyze → _run_analysis_background → build_graph`:

```python
_settings = settings or {}
_MAX_TOOL_OUTPUT_CHARS  = _settings.get("maxToolOutputChars",     MAX_TOOL_OUTPUT_CHARS)
_MAX_AI_MSG_CHARS       = _settings.get("maxAiMessageChars",      MAX_AI_MSG_CHARS)
_MAX_MESSAGES_WINDOW    = _settings.get("maxMessagesWindow",      MAX_MESSAGES_WINDOW)
_MAX_SPECIALIST_ITERS   = _settings.get("maxSpecialistIterations", MAX_SPECIALIST_ITERS)
```

The values are captured in closures inside `build_graph`, so every call to
`compress_messages` / `build_focused_context` / specialist nodes sees the
request-specific limits without global mutation.

### Knobs on the UI

The settings panel in `src/app/ai-chat/components/settings-panel.tsx` exposes
all four fields. Values are persisted in `localStorage` via Zustand
(`src/app/ai-chat/stores/settings-store.ts`) and attached to every analyze
request body.

### Tuning guide

| Symptom | Knob to turn |
|---------|--------------|
| Specialists truncate results before finishing | ↑ `maxToolOutputChars` |
| Reporter forgets numbers from earlier specialists | ↑ `maxAiMessageChars` *or* ↑ `maxMessagesWindow` |
| Analysis times out / costs too much | ↓ `maxSpecialistIterations` (to 3) or use a narrower template |
| Tool error floods the context | ↓ `maxToolOutputChars` (to 2000) |
| Rework loops never resolve | Keep `MAX_REWORKS_PER_STAGE = 1` (increasing rarely helps) |

## Output budget: `8000` and `4000`

Two static limits inside `tools/python_executor.py`:

```python
result = {"stdout": stdout_output[:8000] if stdout_output else "", …}
if error_msg:
    result["error"] = error_msg[:4000]
```

These happen **before** LangGraph's compression, so the server-side cap is
`8000 + 4000` chars per `execute_python` result regardless of UI settings.

## `recursion_limit`

Hard cap on total LangGraph node visits:

| Flow | Value | Set in |
|------|-------|--------|
| Main analysis | `150` | `api_endpoint._run_analysis_background`, `main.run_analysis` |
| Follow-up | `50` | `api_endpoint._run_followup_background` |

With 6 fixed stages (data_loader, planner, code_reviewer, reporter + their
entries) plus up to 4 specialist stages × (1 LLM + 5 tool rounds + 1 manager
review + optional rework), 150 is comfortably above the worst case.

If you raise the specialist iteration cap substantially, consider raising
`recursion_limit` in lockstep.

## Logging

No dedicated logging framework is used. All diagnostic output is plain
`print(...)` statements:

- MCP server startup prints the tool registry.
- Each specialist / manager / planner prints iteration counts, context
  sizes, tool names, decisions.
- Background runners print full tracebacks on failure.

In production this is captured by whatever process supervisor runs the
Python processes (systemd, pm2, docker logs, …).

## Other config knobs worth knowing

| Where | What | Default |
|-------|------|---------|
| `graph_v3.SPECIALIST_POOL` | Which specialists the planner may choose | 6 specialists |
| `graph_v3._AUTO_ACCEPT_STAGES` | Stages the manager skips LLM review for | `{data_loader, planner, code_reviewer, reporter}` |
| `graph_v3.FIXED_PREFIX` / `FIXED_SUFFIX` | Stages inserted around the planner's choices | `[data_loader, planner]` / `[code_reviewer, reporter]` |
| `api_endpoint.OUTPUT_DIR` | Root for output subfolders | `<agentic>/output` |
| `client.py` | JSON-schema-to-Pydantic type map | `integer → int`, `number → float`, `boolean → bool`, else `str` |

All of these are deliberate single-definition points — edit them in one
place and the change propagates throughout.

## Things that are *not* configurable (yet)

- **Gemini temperature / generation params** — use defaults from
  `ChatGoogleGenerativeAI`. Wire through `build_graph` if you need control.
- **Database pool size** — each `_get_engine()` call creates a one-shot
  engine and disposes it. Fine for low concurrency.
- **Output retention policy** — no TTL on `output/{id}`. Clean up manually or
  add a cron job.
- **Concurrent analyses per MCP server** — see warning in **13 — Output
  Management**.
