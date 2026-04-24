# Agentic Subproject — Documentation Index

This folder documents the **`python/agentic/`** subproject: a multi-agent data-analysis
system for the Ellatzite ore-dressing plant (12 ball mills). It combines:

- **MCP** (Model Context Protocol) — transport layer for tool calls
- **LangGraph** — stateful orchestration of multiple LLM "specialist" agents
- **Gemini** (`langchain-google-genai`) — the LLM backbone
- **Pandas / scikit-learn / Prophet / statsmodels / SHAP** — the scientific stack
- **FastAPI** — REST surface consumed by the Next.js `ai-chat` page

## Reading order

| # | Document | What it covers |
|---|----------|----------------|
| 00 | `00_index.md` | This file. |
| 01 | `01_overview.md` | What the system does, when to use it, the user-facing flow. |
| 02 | `02_architecture.md` | High-level component diagram and data flow. |
| 03 | `03_mcp_server_and_client.md` | `server.py` + `client.py`: how MCP tools become LangChain tools. |
| 04 | `04_tools_reference.md` | Every MCP tool: inputs, outputs, examples. |
| 05 | `05_domain_knowledge.md` | Plant variables, specs, shifts, mills. |
| 06 | `06_skills_library.md` | The `skills/` package — tested pandas/sklearn functions. |
| 07 | `07_langgraph_pipeline.md` | `graph_v3.py` state, nodes, routing. |
| 08 | `08_specialists.md` | Each specialist agent and its prompt. |
| 09 | `09_planner_and_manager.md` | Dynamic pipeline selection + quality review loop. |
| 10 | `10_followup_conversations.md` | The follow-up graph and conversation persistence. |
| 11 | `11_analysis_templates.md` | Pre-defined specialist pipelines (bypass the planner). |
| 12 | `12_api_endpoint.md` | FastAPI routes consumed by the frontend. |
| 13 | `13_output_management.md` | Per-analysis output folders, file serving, cleanup. |
| 14 | `14_request_lifecycle.md` | End-to-end sequence of a single analysis. |
| 15 | `15_configuration.md` | `.env`, context budgets, UI settings. |
| 16 | `16_extending.md` | How to add a new tool / skill / specialist / template. |

## Quick start

```powershell
# 1. Install Python deps (see agentic/requirements.txt)
pip install -r python/agentic/requirements.txt

# 2. Configure .env at repo root
# GOOGLE_API_KEY=...
# DB_HOST=em-m-db4.ellatzite-med.com
# DB_NAME=em_pulse_data
# DB_USER=...
# DB_PASSWORD=...

# 3. Start the MCP tool server (port 8003)
python python/agentic/server.py

# 4. Either run the CLI demo...
python python/agentic/main.py

# 4b. ...or start the FastAPI endpoint mounted into the main API
#     (handled automatically by python/api.py when GOOGLE_API_KEY is set)
```

The Next.js UI at `/ai-chat` will call `POST /api/v1/agentic/analyze` and poll
`GET /api/v1/agentic/status/{id}` every 4 seconds until the analysis completes.

## File-to-doc map

| Source file | Documented in |
|-------------|---------------|
| `server.py` | 03 |
| `client.py` | 03 |
| `tools/db_tools.py` | 04, 05 |
| `tools/python_executor.py` | 04, 06 |
| `tools/report_tools.py` | 04, 13 |
| `tools/session_tools.py` + `output_dir.py` | 04, 13 |
| `tools/domain_knowledge.py` | 04, 05 |
| `tools/skill_registry.py` | 04, 06 |
| `skills/*.py` | 06 |
| `graph_v3.py` (main graph) | 07, 08, 09 |
| `graph_v3.py` (follow-up graph) | 10 |
| `analysis_templates.py` | 11 |
| `api_endpoint.py` | 12, 13, 14 |
| `main.py` | 14 (CLI variant) |
