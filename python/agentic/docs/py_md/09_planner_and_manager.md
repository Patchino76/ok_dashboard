# 09 — Planner and Manager Review

Two special nodes govern the *shape* of the pipeline and the *quality* of what
each specialist produces. Neither does domain analysis of its own.

## The Planner

### Purpose

Take the user's question plus the data-loader's summary and decide **which 1–4
specialists to run, in what order**. This avoids wasting LLM calls on
specialists irrelevant to the question.

### Inputs

- `DOMAIN_CONTEXT` (standard plant preamble).
- A bulleted description of each specialist with a *"USE when …"* clause.
- The compressed, tool-stripped history so far (user question +
  data-loader summary).

### Output format (strict)

```
SPECIALISTS: analyst, anomaly_detective, shift_reporter
RATIONALE: One sentence explaining why these specialists were chosen.
```

The parser is deliberately lenient — lower-cased, space-stripped tokens are
matched against `SPECIALIST_POOL`; anything that doesn't match is dropped.
If no valid specialist is parsed, the planner falls back to `['analyst']`.

### Pipeline assembly

```python
stages = FIXED_PREFIX + selected + FIXED_SUFFIX
#           = ["data_loader", "planner"]
#           + ["analyst", "anomaly_detective", "shift_reporter"]
#           + ["code_reviewer", "reporter"]
```

`stages_to_run` is stored in the state and drives `manager_router` — it is
**the** source of truth for what comes next after each ACCEPT.

### Heuristics baked into the prompt

- Always include `analyst` for general/vague requests.
- Select 1–4 specialists, never all 6 (keep analysis focused).
- Order matters: foundational first, specialised later.
- Shortcuts:
  - `"comprehensive report"` / `"full analysis"` → analyst, anomaly_detective, shift_reporter
  - `"forecast"` / `"predict"` → analyst, forecaster
  - `"optimize"` / `"best settings"` → analyst, optimizer
  - `"compare shifts"` / `"KPI report"` → shift_reporter
  - `"anomaly"` / `"root cause"` → anomaly_detective
  - `"uncertainty"` / `"how confident"` → analyst, bayesian_analyst

### Template override (bypass)

If the API request carries a `template_id`, the planner **skips the LLM call
entirely** and uses the template's specialist list directly. See **11 —
Analysis Templates**.

```python
if _template_id:
    tpl_specialists = get_template_specialists(_template_id)
    if tpl_specialists:
        selected = [s for s in tpl_specialists if s in SPECIALIST_POOL]
        stages = FIXED_PREFIX + selected + FIXED_SUFFIX
        # returns immediately, progress message: "Шаблон: Анализатор → …"
```

### Error fallback

If the Gemini call raises, the planner defaults to `analyst` only, logs the
error, and still produces a legal `stages_to_run`. The pipeline never fails at
planning.

## The Manager Review

### Purpose

After every specialist finishes speaking (no more tool calls), `manager_review`
decides one of two things:

- **ACCEPT** → advance to the next stage in `stages_to_run`.
- **REWORK** → send control back to `{current_stage}_entry` for another pass.

### Fast path: auto-accept

Infrastructure stages are never subjected to LLM review:

```python
_AUTO_ACCEPT_STAGES = {"data_loader", "planner", "code_reviewer", "reporter"}
```

For these, the manager immediately emits `ACCEPT: {stage} completed.` and
advances.

### Fast path: heuristic check

For the six analysis specialists, `_heuristic_check` scans the tail of the
message history for the most recent `execute_python` tool result belonging to
this specialist and looks for:

- `has_tool_output` — the specialist actually called `execute_python`.
- `has_new_files` — the result's `new_files` list is non-empty.
- `has_error` — substrings `"error"`, `"Traceback"`, or `"Error:"` appear.

```
if has_tool_output and has_new_files and not has_error:
    ACCEPT: "Heuristic auto-accept: {stage} produced files with no errors."
```

This skips most LLM reviews — the common case of "specialist ran,
produced charts, clean stdout" doesn't burn Gemini calls.

### Slow path: LLM review

Only reached when the heuristic is inconclusive (no files *or* an error was
detected *and* rework budget is not exhausted). The manager calls Gemini with
`MANAGER_REVIEW_PROMPT`:

```
Evaluate the last specialist's output for:
- Completeness: charts AND numerical results?
- Quality: are charts well-formatted, numbers reasonable?
- Correctness: errors, NaN, unreasonable values?
- Actionability: optimizer/shift_reporter must provide specific recommendations.

Respond with EXACTLY one of:
- ACCEPT: [brief reason]
- REWORK: [specific instructions on what to fix]
```

Response is normalised (content starts with `REWORK` or not) into the two
decisions.

### Rework budget

```python
MAX_REWORKS_PER_STAGE = 1
```

Each stage gets **one** retry. `stage_attempts[stage]` counts calls; once it
exceeds the budget the manager short-circuits to ACCEPT regardless of quality.

Combined with the per-specialist iteration cap (`MAX_SPECIALIST_ITERS = 5`,
tunable per request), the worst-case LLM call budget per stage is:

```
1 initial + (≤5 tool-round-trips per attempt) + 1 rework + (≤5 rounds) ≈ 12 calls
```

In practice most stages finish in 2–3 LLM calls.

### Progress feedback

When the manager decides REWORK, a callback fires:

```python
_progress("manager", f"⟳ {_label(current)}: Необходима е корекция, повторен опит...")
```

This is how the user sees *"⟳ Анализатор: Необходима е корекция, повторен
опит..."* in the UI progress bar.

### Why the two-phase design?

A pure LLM judge would double the token cost of every analysis. A pure
heuristic would miss subtle bugs (e.g. Cpk = 0.02 produced without errors).
Combining them captures the common cheap case while still letting the LLM
catch real quality problems.

## Routing summary

```
                         ┌───────────────────────┐
                         │ specialist produces   │
                         │ a non-tool AIMessage  │
                         └──────────┬────────────┘
                                    │
                                    ▼
                            manager_review
                         ┌──────────┬────────────┐
                         │          │            │
           infrastructure│    heuristic pass │  LLM review
             stage?      │    (files ✓,      │  needed?
                         │     no errors)    │
                         ▼          ▼            ▼
                    ACCEPT       ACCEPT     ACCEPT or REWORK
                         │          │            │
                         └────┬─────┴────┬───────┘
                              │          │
                              │ ACCEPT   │ REWORK
                              ▼          ▼
                    next stage entry   same stage entry
                         (advance)        (retry, +1 attempt)
```
