# Mills XGBoost Optimization: Detailed Explanation

This document explains how the mills-xgboost optimization endpoint works end-to-end, including how Optuna is used to search for optimal feature setpoints that maximize (or minimize) the model’s predicted target. It references concrete code in this repository with annotated snippets.

- Backend entrypoints are in `python/mills-xgboost/app/api/endpoints.py`
- Model code is in `python/mills-xgboost/app/models/xgboost_model.py`
- A local demo script/visualizer is in `python/mills-xgboost/app/optimization/test_optuna_opt.py`

---

## High-level Overview

- You call `POST /api/v1/ml/optimize` with:
  - `model_id`: which trained model to use (e.g., `xgboost_PSI80_mill8`)
  - `parameter_bounds`: per-feature `[min, max]` ranges for the search
  - `n_iter`: number of Optuna trials (default 25)
  - `maximize`: whether to maximize or minimize the model output
- The server wraps your trained model with a `BlackBoxFunction` that maps feature inputs → prediction (target value).
- Optuna runs a study and proposes feature values within the bounds for each trial.
- For each trial, the `BlackBoxFunction` predicts a target value.
- After `n_iter` trials, the endpoint returns `best_params`, `best_target`, top-5 `recommendations`, and exports all trials to CSV.

---

## Key Files and Symbols

- `api/endpoints.py`
  - `BlackBoxFunction` — thin wrapper around model prediction used by Optuna
  - `optimize_with_optuna()` — defines objective function and runs an Optuna study
  - `optimize_parameters()` — FastAPI handler for `POST /optimize`
- `models/xgboost_model.py`
  - `MillsXGBoostModel.predict()` — performs scaling + XGBoost prediction
- `optimization/test_optuna_opt.py`
  - Standalone demo that mirrors the endpoint logic and generates plots

---

## Endpoint Request/Response

- Path: `/api/v1/ml/optimize`
- Handler: `optimize_parameters()` in `api/endpoints.py`

Example request:

```json
{
  "model_id": "xgboost_PSI80_mill8",
  "parameter_bounds": {
    "Ore": [160, 200],
    "WaterMill": [5, 20],
    "WaterZumpf": [160, 250],
    "PressureHC": [70, 90],
    "DensityHC": [1.5, 1.9],
    "MotorAmp": [30, 50],
    "Shisti": [0.05, 0.3],
    "Daiki": [0.1, 0.4]
  },
  "n_iter": 50,
  "maximize": true
}
```

Example response (shape):

```json
{
  "best_params": { "Ore": 187.2, "WaterMill": 10.1, ... },
  "best_target": 79.35,
  "target_col": "PSI80",
  "maximize": true,
  "recommendations": [
    { "params": { ... }, "predicted_value": 79.35 },
    { "params": { ... }, "predicted_value": 79.12 },
    { "params": { ... }, "predicted_value": 78.96 }
  ],
  "model_id": "xgboost_PSI80_mill8"
}
```

---

## Implementation Details

### 1) BlackBoxFunction — model wrapper

`api/endpoints.py`

```python
class BlackBoxFunction:
    """
    A black box function that loads an XGBoost model and predicts output
    based on input features. This function will be optimized using Optuna.
    """
    def __init__(self, model_id: str, xgb_model=None, maximize: bool = True):
        self.model_id = model_id
        self.maximize = maximize
        self.xgb_model = xgb_model
        self.scaler = None
        self.metadata = None
        self.features = None
        self.target_col = None
        self.parameter_bounds = None
        if self.xgb_model is None:
            self._load_model()  # loads model, scaler, metadata, features
        else:
            self.features = xgb_model.features
            self.target_col = xgb_model.target_col

    def _load_model(self):
        # Resolves paths under mills-xgboost/models, loads saved model/scaler/metadata
        self.xgb_model = MillsXGBoostModel()
        self.xgb_model.load_model(model_path, scaler_path, metadata_path_if_exists)
        # self.features and self.target_col populated from metadata if present

    def set_parameter_bounds(self, parameter_bounds: Dict[str, List[float]]):
        self.parameter_bounds = parameter_bounds
        # Warns if bounds reference unknown features or if some model features lack bounds

    def __call__(self, **features) -> float:
        # Complete the feature vector with defaults for any missing ones
        input_data = {feature: features.get(feature, 0.0) for feature in self.features}
        prediction = self.xgb_model.predict(input_data)[0]
        return prediction if self.maximize else -prediction
```

Notes:
- The black box returns the prediction directly if `maximize = True`.
- If `maximize = False`, it returns the negative prediction. This keeps the Optuna study in “maximize” terms internally; we flip the sign back later when reporting `best_target`.
- Missing features (not provided by Optuna because you didn’t bound them) default to `0.0`. Avoid this by always providing bounds for all model features.

### 2) Optuna objective and study

`api/endpoints.py`

```python
def optimize_with_optuna(black_box_func: BlackBoxFunction, n_trials: int = 100, timeout: int = None):
    if not black_box_func.parameter_bounds:
        raise ValueError("Parameter bounds must be set before optimization")

    def objective(trial):
        params = {}
        for feature, bounds in black_box_func.parameter_bounds.items():
            params[feature] = trial.suggest_float(feature, bounds[0], bounds[1])
        return black_box_func(**params)  # calls model.predict() under the hood

    direction = "maximize" if black_box_func.maximize else "minimize"
    study = optuna.create_study(direction=direction)
    study.optimize(objective, n_trials=n_trials, timeout=timeout)

    return study.best_params, study.best_value, study
```

Notes:
- `trial.suggest_float` samples a real value uniformly in `[min, max]` for each feature.
- Default sampler is TPE (Bayesian) in Optuna; it uses prior trials to propose new candidates.
- `study.best_params` is the best-performing feature set; `study.best_value` is its objective value (possibly negated if minimizing).

### 3) FastAPI handler: `/optimize`

`api/endpoints.py`

```python
@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_parameters(request: OptimizationRequest):
    # Load model from memory or from disk
    if request.model_id not in models_store:
        black_box = BlackBoxFunction(model_id=request.model_id, maximize=request.maximize)
        models_store[request.model_id] = {
            "model": black_box.xgb_model,
            "target_col": black_box.target_col,
            "features": black_box.features,
        }

    model_info = models_store[request.model_id]
    black_box = BlackBoxFunction(
        model_id=request.model_id,
        xgb_model=model_info["model"],
        maximize=request.maximize,
    )

    # Bounds (use request or fall back to defaults)
    parameter_bounds = request.parameter_bounds or {
        "Ore": [150.0, 200.0],
        "WaterMill": [10.0, 20.0],
        "WaterZumpf": [180.0, 250.0],
        "PressureHC": [70.0, 90.0],
        "DensityHC": [1.5, 1.9],
        "MotorAmp": [30.0, 50.0],
        "Shisti": [0.05, 0.2],
        "Daiki": [0.2, 0.5],
    }
    black_box.set_parameter_bounds(parameter_bounds)

    n_trials = request.n_iter or 25
    best_params, best_value, study = optimize_with_optuna(black_box, n_trials=n_trials)

    if not request.maximize:
        best_value = -best_value  # undo the negate trick for reporting

    # Top-5 recommendations from study.trials
    recommendations = []
    for trial in sorted(
        study.trials,
        key=(lambda t: t.value if request.maximize else -t.value),
        reverse=request.maximize,
    )[:5]:
        value = trial.value if request.maximize else -trial.value
        recommendations.append({"params": trial.params, "predicted_value": float(value)})

    # Export trials → CSV under app/optimization/optimization_results
    # ... see full source for CSV creation code

    return OptimizationResponse(
        best_params=best_params,
        best_target=float(best_value),
        target_col=model_info.get("target_col", "PSI80"),
        maximize=request.maximize,
        recommendations=recommendations,
        model_id=request.model_id,
    )
```

Notes:
- Unlike the `/predict` endpoint (which always loads fresh), `/optimize` caches the loaded model in `models_store` for performance during trials.
- Recommendations list the best candidate trials with their predicted values.
- A CSV of all trials is exported to `python/mills-xgboost/app/optimization/optimization_results/` with a timestamped filename.

### 4) How each prediction is computed

`models/xgboost_model.py`

```python
def predict(self, data):
    if isinstance(data, dict):
        data = pd.DataFrame([data])
    missing_features = [f for f in self.features if f not in data.columns]
    if missing_features:
        raise ValueError(f"Missing features in input data: {missing_features}")
    X = data[self.features]
    X_scaled = self.scaler.transform(X)
    predictions = self.model.predict(X_scaled)
    return predictions
```

- The saved `scaler` from training is applied to the features before the XGBoost regressor predicts.
- The feature list comes from the metadata saved with the model, ensuring consistent ordering.

---

## Local Demo Script and Visualizations

`optimization/test_optuna_opt.py` includes a runnable demo that mirrors the endpoint logic and saves plots:

```python
best_params, best_value, study = optimize_with_optuna(
    black_box_func=black_box,
    n_trials=150,
)
plot_optimization_results(study, black_box)  # saves optimization_history.png, parameter_importances.png, parallel_coordinate.png
```

It also exports trials to CSV via `export_study_to_csv()` to facilitate analysis.

---

## Frontend Integration (brief)

From the UI, the optimization is typically invoked by a hook/store that posts to `/api/v1/ml/optimize` with the current model and bounds, then:
- Applies `best_params` back to the parameter sliders (if desired)
- Shows `best_target` as the recommended setpoint for the target variable
- Optionally displays the top-5 `recommendations`

Make sure your `parameter_bounds` cover all model features to avoid autosetting missing features to `0.0` during trials.

---

## Tips, Pitfalls, and Tuning

- **Bounds completeness**: Always provide bounds for every feature in the model’s metadata (`model.features`). Missing bounds → those features are filled with `0.0` inside `BlackBoxFunction`, which can skew results.
- **Maximize vs. Minimize**: Use `maximize=false` to minimize the model output. Internally the objective returns negative prediction; the handler flips the sign back in the response.
- **Trial count (`n_iter`)**: Increase for higher-quality results at the cost of time. Start with 30–50, then scale up.
- **Sampler/Pruner**: You can customize Optuna’s sampler or add pruning for speed. Currently, defaults are used for simplicity.
- **Reproducibility**: For deterministic runs, set a study sampler seed (e.g., `optuna.create_study(..., sampler=TPESampler(seed=42))`).
- **Exported artifacts**: Check `python/mills-xgboost/app/optimization/optimization_results/` for CSVs and, if using the demo script, Matplotlib plots.

---

## End-to-End Example

1) Train a model (or ensure one exists) so that `mills-xgboost/models/` contains:
- `xgboost_PSI80_mill8_model.json`
- `xgboost_PSI80_mill8_scaler.pkl`
- `xgboost_PSI80_mill8_metadata.json`

2) Call the endpoint:

```bash
curl -X POST http://localhost:3000/api/v1/ml/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "xgboost_PSI80_mill8",
    "parameter_bounds": {
      "Ore": [160, 200],
      "WaterMill": [5, 20],
      "WaterZumpf": [160, 250],
      "PressureHC": [70, 90],
      "DensityHC": [1.5, 1.9],
      "MotorAmp": [30, 50],
      "Shisti": [0.05, 0.3],
      "Daiki": [0.1, 0.4]
    },
    "n_iter": 50,
    "maximize": true
  }'
```

3) Inspect the response and optionally open the CSV export under `optimization_results` for deeper analysis.

---

## Where to Extend

- Add a request option for `sampler` and `pruner` to tune Optuna behavior.
- Persist studies (e.g., RDB storage) to resume/compare runs over time.
- Enforce bounds coverage against metadata features at request validation time and return a helpful error if incomplete.
- Add domain constraints (e.g., coupled parameters) by encoding them inside the `objective()` or by rejecting invalid trials.
---

## Targeted setpoint optimization (below max)

Sometimes you don’t want the absolute maximum. Instead, you want parameters whose predicted target is intentionally below the best value by a configurable amount, or close to a specific target setpoint. There are three practical strategies:

1) Two-phase optimization (recommended)

- Phase A: Maximize to estimate the best achievable value y_max.
- Phase B: Define a target setpoint y_target below the maximum, then optimize a new objective that tracks this target.

Defining the target setpoint:
- Absolute target: y_target = desired value (e.g., 75.0)
- Offset below max: y_target = y_max - delta (e.g., delta = 2.0)
- Percent below max: y_target = y_max * (1 - percent) (e.g., percent = 0.05 for 5% below)

Target-tracking objective:

```python
def optimize_to_target(black_box: BlackBoxFunction, y_target: float, n_trials: int = 50):
    # We maximize the negative distance to the target so that closer is better.
    def objective(trial):
        params = {
            f: trial.suggest_float(f, *black_box.parameter_bounds[f])
            for f in black_box.parameter_bounds
        }
        y = black_box(**params)  # If black_box.maximize is True, y is the raw prediction.
        # Ensure we measure distance on the natural (non-negated) prediction scale.
        y_nat = y if black_box.maximize else -y
        return -abs(y_nat - y_target)

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials)
    # The best trial is closest to y_target; its value is the negative distance.
    best_params = study.best_params
    best_pred = (black_box(**best_params) if black_box.maximize else -black_box(**best_params))
    return best_params, best_pred, study
```

Optionally, add a proximity regularizer to prefer solutions near a baseline operating point p0 (e.g., current plant state):

```python
def objective_with_regularizer(trial, black_box, y_target, p0, lam=0.0):
    params = {f: trial.suggest_float(f, *black_box.parameter_bounds[f]) for f in black_box.parameter_bounds}
    y_nat = black_box(**params) if black_box.maximize else -black_box(**params)
    # L2 distance from baseline
    reg = sum((params[f] - p0.get(f, params[f]))**2 for f in black_box.parameter_bounds)
    return -abs(y_nat - y_target) - lam * reg
```

2) Post-hoc selection from an existing maximize Study

- If you already ran a maximize study, you can compute y_target and simply choose the trial whose predicted value is closest to y_target.

```python
def pick_closest_trial(study: optuna.study.Study, maximize: bool, y_target: float):
    def natural_value(t):
        return t.value if maximize else -t.value
    best = min(study.trials, key=lambda t: abs(natural_value(t) - y_target))
    return best.params, natural_value(best)
```

This is instantaneous and requires no new trials. It works best if your first study explored enough of the space near y_target.

3) Warm-start a second study using prior trials (use “Optuna trials as data”)

- Optuna doesn’t have a separate “trained model.” Its “training data” are the trials. You can reuse them to warm-start a target-seeking study by enqueueing promising initial points (nearest to y_target) before running optimization again.

```python
from optuna.samplers import TPESampler

def warm_start_target_study(black_box: BlackBoxFunction, study_max: optuna.study.Study, y_target: float, k: int = 5, seed: int = 42):
    # Rank existing trials by closeness to y_target
    def natural_value(t):
        return t.value if black_box.maximize else -t.value
    ranked = sorted(study_max.trials, key=lambda t: abs(natural_value(t) - y_target))

    sampler = TPESampler(seed=seed)
    study2 = optuna.create_study(direction="maximize", sampler=sampler)

    # Enqueue the top-k existing params so they are evaluated first
    for t in ranked[:k]:
        study2.enqueue_trial(t.params)

    def objective(trial):
        params = {f: trial.suggest_float(f, *black_box.parameter_bounds[f]) for f in black_box.parameter_bounds}
        y_nat = black_box(**params) if black_box.maximize else -black_box(**params)
        return -abs(y_nat - y_target)

    study2.optimize(objective, n_trials=50)
    best_params = study2.best_params
    best_pred = (black_box(**best_params) if black_box.maximize else -black_box(**best_params))
    return best_params, best_pred, study2
```

API design: extend the `/optimize` endpoint

You can add fields to `OptimizationRequest` to support target-seeking in a single call:

```python
class OptimizationRequest(BaseModel):
    model_id: str
    parameter_bounds: Optional[Dict[str, List[float]]] = None
    n_iter: Optional[int] = 25
    maximize: bool = True

    # New fields
    target_mode: Optional[Literal["none", "absolute", "offset", "percent_below_max"]] = "none"
    target_value: Optional[float] = None        # for "absolute"
    target_delta: Optional[float] = None        # for "offset" (y_max - delta)
    target_percent: Optional[float] = None      # for "percent_below_max" (y_max * (1 - percent))
    regularize_to: Optional[Dict[str, float]] = None  # baseline params p0
    regularization_lambda: Optional[float] = 0.0
```

Handler sketch:

```python
@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_parameters(req: OptimizationRequest):
    # ... load black_box and bounds as shown earlier ...

    # Phase A: If target_mode != "absolute", we may need y_max first.
    study_max = None
    if req.target_mode in ("offset", "percent_below_max"):
        _, y_max, study_max = optimize_with_optuna(black_box, n_trials=req.n_iter or 25)
        if not req.maximize:
            y_max = -y_max

    # Compute y_target
    if req.target_mode == "absolute":
        y_target = req.target_value
    elif req.target_mode == "offset":
        y_target = (y_max - (req.target_delta or 0.0))
    elif req.target_mode == "percent_below_max":
        y_target = (y_max * (1.0 - (req.target_percent or 0.0)))
    else:
        y_target = None

    if y_target is None:
        # Regular maximize/minimize flow
        best_params, best_value, study = optimize_with_optuna(black_box, n_trials=req.n_iter or 25)
        best_value = best_value if req.maximize else -best_value
    else:
        # Target-seeking flow: optionally warm-start from study_max
        def objective(trial):
            params = {f: trial.suggest_float(f, *black_box.parameter_bounds[f]) for f in black_box.parameter_bounds}
            y_nat = black_box(**params) if black_box.maximize else -black_box(**params)
            val = -abs(y_nat - y_target)
            if req.regularize_to and (req.regularization_lambda or 0.0) > 0:
                reg = sum((params[f] - req.regularize_to.get(f, params[f]))**2 for f in black_box.parameter_bounds)
                val -= (req.regularization_lambda or 0.0) * reg
            return val

        study = optuna.create_study(direction="maximize")
        if study_max:
            # enqueue a few good prior params near y_target
            def nat(t):
                return t.value if req.maximize else -t.value
            for t in sorted(study_max.trials, key=lambda t: abs(nat(t) - y_target))[:5]:
                study.enqueue_trial(t.params)

        study.optimize(objective, n_trials=req.n_iter or 25)
        best_params = study.best_params
        best_value = (black_box(**best_params) if req.maximize else -black_box(**best_params))

    # ... build recommendations and CSV export as before ...
    return OptimizationResponse(
        best_params=best_params,
        best_target=float(best_value),
        target_col=black_box.target_col,
        maximize=req.maximize,
        recommendations=[],  # build similarly to existing code
        model_id=req.model_id,
    )
```

Notes on “using the training data of the Optuna model”
- Optuna itself does not train a standalone predictive model for you to reuse; it coordinates trials via a sampler (e.g., TPE) that internally builds distributions.
- The reusable artifact is the Study’s trials: (params, value) pairs. You can:
  - Do post-hoc nearest-to-target selection (no extra runs).
  - Warm-start a second study by enqueueing promising params.
  - Optionally fit your own quick surrogate (e.g., local linear/ridge or k-NN) on the trial data to propose initial candidates near y_target.

---

## References

- `api/endpoints.py` — `BlackBoxFunction`, `optimize_with_optuna`, `optimize_parameters`
- `models/xgboost_model.py` — `MillsXGBoostModel.predict`
- `optimization/test_optuna_opt.py` — demo run, CSV export, plots
