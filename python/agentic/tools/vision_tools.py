"""
tools/vision_tools.py — MCP tool for visual review of chart PNGs.
==================================================================
Lets the critic (or any specialist) ask Gemini to literally LOOK at a saved
chart and report on common quality problems:
  • Empty / mostly-empty plots (NaN-filled, no data)
  • Axis range issues (constant Y, or Y-range collapsing)
  • Missing legend / titles / axis labels
  • Visual sanity: outlier-driven distortion, unreadable text, etc.

This catches a class of failures that the textual STRUCTURED_OUTPUT protocol
cannot — e.g. a skill that "succeeded" but produced a blank chart.

Returns a JSON dict per file:
  {filename: {ok: bool, issues: [str], notes: str}}
"""

import base64
import json
import os
from mcp import types

from tools.output_dir import get_output_dir


review_chart_input_schema = {
    "type": "object",
    "properties": {
        "filenames": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of PNG filenames (in OUTPUT_DIR) to visually review. "
                           "Pass an empty list to review every PNG in the folder.",
        },
        "max_files": {
            "type": "integer",
            "description": "Hard cap on how many files to review per call (default 6).",
        },
    },
    "required": [],
}

review_chart_tool = types.Tool(
    name="review_chart",
    description=(
        "Visually review one or more chart PNG files using Gemini multimodal "
        "vision. For each file returns a small JSON dict with ok=true/false, "
        "a list of detected issues, and a one-line note. Use this from the "
        "critic specialist to catch silently-broken charts (blank plots, "
        "constant axes, missing titles) that would otherwise slip into the "
        "final report. The vision call requires GOOGLE_API_KEY to be set; "
        "falls back to a structural check (file size + basic PNG sanity) "
        "if the API key is missing or the model call fails."
    ),
    inputSchema=review_chart_input_schema,
)


_VISION_PROMPT = (
    "You are reviewing a chart produced by an automated industrial-data "
    "analysis pipeline (ball-mill / mineral processing).\n"
    "Look at the image and output ONE LINE of compact JSON exactly like:\n"
    '{"ok": true|false, "issues": ["..."], "notes": "<short>"}\n'
    "Mark ok=false if you see ANY of: empty/blank plotting area, "
    "all-constant axis (flat line spanning the chart), missing axis labels, "
    "missing title, illegible overlapping text, obviously wrong scaling "
    "(one extreme outlier collapsing the rest to a thin line), or any "
    "rendering glitch. Otherwise ok=true. Keep the notes field under 80 "
    "characters. Output the JSON ONLY, no surrounding prose."
)


def _structural_fallback(path: str) -> dict:
    """Cheap non-vision sanity check used when the vision API is unavailable."""
    try:
        size = os.path.getsize(path)
    except OSError:
        return {"ok": False, "issues": ["file not found"], "notes": "stat() failed"}
    issues: list[str] = []
    if size < 5_000:
        issues.append("file size < 5 KB — likely blank/empty plot")
    if size > 4_000_000:
        issues.append("file size > 4 MB — unusually large, may be malformed")
    # PNG magic byte check
    try:
        with open(path, "rb") as f:
            head = f.read(8)
        if not head.startswith(b"\x89PNG\r\n\x1a\n"):
            issues.append("not a valid PNG header")
    except OSError as e:
        issues.append(f"read error: {e}")

    return {
        "ok": not issues,
        "issues": issues,
        "notes": f"structural-only ({size} bytes)",
    }


async def _gemini_vision_call(path: str) -> dict | None:
    """Call Gemini multimodal vision on the image. Returns parsed JSON dict
    or None on any failure (so the caller can fall back to the structural check)."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        # Use the langchain-google-genai we already depend on.
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")

        # gemini-flash supports inline image data via the standard
        # multimodal content schema.
        llm = ChatGoogleGenerativeAI(
            model=os.getenv("VISION_MODEL", "gemini-2.5-flash"),
            google_api_key=api_key,
        )
        msg = HumanMessage(content=[
            {"type": "text", "text": _VISION_PROMPT},
            {"type": "image_url", "image_url": f"data:image/png;base64,{b64}"},
        ])
        resp = llm.invoke([msg])
        raw = resp.content
        if isinstance(raw, list):
            raw = " ".join(
                item.get("text", "") if isinstance(item, dict) else str(item)
                for item in raw
            )
        text = (raw or "").strip()
        # Allow the model to wrap in ```json fences
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()
        # Find the first { ... } block
        a = text.find("{"); b = text.rfind("}")
        if a == -1 or b == -1 or b <= a:
            return None
        return json.loads(text[a:b + 1])
    except Exception as e:
        return {"ok": False, "issues": [f"vision call failed: {str(e)[:120]}"], "notes": "fallback"}


async def review_chart(arguments: dict) -> list[types.TextContent]:
    output_dir = get_output_dir()
    filenames = arguments.get("filenames") or []
    max_files = int(arguments.get("max_files") or 6)

    if not filenames:
        # Default: every PNG in the folder, capped.
        try:
            filenames = sorted(
                f for f in os.listdir(output_dir)
                if f.lower().endswith(".png")
            )
        except OSError:
            filenames = []

    filenames = filenames[:max_files]
    results: dict[str, dict] = {}

    for name in filenames:
        # Path-traversal guard
        if "/" in name or "\\" in name or ".." in name:
            results[name] = {"ok": False, "issues": ["invalid filename"], "notes": "rejected"}
            continue
        path = os.path.join(output_dir, name)
        if not os.path.exists(path):
            results[name] = {"ok": False, "issues": ["file missing"], "notes": "not on disk"}
            continue

        vision = await _gemini_vision_call(path)
        if vision is None:
            results[name] = _structural_fallback(path)
        else:
            # Defensive normalisation — ensure the keys exist.
            results[name] = {
                "ok": bool(vision.get("ok", True)),
                "issues": list(vision.get("issues") or []),
                "notes": str(vision.get("notes") or "")[:120],
            }

    summary = {
        "n_reviewed": len(results),
        "n_flagged": sum(1 for r in results.values() if not r.get("ok")),
        "results": results,
    }
    return [types.TextContent(type="text", text=json.dumps(summary, indent=2, ensure_ascii=False))]
