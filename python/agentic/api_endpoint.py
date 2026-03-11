"""
api_endpoint.py — FastAPI endpoint for UI integration
=======================================================
Exposes the agentic analysis system as a REST API:
  - POST /api/v1/agentic/analyze  : Submit an analysis request
  - GET  /api/v1/agentic/reports  : List generated reports and charts
  - GET  /api/v1/agentic/reports/{filename} : Download a specific file

This is designed to be mounted into the main api.py later.
The MCP server must be running on port 8003 for this to work.
"""

import asyncio
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from client import get_mcp_tools
from graph import build_graph

router = APIRouter(prefix="/api/v1/agentic", tags=["agentic"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
SERVER_URL = "http://localhost:8003/mcp"

# ── In-flight analysis tracking ──────────────────────────────────────────────
_analyses: dict[str, dict] = {}


# ── Request / Response models ────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    question: str = Field(..., description="Analysis question or request for the agents")
    mill_number: Optional[int] = Field(None, description="Specific mill number (1-12) if relevant")
    start_date: Optional[str] = Field(None, description="Start date ISO format")
    end_date: Optional[str] = Field(None, description="End date ISO format")


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    message: str
    started_at: str


class AnalysisResult(BaseModel):
    analysis_id: str
    status: str
    question: str
    final_answer: Optional[str] = None
    report_files: list[str] = []
    chart_files: list[str] = []
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
    }

    # Run analysis in background
    asyncio.create_task(_run_analysis_background(analysis_id, full_prompt))

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

    # List output files
    report_files = []
    chart_files = []
    if os.path.exists(OUTPUT_DIR):
        for f in sorted(os.listdir(OUTPUT_DIR)):
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
        started_at=entry["started_at"],
        completed_at=entry.get("completed_at"),
        error=entry.get("error"),
    )


@router.get("/reports")
async def list_reports():
    """List all generated reports and charts in the output directory."""
    if not os.path.exists(OUTPUT_DIR):
        return {"files": [], "count": 0}

    files = []
    for f in sorted(os.listdir(OUTPUT_DIR)):
        full_path = os.path.join(OUTPUT_DIR, f)
        if os.path.isfile(full_path) and not f.startswith("."):
            files.append({
                "name": f,
                "size_kb": round(os.path.getsize(full_path) / 1024, 1),
                "type": "report" if f.endswith(".md") else "chart" if f.endswith(".png") else "other",
            })

    return {"count": len(files), "files": files}


@router.get("/reports/{filename}")
async def get_report_file(filename: str):
    """Download a specific report or chart file."""
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    return FileResponse(file_path)


# ── Background analysis runner ───────────────────────────────────────────────

async def _run_analysis_background(analysis_id: str, prompt: str) -> None:
    """Run the multi-agent analysis pipeline in the background."""
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not configured")

        async with streamable_http_client(SERVER_URL) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                langchain_tools = await get_mcp_tools(session)
                graph = build_graph(langchain_tools, api_key)

                final_state = await graph.ainvoke(
                    {"messages": [HumanMessage(content=prompt)]},
                    config={
                        "configurable": {"thread_id": analysis_id},
                        "recursion_limit": 50,
                    },
                )

                final_answer = final_state["messages"][-1].content
                _analyses[analysis_id]["status"] = "completed"
                _analyses[analysis_id]["final_answer"] = final_answer
                _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()

    except Exception as e:
        _analyses[analysis_id]["status"] = "failed"
        _analyses[analysis_id]["error"] = str(e)
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
