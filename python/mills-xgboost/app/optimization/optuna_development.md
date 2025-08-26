# Optuna Development Guide: Constrained Optimization Strategies

## Problem Statement

When using Optuna for minimization, we may find the theoretical minimum (e.g., PSI200 = 22), but in real-world scenarios, we often need higher target setpoints due to:
- **Operational constraints**: Equipment limitations, safety margins
- **Business requirements**: Trading efficiency for capacity, throughput, or other KPIs
- **Multi-objective considerations**: Balancing multiple competing objectives

This guide explores different strategies to handle such constrained optimization scenarios.

---

## Strategy 1: Constrained Optimization (RECOMMENDED)

### Overview
Modify the objective function to include penalties for solutions below a desired threshold. This guides Optuna to find the best solution within acceptable bounds.

### Implementation

```python
def create_constrained_objective(black_box_func, min_threshold=25.0, penalty_factor=1000):
    """
    Create a constrained objective function that penalizes solutions below threshold.
    
    Args:
        black_box_func: The original black box function
        min_threshold: Minimum acceptable target value
        penalty_factor: How heavily to penalize constraint violations
    """
    def constrained_objective(trial):
        # Get parameter suggestions
        params = {}
        for feature, bounds in black_box_func.parameter_bounds.items():
            params[feature] = trial.suggest_float(feature, bounds[0], bounds[1])
        
        # Get prediction from model
        prediction = black_box_func(**params)
        
        # Apply constraint penalty
        if prediction < min_threshold:
            # Heavy penalty makes this solution unattractive
            penalty = (min_threshold - prediction) * penalty_factor
            return prediction - penalty  # For minimization
        
        return prediction
    
    return constrained_objective
```

### Usage Example

```python
# Create constrained objective
min_target = 25.0  # Your desired minimum PSI200
constrained_obj = create_constrained_objective(black_box, min_target)

# Create study with constrained objective
study = optuna.create_study(direction="minimize")
study.optimize(constrained_obj, n_trials=200)

# Results will be >= min_target (if feasible)
print(f"Best constrained value: {study.best_value}")
print(f"Best parameters: {study.best_params}")
```

### Pros & Cons
✅ **Pros:**
- Direct integration of business constraints
- Optuna learns to avoid infeasible regions
- Simple to implement and understand
- Guarantees solutions meet minimum requirements

❌ **Cons:**
- Requires tuning penalty factor
- May struggle if constraints are too restrictive
- Could miss edge cases near constraint boundary

---

## Strategy 2: Multi-Objective Optimization

### Overview
Optimize multiple objectives simultaneously (e.g., PSI200 + capacity + efficiency). Provides Pareto-optimal solutions allowing trade-off analysis.

### Implementation

```python
def create_multi_objective(black_box_func, capacity_func=None):
    """
    Create multi-objective function optimizing PSI200 and secondary objectives.
    
    Args:
        black_box_func: Primary objective (PSI200)
        capacity_func: Secondary objective function (optional)
    """
    def multi_objective(trial):
        # Get parameter suggestions
        params = {}
        for feature, bounds in black_box_func.parameter_bounds.items():
            params[feature] = trial.suggest_float(feature, bounds[0], bounds[1])
        
        # Primary objective: PSI200
        psi200 = black_box_func(**params)
        
        # Secondary objective: Capacity proxy
        if capacity_func:
            capacity = capacity_func(**params)
        else:
            # Simple capacity proxy based on throughput-related parameters
            capacity = params.get('Ore', 0) * params.get('WaterMill', 0)
        
        # Return tuple for multi-objective optimization
        return psi200, -capacity  # Minimize PSI200, maximize capacity
    
    return multi_objective

# Usage
multi_obj = create_multi_objective(black_box)
study = optuna.create_study(directions=["minimize", "minimize"])  # Both minimize
study.optimize(multi_obj, n_trials=200)

# Analyze Pareto front
pareto_trials = study.best_trials
for trial in pareto_trials:
    print(f"PSI200: {trial.values[0]:.2f}, Capacity: {-trial.values[1]:.2f}")
```

### Pros & Cons
✅ **Pros:**
- Provides multiple optimal solutions (Pareto front)
- Allows trade-off analysis between objectives
- No need to set arbitrary constraint thresholds
- Rich solution space exploration

❌ **Cons:**
- More complex to implement and interpret
- Requires defining secondary objectives
- May produce too many solutions to choose from
- Computational overhead for multiple objectives

---

## Strategy 3: Post-Processing Trial Results

### Overview
Run standard optimization, then analyze the trial history to find the best solution above your threshold. Leverages existing trial data without re-optimization.

### Implementation

```python
def analyze_constrained_results(study, trials_df, min_threshold=25.0):
    """
    Analyze optimization results to find best constrained solution.
    
    Args:
        study: Completed Optuna study
        trials_df: DataFrame with trial results
        min_threshold: Minimum acceptable target value
    
    Returns:
        Dictionary with constrained optimization results
    """
    # Filter trials above threshold
    valid_trials = trials_df[trials_df['value'] >= min_threshold]
    
    if valid_trials.empty:
        return {
            'status': 'no_feasible_solution',
            'message': f'No trials found above threshold {min_threshold}',
            'closest_value': trials_df['value'].max(),
            'total_trials': len(trials_df)
        }
    
    # Find best among valid trials
    best_idx = valid_trials['value'].idxmin()
    best_constrained = valid_trials.loc[best_idx]
    
    # Extract parameters
    param_cols = [col for col in valid_trials.columns if col.startswith('param_')]
    best_params = {
        col.replace('param_', ''): best_constrained[col] 
        for col in param_cols
    }
    
    # Calculate statistics
    feasible_ratio = len(valid_trials) / len(trials_df)
    improvement_over_unconstrained = best_constrained['value'] - study.best_value
    
    return {
        'status': 'success',
        'constrained_value': best_constrained['value'],
        'constrained_params': best_params,
        'unconstrained_value': study.best_value,
        'improvement_cost': improvement_over_unconstrained,
        'feasible_trials': len(valid_trials),
        'total_trials': len(trials_df),
        'feasible_ratio': feasible_ratio,
        'trial_number': best_constrained['trial_number']
    }

def plot_constraint_analysis(trials_df, min_threshold=25.0):
    """Plot analysis of constraint satisfaction"""
    import matplotlib.pyplot as plt
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
    
    # Plot 1: Trial values over time with threshold
    ax1.plot(trials_df['trial_number'], trials_df['value'], 'b-', alpha=0.7)
    ax1.axhline(y=min_threshold, color='r', linestyle='--', label=f'Threshold: {min_threshold}')
    ax1.fill_between(trials_df['trial_number'], min_threshold, trials_df['value'].max(), 
                     alpha=0.2, color='green', label='Feasible Region')
    ax1.set_xlabel('Trial Number')
    ax1.set_ylabel('PSI200 Value')
    ax1.set_title('Optimization Progress with Constraint')
    ax1.legend()
    ax1.grid(True)
    
    # Plot 2: Distribution of values
    ax2.hist(trials_df['value'], bins=30, alpha=0.7, color='blue', edgecolor='black')
    ax2.axvline(x=min_threshold, color='r', linestyle='--', linewidth=2, label=f'Threshold: {min_threshold}')
    ax2.axvline(x=trials_df['value'].min(), color='g', linestyle='-', linewidth=2, label=f'Global Min: {trials_df["value"].min():.2f}')
    ax2.set_xlabel('PSI200 Value')
    ax2.set_ylabel('Frequency')
    ax2.set_title('Distribution of Trial Values')
    ax2.legend()
    ax2.grid(True)
    
    plt.tight_layout()
    return fig
```

### Usage Example

```python
# After running standard optimization
best_params, best_value, study = optimize_with_optuna(black_box, n_trials=200)
trials_df = export_study_to_csv(study, "trials.csv")

# Analyze constrained results
min_target = 25.0
results = analyze_constrained_results(study, trials_df, min_target)

if results['status'] == 'success':
    print(f"Best constrained value: {results['constrained_value']:.2f}")
    print(f"Cost of constraint: +{results['improvement_cost']:.2f}")
    print(f"Feasible trials: {results['feasible_ratio']:.1%}")
    print(f"Best parameters: {results['constrained_params']}")
else:
    print(f"No feasible solution found. Closest: {results['closest_value']:.2f}")

# Generate analysis plots
fig = plot_constraint_analysis(trials_df, min_target)
fig.savefig("constraint_analysis.png")
```

### Pros & Cons
✅ **Pros:**
- Works with existing optimization runs
- No need to modify objective function
- Rich statistical analysis of constraint satisfaction
- Can try different thresholds post-hoc

❌ **Cons:**
- May not find optimal constrained solution
- Requires sufficient trials above threshold
- No guidance during optimization process
- May need re-optimization if no feasible solutions

---

## Strategy 4: Custom Sampler with Biased Priors

### Overview
Use Optuna's advanced samplers with custom priors that bias the search toward your desired range, making the optimization naturally explore feasible regions more.

### Implementation

```python
def create_biased_sampler(min_threshold=25.0, bias_strength=0.3):
    """
    Create a custom sampler that biases toward feasible regions.
    
    Args:
        min_threshold: Minimum acceptable value
        bias_strength: How strongly to bias (0.0 = no bias, 1.0 = strong bias)
    """
    # Use TPE sampler with custom configuration
    sampler = optuna.samplers.TPESampler(
        n_startup_trials=50,  # More random exploration initially
        n_ei_candidates=100,  # More candidates to evaluate
        gamma=lambda x: min(int(x * 0.25), 25),  # Custom gamma function
        prior_weight=1.0,     # Weight of prior distribution
        consider_prior=True,  # Use prior information
        consider_magic_clip=True,  # Use magic clip
        consider_endpoints=True   # Consider endpoint values
    )
    
    return sampler

def optimize_with_biased_sampler(black_box_func, min_threshold=25.0, n_trials=200):
    """
    Run optimization with biased sampler.
    """
    # Create biased sampler
    sampler = create_biased_sampler(min_threshold)
    
    # Create study with custom sampler
    study = optuna.create_study(
        direction="minimize",
        sampler=sampler
    )
    
    # Add callback to track constraint satisfaction
    def constraint_callback(study, trial):
        if trial.value is not None and trial.value >= min_threshold:
            print(f"Trial {trial.number}: Found feasible solution {trial.value:.2f}")
    
    # Optimize with callback
    study.optimize(
        lambda trial: objective_function(trial, black_box_func),
        n_trials=n_trials,
        callbacks=[constraint_callback]
    )
    
    return study

def objective_function(trial, black_box_func):
    """Standard objective function for biased sampling"""
    params = {}
    for feature, bounds in black_box_func.parameter_bounds.items():
        params[feature] = trial.suggest_float(feature, bounds[0], bounds[1])
    
    return black_box_func(**params)
```

### Pros & Cons
✅ **Pros:**
- Sophisticated exploration strategy
- Leverages Optuna's advanced algorithms
- No explicit constraint handling needed
- Good for complex parameter spaces

❌ **Cons:**
- Complex to configure properly
- No guarantee of constraint satisfaction
- Requires deep understanding of samplers
- May still find infeasible solutions

---

## Strategy 5: Hybrid Approach (BEST PRACTICE)

### Overview
Combine multiple strategies for robust constrained optimization. Start with constrained optimization, then use post-processing for analysis.

### Implementation

```python
def hybrid_constrained_optimization(
    black_box_func, 
    min_threshold=25.0,
    n_trials=200,
    penalty_factor=1000
):
    """
    Hybrid approach combining constrained optimization with post-processing analysis.
    """
    # Step 1: Run constrained optimization
    print("Step 1: Running constrained optimization...")
    constrained_obj = create_constrained_objective(black_box_func, min_threshold, penalty_factor)
    
    study_constrained = optuna.create_study(direction="minimize")
    study_constrained.optimize(constrained_obj, n_trials=n_trials)
    
    # Step 2: Run unconstrained optimization for comparison
    print("Step 2: Running unconstrained optimization...")
    def unconstrained_obj(trial):
        params = {}
        for feature, bounds in black_box_func.parameter_bounds.items():
            params[feature] = trial.suggest_float(feature, bounds[0], bounds[1])
        return black_box_func(**params)
    
    study_unconstrained = optuna.create_study(direction="minimize")
    study_unconstrained.optimize(unconstrained_obj, n_trials=n_trials)
    
    # Step 3: Export and analyze both studies
    trials_constrained = export_study_to_csv(study_constrained, "trials_constrained.csv")
    trials_unconstrained = export_study_to_csv(study_unconstrained, "trials_unconstrained.csv")
    
    # Step 4: Post-process analysis
    constrained_analysis = analyze_constrained_results(study_unconstrained, trials_unconstrained, min_threshold)
    
    # Step 5: Compare results
    results = {
        'constrained_optimization': {
            'best_value': study_constrained.best_value,
            'best_params': study_constrained.best_params,
            'feasible': study_constrained.best_value >= min_threshold
        },
        'unconstrained_optimization': {
            'best_value': study_unconstrained.best_value,
            'best_params': study_unconstrained.best_params
        },
        'post_processed_constrained': constrained_analysis,
        'threshold': min_threshold,
        'recommendation': None
    }
    
    # Step 6: Make recommendation
    if results['constrained_optimization']['feasible']:
        results['recommendation'] = 'constrained_optimization'
        print(f"✅ Constrained optimization successful: {study_constrained.best_value:.2f}")
    elif constrained_analysis['status'] == 'success':
        results['recommendation'] = 'post_processed_constrained'
        print(f"✅ Post-processed solution found: {constrained_analysis['constrained_value']:.2f}")
    else:
        results['recommendation'] = 'infeasible'
        print(f"❌ No feasible solution found above {min_threshold}")
    
    return results
```

### Pros & Cons
✅ **Pros:**
- Combines best of multiple approaches
- Provides fallback options
- Rich analysis and comparison
- Robust and reliable

❌ **Cons:**
- More computational overhead
- Complex implementation
- Requires more development time

---

## Decision Matrix

| Strategy | Complexity | Reliability | Flexibility | Computational Cost | Best For |
|----------|------------|-------------|-------------|-------------------|----------|
| **Constrained Optimization** | Low | High | Medium | Low | Single constraint, clear threshold |
| **Multi-Objective** | High | High | High | High | Multiple competing objectives |
| **Post-Processing** | Low | Medium | High | Low | Exploring different thresholds |
| **Biased Sampler** | High | Medium | Medium | Medium | Complex parameter spaces |
| **Hybrid Approach** | High | Very High | High | High | Production systems, critical applications |

---

## Recommendations

### For Your PSI200 Use Case:

1. **Start with Strategy 1 (Constrained Optimization)** - Simple, direct, and effective
2. **Add Strategy 3 (Post-Processing)** for analysis and validation
3. **Consider Strategy 5 (Hybrid)** if this becomes a production system

### Implementation Priority:

1. **Phase 1**: Implement constrained optimization with penalty approach
2. **Phase 2**: Add post-processing analysis for validation
3. **Phase 3**: Consider multi-objective if you identify secondary objectives
4. **Phase 4**: Implement hybrid approach for production robustness

### Next Steps:

1. Modify your `test_optuna_opt.py` to implement Strategy 1
2. Test with different penalty factors (100, 1000, 10000)
3. Validate results meet your minimum PSI200 requirement
4. Add post-processing analysis for deeper insights

Would you like me to implement any of these strategies in your existing code?
