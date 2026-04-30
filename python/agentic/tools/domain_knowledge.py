"""
Domain Knowledge Reference for the Ore Dressing Plant (Ellatzite).

Provides plant specifications, variable ranges, units, operational thresholds,
and shift schedules. Used by agents to make correct domain-aware analysis.

Source: mills-parameters.ts + operational knowledge.
"""

import json
import mcp.types as types

# ── Plant Variables ──────────────────────────────────────────────────────────

PLANT_VARIABLES = {
    "Ore": {
        "name_bg": "Разход на руда",
        "unit": "t/h",
        "min": 140,
        "max": 220,
        "abs_max": 240,
        "varType": "MV",
        "description": "Ore feed rate to the ball mill",
        "description_bg": "Разход на входяща руда към мелницата",
        "downtime_threshold": 10,
        "notes": "Values below 10 t/h indicate mill is stopped/idle.",
    },
    "WaterMill": {
        "name_bg": "Вода в мелницата",
        "unit": "m³/h",
        "min": 5,
        "max": 25,
        "varType": "MV",
        "description": "Water flow into the ball mill",
        "description_bg": "Разход на вода в мелницата",
        "notes": "Controls slurry density inside the mill.",
    },
    "WaterZumpf": {
        "name_bg": "Вода в зумпфа",
        "unit": "m³/h",
        "min": 140,
        "max": 250,
        "varType": "MV",
        "description": "Water flow into the sump",
        "description_bg": "Разход на вода в зумпф",
        "notes": "Dilution water added to the sump before pumping to hydrocyclone.",
    },
    "PulpHC": {
        "name_bg": "Пулп в ХЦ",
        "unit": "m³/h",
        "min": 400,
        "max": 600,
        "varType": "CV",
        "description": "Pulp flow to hydrocyclone",
        "description_bg": "Разход на пулп в хидроциклон",
        "notes": "Controlled variable — depends on pump RPM and sump level.",
    },
    "DensityHC": {
        "name_bg": "Плътност на ХЦ",
        "unit": "kg/m³",
        "min": 1500,
        "max": 1900,
        "varType": "CV",
        "description": "Hydrocyclone feed slurry density",
        "description_bg": "Плътност на пулп в хидроциклона",
        "notes": "Higher density = coarser grind. Typical operating: 1600-1800.",
    },
    "PressureHC": {
        "name_bg": "Налягане на ХЦ",
        "unit": "bar",
        "min": 0.2,
        "max": 0.5,
        "varType": "CV",
        "description": "Hydrocyclone feed pressure",
        "description_bg": "Работно налягане в хидроциклона",
        "notes": "Higher pressure = finer classification cut point.",
    },
    "PumpRPM": {
        "name_bg": "Обороти на помпата",
        "unit": "rev/min",
        "min": 0,
        "max": 800,
        "varType": "CV",
        "description": "Sump pump speed",
        "description_bg": "Обороти на работната помпа",
    },
    "CirculativeLoad": {
        "name_bg": "Цирк. товар",
        "unit": "t/t",
        "min": 1.0,
        "max": 3.0,
        "varType": "CV",
        "description": "Circulative load ratio (underflow/feed)",
        "description_bg": "Циркулационен товар на твърдо вещество в МА",
        "notes": "Ratio of hydrocyclone underflow to fresh feed. Typical: 1.5-2.5.",
    },
    "MotorAmp": {
        "name_bg": "Ток на електродвигателя",
        "unit": "A",
        "min": 150,
        "max": 250,
        "varType": "DV",
        "description": "Mill motor amperage (disturbance variable)",
        "description_bg": "Консумация на ток от електродвигателя на мелницата",
        "notes": "Indicates mill load. Higher amps = heavier charge. Real-time sensor.",
    },
    "Shisti": {
        "name_bg": "Шисти",
        "unit": "%",
        "min": 0.0,
        "max": 100.0,
        "varType": "DV",
        "description": "Schist content in ore",
        "description_bg": "Процентно съдържание на шисти в рудата",
        "notes": "Ore quality parameter from lab analysis. Higher = harder to grind.",
    },
    "Daiki": {
        "name_bg": "Дайки",
        "unit": "%",
        "min": 0.0,
        "max": 100.0,
        "varType": "DV",
        "description": "Dyke rock content in ore",
        "description_bg": "Процентно съдържание на дайки в рудата",
        "notes": "Ore quality parameter from lab analysis. Higher = harder to grind.",
    },
    "Grano": {
        "name_bg": "Гранодиорити",
        "unit": "%",
        "min": 0.0,
        "max": 100.0,
        "varType": "DV",
        "description": "Granodiorite content in ore",
        "description_bg": "Процентно съдържание на гранодиорити в рудата",
    },
    "Class_12": {
        "name_bg": "Клас 12",
        "unit": "%",
        "min": 0.0,
        "max": 5.0,
        "varType": "DV",
        "description": "Percentage of material in +12mm class",
        "description_bg": "Процент материал в клас +12 милиметра",
    },
    "Class_15": {
        "name_bg": "Клас 15",
        "unit": "%",
        "min": 0.0,
        "max": 2.0,
        "varType": "DV",
        "description": "Percentage of material in +15mm class",
        "description_bg": "Процент материал в клас +15 милиметра",
    },
    "FE": {
        "name_bg": "Желязо",
        "unit": "%",
        "min": 2.0,
        "max": 5.0,
        "varType": "DV",
        "description": "Iron content in pulp",
        "description_bg": "Процент съдържание на желязо в пулпа",
        "notes": "Real-time sensor. Indicator of ore composition.",
    },
    "PSI80": {
        "name_bg": "Фракция -80 μm",
        "unit": "%",
        "min": 40,
        "max": 60,
        "varType": "TARGET",
        "description": "Particle size classification at 80 microns (% passing)",
        "description_bg": "Класификация на размерите на частиците при 80 микрона",
        "spec_low": 40,
        "spec_high": 60,
        "target": 50,
        "notes": "Primary grind fineness target. Higher = finer grind.",
    },
    "PSI200": {
        "name_bg": "Фракция +200 μm",
        "unit": "%",
        "min": 16,
        "max": 30,
        "varType": "TARGET",
        "description": "Particle size classification at 200 microns (% retained)",
        "description_bg": "Основна целева стойност — финност на смилане +200 микрона",
        "spec_low": 16,
        "spec_high": 30,
        "target": 23,
        "notes": "Main target variable. Lower = finer grind = better flotation recovery.",
    },
    "Power": {
        "name_bg": "Мощност",
        "unit": "kW",
        "min": 0,
        "max": 3000,
        "varType": "DV",
        "description": "Mill motor power consumption",
        "description_bg": "Мощност на електродвигателя на мелницата",
    },
    "ZumpfLevel": {
        "name_bg": "Ниво на зумпф",
        "unit": "mm",
        "min": 0,
        "max": 3000,
        "varType": "CV",
        "description": "Sump level",
        "description_bg": "Ниво на зумпфа",
        "notes": "Controlled by pump speed. Too high = overflow risk.",
    },
}

# ── Shift Schedule ───────────────────────────────────────────────────────────

SHIFTS = {
    "shift_1": {"start": "06:00", "end": "14:00", "label": "Смяна 1 (06-14)"},
    "shift_2": {"start": "14:00", "end": "22:00", "label": "Смяна 2 (14-22)"},
    "shift_3": {"start": "22:00", "end": "06:00", "label": "Смяна 3 (22-06)"},
}

# ── OEE Configuration (plant-wide) ───────────────────────────────────────────
# Used by skills.oee.shift_oee / multi_mill_oee and referenced in DOMAIN_CONTEXT.
OEE_CONFIG = {
    "speed_ref_tph": 180.0,           # Ore @ 100% performance
    "speed_variable": "Ore",
    "quality_variable": "PSI200",
    "quality_floor_pct": 18.0,        # PSI200 ≤ 18% → 100% quality (zero scrap)
    "quality_limit_pct": 30.0,        # PSI200 ≥ 30% → 0% quality (full scrap)
    "downtime_threshold_tph": 50.0,   # Ore < 50 t/h → downtime
    "formula": "OEE = Availability × Performance × Quality",
    "availability": "running_minutes / total_minutes  (running := Ore ≥ 50 t/h)",
    "performance":  "min(mean(Ore[running]) / 180, 1.0)",
    "quality":      "clamp((30 - mean(PSI200[running])) / (30 - 18), 0, 1)",
    "skill_single_mill": "skills.oee.shift_oee(df, output_dir=OUTPUT_DIR)",
    "skill_multi_mill":  "skills.oee.multi_mill_oee({label: df, ...}, output_dir=OUTPUT_DIR)",
}

# ── Mill Names ───────────────────────────────────────────────────────────────

MILL_NAMES = [f"Mill{str(i).zfill(2)}" for i in range(1, 13)]

# ── Variable Type Groups ─────────────────────────────────────────────────────

MV_VARIABLES = [k for k, v in PLANT_VARIABLES.items() if v["varType"] == "MV"]
CV_VARIABLES = [k for k, v in PLANT_VARIABLES.items() if v["varType"] == "CV"]
DV_VARIABLES = [k for k, v in PLANT_VARIABLES.items() if v["varType"] == "DV"]
TARGET_VARIABLES = [k for k, v in PLANT_VARIABLES.items() if v["varType"] == "TARGET"]

# ── Helper to get spec limits dict for SPC ───────────────────────────────────

def get_spec_limits(variable: str) -> dict | None:
    """Return spec limits for a variable, or None if not defined."""
    info = PLANT_VARIABLES.get(variable)
    if not info:
        return None
    if "spec_low" in info and "spec_high" in info:
        return {"LSL": info["spec_low"], "USL": info["spec_high"],
                "target": info.get("target")}
    return {"LSL": info["min"], "USL": info["max"]}

# ── Compact summary for agent prompts ────────────────────────────────────────

def get_plant_summary() -> str:
    """Return a concise text summary of all variables for agent context."""
    lines = ["Plant Variable Reference (Ellatzite Ore Dressing, 12 Ball Mills):", ""]
    for var, info in PLANT_VARIABLES.items():
        spec = ""
        if "spec_low" in info:
            spec = f" [spec: {info['spec_low']}-{info['spec_high']}]"
        notes = f" — {info['notes']}" if info.get("notes") else ""
        lines.append(
            f"  {var} ({info['varType']}): {info['min']}-{info['max']} {info['unit']}{spec}{notes}"
        )
    lines.append("")
    lines.append("Shifts: 06:00-14:00 / 14:00-22:00 / 22:00-06:00")
    lines.append(f"Mills: {', '.join(MILL_NAMES)}")
    lines.append("Downtime threshold: Ore < 10 t/h")
    lines.append("")
    lines.append("OEE Configuration (plant-wide):")
    lines.append(f"  Formula: {OEE_CONFIG['formula']}")
    lines.append(f"  Availability: {OEE_CONFIG['availability']}")
    lines.append(f"  Performance:  {OEE_CONFIG['performance']}  (speed_ref = {OEE_CONFIG['speed_ref_tph']} t/h)")
    lines.append(
        f"  Quality:      {OEE_CONFIG['quality']}  "
        f"(PSI200 floor = {OEE_CONFIG['quality_floor_pct']}% → Q=100%, "
        f"limit = {OEE_CONFIG['quality_limit_pct']}% → Q=0%)"
    )
    lines.append(f"  Downtime threshold for OEE: Ore < {OEE_CONFIG['downtime_threshold_tph']} t/h")
    lines.append(f"  Single mill: {OEE_CONFIG['skill_single_mill']}")
    lines.append(f"  Multi-mill:  {OEE_CONFIG['skill_multi_mill']}")
    return "\n".join(lines)

# ── MCP Tool Definition ─────────────────────────────────────────────────────

get_domain_knowledge_tool = types.Tool(
    name="get_domain_knowledge",
    description=(
        "Get plant domain knowledge: variable specifications (min, max, units, types), "
        "shift schedules, mill names, and operational thresholds. "
        "Use this to understand what each variable means and what its normal operating range is."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "variable": {
                "type": "string",
                "description": "Optional: specific variable name (e.g. 'PSI80'). "
                               "If omitted, returns full plant reference.",
            },
        },
        "required": [],
    },
)


async def get_domain_knowledge(arguments: dict) -> list[types.TextContent]:
    """Handler for the get_domain_knowledge MCP tool."""
    variable = arguments.get("variable", "").strip()

    if variable and variable in PLANT_VARIABLES:
        info = PLANT_VARIABLES[variable]
        result = {variable: info}
        return [types.TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    # Return full summary
    return [types.TextContent(type="text", text=get_plant_summary())]
