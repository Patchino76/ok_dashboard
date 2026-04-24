# 06 — Skills Library

The `skills/` package is a set of tested, reusable analysis functions. The
multi-agent system prefers them over raw matplotlib / sklearn code for three
reasons:

1. **Consistency** — every function returns the same shape, so the downstream
   reporter knows how to consume results.
2. **Cost** — agents don't have to re-derive boilerplate chart styling, control-
   limit formulas, Prophet hyperparameters, etc.
3. **Structured context** — every call auto-emits a `STRUCTURED_OUTPUT:{json}`
   line so subsequent specialists receive compact facts instead of raw stdout.

## The contract

Every public skill function returns:

```python
{
    "figures": ["path/to/chart1.png", …],   # PNGs saved to output_dir
    "stats":   {"some_metric": 1.23, …},    # JSON-serialisable numerics
    "summary": "Human readable multi-line text"
}
```

If the analysis cannot run (empty df, missing column, etc.), `figures` is `[]`
and `summary` explains why. Skills never raise on expected missing-data
conditions; they return and let the caller print the summary.

## Auto-wrapped structured output

`skills/__init__.py` wraps every public function at import time:

```python
@functools.wraps(func)
def wrapper(*args, **kwargs):
    result = func(*args, **kwargs)
    if isinstance(result, dict) and "stats" in result:
        payload = {
            "skill":   f"{module_name}.{func.__name__}",
            "stats":   result.get("stats", {}),
            "figures": [basename(f) for f in result.get("figures", [])],
        }
        print(f"STRUCTURED_OUTPUT:{json.dumps(payload, …)}")
    return result
```

The `STRUCTURED_OUTPUT:` line is picked up by
`graph_v3._extract_structured_output` when the `execute_python` ToolMessage
flows back through `build_focused_context`. Downstream specialists see a
compact `[structured data]: {…}` entry instead of a giant blob of stdout.

## Module catalogue

```
skills/
├── eda.py           — Exploratory data analysis
├── spc.py           — Statistical Process Control
├── anomaly.py       — Anomaly detection + regimes
├── forecasting.py   — Prophet + seasonal decomposition
├── shift_kpi.py     — Per-shift KPIs, downtime, benchmarking
└── optimization.py  — Pareto, sensitivity, optimal windows
```

### `skills.eda`

| Function | What it does |
|----------|--------------|
| `descriptive_stats(df, columns=None)` | count/mean/std/min/q25/q50/q75/max + missing % per column. No figure. |
| `distribution_plots(df, columns=None, output_dir)` | Histogram grid with mean line per variable. → `distribution_plots.png` |
| `correlation_heatmap(df, columns=None, output_dir)` | Lower-triangular annotated heatmap + top-10 `\|corr\|` pairs. → `correlation_heatmap.png` |
| `time_series_overview(df, columns=None, output_dir)` | Stacked line plots with 1-hour rolling mean overlay. → `time_series_overview.png` |

### `skills.spc`

| Function | What it does |
|----------|--------------|
| `control_limits(series, n_sigma=3)` | Returns `{CL, UCL, LCL, std}` — building block. |
| `xbar_chart(df, column, spec_limits, window='1h', n_sigma=3, output_dir)` | X-bar chart on rolling subgroup means; overlays UCL/LCL/LSL/USL; reports out-of-control %. |
| `process_capability(df, column, lsl, usl, output_dir)` | Histogram vs spec; computes Cp, Cpk, Pp, Ppk, fraction out of spec. |
| `control_limits_table(df, columns)` | Tabulated CL/UCL/LCL for many variables at once. |

### `skills.anomaly`

| Function | What it does |
|----------|--------------|
| `isolation_forest_analysis(df, features, contamination=0.05, output_dir)` | Fits IsolationForest, scatter of anomaly score, feature importance ranking. |
| `anomaly_timeline(df, features, output_dir)` | Timeline plot marking anomalous windows. |
| `regime_detection(df, features, output_dir)` | DBSCAN clustering on scaled features; per-regime means and counts. |

### `skills.forecasting`

| Function | What it does |
|----------|--------------|
| `prophet_forecast(df, column, periods=480, freq='1min', output_dir)` | Fits Prophet, plots forecast + uncertainty, returns trend + changepoints. |
| `seasonal_decomposition(df, column, output_dir)` | Additive STL decomposition (trend / seasonal / resid); saves the standard 3-panel chart. |

### `skills.shift_kpi`

| Function | What it does |
|----------|--------------|
| `assign_shifts(df)` | Adds `shift` and `shift_date` columns honouring the 22:00→06:00 wrap. |
| `shift_kpis(df, columns)` | Per-shift mean/std/count and uptime-%, throughput. |
| `shift_comparison_chart(df, columns, output_dir)` | Box plots per shift for each variable. |
| `downtime_analysis(df, ore_col='Ore', threshold=10, output_dir)` | Total downtime hours, top events with timestamps and durations. |

### `skills.optimization`

| Function | What it does |
|----------|--------------|
| `pareto_frontier(df, x, y, x_minimize=False, y_minimize=True, output_dir)` | Identifies non-dominated points in (throughput, quality) space. |
| `sensitivity_analysis(df, target, feature_cols, output_dir)` | Linear + tree importance ranking of features' effect on `target`. |
| `optimal_windows(df, target, feature_cols, output_dir)` | Finds feature ranges where target is in its best quartile. |

## How skills reach the executor namespace

`tools/python_executor.py` does the wiring:

```python
try:
    import skills as _skills_module
    _ADVANCED_LIBS["skills"] = _skills_module
except ImportError: …

# in execute_python()
namespace = {
    …,
    "list_skills": lambda module=None: print(_format_catalog(module)),
}
namespace.update(_ADVANCED_LIBS)      # 'skills' lands in namespace here
```

So inside any `execute_python` call an agent can simply write:

```python
result = skills.spc.xbar_chart(df, 'PSI80',
                               spec_limits=(40, 60),
                               output_dir=OUTPUT_DIR)
print(result['summary'])
```

No import statement is needed.

## Discovery: `list_skills` MCP tool

The server-side `skill_registry.py` introspects every public function in every
skill module using `inspect`, extracts the first paragraph of the docstring,
the signature, and the "Returns:" section, and formats it as text. The
resulting catalogue is what gets returned by the `list_skills` MCP tool.

Specialists are explicitly instructed (in their system prompts) to call
`list_skills()` first if they are unsure which skill to use, rather than
writing raw pandas.

## Best practices for new skills

1. Return `{figures, stats, summary}` — nothing else.
2. Save figures with `plt.savefig(…, dpi=150, bbox_inches='tight')` then
   `plt.close()` so the executor namespace doesn't leak figures.
3. Put numeric results in `stats` (nested dicts are fine but keep it
   JSON-serialisable — the structured-output wrapper uses `default=str`).
4. Keep `summary` human-readable and multi-line; the reporter will paste
   pieces of it into the final Markdown.
5. First-paragraph docstring = tool description. Document the `Returns:`
   section because it goes into the `list_skills` catalogue verbatim.
