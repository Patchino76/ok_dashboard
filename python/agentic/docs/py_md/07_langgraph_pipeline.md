# 07 — LangGraph Pipeline (`graph_v3.py`)

The main analysis pipeline is built by `graph_v3.build_graph()`. It is a
LangGraph `StateGraph` with ~13 nodes, custom routing logic, and context
compression. This page covers the mechanics; agent prompts live in **08**,
planner/manager logic in **09**.

## State shape

```python
class AnalysisState(MessagesState):
    current_stage:  str          # name of the stage currently being evaluated
    stages_to_run:  list[str]    # pipeline produced by the planner
    stage_attempts: dict         # {stage_name: int} — rework counters
```

`MessagesState` provides the `messages: list[BaseMessage]` key with automatic
append semantics. Everything the agents say goes there; per-stage memory is
encoded via `msg.name`.

## Pipeline shape

```
START
  │
  ▼
data_loader_entry ─▶ data_loader ─▶ tools ─▶ data_loader ─▶ manager_review
                                                                │ ACCEPT
                                                                ▼
                                                          planner_entry ─▶ planner ─▶ manager_review
                                                                                        │ ACCEPT
                                                  ┌─────────────────────────────────────┘
                                                  ▼
          ┌──────────── (per specialist selected by planner) ────────────┐
          │                                                              │
          ▼                                                              │
   {specialist}_entry ─▶ {specialist} ⇄ tools  ─▶ manager_review ────────┘
   (analyst, forecaster, anomaly_detective, bayesian_analyst,     │ ACCEPT → next
    optimizer, shift_reporter)                                    │ REWORK → same
                                                                  ▼
                                                  code_reviewer_entry ─▶ code_reviewer
                                                                  │
                                                                  ▼
                                                         reporter_entry ─▶ reporter ─▶ END
```

Two kinds of nodes alternate:

- **`{stage}_entry`** — a trivial "setter" node that sets `current_stage=stage`
  in the state. This is how `manager_review` knows whose output it is
  inspecting.
- **`{stage}`** — the specialist LLM call (or the planner/manager).

`tools` and `manager_review` are shared by all specialists.

## Entry-node trick

```python
def make_stage_entry(stage_name: str):
    def entry_node(state): return {"current_stage": stage_name}
    return entry_node

for stage in ALL_STAGES:
    graph.add_node(f"{stage}_entry", make_stage_entry(stage))
```

Without entry nodes, every specialist would need to write `current_stage`
itself, and rework routing would have to hard-code "send back to
`{current}_entry`" in every branch. Entry nodes cleanly separate routing
from specialist logic.

## Routing in detail

### After a specialist speaks

```python
def specialist_router(state):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"            # needs a tool — run it, come back
    return "manager_review"       # done speaking — let the manager judge
```

### After tools

```python
def after_tools(state):
    # walk backward to find the most recent specialist AIMessage with tool_calls
    for msg in reversed(state["messages"]):
        if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
            return msg.name
    return "data_loader"
```

This is what makes the `{specialist} ⇄ tools` loop possible: after a tool
result lands, control returns to the same specialist so it can read the output
and continue.

### After manager_review

```python
def manager_router(state):
    last = state["messages"][-1]
    if last.content.startswith("REWORK:"):
        return f"{current}_entry"         # retry the same stage
    idx = stages.index(current)
    if idx + 1 < len(stages):
        return f"{stages[idx + 1]}_entry" # advance
    return "end"                          # reporter finished → END
```

`stages` is the planner-produced list, so the specialist sequence is **data
driven** — no hard-coded chain of edges between specialists.

## Tool binding is per-specialist

```python
tools_by_name = {t.name: t for t in tools}

TOOL_SETS = {
    "data_loader":       ["query_mill_data", "query_combined_data", "get_db_schema"],
    "analyst":           ["execute_python", "list_output_files", "list_skills"],
    "forecaster":        [... same as analyst],
    "anomaly_detective": [... same as analyst],
    "bayesian_analyst":  [... same as analyst],
    "optimizer":         [... same as analyst],
    "shift_reporter":    [... same as analyst],
    "code_reviewer":     [... same as analyst],
    "reporter":          ["list_output_files", "write_markdown_report"],
}

for name, tool_names in TOOL_SETS.items():
    specialist_llms[name] = llm.bind_tools([tools_by_name[n] for n in tool_names])
```

Three practical consequences:

1. The `reporter` cannot accidentally run more analysis.
2. The `data_loader` cannot accidentally execute Python (which would defeat
   its narrow "load and summarise" role).
3. All analysis specialists share the same tool set, so prompts differ only in
   *what kind of analysis to do*, not in *how to do tool calls*.

## Context compression

LLM cost grows linearly with message-history size, and specialists run
sequentially, so the raw history grows fast. Two helpers keep it bounded:

### `compress_messages(messages)`

```
if len(messages) > MAX_MESSAGES_WINDOW + 1:
    messages = [messages[0]] + messages[-MAX_MESSAGES_WINDOW:]
# truncate ToolMessage content to MAX_TOOL_OUTPUT_CHARS
# truncate AIMessage content to MAX_AI_MSG_CHARS (keep tool_calls intact)
```

Defaults (configurable via the UI settings panel → `AnalysisSettings`):

| Setting | Default | Purpose |
|---------|---------|---------|
| `maxToolOutputChars` | 4000 | Per tool result |
| `maxAiMessageChars` | 4000 | Per AI message |
| `maxMessagesWindow` | 20 | Tail size (plus the original user msg) |
| `maxSpecialistIterations` | 5 | Hard cap on specialist loops |

### `build_focused_context(all_msgs, stage_name)`

For each specialist invocation, this builds a **fresh, minimal message list**:

1. Keep the original user question.
2. Keep the current specialist's own prior messages + its tool results (by
   matching tool-call IDs).
3. Summarise everything else into short `[prior analysis context]` lines:
   - `query_mill_data` / `query_combined_data` results → 200-char excerpt.
   - `execute_python` tool results → if a `STRUCTURED_OUTPUT:` line is
     present, use it; otherwise take a 1200-char tail of stdout.
   - Other specialists' text → `[{name}]: {400-char excerpt}`.
   - Manager REWORK messages addressed at this specialist → included verbatim.
4. Prepend the stage's system prompt.

The result: an `analyst` running in iteration 1 sees ~7 messages instead of
30+, and the subsequent `forecaster` does too.

## Structured output protocol (skill → context bridge)

```
skill function
   └─ prints "STRUCTURED_OUTPUT:{"skill":"spc.xbar_chart","stats":{…}}"
         │
         ▼
execute_python ToolMessage(stdout="…\nSTRUCTURED_OUTPUT:{…}\n…")
         │
         ▼
build_focused_context._extract_structured_output()
         │
         ▼
appended as "[structured data]: {skill: spc.xbar_chart, stats: {…}}"
  to the next specialist's prompt
```

This is how, for example, the `reporter` can cite Cpk = 1.12 even though it
never saw the full 8 000-char stdout that produced the number.

## Specialist iteration cap

```python
iteration = sum(1 for m in state["messages"]
                if getattr(m, "name", None) == name) + 1
if iteration > MAX_SPECIALIST_ITERS:
    return {"messages": [AIMessage(content=f"[{name}] Done (iteration cap). Moving on.", name=name)]}
```

Prevents any specialist from livelocking on a failing tool call. Combined with
`MAX_REWORKS_PER_STAGE = 1` in the manager, the worst case for any single
stage is 5 LLM calls + 1 rework loop = ~10 LLM calls.

## Progress callback

```python
_progress = on_progress or (lambda stage, msg: None)
```

`on_progress(stage, message)` is supplied by `api_endpoint.py` and appends a
timestamped entry to `_analyses[id]["progress"]`. The UI polls this and shows
Bulgarian status lines:

- `"Зареждане на данни..."`
- `"Анализатор: Статистически анализ, разпределения и SPC диаграми..."`
- `"⟳ Детектор на аномалии: Необходима е корекция, повторен опит..."`
- `"✓ Генериране на отчет завърши."`

The CLI variant (`main.py`) omits the callback, so progress is logged only to
stdout.

## Checkpointing

`build_graph(..., checkpointer=None)` accepts an optional LangGraph
`checkpointer` (e.g. `SqliteSaver`). The API currently passes `None` — state
is kept only in `_analyses[id]` — but `checkpoints.db` exists in the folder
for when persistent resumable graphs are enabled.
