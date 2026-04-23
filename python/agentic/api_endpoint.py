"""
api_endpoint.py — FastAPI endpoint for UI integration
=======================================================
Exposes the agentic analysis system as a REST API:
  - POST /api/v1/agentic/analyze        : Submit an analysis request
  - POST /api/v1/agentic/followup/{id}  : Send a follow-up question
  - GET  /api/v1/agentic/status/{id}    : Check analysis status
  - GET  /api/v1/agentic/reports        : List generated reports and charts
  - GET  /api/v1/agentic/reports/{filename} : Download a specific file

This is designed to be mounted into the main api.py later.
The MCP server must be running on port 8003 for this to work.

Uses SqliteSaver for LangGraph checkpointing so follow-up conversations
can resume from any completed analysis.
"""

import asyncio
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from client import get_mcp_tools
from graph_v3 import build_graph, build_followup_graph

# Load .env from project root (two levels up: agentic → python → project root)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

router = APIRouter(prefix="/api/v1/agentic", tags=["agentic"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8003/mcp")
CHECKPOINTS_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints.db")

# ── In-flight analysis tracking ──────────────────────────────────────────────
_analyses: dict[str, dict] = {}


# ── Request / Response models ────────────────────────────────────────────────

class AnalysisSettings(BaseModel):
    maxToolOutputChars: int = Field(4000, description="Max chars from tool output")
    maxAiMessageChars: int = Field(4000, description="Max chars per AI message in history")
    maxMessagesWindow: int = Field(20, description="Max messages in context window")
    maxSpecialistIterations: int = Field(5, description="Max iterations per specialist")


class AnalysisRequest(BaseModel):
    question: str = Field(..., description="Analysis question or request for the agents")
    mill_number: Optional[int] = Field(None, description="Specific mill number (1-12) if relevant")
    start_date: Optional[str] = Field(None, description="Start date ISO format")
    end_date: Optional[str] = Field(None, description="End date ISO format")
    settings: Optional[AnalysisSettings] = Field(None, description="Analysis context budget settings")
    template_id: Optional[str] = Field(None, description="Pre-defined analysis template ID")


class FollowUpRequest(BaseModel):
    question: str = Field(..., description="Follow-up question or instruction")


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    message: str
    started_at: str


class ProgressMessage(BaseModel):
    timestamp: str
    stage: str
    message: str


class AnalysisResult(BaseModel):
    analysis_id: str
    status: str
    question: str
    final_answer: Optional[str] = None
    report_files: list[str] = []
    chart_files: list[str] = []
    progress: list[ProgressMessage] = []
    started_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

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
        "progress": [],
    }

    # Prepare settings dict for graph builder
    settings_dict = None
    if request.settings:
        settings_dict = request.settings.model_dump()

    # Run analysis in background
    asyncio.create_task(_run_analysis_background(
        analysis_id, full_prompt,
        settings=settings_dict,
        template_id=request.template_id,
    ))

    return AnalysisResponse(
        analysis_id=analysis_id,
        status="running",
        message="Analysis started. Use GET /api/v1/agentic/status/{analysis_id} to check progress.",
        started_at=_analyses[analysis_id]["started_at"],
    )


@router.get("/status/{analysis_id}", response_model=AnalysisResult)
async def get_analysis_status(analysis_id: str):
    """Check the status of a running or completed analysis."""
    if analysis_id not in _analyses:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")

    entry = _analyses[analysis_id]

    # Resolve output folder — follow-ups use the parent analysis's folder
    parent_id = entry.get("parent_analysis_id", analysis_id)
    analysis_dir = os.path.join(OUTPUT_DIR, parent_id)
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
        progress=entry.get("progress", []),
        started_at=entry["started_at"],
        completed_at=entry.get("completed_at"),
        error=entry.get("error"),
    )


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


@router.post("/followup/{analysis_id}", response_model=AnalysisResponse)
async def send_followup(analysis_id: str, request: FollowUpRequest):
    """Send a follow-up question to refine or extend an existing analysis."""
    # Verify the original analysis exists and is completed
    original = _analyses.get(analysis_id)
    if not original:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    if original["status"] not in ("completed", "failed"):
        raise HTTPException(status_code=400, detail=f"Analysis {analysis_id} is still {original['status']}")

    followup_id = f"{analysis_id}-f{str(uuid.uuid4())[:4]}"

    _analyses[followup_id] = {
        "status": "running",
        "question": request.question,
        "parent_analysis_id": analysis_id,
        "started_at": datetime.now().isoformat(),
        "final_answer": None,
        "error": None,
        "completed_at": None,
        "progress": [],
    }

    asyncio.create_task(_run_followup_background(
        analysis_id, followup_id, request.question,
    ))

    return AnalysisResponse(
        analysis_id=followup_id,
        status="running",
        message="Follow-up started. Use GET /api/v1/agentic/status/{followup_id} to check progress.",
        started_at=_analyses[followup_id]["started_at"],
    )


@router.get("/templates")
async def get_templates():
    """List all available analysis templates."""
    from analysis_templates import list_templates
    return {"templates": list_templates()}


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


# ── Background analysis runner ───────────────────────────────────────────────

def _make_progress_callback(analysis_id: str) -> Callable[[str, str], None]:
    """Create a callback that appends progress messages for a given analysis."""
    def on_progress(stage: str, message: str) -> None:
        entry = _analyses.get(analysis_id)
        if entry is not None:
            entry["progress"].append({
                "timestamp": datetime.now().isoformat(),
                "stage": stage,
                "message": message,
            })
    return on_progress


async def _run_analysis_background(
    analysis_id: str,
    prompt: str,
    settings: dict | None = None,
    template_id: str | None = None,
) -> None:
    """Run the multi-agent analysis pipeline in the background."""
    on_progress = _make_progress_callback(analysis_id)
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not configured")

        on_progress("system", "Подготовка на анализа...")

        async with streamable_http_client(SERVER_URL) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # Configure per-analysis output subfolder on the MCP server
                await session.call_tool(
                    "set_output_directory",
                    {"analysis_id": analysis_id},
                )

                on_progress("system", "Стартиране на AI специалисти...")

                langchain_tools = await get_mcp_tools(session)

                async with AsyncSqliteSaver.from_conn_string(CHECKPOINTS_DB) as checkpointer:
                    graph = build_graph(
                        langchain_tools, api_key,
                        on_progress=on_progress,
                        settings=settings,
                        template_id=template_id,
                        checkpointer=checkpointer,
                    )

                    final_state = await graph.ainvoke(
                        {"messages": [HumanMessage(content=prompt)]},
                        config={
                            "configurable": {"thread_id": analysis_id},
                            "recursion_limit": 150,
                        },
                    )

                final_answer = final_state["messages"][-1].content
                _analyses[analysis_id]["status"] = "completed"
                _analyses[analysis_id]["final_answer"] = final_answer
                _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
                on_progress("system", "✓ Анализът е завършен.")

    except Exception as e:
        _analyses[analysis_id]["status"] = "failed"
        _analyses[analysis_id]["error"] = str(e)
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
        on_progress("system", f"✗ Грешка при анализа: {str(e)[:200]}")


async def _run_followup_background(
    analysis_id: str,
    followup_id: str,
    question: str,
) -> None:
    """Run a follow-up question against an existing analysis session."""
    on_progress = _make_progress_callback(followup_id)
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not configured")

        on_progress("followup", "Обработка на допълнителен въпрос...")

        async with streamable_http_client(SERVER_URL) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # Ensure output directory matches the original analysis
                await session.call_tool(
                    "set_output_directory",
                    {"analysis_id": analysis_id},
                )

                langchain_tools = await get_mcp_tools(session)

                async with AsyncSqliteSaver.from_conn_string(CHECKPOINTS_DB) as checkpointer:
                    graph = build_followup_graph(
                        langchain_tools, api_key,
                        on_progress=on_progress,
                        checkpointer=checkpointer,
                    )

                    # The follow-up graph uses the same thread_id as the original
                    # analysis, but with a different graph structure. We pass the
                    # user's follow-up question as a new HumanMessage.
                    # Use a follow-up-specific thread to avoid corrupting the
                    # original graph's checkpoint (different state schemas).
                    followup_thread_id = f"{analysis_id}_followup"

                    final_state = await graph.ainvoke(
                        {"messages": [HumanMessage(content=question)]},
                        config={
                            "configurable": {"thread_id": followup_thread_id},
                            "recursion_limit": 50,
                        },
                    )

                final_answer = final_state["messages"][-1].content
                _analyses[followup_id]["status"] = "completed"
                _analyses[followup_id]["final_answer"] = final_answer
                _analyses[followup_id]["completed_at"] = datetime.now().isoformat()
                on_progress("followup", "✓ Допълнителният анализ е завършен.")

    except Exception as e:
        _analyses[followup_id]["status"] = "failed"
        _analyses[followup_id]["error"] = str(e)
        _analyses[followup_id]["completed_at"] = datetime.now().isoformat()
        on_progress("followup", f"✗ Грешка: {str(e)[:200]}")
