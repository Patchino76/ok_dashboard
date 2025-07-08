# Bayesian Optimization in Mills XGBoost

This document explains the implementation of Bayesian optimization for mill parameter tuning in the Mills XGBoost system.

## Conceptual Overview

### What is Bayesian Optimization?

Bayesian optimization is a sequential design strategy for global optimization of black-box functions. It's particularly effective when:
- The objective function is expensive to evaluate (in our case, running physical mill experiments)
- There is no analytical expression for the objective function (we use a trained ML model instead)
- We don't have access to derivatives of the function

The approach works by maintaining a probabilistic model of the objective function (using Gaussian Processes) and using it to:
1. Decide where to sample next (balancing exploration and exploitation)
2. Make predictions about optimal parameter settings

### Key Components

1. **Gaussian Process (GP)**: A probabilistic model that provides both a prediction and uncertainty estimate
2. **Acquisition Function**: A function that determines where to sample next by trading off exploration (high uncertainty regions) and exploitation (regions with high expected improvement)
3. **Black Box Function**: The objective function being optimized (in our case, an XGBoost model predicting mill performance)

## Implementation in the Mills XGBoost System

The `bayesian_opt.py` module implements Bayesian optimization using the `bayesian-optimization` library (version 3.0.1) through the `MillBayesianOptimizer` class.

### Class Structure: MillBayesianOptimizer

#### Core Properties

```python
self.model          # Trained XGBoost model
self.target_col     # Target column to optimize (e.g., 'PSI80')
self.maximize       # Whether to maximize or minimize the target
self.optimizer      # BayesianOptimization instance
self.pbounds        # Parameter bounds dictionary {param_name: (min, max)}
self.param_constraints # Dictionary of constraint functions
self.best_params    # Best parameters found during optimization
self.optimization_history # List of evaluations with parameters and predictions
```

#### Data Flow

1. **Input**: 
   - Trained XGBoost model
   - Parameter bounds to search within
   - Optional constraints on parameter combinations

2. **Optimization Process**:
   - Black box function evaluates parameters using the XGBoost model
   - Gaussian Process models the relationship between parameters and target
   - Acquisition function guides the search for optimal parameters

3. **Output**:
   - Best parameter settings discovered
   - Predicted target value for those parameters
   - Optimization history for analysis
   - Multiple alternative recommendations

### Key Methods

#### 1. `__init__(self, xgboost_model, target_col='PSI80', maximize=True)`

Initializes the optimizer with a trained model and optimization objective.

```python
# Example usage
optimizer = MillBayesianOptimizer(trained_model, target_col='PSI80', maximize=True)
```

#### 2. `_black_box_function(self, **kwargs)`

This is the objective function that the Bayesian optimizer tries to optimize. It:
- Takes parameter values as keyword arguments
- Creates a DataFrame with these parameters
- Checks if parameters meet constraints
- Predicts the outcome using the XGBoost model
- Records the prediction in optimization history
- Returns the prediction (negated if minimizing)

```python
# How it works internally
def _black_box_function(self, **kwargs):
    # Convert parameters to DataFrame
    data = pd.DataFrame([{k: float(v) for k, v in kwargs.items()}])
    
    # Check constraints
    if not self._check_constraints(param_values):
        return -float('inf') if self.maximize else float('inf')
    
    # Make prediction and record history
    prediction = self.model.predict(data)[0]
    self.optimization_history.append({...})
    
    # Return (negated if minimizing)
    return prediction if self.maximize else -prediction
```

#### 3. `set_parameter_bounds(self, pbounds=None, data=None)`

Sets the bounds for each parameter to search within. Can derive bounds from:
- Explicitly provided bounds dictionary
- Training data min/max values (with buffer)
- Default values for common mill parameters

#### 4. `set_constraints(self, constraints=None)` and `_check_constraints(self, params)`

Allows adding constraints to parameter combinations (e.g., WaterMill ≥ 1.5 × WaterZumpf) and checks if a set of parameters meets all constraints.

#### 5. `optimize(self, init_points=5, n_iter=25, acq='ei', kappa=2.5, xi=0.0, save_dir=None)`

The main optimization method that:
- Initializes the BayesianOptimization object
- Sets up the acquisition function based on specified type ('ei', 'ucb', 'poi')
- Runs random exploration for `init_points` steps
- Runs guided optimization for `n_iter` steps
- Returns and optionally saves the optimization results

```python
# Example usage
results = optimizer.optimize(
    init_points=5,       # Random exploration steps
    n_iter=20,           # Guided optimization steps
    acq='ei',            # Expected Improvement acquisition
    save_dir='results'   # Directory to save results
)
```

#### 6. `recommend_parameters(self, n_recommendations=3)`

Returns the top N parameter combinations from the optimization history, sorted by predicted target value.

## Acquisition Functions

The implementation supports three acquisition functions:

1. **Upper Confidence Bound (UCB)**: Balances exploration and exploitation with a tunable parameter `kappa`
   ```python
   acquisition_function = bayes_acq.UCB(kappa=2.5)
   ```

2. **Expected Improvement (EI)**: Calculates the expected improvement over the current best observation, with parameter `xi` controlling exploration
   ```python
   acquisition_function = bayes_acq.EI(xi=0.05)
   ```

3. **Probability of Improvement (POI)**: Calculates the probability that a point will improve over the current best, with parameter `xi`
   ```python
   acquisition_function = bayes_acq.POI(xi=0.05)
   ```

## Practical Usage

### Basic Workflow

1. Train an XGBoost model on historical mill data
2. Create a `MillBayesianOptimizer` instance with the trained model
3. Set parameter bounds for the optimization search space
4. Add any constraints on parameter combinations
5. Run the optimization process
6. Retrieve the best parameters and recommendations

### Example

```python
# Assuming we have a trained model
model = MillsXGBoostModel()
model.load_model('models/xgboost_PSI80_mill6_model.json', 'models/xgboost_PSI80_mill6_scaler.pkl')

# Create optimizer
optimizer = MillBayesianOptimizer(model, target_col='PSI80', maximize=True)

# Set parameter bounds
optimizer.set_parameter_bounds({
    'Ore': (160.0, 200.0),
    'WaterMill': (12.0, 18.0),
    'WaterZumpf': (140.0, 240.0),
    'PressureHC': (0.3, 0.5),
    'DensityHC': (1500, 1800)
})

# Add constraints
def water_constraint(params):
    return params['WaterMill'] >= 1.5 * params['WaterZumpf'] / 100
    
optimizer.set_constraints({'water_ratio': water_constraint})

# Run optimization
results = optimizer.optimize(init_points=5, n_iter=25)

# Get recommendations
recommendations = optimizer.recommend_parameters(n_recommendations=3)
```

### Integration with FastAPI

The optimization functionality is exposed through the `/optimize` endpoint in `endpoints.py`, which:
1. Takes an `OptimizationRequest` with model ID and parameter bounds
2. Retrieves the trained model from the model store
3. Creates and configures a `MillBayesianOptimizer`
4. Runs the optimization process
5. Returns the best parameters and recommendations as an `OptimizationResponse`

## Performance Considerations

1. **Computation Efficiency**: The optimization process is computationally efficient since it uses the trained XGBoost model for predictions rather than running actual mill experiments.

2. **Search Space Size**: Performance scales with the number of parameters being optimized. More parameters require more iterations to find good solutions.

3. **Exploration vs. Exploitation**: The balance can be tuned via:
   - `init_points`: More points = more exploration
   - `n_iter`: More iterations = more exploitation
   - Acquisition function parameters (`kappa`, `xi`)

4. **Constraints**: Adding constraints can significantly improve optimization by excluding infeasible parameter combinations.
