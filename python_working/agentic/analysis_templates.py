"""
analysis_templates.py -- Pre-defined analysis pipeline templates.
=================================================================
Each template specifies which specialists to run, bypassing the planner.
Used when the user selects a template from the UI or passes template_id via API.

Each template may also declare an optional ``budgets`` dict to override the
default per-stage context limits. Keys mirror AnalysisSettings:
  • maxToolOutputChars        — cap on tool output kept in history
  • maxAiMessageChars         — cap on AI message text kept in history
  • maxMessagesWindow         — sliding window of recent messages
  • maxSpecialistIterations   — max tool-use rounds per specialist
The user's UI settings still win — template budgets are applied ONLY for
keys the user has not explicitly overridden.
"""

# Default budgets are intentionally generous. Tighten per template only when
# the analysis pattern is well-understood (e.g. shift comparison rarely needs
# > 2 iterations per specialist).
TEMPLATES = {
    "comprehensive": {
        "label": "Пълен анализ",
        "label_en": "Comprehensive Analysis",
        "description": "EDA + аномалии + сменен отчет — пълен доклад за мелница",
        "specialists": ["analyst", "anomaly_detective", "shift_reporter"],
        # Multi-specialist pipeline: keep generous iters but trim per-message
        # budgets so the context window doesn't blow up across 3+ specialists.
        "budgets": {
            "maxAiMessageChars": 3500,
            "maxMessagesWindow": 18,
            "maxSpecialistIterations": 5,
        },
    },
    "forecast": {
        "label": "Прогноза",
        "label_en": "Forecast Report",
        "description": "EDA + прогнозиране на трендове с Prophet",
        "specialists": ["analyst", "forecaster"],
        # Forecasting needs more iterations to tune the model + render charts.
        "budgets": {
            "maxSpecialistIterations": 6,
            "maxToolOutputChars": 2500,
        },
    },
    "quality": {
        "label": "Качество на смилане",
        "label_en": "Grinding Quality",
        "description": "Анализ на PSI80/PSI200, SPC контролни карти и оптимизация",
        "specialists": ["analyst", "optimizer"],
        "budgets": {
            "maxSpecialistIterations": 5,
        },
    },
    "shift_comparison": {
        "label": "Сравнение на смени",
        "label_en": "Shift Comparison",
        "description": "KPI по смени, сравнение, престои и ефективност",
        "specialists": ["shift_reporter"],
        # Single-specialist pipeline: smallest budget — one focused job.
        "budgets": {
            "maxSpecialistIterations": 4,
            "maxMessagesWindow": 12,
        },
    },
    "anomaly_investigation": {
        "label": "Разследване на аномалии",
        "label_en": "Anomaly Investigation",
        "description": "Детекция на аномалии + Bayesian анализ на причини",
        "specialists": ["anomaly_detective", "bayesian_analyst"],
        # Bayesian analysis can produce long traces — cap output strictly.
        "budgets": {
            "maxToolOutputChars": 1800,
            "maxSpecialistIterations": 5,
        },
    },
    "optimization": {
        "label": "Оптимизация",
        "label_en": "Process Optimization",
        "description": "Pareto анализ, чувствителност и оптимални прозорци",
        "specialists": ["analyst", "optimizer"],
        "budgets": {
            "maxSpecialistIterations": 6,
        },
    },
}


def get_template_budgets(template_id: str) -> dict:
    """Return the budget override dict for a template (empty dict if none)."""
    tpl = TEMPLATES.get(template_id)
    return dict(tpl.get("budgets", {})) if tpl else {}


def get_template(template_id: str) -> dict | None:
    """Return a template by ID, or None if not found."""
    return TEMPLATES.get(template_id)


def get_template_specialists(template_id: str) -> list[str] | None:
    """Return the specialist list for a template, or None if not found."""
    tpl = TEMPLATES.get(template_id)
    return tpl["specialists"] if tpl else None


def list_templates() -> list[dict]:
    """Return all templates as a list of dicts with id included."""
    return [
        {"id": tid, **tpl}
        for tid, tpl in TEMPLATES.items()
    ]
