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
import unicodedata
import urllib.parse
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from client import get_mcp_tools
from graph_v3 import build_graph, build_followup_graph
import db as analyses_db

# Load .env from project root (two levels up: agentic → python → project root)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

router = APIRouter(prefix="/api/v1/agentic", tags=["agentic"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8003/mcp")

# Initialize the SQLite analyses DB on import.
analyses_db.init_db()

# ── Role dependency ──────────────────────────────────────────────────
ALLOWED_ROLES = {"mechanic", "technologist", "manager"}


def require_role(
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role: Optional[str] = None,
) -> str:
    """FastAPI dependency: extract and validate the caller's role.

    Accepts the role from either the ``X-User-Role`` header (preferred, set
    by the SPA's ``apiFetch`` helper) OR a ``?role=`` query parameter
    (fallback for native browser flows like <img> / <a download>, and a
    safety net in case a proxy strips custom headers).
    """
    raw = (x_user_role or role or "").strip().lower()
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Missing role (X-User-Role header or ?role= query param)",
        )
    if raw not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{raw}'. Allowed: {sorted(ALLOWED_ROLES)}",
        )
    return raw


def _ensure_role_match(analysis_id: str, role: str) -> str:
    """Look up analysis role; 404 if missing, 403 if it doesn't match the caller.
    Returns the persisted role on success."""
    persisted = analyses_db.get_role(analysis_id)
    if persisted is None:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    if persisted != role:
        raise HTTPException(status_code=403, detail="Analysis belongs to another role")
    return persisted

# ── In-flight analysis tracking ──────────────────────────────────────────────
_analyses: dict[str, dict] = {}


# ── Request / Response models ────────────────────────────────────────────────

class AnalysisSettings(BaseModel):
    maxToolOutputChars: int = Field(4000, description="Max chars from tool output")
    maxAiMessageChars: int = Field(4000, description="Max chars per AI message in history")
    maxMessagesWindow: int = Field(20, description="Max messages in context window")
    maxSpecialistIterations: int = Field(5, description="Max iterations per specialist")
    enableParallelSpecialists: bool = Field(
        False,
        description="Run all selected specialists concurrently after planning. "
                    "Trades per-stage manager review for wall-clock speed.",
    )


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
    # mtime (unix seconds) per filename — lets the UI detect updated files
    # when a follow-up rewrites a same-named .md or regenerates a chart.
    report_files_mtime: dict[str, float] = {}
    chart_files_mtime: dict[str, float] = {}
    progress: list[ProgressMessage] = []
    started_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalysisResponse)
async def start_analysis(request: AnalysisRequest, role: str = Depends(require_role)):
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
    started_at = datetime.now().isoformat()

    # Persist to SQLite (source of truth across browsers / restarts)
    analyses_db.create_analysis(
        analysis_id=analysis_id,
        role=role,
        question=full_prompt,
        started_at=started_at,
        status="running",
    )

    _analyses[analysis_id] = {
        "status": "running",
        "question": full_prompt,
        "role": role,
        "started_at": started_at,
        "final_answer": None,
        "error": None,
        "completed_at": None,
        "progress": [],
    }

    # Prepare settings dict for graph builder.
    # User-supplied settings always win; template budgets fill in any gaps so
    # template-tuned defaults take effect when the UI sliders are at default.
    settings_dict: dict = {}
    if request.template_id:
        from analysis_templates import get_template_budgets
        settings_dict.update(get_template_budgets(request.template_id))
    if request.settings:
        # exclude_unset=True keeps only keys the user actually set so template
        # defaults survive for the rest. Falls back gracefully on Pydantic v1.
        try:
            user_overrides = request.settings.model_dump(exclude_unset=True)
        except TypeError:
            user_overrides = request.settings.model_dump()
        settings_dict.update(user_overrides)

    # Run analysis in background and keep a handle so it can be cancelled
    task = asyncio.create_task(_run_analysis_background(
        analysis_id, full_prompt,
        settings=settings_dict or None,
        template_id=request.template_id,
        role=role,
    ))
    _analyses[analysis_id]["task"] = task

    return AnalysisResponse(
        analysis_id=analysis_id,
        status="running",
        message="Analysis started. Use GET /api/v1/agentic/status/{analysis_id} to check progress.",
        started_at=_analyses[analysis_id]["started_at"],
    )


@router.get("/status/{analysis_id}", response_model=AnalysisResult)
async def get_analysis_status(analysis_id: str, role: str = Depends(require_role)):
    """Check the status of a running or completed analysis."""
    _ensure_role_match(analysis_id, role)

    # Hydrate from DB if process was restarted and in-memory entry is gone.
    if analysis_id not in _analyses:
        row = analyses_db.get_analysis(analysis_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
        _analyses[analysis_id] = {
            "status": row["status"],
            "question": row["question"],
            "role": row["role"],
            "started_at": row["started_at"],
            "final_answer": row["final_answer"],
            "error": row["error"],
            "completed_at": row["completed_at"],
            "progress": [],
            "parent_analysis_id": row["parent_id"] or analysis_id,
        }

    entry = _analyses[analysis_id]

    # Resolve output folder — follow-ups use the parent analysis's folder
    parent_id = entry.get("parent_analysis_id", analysis_id)
    analysis_dir = os.path.join(OUTPUT_DIR, parent_id)
    report_files = []
    chart_files = []
    report_files_mtime: dict[str, float] = {}
    chart_files_mtime: dict[str, float] = {}
    if os.path.exists(analysis_dir):
        for f in sorted(os.listdir(analysis_dir)):
            full = os.path.join(analysis_dir, f)
            if not os.path.isfile(full):
                continue
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                mtime = 0.0
            if f.endswith(".md"):
                report_files.append(f)
                report_files_mtime[f] = mtime
            elif f.endswith(".png"):
                chart_files.append(f)
                chart_files_mtime[f] = mtime

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
        report_files_mtime=report_files_mtime,
        chart_files_mtime=chart_files_mtime,
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
async def get_report_file(
    analysis_id: str,
    filename: str,
    role: Optional[str] = None,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
):
    """Download a specific report or chart file from an analysis subfolder.

    Role-scoped: returns 403 if the analysis belongs to a different role.
    Falls back to the flat output dir for an analysis_id that exists in DB
    but whose files were written before per-analysis subfolders existed.

    Role can be supplied via the X-User-Role header (used by apiFetch) OR
    the ``role`` query parameter (used by native <img> and download links
    that can't set custom headers).
    """
    effective_role = (role or x_user_role or "").strip().lower()
    if not effective_role:
        raise HTTPException(
            status_code=400,
            detail="Missing role (X-User-Role header or ?role= query param)",
        )
    if effective_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{effective_role}'")
    _ensure_role_match(analysis_id, effective_role)
    file_path = os.path.join(OUTPUT_DIR, analysis_id, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)

    # Unicode normalization fallback. The browser sends URL bytes that decode
    # to one Unicode form (typically NFC), but matplotlib / the agents may
    # have written the file under a different normalization (NFD on macOS,
    # mixed forms on Windows when paths come from Cyrillic input). Scan the
    # folder and match by NFC-normalized name so non-ASCII filenames like
    # "oee_trend_Мелница_6.png" resolve regardless of which form was used.
    folder = os.path.join(OUTPUT_DIR, analysis_id)
    if os.path.isdir(folder):
        target_nfc = unicodedata.normalize("NFC", filename)
        try:
            for entry in os.listdir(folder):
                if unicodedata.normalize("NFC", entry) == target_nfc:
                    return FileResponse(os.path.join(folder, entry))
        except OSError as e:
            print(f"[get_report_file] listdir failed for {folder}: {e}")

    # Legacy flat-output fallback (analyses written before per-id subfolders).
    fallback = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(fallback):
        return FileResponse(fallback)

    raise HTTPException(status_code=404, detail=f"File {filename} not found")


# ── Role-scoped conversation listing / hydration ───────────────────────────

@router.get("/conversations")
async def list_conversations(role: str = Depends(require_role)):
    """List root analyses for the caller's role (newest first).

    Used by the UI to render the conversation list shared across browsers
    by all users belonging to the same role.
    """
    rows = analyses_db.list_root_analyses_by_role(role)
    return {"role": role, "count": len(rows), "conversations": rows}


@router.get("/conversations/{analysis_id}/messages")
async def get_conversation_messages(analysis_id: str, role: str = Depends(require_role)):
    """Return the persisted message thread for a conversation.

    The UI calls this when a user selects a conversation from the list so
    that message bubbles can be rendered without relying on local storage.
    """
    _ensure_role_match(analysis_id, role)
    messages = analyses_db.get_messages(analysis_id)
    return {"analysis_id": analysis_id, "messages": messages}


@router.post("/followup/{analysis_id}", response_model=AnalysisResponse)
async def send_followup(analysis_id: str, request: FollowUpRequest, role: str = Depends(require_role)):
    """Send a follow-up question to refine or extend an existing analysis."""
    print(f"\n[send_followup] received analysis_id={analysis_id!r} "
          f"question_len={len(request.question or '')} "
          f"known_ids={len(_analyses)}")
    try:
        # Role check against persisted DB row (works across restarts).
        _ensure_role_match(analysis_id, role)

        # Hydrate in-memory entry from DB if the server was restarted.
        original = _analyses.get(analysis_id)
        if not original:
            row = analyses_db.get_analysis(analysis_id)
            if row is None:
                raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
            messages = analyses_db.get_messages(analysis_id)
            _analyses[analysis_id] = {
                "status": row["status"],
                "question": row["question"],
                "role": row["role"],
                "started_at": row["started_at"],
                "final_answer": row["final_answer"],
                "error": row["error"],
                "completed_at": row["completed_at"],
                "progress": [],
                "conversation_history": [
                    {"type": m["type"], "content": m["content"]} for m in messages
                ],
                "report_markdown": row["report_md"],
            }
            original = _analyses[analysis_id]

        if original["status"] not in ("completed", "failed"):
            print(f"[send_followup] 400 — status={original['status']!r}")
            raise HTTPException(status_code=400, detail=f"Analysis {analysis_id} is still {original['status']}")

        followup_id = f"{analysis_id}-f{str(uuid.uuid4())[:4]}"
        started_at = datetime.now().isoformat()

        # Persist follow-up row in DB (inherits role, links to parent).
        analyses_db.create_analysis(
            analysis_id=followup_id,
            role=role,
            question=request.question,
            parent_id=analysis_id,
            started_at=started_at,
            status="running",
        )

        _analyses[followup_id] = {
            "status": "running",
            "question": request.question,
            "role": role,
            "parent_analysis_id": analysis_id,
            "started_at": started_at,
            "final_answer": None,
            "error": None,
            "completed_at": None,
            "progress": [],
        }

        task = asyncio.create_task(_run_followup_background(
            analysis_id, followup_id, request.question,
        ))
        _analyses[followup_id]["task"] = task

        print(f"[send_followup] ✓ accepted, followup_id={followup_id}")
        return AnalysisResponse(
            analysis_id=followup_id,
            status="running",
            message="Follow-up started. Use GET /api/v1/agentic/status/{followup_id} to check progress.",
            started_at=_analyses[followup_id]["started_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"\n========== SEND_FOLLOWUP CRASH ==========\n{tb}\n==========================================\n")
        raise HTTPException(status_code=500, detail=f"Follow-up endpoint failed: {e}")


@router.get("/templates")
async def get_templates():
    """List all available analysis templates."""
    from analysis_templates import list_templates
    return {"templates": list_templates()}


@router.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str, role: str = Depends(require_role)):
    """Delete an analysis (and its follow-ups) plus output files."""
    _ensure_role_match(analysis_id, role)

    # Find all follow-up ids before deletion so we can clean their folders too.
    followup_ids = [analysis_id]
    for key in list(_analyses.keys()):
        entry = _analyses.get(key, {})
        if entry.get("parent_analysis_id") == analysis_id and key != analysis_id:
            followup_ids.append(key)

    # Remove output subfolder (root id only — follow-ups share the parent folder)
    analysis_dir = os.path.join(OUTPUT_DIR, analysis_id)
    if os.path.exists(analysis_dir):
        shutil.rmtree(analysis_dir, ignore_errors=True)

    # DB cascade removes follow-ups + messages.
    analyses_db.delete_analysis(analysis_id)

    # Remove from in-memory tracking
    for fid in followup_ids:
        _analyses.pop(fid, None)

    return {"status": "deleted", "analysis_id": analysis_id}


@router.delete("/followup/{followup_id}")
async def delete_followup(followup_id: str, role: str = Depends(require_role)):
    """Delete a single follow-up exchange.

    Performs three coordinated cleanups so the deleted Q+A can never resurface
    in a future follow-up's prompt context:

    1. **Trim the parent's persisted messages** — find the HumanMessage whose
       content matches this follow-up's stored ``question`` and drop it together
       with the contiguous AIMessage(s) that follow, up to (but not including)
       the next HumanMessage. The trimmed sequence is written back to the
       ``messages`` table (replace-and-append semantics of append_messages).
    2. **Delete the follow-up row** — cascades to any rows it owns.
    3. **Invalidate in-memory state** — pop the follow-up entry and clear the
       parent's ``conversation_history`` so the next follow-up rehydrates from
       the freshly trimmed DB rows.

    File cleanup (PNG/MD on disk) is handled separately by the existing
    ``DELETE /reports/{parent}/{filename}`` flow that the SPA already invokes
    in lockstep, so we don't touch the output directory here.
    """
    _ensure_role_match(followup_id, role)

    row = analyses_db.get_analysis(followup_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Follow-up {followup_id} not found")

    parent_id = row.get("parent_id")
    if not parent_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "This is a root analysis, not a follow-up. "
                "Use DELETE /analysis/{id} to remove a whole conversation."
            ),
        )

    followup_question = (row.get("question") or "").strip()

    # ── 1. Trim the parent's persisted message thread ───────────────────────
    parent_messages = analyses_db.get_messages(parent_id)
    trimmed: list[dict] = []
    skipping = False
    found_match = False
    for m in parent_messages:
        mtype = m.get("type", "")
        mcontent = (m.get("content") or "").strip()

        if not skipping:
            # Start dropping at the HumanMessage that matches the follow-up's question.
            if (
                not found_match
                and mtype == "HumanMessage"
                and mcontent == followup_question
                and followup_question
            ):
                skipping = True
                found_match = True
                continue
            trimmed.append(m)
        else:
            # Keep skipping until we hit the next HumanMessage (start of next turn).
            if mtype == "HumanMessage":
                skipping = False
                trimmed.append(m)
            # else: drop AIMessage / ToolMessage tail belonging to this follow-up.

    if found_match:
        # append_messages does DELETE-then-INSERT, so passing the trimmed list
        # replaces the parent's thread atomically. Pass at least one message
        # (the parent's original question) because append_messages early-returns
        # on an empty list, which would leave the old rows in place.
        if trimmed:
            analyses_db.append_messages(parent_id, trimmed)
        else:
            # Defensive: nothing left — wipe the table directly.
            with analyses_db._cursor() as cur:  # type: ignore[attr-defined]
                cur.execute(
                    "DELETE FROM messages WHERE analysis_id = ?", (parent_id,)
                )
        print(
            f"[delete_followup] trimmed parent {parent_id} messages: "
            f"{len(parent_messages)} → {len(trimmed)}"
        )
    else:
        print(
            f"[delete_followup] no matching HumanMessage in parent {parent_id} "
            f"for follow-up question (len={len(followup_question)}); "
            "parent message thread left intact"
        )

    # ── 2. Delete the follow-up row (cascades to its own messages, if any) ──
    analyses_db.delete_analysis(followup_id)

    # ── 3. Invalidate in-memory state so the next follow-up rehydrates ──────
    _analyses.pop(followup_id, None)
    parent_entry = _analyses.get(parent_id)
    if parent_entry is not None:
        parent_entry.pop("conversation_history", None)

    return {
        "status": "deleted",
        "followup_id": followup_id,
        "parent_id": parent_id,
        "parent_messages_remaining": len(trimmed),
    }


@router.post("/cancel/{analysis_id}")
async def cancel_analysis(analysis_id: str, role: str = Depends(require_role)):
    """Cancel a running analysis or follow-up.

    Aborts the underlying asyncio task. Partial artefacts already written to
    the per-analysis output folder are kept intact — the user explicitly
    chose "abort + keep partial artefacts" semantics.
    """
    _ensure_role_match(analysis_id, role)
    entry = _analyses.get(analysis_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")

    if entry["status"] != "running":
        return {
            "status": entry["status"],
            "analysis_id": analysis_id,
            "message": f"Analysis already {entry['status']}, nothing to cancel.",
        }

    task = entry.get("task")
    if task is not None and not task.done():
        task.cancel()
        print(f"[cancel] requested cancellation of {analysis_id}")
    else:
        # No task handle (shouldn't happen) — mark cancelled anyway so the UI
        # stops polling.
        entry["status"] = "cancelled"
        entry["completed_at"] = datetime.now().isoformat()

    return {"status": "cancelling", "analysis_id": analysis_id}


@router.delete("/reports/{analysis_id}/{filename}")
async def delete_report_file(analysis_id: str, filename: str, role: str = Depends(require_role)):
    """Delete a single file from an analysis's output folder.

    Used by the UI's "delete last exchange" button to remove files produced
    by a follow-up the user wants to retry.
    """
    # Basic path-traversal guard: reject anything with separators or ..
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    _ensure_role_match(analysis_id, role)

    file_path = os.path.join(OUTPUT_DIR, analysis_id, filename)
    if not os.path.exists(file_path):
        # Same NFC/NFD normalization fallback as get_report_file — non-ASCII
        # filenames may be stored under a different Unicode form than what
        # the URL decodes to.
        folder = os.path.join(OUTPUT_DIR, analysis_id)
        resolved: Optional[str] = None
        if os.path.isdir(folder):
            target_nfc = unicodedata.normalize("NFC", filename)
            try:
                for entry in os.listdir(folder):
                    if unicodedata.normalize("NFC", entry) == target_nfc:
                        resolved = os.path.join(folder, entry)
                        break
            except OSError as e:
                print(f"[delete_report_file] listdir failed for {folder}: {e}")
        if resolved is None:
            raise HTTPException(status_code=404, detail=f"File {filename} not found")
        file_path = resolved

    try:
        os.remove(file_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Could not delete: {e}")

    return {"status": "deleted", "analysis_id": analysis_id, "filename": filename}


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


def _extract_final_answer(messages) -> str:
    """Walk back from the end of the LangGraph message list to find the
    last AIMessage with non-empty textual content.

    The naive `messages[-1].content` approach fails when the final step is
    a ToolMessage or an AIMessage that only carries `tool_calls` (no text),
    which leaves the UI showing an empty "Анализът е завършен." placeholder
    even though the run produced a real answer earlier in the trace.
    """
    for msg in reversed(messages or []):
        msg_type = type(msg).__name__
        if msg_type != "AIMessage":
            continue
        # Skip pure tool-call hops with no text
        if getattr(msg, "tool_calls", None) and not msg.content:
            continue
        text = _content_to_str(msg.content)
        if text and text.strip():
            return text
    # Fallback to the very last message (preserves prior behaviour)
    if messages:
        return _content_to_str(messages[-1].content)
    return ""


def _read_latest_report_markdown(analysis_id: str) -> Optional[str]:
    """Read the most recently modified .md report file from the analysis output folder.

    Returns None if the folder doesn't exist or contains no .md files.
    The Reporter (and REFINE_REPORT follow-ups) write via write_markdown_report
    into OUTPUT_DIR/<analysis_id>/. We pick the newest file by mtime so that
    refined reports supersede the original.
    """
    folder = os.path.join(OUTPUT_DIR, analysis_id)
    if not os.path.isdir(folder):
        return None
    try:
        md_files = [
            os.path.join(folder, f)
            for f in os.listdir(folder)
            if f.lower().endswith(".md") and os.path.isfile(os.path.join(folder, f))
        ]
        if not md_files:
            return None
        latest = max(md_files, key=os.path.getmtime)
        with open(latest, "r", encoding="utf-8") as fh:
            content = fh.read()
        return content.strip() or None
    except Exception as e:
        print(f"[report_markdown] Failed to read report for {analysis_id}: {e}")
        return None


def _ensure_followup_report(
    *,
    parent_analysis_id: str,
    followup_id: str,
    question: str,
    final_answer: str,
    followup_started_iso: str,
) -> Optional[str]:
    """Guarantee that every follow-up leaves behind a Markdown artefact.

    Scans ``OUTPUT_DIR/<parent_analysis_id>/`` for files whose mtime is at or
    after the follow-up's start time. If the agents produced new PNG charts
    during this follow-up but did NOT write/update any Markdown file
    referencing them, this function writes a deterministic follow-up report
    that embeds those new images and includes the agent's textual answer.

    Returns the absolute path of the file that was written, or ``None`` if no
    auto-report was needed (either the agents already wrote one, or there
    were no new charts to bundle).
    """
    folder = os.path.join(OUTPUT_DIR, parent_analysis_id)
    if not os.path.isdir(folder):
        return None

    # Parse the follow-up start time into unix seconds. Apply a 2s skew so a
    # file written within the same second still counts as "new".
    try:
        started_at = datetime.fromisoformat(followup_started_iso).timestamp() - 2.0
    except Exception:
        # If parsing fails, treat everything in the folder as eligible — better
        # to over-include than to skip the auto-report entirely.
        started_at = 0.0

    new_pngs: list[str] = []
    new_mds: list[str] = []
    try:
        for f in sorted(os.listdir(folder)):
            full = os.path.join(folder, f)
            if not os.path.isfile(full):
                continue
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                continue
            if mtime < started_at:
                continue
            low = f.lower()
            if low.endswith(".png"):
                new_pngs.append(f)
            elif low.endswith(".md"):
                new_mds.append(f)
    except OSError as e:
        print(f"[followup-md] could not list {folder}: {e}")
        return None

    # If the agents already wrote (or rewrote) a Markdown report during this
    # follow-up, trust them — don't add a second one.
    if new_mds:
        print(
            f"[followup-md] {followup_id}: {len(new_mds)} MD file(s) already "
            f"written by agents ({new_mds}); skipping auto-report"
        )
        return None

    # Nothing visual was produced either → leave it alone, the text answer is
    # rendered in the chat bubble already and would just duplicate as MD.
    if not new_pngs:
        return None

    # Build the synthesized Markdown.
    answer_text = (final_answer or "").strip() or (
        "Допълнителният анализ е завършен. Виж приложените графики."
    )
    title = (question or "Допълнителен анализ").strip()
    # Keep the title to a single line for the H1.
    title_h1 = title.split("\n", 1)[0][:160]

    lines: list[str] = [
        f"# {title_h1}",
        "",
        f"_Автоматично генериран отчет за допълнителен въпрос ({followup_id})._",
        "",
        "## Въпрос",
        "",
        title,
        "",
        "## Отговор",
        "",
        answer_text,
        "",
        "## Генерирани графики",
        "",
    ]
    for png in new_pngs:
        # Percent-encode the URL portion so non-ASCII filenames (e.g.
        # "oee_trend_Мелница_6.png") round-trip correctly through the
        # MD renderer → <img src> → /reports/{parent}/{file} endpoint.
        # The alt-text keeps the human-readable original.
        encoded = urllib.parse.quote(png, safe="")
        lines.append(f"![{png}]({encoded})")
        lines.append("")

    md_body = "\n".join(lines).rstrip() + "\n"

    # Filename must be unique per follow-up so multiple follow-ups don't
    # overwrite each other's auto-reports.
    out_name = f"followup_{followup_id}.md"
    out_path = os.path.join(folder, out_name)
    try:
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(md_body)
        print(
            f"[followup-md] {followup_id}: wrote auto-report {out_name} "
            f"(embedding {len(new_pngs)} new chart(s))"
        )
        return out_path
    except OSError as e:
        print(f"[followup-md] failed to write {out_path}: {e}")
        return None


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
    role: str | None = None,
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
                    role=role,
                    user_question=prompt,
                )

                final_state = await graph.ainvoke(
                    {"messages": [HumanMessage(content=prompt)]},
                    config={
                        "configurable": {"thread_id": analysis_id},
                        "recursion_limit": 150,
                    },
                )

                final_answer = _extract_final_answer(final_state["messages"])
                # Store serialized messages for follow-up conversations
                serialized = _serialize_messages(final_state["messages"])
                _analyses[analysis_id]["conversation_history"] = serialized
                # Snapshot the generated Markdown report so follow-ups can
                # see it verbatim as a SystemMessage (avoids losing it to the
                # tool_calls stripping in _serialize_messages).
                report_md = _read_latest_report_markdown(analysis_id)
                if report_md:
                    _analyses[analysis_id]["report_markdown"] = report_md
                    print(f"[report_markdown] Captured {len(report_md)} chars for {analysis_id}")
                else:
                    print(f"[report_markdown] No .md file found for {analysis_id}")

                _analyses[analysis_id]["status"] = "completed"
                _analyses[analysis_id]["final_answer"] = final_answer
                _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()

                # Persist completion state to DB
                try:
                    analyses_db.update_status(
                        analysis_id, "completed",
                        final_answer=final_answer, completed=True,
                    )
                    analyses_db.append_messages(analysis_id, serialized)
                    if report_md:
                        analyses_db.set_report_md(analysis_id, report_md)
                except Exception as db_err:
                    print(f"[db] Failed to persist completion for {analysis_id}: {db_err}")

                on_progress("system", "✓ Анализът е завършен.")

    except asyncio.CancelledError:
        print(f"\n[cancel] analysis {analysis_id} cancelled by user")
        _analyses[analysis_id]["status"] = "cancelled"
        _analyses[analysis_id]["completed_at"] = datetime.now().isoformat()
        try:
            analyses_db.update_status(analysis_id, "cancelled", completed=True)
        except Exception as db_err:
            print(f"[db] Failed to persist cancel for {analysis_id}: {db_err}")
        on_progress("system", "⛔ Анализът е прекъснат от потребителя.")
        # Re-raise so the task is properly marked as cancelled
        raise
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
        try:
            analyses_db.update_status(
                analysis_id, "failed", error=str(e), completed=True,
            )
        except Exception as db_err:
            print(f"[db] Failed to persist failure for {analysis_id}: {db_err}")
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

        # Retrieve conversation history from the original analysis.
        # If the in-memory entry is missing or has no history (e.g. server
        # was restarted, or the parent analysis predates message persistence),
        # fall back to the DB row and synthesize a minimal history from the
        # original question + final answer. The actual factual context is
        # still carried by the report Markdown injected as a SystemMessage
        # further down, so this is a safe fallback.
        original = _analyses.get(analysis_id, {})
        history = original.get("conversation_history", [])

        if not history:
            row = analyses_db.get_analysis(analysis_id)
            if row is None:
                raise ValueError(f"Analysis {analysis_id} not found")
            db_messages = analyses_db.get_messages(analysis_id)
            if db_messages:
                history = [
                    {"type": m["type"], "content": m["content"]} for m in db_messages
                ]
            else:
                # Last-resort synthesis: question + final_answer
                synth: list[dict] = []
                if row.get("question"):
                    synth.append({"type": "HumanMessage", "content": row["question"]})
                if row.get("final_answer"):
                    synth.append({"type": "AIMessage", "content": row["final_answer"]})
                history = synth
                print(
                    f"[followup] synthesized history from DB row for {analysis_id} "
                    f"({len(synth)} msgs)"
                )

            if not history:
                raise ValueError(
                    f"No conversation history or final answer available for analysis {analysis_id}"
                )

        # Rebuild message objects and keep only the last N for context
        prior_messages = _rebuild_messages(history)[-30:]

        # Pull the latest version of the generated report from disk so follow-ups
        # see the actual Markdown body (not just the short specialist prose that
        # survives serialization). Disk is the source of truth — if REFINE_REPORT
        # rewrote the file previously, this picks it up.
        report_md = _read_latest_report_markdown(analysis_id)
        if not report_md:
            report_md = original.get("report_markdown")

        report_context: list = []
        if report_md:
            report_context.append(SystemMessage(content=(
                "=== ТЕКУЩ ДОКЛАД (последна версия, източник на истина) ===\n"
                "Това е Markdown съдържанието на последния запазен отчет за този анализ.\n"
                "Използвай го като основа за отговори и обновявания. НЕ противоречи на "
                "числата в него. Ако потребителят иска промяна — запази структурата, "
                "терминологията и езика (български), обнови само поисканите части.\n"
                "Когато викаш write_markdown_report — подай пълното ново съдържание "
                "(не само промяната), запазвайки всичко останало от текущия доклад.\n"
                "================================================================\n\n"
                f"{report_md}\n\n"
                "=== КРАЙ НА ТЕКУЩИЯ ДОКЛАД ==="
            )))
            print(f"[followup] injecting report markdown: {len(report_md)} chars")
        else:
            print(f"[followup] no prior report markdown available for {analysis_id}")

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

                # Pass report snapshot + prior conversation + new question as initial messages
                initial_messages = report_context + prior_messages + [HumanMessage(content=question)]

                final_state = await graph.ainvoke(
                    {"messages": initial_messages},
                    config={
                        "configurable": {"thread_id": followup_id},
                        "recursion_limit": 50,
                    },
                )

                final_answer = _extract_final_answer(final_state["messages"])
                # Update conversation history with follow-up messages
                serialized = _serialize_messages(final_state["messages"])
                _analyses[analysis_id]["conversation_history"] = serialized

                # ── Guarantee an MD artefact for every follow-up ──────────────
                # If the agents produced new PNG charts during this follow-up
                # but did NOT write/update a Markdown file referencing them,
                # synthesize one here so the user always gets a coherent
                # report bundle in the UI's "Файлове" footer.
                try:
                    _ensure_followup_report(
                        parent_analysis_id=analysis_id,
                        followup_id=followup_id,
                        question=question,
                        final_answer=final_answer,
                        followup_started_iso=_analyses[followup_id]["started_at"],
                    )
                except Exception as e:
                    print(f"[followup-md] auto-report writer failed for {followup_id}: {e}")

                # Refresh the cached report snapshot in case this follow-up
                # rewrote it (REFINE_REPORT or a SPECIALIST that called
                # write_markdown_report). Disk remains the source of truth.
                refreshed_md = _read_latest_report_markdown(analysis_id)
                if refreshed_md:
                    _analyses[analysis_id]["report_markdown"] = refreshed_md
                    print(f"[report_markdown] Refreshed {len(refreshed_md)} chars after follow-up {followup_id}")

                _analyses[followup_id]["status"] = "completed"
                _analyses[followup_id]["final_answer"] = final_answer
                _analyses[followup_id]["completed_at"] = datetime.now().isoformat()

                # Persist follow-up completion + refreshed conversation/report on the parent.
                try:
                    analyses_db.update_status(
                        followup_id, "completed",
                        final_answer=final_answer, completed=True,
                    )
                    # Conversation history is stored on the parent (root) analysis.
                    analyses_db.append_messages(analysis_id, serialized)
                    if refreshed_md:
                        analyses_db.set_report_md(analysis_id, refreshed_md)
                except Exception as db_err:
                    print(f"[db] Failed to persist follow-up completion for {followup_id}: {db_err}")

                on_progress("followup", "✓ Допълнителният анализ е завършен.")

    except asyncio.CancelledError:
        print(f"\n[cancel] follow-up {followup_id} cancelled by user")
        _analyses[followup_id]["status"] = "cancelled"
        _analyses[followup_id]["completed_at"] = datetime.now().isoformat()
        try:
            analyses_db.update_status(followup_id, "cancelled", completed=True)
        except Exception as db_err:
            print(f"[db] Failed to persist follow-up cancel for {followup_id}: {db_err}")
        on_progress("followup", "⛔ Допълнителният въпрос е прекъснат от потребителя.")
        raise
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
        try:
            analyses_db.update_status(
                followup_id, "failed", error=str(e), completed=True,
            )
        except Exception as db_err:
            print(f"[db] Failed to persist follow-up failure for {followup_id}: {db_err}")
        on_progress("followup", f"✗ Грешка: {str(e)[:200]}")
