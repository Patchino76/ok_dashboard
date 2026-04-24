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
from client import get_mcp_tools
from graph_v3 import build_graph, build_followup_graph

# Load .env from project root (two levels up: agentic → python → project root)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

router = APIRouter(prefix="/api/v1/agentic", tags=["agentic"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8003/mcp")

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

    fa = entry.get("final_answer")
    if fa is not None and not isinstance(fa, str):
        fa = _content_to_str(fa)

    return AnalysisResult(
        analysis_id=analysis_id,
        status=entry["status"],
        question=entry["question"],
        final_answer=fa,
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


def _content_to_str(content) -> str:
    """Flatten LangChain message content to a plain string.

    Gemini sometimes returns content as a list of dicts like
    [{'type': 'text', 'text': '...'}]. Pydantic's str-typed fields reject that.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(item.get("text", "") or item.get("content", "") or "")
            else:
                parts.append(str(item))
        return "\n".join(p for p in parts if p).strip()
    return str(content) if content is not None else ""


def _serialize_messages(messages) -> list[dict]:
    """Serialize LangChain messages to dicts for follow-up context.

    Strips ToolMessages and AIMessages with tool_calls to avoid orphaned
    tool-call references that would break LLM validation on follow-up.
    Keeps only clean HumanMessage and AIMessage content.
    """
    serialized = []
    for msg in messages:
        msg_type = type(msg).__name__
        # Skip tool messages (they require tool_call_id that we don't serialize)
        if msg_type == "ToolMessage":
            continue
        # Skip AIMessages that only contain tool calls (no useful content)
        if msg_type == "AIMessage" and getattr(msg, "tool_calls", None):
            continue
        content = _content_to_str(msg.content)
        if not content or not content.strip():
            continue
        entry = {"type": msg_type, "content": content}
        if hasattr(msg, "name") and msg.name:
            entry["name"] = msg.name
        serialized.append(entry)
    return serialized


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
                graph = build_graph(
                    langchain_tools, api_key,
                    on_progress=on_progress,
                    settings=settings,
                    template_id=template_id,
                )

                final_state = await graph.ainvoke(
                    {"messages": [HumanMessage(content=prompt)]},
                    config={
                        "configurable": {"thread_id": analysis_id},
                        "recursion_limit": 150,
                    },
                )

                final_answer = _content_to_str(final_state["messages"][-1].content)
                # Store serialized messages for follow-up conversations
                _analyses[analysis_id]["conversation_history"] = _serialize_messages(
                    final_state["messages"]
                )
                _analyses[analysis_id]["status"] = "completed"
                _analyses[analysis_id]["final_answer"] = final_answer
                _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
                on_progress("system", "✓ Анализът е завършен.")

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"\n========== ANALYSIS FAILED ({analysis_id}) ==========")
        print(tb)
        print("=====================================================\n")
        _analyses[analysis_id]["status"] = "failed"
        _analyses[analysis_id]["error"] = str(e)
        _analyses[analysis_id]["traceback"] = tb
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
        on_progress("system", f"✗ Грешка при анализа: {str(e)[:200]}")


def _rebuild_messages(history: list[dict]) -> list:
    """Rebuild LangChain message objects from serialized conversation history.

    Defensively skips ToolMessage entries and entries with empty content so
    that old histories (serialized before the filter was added) still work.
    """
    from langchain_core.messages import AIMessage, SystemMessage
    _type_map = {
        "HumanMessage": HumanMessage,
        "AIMessage": AIMessage,
        "SystemMessage": SystemMessage,
    }
    messages = []
    for entry in history:
        # Skip tool messages — they'd have orphaned tool_call_ids
        if entry.get("type") == "ToolMessage":
            continue
        content = entry.get("content", "")
        if not content or not content.strip():
            continue
        cls = _type_map.get(entry["type"], HumanMessage)
        try:
            messages.append(cls(content=content))
        except Exception:
            messages.append(HumanMessage(content=content))
    return messages


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

        # Retrieve conversation history from the original analysis
        original = _analyses.get(analysis_id, {})
        history = original.get("conversation_history", [])
        if not history:
            raise ValueError(f"No conversation history found for analysis {analysis_id}")

        # Rebuild message objects and keep only the last N for context
        prior_messages = _rebuild_messages(history)[-30:]

        print(f"\n[followup] analysis_id={analysis_id} followup_id={followup_id}")
        print(f"[followup] history entries: {len(history)} | rebuilt: {len(prior_messages)}")
        print(f"[followup] rebuilt types: {[type(m).__name__ for m in prior_messages]}")
        print(f"[followup] question: {question[:120]}")

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
                graph = build_followup_graph(
                    langchain_tools, api_key,
                    on_progress=on_progress,
                )

                # Pass prior conversation + new question as initial messages
                initial_messages = prior_messages + [HumanMessage(content=question)]

                final_state = await graph.ainvoke(
                    {"messages": initial_messages},
                    config={
                        "configurable": {"thread_id": followup_id},
                        "recursion_limit": 50,
                    },
                )

                final_answer = _content_to_str(final_state["messages"][-1].content)
                # Update conversation history with follow-up messages
                _analyses[analysis_id]["conversation_history"] = _serialize_messages(
                    final_state["messages"]
                )
                _analyses[followup_id]["status"] = "completed"
                _analyses[followup_id]["final_answer"] = final_answer
                _analyses[followup_id]["completed_at"] = datetime.now().isoformat()
                on_progress("followup", "✓ Допълнителният анализ е завършен.")

    except BaseException as e:
        import traceback
        tb = traceback.format_exc()
        print(f"\n========== FOLLOWUP FAILED ({followup_id}) ==========")
        print(f"Exception type: {type(e).__name__}")
        print(tb)
        # If it's an ExceptionGroup, drill into sub-exceptions
        if hasattr(e, "exceptions"):
            for i, sub in enumerate(e.exceptions):
                print(f"--- Sub-exception {i}: {type(sub).__name__} ---")
                print("".join(traceback.format_exception(type(sub), sub, sub.__traceback__)))
        print("=====================================================\n")
        _analyses[followup_id]["status"] = "failed"
        _analyses[followup_id]["error"] = str(e)
        _analyses[followup_id]["traceback"] = tb
        _analyses[followup_id]["completed_at"] = datetime.now().isoformat()
        on_progress("followup", f"✗ Грешка: {str(e)[:200]}")
