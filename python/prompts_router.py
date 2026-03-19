"""
prompts_router.py — CRUD endpoints for user-saved prompts (SQLite)
"""

import sqlite3
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# ── SQLite setup ─────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db():
    conn = _get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prompts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user        TEXT    NOT NULL DEFAULT 'Admin',
            title       TEXT    NOT NULL,
            description TEXT    NOT NULL,
            created_at  TEXT    NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


_init_db()

# ── Pydantic models ──────────────────────────────────────────────────────────


class PromptCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=5000)


class PromptOut(BaseModel):
    id: int
    user: str
    title: str
    description: str
    created_at: str


class PromptUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)


# ── Router ───────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/v1/prompts", tags=["User Prompts"])


@router.get("/", response_model=List[PromptOut])
async def list_prompts(user: str = "Admin"):
    """List all prompts for a user, newest first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM prompts WHERE user = ? ORDER BY created_at DESC", (user,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/", response_model=PromptOut, status_code=201)
async def create_prompt(body: PromptCreate, user: str = "Admin"):
    """Create a new saved prompt."""
    now = datetime.utcnow().isoformat()
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO prompts (user, title, description, created_at) VALUES (?, ?, ?, ?)",
        (user, body.title, body.description, now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM prompts WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return dict(row)


@router.put("/{prompt_id}", response_model=PromptOut)
async def update_prompt(prompt_id: int, body: PromptUpdate, user: str = "Admin"):
    """Update an existing prompt's title and/or description."""
    conn = _get_conn()
    existing = conn.execute(
        "SELECT * FROM prompts WHERE id = ? AND user = ?", (prompt_id, user)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Prompt not found")

    new_title = body.title if body.title is not None else existing["title"]
    new_desc = body.description if body.description is not None else existing["description"]

    conn.execute(
        "UPDATE prompts SET title = ?, description = ? WHERE id = ?",
        (new_title, new_desc, prompt_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM prompts WHERE id = ?", (prompt_id,)).fetchone()
    conn.close()
    return dict(row)


@router.delete("/{prompt_id}", status_code=204)
async def delete_prompt(prompt_id: int, user: str = "Admin"):
    """Delete a saved prompt."""
    conn = _get_conn()
    cur = conn.execute(
        "DELETE FROM prompts WHERE id = ? AND user = ?", (prompt_id, user)
    )
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return None
