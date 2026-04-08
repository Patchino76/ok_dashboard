"""
analysis_templates.py -- Pre-defined analysis pipeline templates.
=================================================================
Each template specifies which specialists to run, bypassing the planner.
Used when the user selects a template from the UI or passes template_id via API.
"""

TEMPLATES = {
    "comprehensive": {
        "label": "Пълен анализ",
        "label_en": "Comprehensive Analysis",
        "description": "EDA + аномалии + сменен отчет — пълен доклад за мелница",
        "specialists": ["analyst", "anomaly_detective", "shift_reporter"],
    },
    "forecast": {
        "label": "Прогноза",
        "label_en": "Forecast Report",
        "description": "EDA + прогнозиране на трендове с Prophet",
        "specialists": ["analyst", "forecaster"],
    },
    "quality": {
        "label": "Качество на смилане",
        "label_en": "Grinding Quality",
        "description": "Анализ на PSI80/PSI200, SPC контролни карти и оптимизация",
        "specialists": ["analyst", "optimizer"],
    },
    "shift_comparison": {
        "label": "Сравнение на смени",
        "label_en": "Shift Comparison",
        "description": "KPI по смени, сравнение, престои и ефективност",
        "specialists": ["shift_reporter"],
    },
    "anomaly_investigation": {
        "label": "Разследване на аномалии",
        "label_en": "Anomaly Investigation",
        "description": "Детекция на аномалии + Bayesian анализ на причини",
        "specialists": ["anomaly_detective", "bayesian_analyst"],
    },
    "optimization": {
        "label": "Оптимизация",
        "label_en": "Process Optimization",
        "description": "Pareto анализ, чувствителност и оптимални прозорци",
        "specialists": ["analyst", "optimizer"],
    },
}


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
