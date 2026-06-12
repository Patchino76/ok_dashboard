"""
db.py — SQLite persistence for agentic analyses
=================================================
Stores per-role conversation history so that users sharing a role
(Механик / Технолог / Мениджър) see the same list of analyses across
browsers and devices.

Schema
------
- analyses: one row per analysis run (root or follow-up).
- messages: ordered conversation turns per analysis (for hydration).

Files (PNG/MD) remain on disk under output/{analysis_id}/. The DB only
caches the latest Markdown report body to support follow-ups when the
in-memory _analyses dict has been evicted.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Iterator, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analyses.db")

ALLOWED_ROLES = {"mechanic", "technologist", "manager"}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS analyses (
    id            TEXT PRIMARY KEY,
    parent_id     TEXT,
    role          TEXT NOT NULL,
    title         TEXT,
    question      TEXT NOT NULL,
    status        TEXT NOT NULL,
    final_answer  TEXT,
    report_md     TEXT,
    error         TEXT,
    started_at    TEXT NOT NULL,
    completed_at  TEXT,
    FOREIGN KEY (parent_id) REFERENCES analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analyses_role_started
    ON analyses(role, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_parent
    ON analyses(parent_id);

CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id  TEXT NOT NULL,
    seq          INTEGER NOT NULL,
    type         TEXT NOT NULL,
    content      TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_analysis
    ON messages(analysis_id, seq);
"""

# Single shared connection guarded by a lock. SQLite + WAL handles concurrent
# reads; we serialize writes with the lock to keep things simple.
_conn: sqlite3.Connection | None = None
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is not None:
        return _conn
    conn = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,
        isolation_level=None,  # autocommit; we use explicit transactions when needed
        timeout=30.0,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.executescript(_SCHEMA)
    _conn = conn
    return conn


def init_db() -> None:
    """Initialize the database (idempotent). Safe to call at startup."""
    with _lock:
        _connect()


@contextmanager
def _cursor() -> Iterator[sqlite3.Cursor]:
    with _lock:
        conn = _connect()
        cur = conn.cursor()
        try:
            yield cur
        finally:
            cur.close()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now().isoformat()


def _make_title(question: str, max_len: int = 80) -> str:
    q = (question or "").strip().replace("\n", " ")
    return q[:max_len] + ("…" if len(q) > max_len else "")


# ── CRUD ─────────────────────────────────────────────────────────────────────

def create_analysis(
    *,
    analysis_id: str,
    role: str,
    question: str,
    parent_id: Optional[str] = None,
    started_at: Optional[str] = None,
    status: str = "running",
) -> None:
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")
    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO analyses (id, parent_id, role, title, question, status, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                parent_id,
                role,
                _make_title(question),
                question,
                status,
                started_at or _now(),
            ),
        )


def update_status(
    analysis_id: str,
    status: str,
    *,
    final_answer: Optional[str] = None,
    error: Optional[str] = None,
    completed: bool = False,
) -> None:
    fields = ["status = ?"]
    params: list = [status]
    if final_answer is not None:
        fields.append("final_answer = ?")
        params.append(final_answer)
    if error is not None:
        fields.append("error = ?")
        params.append(error)
    if completed:
        fields.append("completed_at = ?")
        params.append(_now())
    params.append(analysis_id)
    with _cursor() as cur:
        cur.execute(
            f"UPDATE analyses SET {', '.join(fields)} WHERE id = ?",
            tuple(params),
        )


def set_report_md(analysis_id: str, report_md: str) -> None:
    with _cursor() as cur:
        cur.execute(
            "UPDATE analyses SET report_md = ? WHERE id = ?",
            (report_md, analysis_id),
        )


def get_analysis(analysis_id: str) -> Optional[dict]:
    with _cursor() as cur:
        row = cur.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
        return dict(row) if row else None


def get_role(analysis_id: str) -> Optional[str]:
    with _cursor() as cur:
        row = cur.execute(
            "SELECT role FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
        return row["role"] if row else None


def list_root_analyses_by_role(role: str) -> list[dict]:
    """Return root analyses (parent_id IS NULL) for the given role,
    newest first. Used to populate the conversation list in the UI."""
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")
    with _cursor() as cur:
        rows = cur.execute(
            """
            SELECT id, role, title, question, status, started_at, completed_at, error
            FROM analyses
            WHERE role = ? AND parent_id IS NULL
            ORDER BY started_at DESC
            """,
            (role,),
        ).fetchall()
        return [dict(r) for r in rows]


def delete_analysis(analysis_id: str) -> None:
    """Delete an analysis and all of its follow-ups (cascade) and messages."""
    with _cursor() as cur:
        # Manual cascade: delete this analysis + any follow-ups whose parent_id
        # equals it (FK ON DELETE CASCADE handles messages for each row).
        cur.execute("DELETE FROM analyses WHERE id = ? OR parent_id = ?",
                    (analysis_id, analysis_id))


# ── Messages ─────────────────────────────────────────────────────────────────

def append_messages(analysis_id: str, messages: list[dict]) -> None:
    """Replace-and-append: clears existing messages for the analysis and
    inserts the provided ordered list. Used after a (follow-up) run to
    persist the latest serialized conversation history."""
    if not messages:
        return
    now = _now()
    with _cursor() as cur:
        cur.execute("DELETE FROM messages WHERE analysis_id = ?", (analysis_id,))
        cur.executemany(
            """
            INSERT INTO messages (analysis_id, seq, type, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (analysis_id, i, m.get("type", "HumanMessage"),
                 m.get("content", ""), now)
                for i, m in enumerate(messages)
            ],
        )


# ── Long-term memory: similar past analyses ─────────────────────────────────

# Domain-relevant tokens we use as a cheap "topic" signal across analyses.
# Tokenising on these keeps retrieval robust to Bulgarian/English mixing
# without needing embeddings or a vector store.
_MEMORY_KEYWORDS = (
    "psi80", "psi200", "ore", "watermill", "waterzumpf", "motoramp",
    "power", "density", "densityhc", "pressurehc", "pulphc",
    "shisti", "daiki", "grano",
    "shift", "смяна", "смени",
    "anomaly", "аномал",
    "forecast", "прогноз",
    "optim", "оптим",
    "kpi", "oee", "ефективн", "престой", "downtime",
    "мелница", "mill",
    "energy", "kwh", "енерг",
)


def _tokenise(text: str) -> set[str]:
    if not text:
        return set()
    low = text.lower()
    found = {kw for kw in _MEMORY_KEYWORDS if kw in low}
    # Mill numbers (1..12) — "mill 8", "мелница 8"
    import re as _re
    for m in _re.finditer(r"(?:mill|мелница)\s*(\d{1,2})", low):
        n = int(m.group(1))
        if 1 <= n <= 12:
            found.add(f"mill_{n}")
    return found


def find_similar_analyses(
    question: str,
    role: str,
    *,
    limit: int = 3,
    pool_size: int = 50,
    exclude_id: Optional[str] = None,
) -> list[dict]:
    """Return up to `limit` recent COMPLETED analyses (same role) whose
    questions share the most domain keywords with `question`. Lightweight
    keyword-Jaccard scoring over the most-recent `pool_size` rows — no
    embedding model required."""
    if role not in ALLOWED_ROLES:
        return []
    target = _tokenise(question)
    if not target:
        return []

    with _cursor() as cur:
        rows = cur.execute(
            """
            SELECT id, title, question, status, started_at, completed_at
            FROM analyses
            WHERE role = ?
              AND parent_id IS NULL
              AND status = 'completed'
              AND (id != ? OR ? IS NULL)
            ORDER BY started_at DESC
            LIMIT ?
            """,
            (role, exclude_id or "", exclude_id, pool_size),
        ).fetchall()

    scored: list[tuple[float, dict]] = []
    for r in rows:
        toks = _tokenise(r["question"])
        if not toks:
            continue
        overlap = len(target & toks)
        if overlap == 0:
            continue
        union = len(target | toks)
        jaccard = overlap / union if union else 0.0
        scored.append((jaccard, dict(r)))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:limit]]


def get_messages(analysis_id: str) -> list[dict]:
    with _cursor() as cur:
        rows = cur.execute(
            """
            SELECT seq, type, content, created_at
            FROM messages
            WHERE analysis_id = ?
            ORDER BY seq ASC
            """,
            (analysis_id,),
        ).fetchall()
        return [dict(r) for r in rows]
