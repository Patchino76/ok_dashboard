"""
graph.py — Multi-Agent LangGraph with Dynamic Specialist Pool
==========================================================================
Planner-driven architecture that selects only the relevant specialists:

  [START] → [data_loader] → [manager_review] →
            [planner] →
            [specialist_1] ↔ [tools] → [manager_review] →
            [specialist_2] ↔ [tools] → [manager_review] →
            ...
            [critic] ↔ [tools] → [manager_review] →
            [reporter] ↔ [tools] → [END]

The planner examines the user's request + loaded data summary and decides
which specialists (from a pool of 6) to invoke. This avoids wasting LLM
calls on irrelevant specialists while enabling deep domain-specific analysis.

Specialist Pool:
  - analyst           : Basic EDA, SPC, correlations, distributions
  - forecaster        : Time series forecasting, changepoints, seasonality
  - anomaly_detective : Multivariate anomaly detection, root cause, regimes
  - bayesian_analyst  : Bayesian inference, credible intervals, causal analysis
  - optimizer         : Pareto frontiers, what-if simulation, optimal setpoints
  - shift_reporter    : Shift KPIs, benchmarking, energy efficiency, handover reports
"""

import os
from datetime import datetime
from typing import Callable, Optional

from langchain_core.messages import (
    SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage,
)
from langchain_core.tools import BaseTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, MessagesState, END, START
from langgraph.types import Send

GEMINI_MODEL = "gemini-3.1-flash-lite-preview"
# Optional model tiering: use a stronger model only where it pays off (the
# reporter, which synthesizes the final Bulgarian report). Defaults to the base
# model so behavior is unchanged unless GEMINI_REPORTER_MODEL is set (or the
# per-request `reporterModel` setting is provided).
GEMINI_REPORTER_MODEL = os.getenv("GEMINI_REPORTER_MODEL", GEMINI_MODEL)

# Token-budget controls
MAX_TOOL_OUTPUT_CHARS = 2000
MAX_AI_MSG_CHARS = 3000
MAX_MESSAGES_WINDOW = 14
MAX_SPECIALIST_ITERS = 5


# ── State ────────────────────────────────────────────────────────────────────

class AnalysisState(MessagesState):
    current_stage: str
    stages_to_run: list[str]   # set by planner — dynamic per analysis
    stage_attempts: dict       # track rework attempts per stage
    parallel_mode: bool        # True while parallel specialist branches are active
    extensions_used: int       # number of times the critic has extended the pipeline


# ── Specialist pool ──────────────────────────────────────────────────────────

SPECIALIST_POOL = [
    "analyst", "forecaster", "anomaly_detective",
    "bayesian_analyst", "optimizer", "shift_reporter",
]

FIXED_PREFIX = ["data_loader", "planner"]
FIXED_SUFFIX = ["critic", "reporter"]

MAX_REWORKS_PER_STAGE = 1


# ══════════════════════════════════════════════════════════════════════════════
# System Prompts
# ══════════════════════════════════════════════════════════════════════════════

from prompts import (
    DATA_LOADER_PROMPT,
    PLANNER_PROMPT,
    ANALYST_PROMPT,
    FORECASTER_PROMPT,
    ANOMALY_DETECTIVE_PROMPT,
    BAYESIAN_ANALYST_PROMPT,
    OPTIMIZER_PROMPT,
    SHIFT_REPORTER_PROMPT,
    CRITIC_PROMPT,
    REPORTER_PROMPT,
    MANAGER_REVIEW_PROMPT,
    DOMAIN_CONTEXT,
    CTX_MINIMAL,
)


def _parse_planner_specialists(content: str) -> list[str]:
    """Parse the planner's specialist selection.

    Prefers a JSON object {"specialists": [...], "rationale": "..."}; falls
    back to the legacy "SPECIALISTS: a, b" line format for resilience. Returns
    a de-duplicated list of valid specialist names (subset of SPECIALIST_POOL).
    """
    import json as _json
    import re as _re

    def _norm(name: str) -> str:
        return name.strip().lower().replace(" ", "_")

    selected: list[str] = []
    text = (content or "").strip()

    # 1) Try JSON — tolerate ```json fences / surrounding prose by grabbing the
    #    first {...} block.
    match = _re.search(r"\{.*\}", text, _re.DOTALL)
    if match:
        try:
            obj = _json.loads(match.group(0))
            raw = obj.get("specialists") or obj.get("agents") or []
            if isinstance(raw, str):
                raw = _re.split(r"[,\n]", raw)
            for s in raw:
                ns = _norm(str(s))
                if ns in SPECIALIST_POOL and ns not in selected:
                    selected.append(ns)
        except (_json.JSONDecodeError, ValueError, AttributeError):
            pass

    # 2) Fallback: legacy "SPECIALISTS: a, b" line.
    if not selected:
        for line in text.split("\n"):
            line = line.strip()
            if line.upper().startswith("SPECIALISTS:"):
                for s in line.split(":", 1)[1].split(","):
                    ns = _norm(s)
                    if ns in SPECIALIST_POOL and ns not in selected:
                        selected.append(ns)

    return selected



# ══════════════════════════════════════════════════════════════════════════════
# Graph Builder
# ══════════════════════════════════════════════════════════════════════════════

# ── Human-readable stage labels for progress messages ────────────────────
_STAGE_LABELS: dict[str, str] = {
    "data_loader":       "Зареждане на данни",
    "planner":           "Планиране",
    "analyst":           "Анализатор",
    "forecaster":        "Прогнозиране",
    "anomaly_detective": "Детектор на аномалии",
    "bayesian_analyst":  "Байесов анализ",
    "optimizer":         "Оптимизатор",
    "shift_reporter":    "Сменен отчет",
    "critic":            "Проверка и валидация",
    "reporter":          "Генериране на отчет",
    "manager":           "Мениджър",
}

# Friendly activity descriptions shown to the end user
_STAGE_DESCRIPTIONS: dict[str, str] = {
    "data_loader":       "Зареждане на данни от базата...",
    "analyst":           "Статистически анализ, разпределения и SPC диаграми...",
    "forecaster":        "Прогнозиране на трендове и сезонност...",
    "anomaly_detective": "Търсене на аномалии и причини...",
    "bayesian_analyst":  "Байесов анализ и доверителни интервали...",
    "optimizer":         "Оптимизация на настройки и препоръки...",
    "shift_reporter":    "Анализ по смени и KPI показатели...",
    "critic":            "Валидация на резултати и крос-проверка на числата...",
    "reporter":          "Писане на краен отчет...",
}

def _label(stage: str) -> str:
    return _STAGE_LABELS.get(stage, stage)

def _desc(stage: str) -> str:
    return _STAGE_DESCRIPTIONS.get(stage, "")


def build_graph(
    tools: list[BaseTool],
    api_key: str,
    on_progress: Optional[Callable[[str, str], None]] = None,
    settings: dict | None = None,
    template_id: str | None = None,
    checkpointer=None,
    role: str | None = None,
    user_question: str | None = None,
) -> StateGraph:
    # No-op fallback if caller doesn't supply a callback
    _progress = on_progress or (lambda stage, msg: None)

    # Apply settings overrides (from UI) or use module-level defaults
    _settings = settings or {}
    _MAX_TOOL_OUTPUT_CHARS = _settings.get("maxToolOutputChars", MAX_TOOL_OUTPUT_CHARS)
    _MAX_AI_MSG_CHARS = _settings.get("maxAiMessageChars", MAX_AI_MSG_CHARS)
    _MAX_MESSAGES_WINDOW = _settings.get("maxMessagesWindow", MAX_MESSAGES_WINDOW)
    _MAX_SPECIALIST_ITERS = _settings.get("maxSpecialistIterations", MAX_SPECIALIST_ITERS)
    # Parallel-specialist fan-out (opt-in). When True, after the planner is
    # accepted, all selected specialists are dispatched concurrently via Send
    # and converge directly at critic_entry. Cuts wall-clock time for
    # multi-specialist analyses but skips per-stage manager_review.
    _ENABLE_PARALLEL = bool(_settings.get("enableParallelSpecialists", False))

    # Template override (imported lazily to avoid circular imports)
    _template_id = template_id

    llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=api_key)

    # Model tiering: the reporter may use a stronger model. Resolution order:
    # per-request setting → env default → base model. When it equals the base
    # model we just reuse `llm` (no extra client, no behavior change).
    _reporter_model = _settings.get("reporterModel") or GEMINI_REPORTER_MODEL
    if _reporter_model and _reporter_model != GEMINI_MODEL:
        reporter_llm = ChatGoogleGenerativeAI(model=_reporter_model, google_api_key=api_key)
        print(f"  [model] reporter using tiered model: {_reporter_model}")
    else:
        reporter_llm = llm

    # ── Per-specialist tool binding ─────────────────────────────────────
    tools_by_name = {t.name: t for t in tools}

    # All specialists that do analysis share the same tool set
    ANALYSIS_TOOLS = ["execute_python", "run_skill", "list_output_files", "list_skills"]
    DATA_TOOLS = ["query_mill_data", "query_combined_data", "get_db_schema"]
    REPORT_TOOLS = ["list_output_files", "write_markdown_report"]
    # Critic gets the vision tool on top of normal analysis tools, so it can
    # actually LOOK at the produced PNGs and flag silently broken charts.
    CRITIC_TOOLS = ANALYSIS_TOOLS + ["review_chart"]

    TOOL_SETS = {
        "data_loader":       DATA_TOOLS,
        "analyst":           ANALYSIS_TOOLS,
        "forecaster":        ANALYSIS_TOOLS,
        "anomaly_detective": ANALYSIS_TOOLS,
        "bayesian_analyst":  ANALYSIS_TOOLS,
        "optimizer":         ANALYSIS_TOOLS,
        "shift_reporter":    ANALYSIS_TOOLS,
        "critic":            CRITIC_TOOLS,
        "reporter":          REPORT_TOOLS,
    }

    specialist_llms = {}
    for stage_name, tool_names in TOOL_SETS.items():
        stage_tools = [tools_by_name[n] for n in tool_names if n in tools_by_name]
        base_llm = reporter_llm if stage_name == "reporter" else llm
        specialist_llms[stage_name] = base_llm.bind_tools(stage_tools)

    # ── Message helpers ─────────────────────────────────────────────────
    def truncate(text: str, limit: int) -> str:
        return text[:limit] + "\n... [truncated]" if len(text) > limit else text

    def normalize_content(content) -> str:
        if isinstance(content, list):
            texts = [item.get("text", "") if isinstance(item, dict) else str(item) for item in content]
            return "\n".join(texts).strip()
        return str(content) if content else ""

    def compress_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        if len(messages) > _MAX_MESSAGES_WINDOW + 1:
            messages = [messages[0]] + messages[-(_MAX_MESSAGES_WINDOW):]

        compressed = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = normalize_content(msg.content)
                compressed.append(ToolMessage(
                    content=truncate(content, _MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
            elif isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if len(content) > _MAX_AI_MSG_CHARS:
                    compressed.append(AIMessage(
                        content=truncate(content, _MAX_AI_MSG_CHARS),
                        name=getattr(msg, "name", None),
                        tool_calls=msg.tool_calls if msg.tool_calls else [],
                    ))
                else:
                    compressed.append(msg)
            else:
                compressed.append(msg)
        return compressed

    def strip_tool_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        clean = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = normalize_content(msg.content)
                clean.append(AIMessage(
                    content=f"[Tool result from {msg.name}]: {truncate(content, 800)}",
                    name=msg.name,
                ))
            elif isinstance(msg, AIMessage) and msg.tool_calls:
                text = normalize_content(msg.content) or f"[{getattr(msg, 'name', 'agent')} requested tools]"
                clean.append(AIMessage(content=text, name=getattr(msg, "name", None)))
            else:
                clean.append(msg)
        return clean

    # ── Structured output extraction (2C) ──────────────────────────────
    def _extract_structured_output(content: str) -> str | None:
        """Extract STRUCTURED_OUTPUT:JSON lines from execute_python stdout.
        Returns the JSON string if found, else None."""
        import json as _json
        lines = content.split("\n")
        structured_parts = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("STRUCTURED_OUTPUT:"):
                json_str = stripped[len("STRUCTURED_OUTPUT:"):].strip()
                try:
                    parsed = _json.loads(json_str)
                    structured_parts.append(_json.dumps(parsed, ensure_ascii=False))
                except _json.JSONDecodeError:
                    pass
        if structured_parts:
            return " | ".join(structured_parts)
        return None

    # ── Stream STRUCTURED_OUTPUT events to the UI (Step 18) ────────────
    # Parses the execute_python tool output, finds every STRUCTURED_OUTPUT
    # JSON line emitted by skill functions, and forwards each as its own
    # progress event with a ``STRUCTURED:`` prefix the frontend can route
    # to a dedicated "live data tiles" panel. The textual progress feed
    # remains untouched — these are additional events.
    def _stream_structured_outputs(owner_name: str, output_str: str) -> None:
        if not output_str or "STRUCTURED_OUTPUT:" not in output_str:
            return
        # `output_str` is the JSON-serialised result of execute_python; the
        # actual STRUCTURED_OUTPUT lines live inside its stdout field, but
        # we just scan the raw text — a substring search is robust to
        # either shape (raw stdout or JSON-escaped).
        import json as _json
        # 1) Try to parse the execute_python wrapper {"stdout": "..."} first
        candidate_text = output_str
        try:
            wrapper = _json.loads(output_str)
            if isinstance(wrapper, dict) and isinstance(wrapper.get("stdout"), str):
                candidate_text = wrapper["stdout"]
        except (_json.JSONDecodeError, ValueError):
            pass

        for line in candidate_text.split("\n"):
            stripped = line.strip()
            if not stripped.startswith("STRUCTURED_OUTPUT:"):
                continue
            payload_raw = stripped[len("STRUCTURED_OUTPUT:"):].strip()
            try:
                parsed = _json.loads(payload_raw)
            except _json.JSONDecodeError:
                continue  # Skip malformed payloads silently
            # Re-serialise compactly; cap to avoid blowing up the progress
            # log if a skill ever dumps an enormous metrics dict.
            try:
                compact = _json.dumps(parsed, ensure_ascii=False, default=str)
                if len(compact) > 4000:
                    compact = compact[:3997] + "..."
                _progress(owner_name, f"STRUCTURED:{compact}")
            except Exception:
                continue

    # ── Focused context builder ─────────────────────────────────────────
    def build_focused_context(all_msgs: list[BaseMessage], stage_name: str) -> list[BaseMessage]:
        user_msg = None
        prior_summary_parts = []
        current_stage_msgs = []

        my_tool_call_ids = set()
        for msg in all_msgs:
            if isinstance(msg, AIMessage) and getattr(msg, "name", None) == stage_name and msg.tool_calls:
                for tc in msg.tool_calls:
                    my_tool_call_ids.add(tc.get("id"))

        for msg in all_msgs:
            if isinstance(msg, HumanMessage) and user_msg is None:
                user_msg = msg
                continue

            msg_name = getattr(msg, "name", None)

            if msg_name == stage_name:
                current_stage_msgs.append(msg)
                continue

            if isinstance(msg, ToolMessage) and msg.tool_call_id in my_tool_call_ids:
                content = normalize_content(msg.content)
                current_stage_msgs.append(ToolMessage(
                    content=truncate(content, _MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
                continue

            # Summarize prior stages compactly
            if isinstance(msg, ToolMessage) and msg.name in ("query_mill_data", "query_combined_data"):
                content = normalize_content(msg.content)
                if "loaded" in content.lower():
                    prior_summary_parts.append(truncate(content, 200))
            elif isinstance(msg, ToolMessage) and msg.name == "execute_python":
                content = normalize_content(msg.content)
                # Extract STRUCTURED_OUTPUT blocks for structured data flow (2C)
                structured = _extract_structured_output(content)
                if structured:
                    prior_summary_parts.append(f"[structured data]: {structured}")
                else:
                    prior_summary_parts.append(f"[python output]: {truncate(content, 1200)}")
            elif isinstance(msg, AIMessage) and msg_name and msg_name not in ("manager", "planner") and not msg.tool_calls:
                content = normalize_content(msg.content)
                if content:
                    # Critic's verification block must reach the reporter intact;
                    # other specialist prose is fine compressed.
                    cap = 1500 if msg_name == "critic" else 400
                    prior_summary_parts.append(f"[{msg_name}]: {truncate(content, cap)}")
            elif msg_name == "manager" and isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if "REWORK" in content and stage_name in content:
                    current_stage_msgs.append(msg)

        result = []
        if user_msg:
            result.append(user_msg)

        if prior_summary_parts:
            summary = "[Prior analysis context]:\n" + "\n".join(prior_summary_parts[-8:])
            result.append(HumanMessage(content=summary))

        result.extend(compress_messages(current_stage_msgs))
        return result

    # ── Specialist node factory ────────────────────────────────────────
    today = datetime.now().strftime("%Y-%m-%d")

    ALL_PROMPTS = {
        "data_loader":       DATA_LOADER_PROMPT.replace("{TODAY_DATE}", today),
        "analyst":           ANALYST_PROMPT,
        "forecaster":        FORECASTER_PROMPT,
        "anomaly_detective": ANOMALY_DETECTIVE_PROMPT,
        "bayesian_analyst":  BAYESIAN_ANALYST_PROMPT,
        "optimizer":         OPTIMIZER_PROMPT,
        "shift_reporter":    SHIFT_REPORTER_PROMPT,
        "critic":            CRITIC_PROMPT,
        "reporter":          REPORTER_PROMPT,
    }

    ALL_STAGES = list(ALL_PROMPTS.keys())

    def make_specialist_node(name: str):
        system_prompt = ALL_PROMPTS[name]
        stage_llm = specialist_llms[name]

        def specialist_node(state: AnalysisState) -> dict:
            iteration = sum(1 for m in state["messages"] if getattr(m, "name", None) == name) + 1
            print(f"\n  [{name}] iteration {iteration}/{_MAX_SPECIALIST_ITERS} — processing...")
            # Only show user-facing progress on first iteration (with description)
            if iteration == 1:
                desc = _desc(name)
                _progress(name, f"{_label(name)}: {desc}" if desc else f"{_label(name)}...")

            if iteration > _MAX_SPECIALIST_ITERS:
                print(f"  [{name}] Iteration cap reached, advancing.")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Done (iteration cap). Moving on.",
                        name=name,
                    )],
                }

            raw_msgs = state["messages"]
            focused = build_focused_context(raw_msgs, name)
            messages = [SystemMessage(content=system_prompt)] + focused

            print(f"  [{name}] Context: {len(focused)} msgs, types: {[type(m).__name__ for m in focused]}")

            try:
                response = stage_llm.invoke(messages)
            except Exception as e:
                error_str = str(e)
                print(f"  [{name}] LLM error: {error_str[:200]}")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Error: {error_str[:150]}. Moving on.",
                        name=name,
                    )],
                }

            response.content = normalize_content(response.content)

            if response.tool_calls:
                tool_names = [tc["name"] for tc in response.tool_calls]
                print(f"  [{name}] Calling tools: {tool_names}")
            else:
                preview = (response.content[:120] + "...") if response.content and len(response.content) > 120 else response.content
                print(f"  [{name}] Done: \"{preview}\"")
                _progress(name, f"✓ {_label(name)} завърши.")

            response.name = name
            return {"messages": [response]}

        return specialist_node

    # ── Long-term memory: hint built once per graph build ─────────────
    # Look up the 3 most-similar past analyses for the same role and turn
    # them into a short bullet list that the planner can read alongside the
    # user question. Cheap keyword-Jaccard retrieval — no embedding model.
    _memory_hint: str = ""
    if role and user_question:
        try:
            import db as _db
            similar = _db.find_similar_analyses(user_question, role, limit=3)
            if similar:
                bullets = []
                for r in similar:
                    title = (r.get("title") or r.get("question") or "")[:120]
                    bullets.append(f"  • [{r['started_at'][:10]}] {title}")
                _memory_hint = (
                    "RECENT SIMILAR ANALYSES (same role, completed):\n"
                    + "\n".join(bullets)
                    + "\nUse these as soft hints for which specialists tend to be useful. "
                    + "DO NOT just copy their pipelines — re-evaluate from the current question."
                )
                print(f"  [memory] Found {len(similar)} similar past analyses for planner.")
        except Exception as e:
            print(f"  [memory] similar-analyses lookup failed: {str(e)[:120]}")

    # ── Planner node ──────────────────────────────────────────────────
    def planner_node(state: AnalysisState) -> dict:
        print("\n  [planner] Analyzing request to determine specialists needed...")
        _progress("planner", "Планиране: Избор на подходящи специалисти...")

        # Template override: skip LLM planning if a template was selected
        if _template_id:
            from analysis_templates import get_template_specialists
            tpl_specialists = get_template_specialists(_template_id)
            if tpl_specialists:
                selected = [s for s in tpl_specialists if s in SPECIALIST_POOL]
                if selected:
                    stages = FIXED_PREFIX + selected + FIXED_SUFFIX
                    readable = ' → '.join(_label(s) for s in selected)
                    print(f"  [planner] Using template '{_template_id}': {' → '.join(stages)}")
                    _progress("planner", f"Шаблон: {readable}")
                    return {
                        "messages": [AIMessage(content=f"Using template '{_template_id}'. SPECIALISTS: {', '.join(selected)}", name="planner")],
                        "stages_to_run": stages,
                        "current_stage": "planner",
                    }

        compressed = compress_messages(state["messages"])
        # Prepend the long-term-memory hint to the planner's system prompt
        # when we have recent similar analyses for this role.
        planner_system = PLANNER_PROMPT
        if _memory_hint:
            planner_system = f"{PLANNER_PROMPT}\n\n---\n{_memory_hint}"
        messages = [SystemMessage(content=planner_system)] + strip_tool_messages(compressed)

        try:
            response = llm.invoke(messages)
        except Exception as e:
            print(f"  [planner] Error: {str(e)[:150]}. Defaulting to analyst only.")
            return {
                "messages": [AIMessage(content="SPECIALISTS: analyst\nRATIONALE: Fallback due to planning error.", name="planner")],
                "stages_to_run": ["data_loader", "planner", "analyst", "critic", "reporter"],
                "current_stage": "planner",
            }

        content = normalize_content(response.content)
        print(f"  [planner] Response: {content}")

        # Parse the planner's JSON output (with legacy line fallback)
        selected = _parse_planner_specialists(content)

        if not selected:
            selected = ["analyst"]
            print("  [planner] No valid specialists parsed, defaulting to analyst.")

        # Build full stage list
        stages = FIXED_PREFIX + selected + FIXED_SUFFIX
        print(f"  [planner] Pipeline: {' → '.join(stages)}")
        readable = ' → '.join(_label(s) for s in selected)
        _progress("planner", f"Избрани специалисти: {readable}")

        return {
            "messages": [AIMessage(content=content, name="planner")],
            "stages_to_run": stages,
            "current_stage": "planner",
        }

    # ── Manager review node ──────────────────────────────────────────
    # Stages that are auto-accepted without LLM review
    _AUTO_ACCEPT_STAGES = {"data_loader", "planner", "critic", "reporter"}

    def _heuristic_check(messages: list[BaseMessage], stage_name: str) -> str | None:
        """Check if a specialist produced files, structured output, and had no errors.
        Returns an auto-accept reason string, or None if LLM review is needed."""
        has_new_files = False
        has_error = False
        has_tool_output = False
        has_structured = False

        for msg in reversed(messages):
            msg_name = getattr(msg, "name", None)
            # Only inspect tool results from this specialist's iteration
            if isinstance(msg, ToolMessage) and msg.name == "execute_python":
                has_tool_output = True
                content = normalize_content(msg.content)
                if '"new_files":' in content:
                    # Check if new_files list is non-empty
                    try:
                        import re as _re
                        match = _re.search(r'"new_files":\s*\[([^\]]+)\]', content)
                        if match and match.group(1).strip():
                            has_new_files = True
                    except Exception:
                        pass
                if "STRUCTURED_OUTPUT:" in content:
                    has_structured = True
                if '"error":' in content.lower() or "Traceback" in content or "Error:" in content:
                    has_error = True
            # Stop scanning once we hit this specialist's first AI message
            if isinstance(msg, AIMessage) and msg_name == stage_name and not msg.tool_calls:
                break
            # Also stop if we hit a different stage's entry
            if isinstance(msg, AIMessage) and msg_name and msg_name != stage_name and msg_name != "manager":
                break

        # Strict path: chart + structured output + no errors → auto-accept.
        if has_tool_output and has_new_files and has_structured and not has_error:
            return f"Heuristic auto-accept: {stage_name} produced files + STRUCTURED_OUTPUT, no errors."
        # Lenient path: still accept on chart + no errors, but flag missing protocol.
        if has_tool_output and has_new_files and not has_error:
            return f"Heuristic auto-accept: {stage_name} produced files (no STRUCTURED_OUTPUT — degraded)."
        return None

    def _maybe_extend_pipeline(state: AnalysisState) -> dict | None:
        """If the critic just finished and asked for extensions, splice them
        into stages_to_run BEFORE the reporter, then re-run the critic on the
        extended outputs. Returns a dict of state updates, or None if no
        extension is needed."""
        ext_used = state.get("extensions_used", 0) or 0
        if ext_used >= _MAX_PIPELINE_EXTENSIONS:
            return None
        stages = list(state.get("stages_to_run", []))
        extras = _parse_extensions(state["messages"], stages)
        if not extras:
            return None
        try:
            reporter_idx = stages.index("reporter")
        except ValueError:
            reporter_idx = len(stages)
        new_stages = (
            stages[:reporter_idx]
            + extras
            + ["critic"]
            + stages[reporter_idx:]
        )
        print(f"  [manager] Critic extends pipeline with: {', '.join(extras)} "
              f"(extension {ext_used + 1}/{_MAX_PIPELINE_EXTENSIONS})")
        _progress("critic", f"Допълнителни специалисти: {', '.join(_label(s) for s in extras)}")
        return {
            "stages_to_run": new_stages,
            "extensions_used": ext_used + 1,
        }

    def manager_review_node(state: AnalysisState) -> dict:
        current = state.get("current_stage", "data_loader")
        attempts = state.get("stage_attempts", {})
        attempt_count = attempts.get(current, 0)

        print(f"\n  [manager] Reviewing {current} output (attempt {attempt_count + 1})...")

        # Auto-accept infrastructure stages (data_loader, planner, critic, reporter)
        if current in _AUTO_ACCEPT_STAGES:
            print(f"  [manager] {current} — auto-accepting (infrastructure stage).")
            update = {
                "messages": [AIMessage(content=f"ACCEPT: {current} completed.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }
            # Adaptive re-plan: if the critic asked for more specialists, splice them in.
            if current == "critic":
                ext_update = _maybe_extend_pipeline(state)
                if ext_update:
                    update.update(ext_update)
            return update

        if attempt_count >= MAX_REWORKS_PER_STAGE:
            print(f"  [manager] Max reworks reached for {current} — accepting.")
            return {
                "messages": [AIMessage(content=f"ACCEPT: Max reworks reached for {current}.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        # Heuristic: if specialist produced chart files with no errors, skip LLM review
        heuristic_reason = _heuristic_check(state["messages"], current)
        if heuristic_reason:
            print(f"  [manager] {heuristic_reason}")
            return {
                "messages": [AIMessage(content=f"ACCEPT: {heuristic_reason}", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        # Fall back to LLM review for ambiguous cases
        print(f"  [manager] Heuristic inconclusive for {current}, invoking LLM review...")
        compressed = compress_messages(state["messages"])
        messages = [SystemMessage(content=MANAGER_REVIEW_PROMPT)] + strip_tool_messages(compressed)

        try:
            response = llm.invoke(messages)
        except Exception as e:
            print(f"  [manager] Review error: {str(e)[:150]}")
            return {
                "messages": [AIMessage(content="ACCEPT: Review skipped due to error.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        raw = response.content
        content = normalize_content(raw).strip()

        if content.upper().startswith("REWORK") or "REWORK:" in content.upper():
            decision = "REWORK"
            stamped = f"REWORK: {content}"
        else:
            decision = "ACCEPT"
            stamped = f"ACCEPT: {content}"

        print(f"  [manager] Decision: {decision} — {content[:150]}")
        if decision == "REWORK":
            _progress("manager", f"⟳ {_label(current)}: Необходима е корекция, повторен опит...")

        return {
            "messages": [AIMessage(content=stamped, name="manager")],
            "stage_attempts": {**attempts, current: attempt_count + 1},
        }

    # ── Tool execution node ──────────────────────────────────────────
    async def tool_node(state: AnalysisState) -> dict:
        last_message = state["messages"][-1]
        # Identify which specialist owns these tool calls — needed so the
        # streamed STRUCTURED_OUTPUT events can be attributed correctly.
        owner_name = getattr(last_message, "name", None) or "specialist"

        results = []
        for tc in last_message.tool_calls:
            tool = tools_by_name.get(tc["name"])
            if tool is None:
                results.append(ToolMessage(
                    content=f"Error: unknown tool '{tc['name']}'",
                    tool_call_id=tc["id"], name=tc["name"],
                ))
                continue
            try:
                print(f"    [tool] Executing {tc['name']}...")
                output = await tool.ainvoke(tc["args"])
                output_str = str(output)
                results.append(ToolMessage(
                    content=output_str, tool_call_id=tc["id"], name=tc["name"],
                ))

                # ── Stream STRUCTURED_OUTPUT events to the UI (Step 18) ──
                # When execute_python returns, scan its stdout for the
                # STRUCTURED_OUTPUT:{...} lines emitted by skill functions
                # and forward each as a dedicated progress event so the
                # frontend can render live "data tiles" alongside the
                # textual progress feed.
                if tc["name"] == "execute_python":
                    _stream_structured_outputs(owner_name, output_str)
            except Exception as e:
                results.append(ToolMessage(
                    content=f"Error: {e}", tool_call_id=tc["id"], name=tc["name"],
                ))
        return {"messages": results}

    # ── Routing logic ────────────────────────────────────────────────

    def specialist_router(state: AnalysisState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        # In parallel mode, all specialist branches converge at the critic.
        if state.get("parallel_mode"):
            return "critic_entry"
        # Terminal stage (reporter) is auto-accepted and has nothing after it —
        # route straight to END, skipping the redundant manager_review →
        # manager_router → end hops.
        stages = state.get("stages_to_run") or []
        current = state.get("current_stage")
        if stages and current == stages[-1]:
            return "end"
        return "manager_review"

    def after_tools(state: AnalysisState) -> str:
        for msg in reversed(state["messages"]):
            if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
                return msg.name
        return "data_loader"

    # Maximum number of times the critic may extend the pipeline.
    _MAX_PIPELINE_EXTENSIONS = 2

    def _parse_extensions(messages: list[BaseMessage], stages: list[str]) -> list[str]:
        """Find an EXTEND_PIPELINE: a, b line in the most recent critic message
        and return up to 2 NEW specialists not already in stages."""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and getattr(msg, "name", None) == "critic":
                text = normalize_content(msg.content)
                for line in text.splitlines():
                    line = line.strip()
                    if line.upper().startswith("EXTEND_PIPELINE:"):
                        raw = line.split(":", 1)[1].strip()
                        candidates = [s.strip().lower().replace(" ", "_") for s in raw.split(",")]
                        return [
                            s for s in candidates
                            if s in SPECIALIST_POOL and s not in stages
                        ][:2]
                return []  # critic ran but did not request extensions
        return []

    def manager_router(state: AnalysisState):
        """After manager review: advance to next stage, rework current, fan out
        specialists in parallel, or splice in critic-requested extensions.
        May return a string OR a list of Send commands."""
        last = state["messages"][-1]
        content = last.content if isinstance(last.content, str) else str(last.content)
        current = state.get("current_stage", "data_loader")
        stages = list(state.get("stages_to_run", FIXED_PREFIX + ["analyst"] + FIXED_SUFFIX))

        # REWORK → send back to current stage
        if content.startswith("REWORK:"):
            print(f"  [manager] Sending {current} back for rework.")
            return f"{current}_entry"

        # PARALLEL FAN-OUT: planner just accepted → dispatch all specialists at once
        if _ENABLE_PARALLEL and current == "planner":
            specialists = [s for s in stages if s in SPECIALIST_POOL]
            if specialists:
                print(f"\n  ──→ Parallel fan-out: {', '.join(specialists)}")
                _progress("planner", f"Паралелна обработка: {', '.join(_label(s) for s in specialists)}")
                base = dict(state)
                base["parallel_mode"] = True
                return [Send(f"{s}_entry", base) for s in specialists]
            return "critic_entry"

        # ACCEPT → advance to next stage (sequential path)
        # Note: any pipeline extensions requested by the critic have already
        # been spliced into stages_to_run by manager_review_node, so the
        # standard "next stage" lookup below picks them up automatically.
        if current in stages:
            idx = stages.index(current)
            if idx + 1 < len(stages):
                next_stage = stages[idx + 1]
                print(f"\n  ──→ Advancing: {current} → {next_stage}")
                return f"{next_stage}_entry"

        print(f"\n  ──→ Pipeline complete!")
        return "end"

    # ── Stage entry nodes ────────────────────────────────────────
    def make_stage_entry(stage_name: str):
        def entry_node(state: AnalysisState) -> dict:
            update: dict = {"current_stage": stage_name}
            # When parallel branches converge at the critic, switch back to
            # sequential mode so the suffix (reporter) runs normally.
            if stage_name == "critic":
                update["parallel_mode"] = False
            return update
        return entry_node

    # ── Graph assembly ───────────────────────────────────────────────
    graph = StateGraph(AnalysisState)

    # Register entry + specialist nodes for ALL possible stages
    for stage in ALL_STAGES:
        graph.add_node(f"{stage}_entry", make_stage_entry(stage))
        graph.add_node(stage, make_specialist_node(stage))

    # Planner is special — not a specialist, no tools
    graph.add_node("planner_entry", make_stage_entry("planner"))
    graph.add_node("planner", planner_node)

    graph.add_node("tools", tool_node)
    graph.add_node("manager_review", manager_review_node)

    # Entry point
    graph.set_entry_point("data_loader_entry")

    # Wire: entry → node (for all stages + planner)
    for stage in ALL_STAGES:
        graph.add_edge(f"{stage}_entry", stage)
    graph.add_edge("planner_entry", "planner")

    # Wire: planner → manager_review (planner doesn't use tools)
    graph.add_edge("planner", "manager_review")

    # Wire: specialist → tools / manager_review / critic_entry (parallel join) / END
    for stage in ALL_STAGES:
        graph.add_conditional_edges(
            stage,
            specialist_router,
            {
                "tools": "tools",
                "manager_review": "manager_review",
                "critic_entry": "critic_entry",
                "end": END,
            },
        )

    # Wire: tools → back to specialist
    graph.add_conditional_edges(
        "tools",
        after_tools,
        {stage: stage for stage in ALL_STAGES},
    )

    # Wire: manager_review → next stage or rework or END
    manager_targets = {f"{stage}_entry": f"{stage}_entry" for stage in ALL_STAGES}
    manager_targets["planner_entry"] = "planner_entry"
    manager_targets["end"] = END
    graph.add_conditional_edges(
        "manager_review",
        manager_router,
        manager_targets,
    )

    return graph.compile(checkpointer=checkpointer)


# ══════════════════════════════════════════════════════════════════════════════
# Follow-Up Graph Builder
# ══════════════════════════════════════════════════════════════════════════════

FOLLOWUP_ROUTER_PROMPT = f"""{CTX_MINIMAL}

You are the Follow-Up Router. A user has already received an analysis report and
is now asking a follow-up question. Decide how to handle it.

Choose EXACTLY ONE action:

1. **SPECIALIST:<name>** — Run a specialist that produces NEW analysis and/or NEW
   files (charts, tables, sub-reports).
   Available specialists: analyst, forecaster, anomaly_detective,
   bayesian_analyst, optimizer, shift_reporter
   → USE THIS whenever the user asks to DRAW / CREATE / GENERATE / PLOT /
     НАЧЕРТАЙ / ИЗГОТВИ / ГЕНЕРИРАЙ charts, graphs, figures, time-series,
     histograms, comparisons, forecasts, anomaly maps, or any new artifact
     that does not already exist in the current report.
   → Default specialist for chart/visualisation requests: **analyst**.

2. **REFINE_REPORT** — Rewrite/expand the existing Markdown report with NO new
   analysis. Pure text edits, restructuring, adding explanatory prose.
   → Do NOT pick this if new figures or new computations are needed.

3. **ANSWER** — Reply with TEXT ONLY using already-computed results.
   → Allowed for trivial textual lookups like "what is the mean of X?" or
     "which mill had the highest PSI200?".
   → FORBIDDEN if the user asks for any new file, chart, image, plot,
     dataset export, or any computation that hasn't already been performed.

CRITICAL OUTPUT CONTRACT:
  - Respond with EXACTLY two lines.
  - Do NOT explain, justify, or pre-answer the user's question.
  - Do NOT mention filenames, numbers, or report content.
  - Any extra prose will be discarded.

Format (literally):
ACTION: <one of SPECIALIST:<name> | REFINE_REPORT | ANSWER>
INSTRUCTION: <one short sentence describing what the executor must do>
"""

FOLLOWUP_SPECIALIST_PROMPT = f"""{DOMAIN_CONTEXT}

╔══════════════════════════════════════════════════════════════════════════╗
║  ВНИМАНИЕ — ЕЗИК НА ОТГОВОРА: БЪЛГАРСКИ (BULGARIAN ONLY)                 ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Финалното AI съобщение към потребителя ТРЯБВА да бъде изцяло на         ║
║  български език (кирилица). Това включва: отговора на въпроса,           ║
║  обяснителните пасажи, заглавията на секции, коментарите към             ║
║  таблиците/графиките, изводите и препоръките.                            ║
║                                                                          ║
║  Ако извикаш write_markdown_report — съдържанието на Markdown файла      ║
║  също ТРЯБВА да е изцяло на български.                                   ║
║                                                                          ║
║  Изключения (остават непреведени): имена на колони/променливи (PSI80,    ║
║  Ore, DensityHC и т.н.), имена на файлове, единици (kWh/t, t/h, μm, %),  ║
║  числови стойности, SQL идентификатори, Markdown синтаксис.              ║
║                                                                          ║
║  Дори потребителят да зададе въпроса си на английски — отговорът        ║
║  винаги е на български.                                                  ║
╚══════════════════════════════════════════════════════════════════════════╝

You are a Follow-Up Specialist (Специалист по допълнителни въпроси). The user
has already received an analysis report and is asking a follow-up question.
The data is already loaded — use get_df() and list_dfs() to access it.

MANDATORY: Use the `skills` library for analysis. Call list_skills() to discover
available functions. Skills return standardized dicts with figures, stats, summary.

Изпълни анализа, отпечатай резултатите (print) и запази графиките в OUTPUT_DIR.
ВИНАГИ отпечатвай result['summary'] за всяка skill функция, която извикваш.
Ако потребителят иска обновяване на отчета — извикай write_markdown_report с
обновеното съдържание (на български).

Имена на смени в прозата: „първа смяна", „втора смяна", „трета смяна" (или
„Смяна 1/2/3"). Имена на мелници в прозата: „Мелница 1"…„Мелница 12".
"""


class FollowUpState(MessagesState):
    action: str        # SPECIALIST:<name>, REFINE_REPORT, or ANSWER
    instruction: str   # What to do


def build_followup_graph(
    tools: list[BaseTool],
    api_key: str,
    on_progress: Optional[Callable[[str, str], None]] = None,
    checkpointer=None,
) -> StateGraph:
    """Build a lightweight follow-up graph for conversational refinement."""
    _progress = on_progress or (lambda stage, msg: None)

    llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=api_key)

    tools_by_name = {t.name: t for t in tools}
    FOLLOWUP_TOOLS = ["execute_python", "list_output_files", "write_markdown_report", "list_skills"]
    followup_tool_objects = [tools_by_name[n] for n in FOLLOWUP_TOOLS if n in tools_by_name]
    followup_llm = llm.bind_tools(followup_tool_objects)

    # Preserve any leading SystemMessage(s) in state (e.g. the report snapshot
    # injected by the API layer) when we tail-slice the message window — they
    # must always reach the LLM, regardless of window size.
    def _split_leading_system(msgs: list[BaseMessage]) -> tuple[list[BaseMessage], list[BaseMessage]]:
        leading: list[BaseMessage] = []
        i = 0
        while i < len(msgs) and isinstance(msgs[i], SystemMessage):
            leading.append(msgs[i])
            i += 1
        return leading, msgs[i:]

    # ── Router node ─────────────────────────────────────────────────
    def followup_router_node(state: FollowUpState) -> dict:
        _progress("followup", "Анализиране на допълнителния въпрос...")
        leading_sys, rest = _split_leading_system(state["messages"])
        messages = [SystemMessage(content=FOLLOWUP_ROUTER_PROMPT)] + leading_sys + rest[-20:]

        try:
            response = llm.invoke(messages)
        except Exception as e:
            print(f"  [followup_router] Error: {str(e)[:150]}")
            return {
                "messages": [AIMessage(content="ACTION: ANSWER\nINSTRUCTION: Answer the user's question directly.", name="followup_router")],
                "action": "ANSWER",
                "instruction": "Answer the user's question directly.",
            }

        raw = response.content
        if isinstance(raw, list):
            content = "\n".join(
                item.get("text", "") if isinstance(item, dict) else str(item)
                for item in raw
            ).strip()
        else:
            content = (str(raw) if raw else "").strip()
        print(f"  [followup_router] Response: {content[:200]}")

        # Parse action / instruction from the model's output.
        action = "ANSWER"
        instruction = "Answer the user's question."
        # Action may be on the very first line OR anywhere in the response
        # (some models add prose before the contract lines). Scan all lines.
        for line in content.split("\n"):
            line = line.strip()
            if line.upper().startswith("ACTION:"):
                action = line.split(":", 1)[1].strip()
                # Allow "ACTION: SPECIALIST:analyst" by re-joining the rest:
                rest = line.split(":", 1)[1].strip()
                action = rest
            elif line.upper().startswith("INSTRUCTION:"):
                instruction = line.split(":", 1)[1].strip()

        # SAFETY NET — if the router defaulted to ANSWER but the user's last
        # message clearly asks for new artifacts, escalate to the analyst.
        # This catches the common failure mode where the LLM ignores the
        # contract and writes a hallucinated answer in place of routing.
        try:
            last_human = next(
                (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
                None,
            )
            # Inline content flattening (Gemini may return content as a list of dicts).
            def _flat(c):
                if isinstance(c, str):
                    return c
                if isinstance(c, list):
                    return " ".join(
                        (item.get("text", "") if isinstance(item, dict) else str(item))
                        for item in c
                    )
                return str(c) if c is not None else ""
            user_text = _flat(last_human.content).lower() if last_human else ""
        except Exception:
            user_text = ""
        CHART_KEYWORDS = (
            "начертай", "изготви", "генерирай", "покажи график",
            "графика", "графики", "хистограм", "визуализирай",
            "диаграм", "plot", "draw", "chart", "figure", "histogram",
            "visuali", "forecast", "прогноз",
        )
        if action.upper() == "ANSWER" and any(k in user_text for k in CHART_KEYWORDS):
            print("  [followup_router] Overriding ANSWER → SPECIALIST:analyst (chart keywords detected)")
            action = "SPECIALIST:analyst"
            instruction = (
                "Създай поисканите графики/визуализации. Използвай skills или "
                "execute_python с matplotlib, запази PNG файловете в OUTPUT_DIR и "
                "обнови доклада чрез write_markdown_report."
            )

        _progress("followup", f"Действие: {action}")
        # Store a SHORT deterministic marker in state — NEVER the model's verbose
        # output. This prevents the router's hallucinations from being mistaken
        # for the final answer by the UI or by downstream prompts.
        marker = f"[router] action={action} | instruction={instruction[:160]}"
        return {
            "messages": [AIMessage(content=marker, name="followup_router")],
            "action": action,
            "instruction": instruction,
        }

    # ── Executor node (handles all three action types) ──────────────
    def followup_executor_node(state: FollowUpState) -> dict:
        action = state.get("action", "ANSWER")
        instruction = state.get("instruction", "")
        _progress("followup", "Изпълнение на допълнителен анализ...")

        # Build a focused system prompt based on the action
        if action.upper().startswith("SPECIALIST:"):
            specialist_name = action.split(":", 1)[1].strip().lower()
            system = f"{FOLLOWUP_SPECIALIST_PROMPT}\n\nYou are acting as the {specialist_name} specialist.\nTask: {instruction}"
            _progress("followup", f"Стартиране на {_label(specialist_name) if specialist_name in _STAGE_LABELS else specialist_name}...")
        elif action.upper() == "REFINE_REPORT":
            system = (
                f"{FOLLOWUP_SPECIALIST_PROMPT}\n\n"
                f"Task: Refine/update the existing report. {instruction}\n"
                "Call list_output_files to see existing files, then call write_markdown_report "
                "with the updated content. Keep all existing analysis but add/modify as requested."
            )
            _progress("followup", "Актуализиране на доклада...")
        else:
            system = (
                f"{FOLLOWUP_SPECIALIST_PROMPT}\n\n"
                f"Task: {instruction}\n"
                "Answer the user's question using the loaded data. "
                "Use execute_python to compute answers. Print results clearly.\n\n"
                "СТРОГО ПРАВИЛО — БЕЗ ХАЛЮЦИНАЦИИ:\n"
                "• НЕ твърди, че съществуват файлове/графики, които не си потвърдил/а "
                "чрез list_output_files или които не си създал/а сам в този ход.\n"
                "• Ако потребителят иска нещо ново (графика, изчисление, обновяване "
                "на доклада), първо извикай съответния инструмент (execute_python или "
                "write_markdown_report), изчакай резултата и едва тогава обяви успех.\n"
                "• Ако не можеш да изпълниш това с наличните инструменти, кажи ясно "
                "какво липсва, вместо да си измисляш отговор."
            )
            _progress("followup", "Отговор на въпрос...")

        # Use last 30 messages for context (includes original analysis), but
        # always preserve any leading SystemMessage(s) — e.g. the injected
        # snapshot of the current report — so the LLM never loses them to the
        # tail-window truncation.
        leading_sys, rest = _split_leading_system(state["messages"])
        focused = leading_sys + rest[-30:]
        messages = [SystemMessage(content=system)] + focused

        try:
            response = followup_llm.invoke(messages)
        except Exception as e:
            print(f"  [followup_executor] Error: {str(e)[:150]}")
            return {
                "messages": [AIMessage(content=f"Error during follow-up: {str(e)[:200]}", name="followup_executor")],
            }

        response.name = "followup_executor"
        if response.tool_calls:
            tool_names = [tc["name"] for tc in response.tool_calls]
            print(f"  [followup_executor] Calling tools: {tool_names}")
        else:
            preview = (response.content[:120] + "...") if response.content and len(response.content) > 120 else response.content
            print(f"  [followup_executor] Done: \"{preview}\"")
            _progress("followup", "✓ Допълнителният анализ е завършен.")

        return {"messages": [response]}

    # ── Tool node ──────────────────────────────────────────────────
    async def followup_tool_node(state: FollowUpState) -> dict:
        last_message = state["messages"][-1]
        results = []
        for tc in last_message.tool_calls:
            tool = tools_by_name.get(tc["name"])
            if tool is None:
                results.append(ToolMessage(
                    content=f"Error: unknown tool '{tc['name']}'",
                    tool_call_id=tc["id"], name=tc["name"],
                ))
                continue
            try:
                print(f"    [followup_tool] Executing {tc['name']}...")
                output = await tool.ainvoke(tc["args"])
                results.append(ToolMessage(
                    content=str(output), tool_call_id=tc["id"], name=tc["name"],
                ))
            except Exception as e:
                results.append(ToolMessage(
                    content=f"Error: {e}", tool_call_id=tc["id"], name=tc["name"],
                ))
        return {"messages": results}

    # ── Routing ────────────────────────────────────────────────────
    def executor_router(state: FollowUpState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "followup_tools"
        return "end"

    # ── Graph assembly ─────────────────────────────────────────────
    graph = StateGraph(FollowUpState)

    graph.add_node("followup_router", followup_router_node)
    graph.add_node("followup_executor", followup_executor_node)
    graph.add_node("followup_tools", followup_tool_node)

    graph.set_entry_point("followup_router")
    graph.add_edge("followup_router", "followup_executor")
    graph.add_conditional_edges(
        "followup_executor",
        executor_router,
        {"followup_tools": "followup_tools", "end": END},
    )
    graph.add_edge("followup_tools", "followup_executor")

    return graph.compile(checkpointer=checkpointer)
