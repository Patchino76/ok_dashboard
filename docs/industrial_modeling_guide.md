# Industrial Process Modeling: Ball Mill Analysis Guide
## Troubleshooting XGBoost Models for Copper Ore Dressing

---

## 📋 **Problem Statement**

In a copper mine's ball-milling department, we're modeling the -200mk fraction (measured by PSI300 unit) using XGBoost. The challenge: model performance varies dramatically across time periods - R² can reach 0.5 in some periods but go negative in others, despite consistent underlying physics.

**Key Question**: What causes this inconsistent performance and how can we build more robust models?

---

## 🔍 **Phase 1: Data Quality and Sensor Health Analysis**

### **Sensor Drift and Calibration Issues**

**Systematic Drift Detection**
- Plot each sensor's raw values over time
- Look for gradual shifts, sudden jumps, or periods where sensors flatline
- **Action**: Create time series plots for all critical sensors

**Cross-Sensor Correlation Analysis**
- Compare sensors that should be correlated (e.g., flow rates vs. power consumption)
- Diverging correlations indicate sensor issues
- **Metric**: Correlation coefficient changes > 0.3 over time windows

**Calibration Schedule Analysis**
- Map model performance against sensor calibration dates
- Poor performance often follows overdue calibrations
- **Tool**: Maintenance log correlation with R² scores

**Reference Point Validation**
- Use process constraints (mass balance, energy balance)
- Identify sensors giving physically impossible readings
- **Check**: Power consumption vs. throughput ratios

### **Data Quality Metrics by Time Period**

**Missing Data Patterns**
```python
missing_data_rate = data.groupby(pd.Grouper(freq='D')).apply(
    lambda x: x.isnull().sum() / len(x)
)
```

**Signal-to-Noise Ratio**
- Analyze variance in sensor readings during steady-state operations
- **Threshold**: SNR < 10 indicates sensor problems

**Outlier Frequency**
- Track unusual spikes or drops
- **Method**: Z-score analysis with rolling windows

**Sampling Frequency Consistency**
- Verify all sensors maintain expected sampling rates
- **Alert**: Missing timestamps or irregular intervals

---

## ⚙️ **Phase 2: Process Condition Analysis**

### **Operational Regime Changes**

**Feed Ore Characteristics**
- Hardness variations (Work Index)
- Mineral composition changes
- Moisture content fluctuations
- **Impact**: Different ore types require different grinding parameters

**Throughput Variations**
- Production rate changes affect mill dynamics
- **Critical**: Residence time calculations
- **Formula**: `Residence Time = Mill Volume / Feed Rate`

**Equipment Wear Patterns**
- Ball mill liner wear progression
- Ball charge condition deterioration
- Classifier performance degradation
- **Monitoring**: Power draw per ton processed

**Maintenance Events**
- Performance often degrades before scheduled maintenance
- Improvement typically follows maintenance
- **Tracking**: Maintenance calendar vs. model performance

### **Hidden Process Variables**

**Ambient Conditions**
- Temperature effects on measurement accuracy
- Humidity impact on material properties
- Atmospheric pressure variations

**Upstream Process Variations**
- Changes in crushing circuit performance
- Ore blending inconsistencies
- Storage condition effects

**Water Quality**
- Process water chemistry changes
- pH variations affecting flotation downstream
- Dissolved solids content

---

## 📊 **Phase 3: Advanced Statistical Investigation**

### **Feature Stability Analysis**

```python
from sklearn.feature_selection import mutual_info_regression
import pandas as pd
import numpy as np

def analyze_feature_stability(data, target, time_periods):
    """
    Analyze how feature importance changes across time periods
    """
    stability_scores = {}
    for period in time_periods:
        period_data = data[data['timestamp'].between(period[0], period[1])]
        
        # Calculate mutual information scores
        mi_scores = mutual_info_regression(
            period_data.drop(['timestamp', target], axis=1), 
            period_data[target]
        )
        
        stability_scores[period] = dict(zip(
            period_data.drop(['timestamp', target], axis=1).columns,
            mi_scores
        ))
    
    # Calculate stability metrics
    feature_stability = {}
    for feature in period_data.drop(['timestamp', target], axis=1).columns:
        scores = [stability_scores[period][feature] for period in time_periods]
        feature_stability[feature] = {
            'mean': np.mean(scores),
            'std': np.std(scores),
            'cv': np.std(scores) / np.mean(scores) if np.mean(scores) > 0 else np.inf
        }
    
    return feature_stability

def rank_feature_stability(stability_results):
    """
    Rank features by stability (lower coefficient of variation = more stable)
    """
    stability_ranking = sorted(
        stability_results.items(),
        key=lambda x: x[1]['cv']
    )
    return stability_ranking
```

### **Covariate Shift Detection**

**Statistical Tests**
- Kolmogorov-Smirnov test for distribution changes
- Mann-Whitney U test for median shifts
- **Implementation**:
```python
from scipy import stats

def detect_distribution_shift(data1, data2, alpha=0.05):
    """
    Detect if two datasets come from different distributions
    """
    statistic, p_value = stats.ks_2samp(data1, data2)
    return p_value < alpha, p_value
```

**Domain Adaptation Techniques**
- Maximum Mean Discrepancy (MMD) for quantifying dataset shift
- **Threshold**: MMD > 0.1 indicates significant shift

**Principal Component Analysis**
- Track how principal components change across time periods
- **Alert**: First PC explains < 80% of original variance

---

## 🤖 **Phase 4: Model-Based Diagnostics**

### **Residual Analysis by Time Period**

**Residual Patterns**
```python
def analyze_residuals_by_time(predictions, actuals, timestamps):
    """
    Analyze prediction residuals over time
    """
    residuals = predictions - actuals
    residual_df = pd.DataFrame({
        'timestamp': timestamps,
        'residuals': residuals,
        'abs_residuals': np.abs(residuals)
    })
    
    # Rolling statistics
    residual_df['rolling_mean'] = residual_df['residuals'].rolling('7D').mean()
    residual_df['rolling_std'] = residual_df['residuals'].rolling('7D').std()
    
    return residual_df
```

**Heteroscedasticity Check**
- Verify if prediction uncertainty varies across operating conditions
- **Test**: Breusch-Pagan test for constant variance

**Autocorrelation Analysis**
- Check if prediction errors show temporal dependencies
- **Tool**: ACF/PACF plots of residuals

### **Feature Attribution Analysis**

**SHAP Values**
```python
import shap

def compare_shap_across_periods(model, data_periods):
    """
    Compare feature importance explanations across time periods
    """
    explainer = shap.TreeExplainer(model)
    
    shap_comparisons = {}
    for period_name, period_data in data_periods.items():
        shap_values = explainer.shap_values(period_data)
        shap_comparisons[period_name] = shap_values
    
    return shap_comparisons
```

**Permutation Importance**
- Identify features that become less predictive in poor-performing periods
- **Method**: Feature importance drop when shuffled

**Partial Dependence Plots**
- Check if feature-target relationships change over time
- **Warning**: Non-monotonic changes suggest instability

---

## 🔬 **Phase 5: Physics-Informed Solutions**

### **First Principles Constraints**

**Mass Balance Enforcement**
```python
def validate_mass_balance(feed_rate, product_streams, tolerance=0.05):
    """
    Ensure model predictions respect mass conservation
    """
    total_output = sum(product_streams.values())
    mass_balance_error = abs(feed_rate - total_output) / feed_rate
    
    return mass_balance_error < tolerance
```

**Residence Time Calculations**
- Verify features align with actual material residence time
- **Formula**: `RT = Hold-up Volume / Volumetric Flow Rate`

**Energy Balance Validation**
- Use power consumption to validate grinding efficiency
- **Constraint**: `Energy per ton = f(Work Index, Size Reduction Ratio)`

### **Process Regime Classification**

```python
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

def identify_process_regimes(data, n_regimes=3):
    """
    Identify distinct operating regimes based on key process variables
    """
    regime_features = [
        'mill_power', 'feed_rate', 'water_addition', 
        'cyclone_pressure', 'ore_hardness'
    ]
    
    # Standardize features
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(data[regime_features])
    
    # Cluster analysis
    kmeans = KMeans(n_clusters=n_regimes, random_state=42)
    regimes = kmeans.fit_predict(scaled_features)
    
    # Add regime labels to data
    data['operating_regime'] = regimes
    
    return data, kmeans, scaler
```

---

## 🔄 **Phase 6: Robust Modeling Strategies**

### **Multi-Model Approach**

**Regime-Specific Models**
```python
def train_regime_specific_models(data, target_col, regime_col):
    """
    Train separate models for different operating conditions
    """
    models = {}
    
    for regime in data[regime_col].unique():
        regime_data = data[data[regime_col] == regime]
        
        X = regime_data.drop([target_col, regime_col], axis=1)
        y = regime_data[target_col]
        
        # Train XGBoost for this regime
        model = XGBRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        model.fit(X, y)
        
        models[regime] = model
    
    return models
```

**Ensemble Methods**
- Combine models trained on different time periods
- Dynamic weighting based on recent performance
- **Strategy**: Exponentially weighted moving average of model predictions

**Online Learning**
```python
from sklearn.linear_model import SGDRegressor

def implement_online_learning(base_model, new_data, learning_rate=0.01):
    """
    Implement incremental learning for model adaptation
    """
    # Use SGD for online updates
    online_model = SGDRegressor(learning_rate='constant', eta0=learning_rate)
    
    # Partial fit with new data
    X_new = new_data.drop(['target'], axis=1)
    y_new = new_data['target']
    
    online_model.partial_fit(X_new, y_new)
    
    return online_model
```

### **Transfer Learning Techniques**

**Domain Adaptation**
- Use CORAL (Correlation Alignment) for cross-period adaptation
- DANN (Domain-Adversarial Neural Networks) for complex adaptations

**Meta-Learning**
- Train models that quickly adapt to new time periods
- **Approach**: Model-Agnostic Meta-Learning (MAML)

### **Uncertainty Quantification**

```python
def prediction_with_uncertainty(model, X_test, n_estimators=100):
    """
    Implement prediction intervals using tree-based ensemble variance
    """
    if hasattr(model, 'estimators_'):
        # For ensemble methods
        predictions = np.array([
            tree.predict(X_test) for tree in model.estimators_
        ])
        mean_pred = np.mean(predictions, axis=0)
        std_pred = np.std(predictions, axis=0)
        
        # 95% confidence intervals
        lower_bound = mean_pred - 1.96 * std_pred
        upper_bound = mean_pred + 1.96 * std_pred
        
        return mean_pred, lower_bound, upper_bound
    else:
        # For single models, use quantile regression
        return model.predict(X_test), None, None
```

---

## 🔍 **Upstream Process Variations Analysis**

### **Moving Window Analysis Implementation**

**Ore Blending Variations**
```python
def analyze_ore_blending_stability(data, window_size='7D'):
    """
    Analyze ore composition stability over time using moving windows
    """
    ore_metrics = [
        'hardness_index', 'copper_grade', 'pyrite_content', 
        'silica_content', 'moisture_content'
    ]
    
    results = {}
    for metric in ore_metrics:
        # Rolling statistics
        rolling_mean = data[metric].rolling(window=window_size).mean()
        rolling_std = data[metric].rolling(window=window_size).std()
        rolling_cv = rolling_std / rolling_mean  # Coefficient of variation
        
        # Detect change points
        change_points = detect_change_points(data[metric], window_size)
        
        results[metric] = {
            'cv_trend': rolling_cv,
            'stability_score': 1 / rolling_cv.mean(),
            'change_points': change_points
        }
    
    return results

def detect_change_points(series, window_size):
    """
    Detect significant shifts in ore characteristics using statistical tests
    """
    from scipy import stats
    
    rolling_mean = series.rolling(window=window_size).mean()
    change_points = []
    
    window_samples = int(pd.Timedelta(window_size).total_seconds() / 3600)  # Convert to hours
    
    for i in range(len(rolling_mean) - window_samples):
        if i < window_samples:
            continue
            
        # Compare current vs previous window
        current_window = series.iloc[i-window_samples:i]
        previous_window = series.iloc[i-2*window_samples:i-window_samples]
        
        # Mann-Whitney U test for distribution change
        try:
            statistic, p_value = stats.mannwhitneyu(
                current_window.dropna(), 
                previous_window.dropna()
            )
            
            if p_value < 0.05:  # Significant change detected
                change_points.append(series.index[i])
        except:
            continue
    
    return change_points
```

**Crushing Circuit Performance Tracking**
```python
def analyze_crushing_circuit_variations(data, window_size='12H'):
    """
    Track crushing circuit performance affecting downstream milling
    """
    crushing_metrics = {
        'crusher_throughput': data['crusher_feed_rate'],
        'crusher_power_efficiency': data['crusher_power'] / data['crusher_feed_rate'],
        'product_size_p80': data['crusher_product_p80'],
        'crusher_gap_setting': data['crusher_css'],
        'crusher_liner_wear': data['crusher_operating_hours'] % 2000  # Typical liner life
    }
    
    variations = {}
    for metric_name, metric_data in crushing_metrics.items():
        # Rolling statistics
        rolling_stats = {
            'mean': metric_data.rolling(window=window_size).mean(),
            'std': metric_data.rolling(window=window_size).std(),
            'range': (metric_data.rolling(window=window_size).max() - 
                     metric_data.rolling(window=window_size).min())
        }
        
        # Stability indicators
        stability_index = rolling_stats['std'] / rolling_stats['mean']
        
        variations[metric_name] = {
            'stats': rolling_stats,
            'stability_index': stability_index,
            'high_variation_periods': identify_high_variation_periods(stability_index)
        }
    
    return variations
```

**Storage Condition Monitoring**
```python
def analyze_storage_conditions(data, window_size='24H'):
    """
    Monitor ore storage conditions affecting mill feed quality
    """
    def calculate_residence_time(data):
        """Estimate ore residence time in stockpiles"""
        inventory_level = data['stockpile_tonnage']
        feed_rate = data['mill_feed_rate']
        return inventory_level / feed_rate  # Hours
    
    def calculate_segregation_index(data):
        """Measure ore characteristic variation within batches"""
        if 'batch_id' in data.columns:
            batch_grade_std = data.groupby('batch_id')['copper_grade'].std()
            overall_grade_std = data['copper_grade'].std()
            return batch_grade_std.mean() / overall_grade_std
        return np.nan
    
    def calculate_blending_efficiency(data, window_size):
        """Measure blending quality"""
        if 'target_blend_grade' in data.columns:
            target_grade = data['target_blend_grade']
            actual_grade = data['actual_mill_feed_grade'].rolling(window=window_size).mean()
            return 1 - abs(actual_grade - target_grade) / target_grade
        return np.nan
    
    storage_metrics = {
        'stockpile_residence_time': calculate_residence_time(data),
        'segregation_index': calculate_segregation_index(data),
        'moisture_variation': data['stockpile_moisture'].rolling(window=window_size).std(),
        'blending_efficiency': calculate_blending_efficiency(data, window_size)
    }
    
    return storage_metrics
```

---

## 📊 **Feature Stability Analysis (Детайлно обяснение)**

### **Какво означава "стабилност на features"?**

**Стабилен feature** запазва:
- Консистентна важност за модела
- Постоянна връзка с целевата променлива
- Стабилни статистически характеристики

**Нестабилен feature** показва:
- Променяща се предсказваща сила
- Различно поведение в различни периоди
- Проблеми със сензорите или процеса

### **Подробна имплементация**

```python
def comprehensive_feature_stability_analysis(data, target_col, feature_cols, 
                                           time_col, window_size='30D', step_size='7D'):
    """
    Цялостен анализ на стабилността на features
    """
    from sklearn.feature_selection import mutual_info_regression
    from scipy.stats import pearsonr
    
    # Подготовка на времевите прозорци
    time_windows = pd.date_range(
        start=data[time_col].min(), 
        end=data[time_col].max(), 
        freq=step_size
    )
    
    stability_results = {
        'mutual_info': {},
        'correlation': {},
        'statistical_properties': {},
        'distribution_changes': {}
    }
    
    for feature in feature_cols:
        print(f"Analyzing {feature}...")
        
        mi_scores = []
        correlations = []
        means = []
        stds = []
        distribution_tests = []
        
        previous_window_data = None
        
        for i, window_start in enumerate(time_windows[:-1]):
            window_end = window_start + pd.Timedelta(window_size)
            
            # Извличане на данни за прозореца
            window_data = data[
                (data[time_col] >= window_start) & 
                (data[time_col] < window_end)
            ].copy()
            
            if len(window_data) < 50:  # Недостатъчно данни
                continue
            
            # Почистване на данните
            feature_data = window_data[feature].fillna(window_data[feature].median())
            target_data = window_data[target_col].fillna(window_data[target_col].median())
            
            try:
                # Mutual Information (нелинейна зависимост)
                mi_score = mutual_info_regression(
                    feature_data.values.reshape(-1, 1),
                    target_data.values
                )[0]
                mi_scores.append(mi_score)
                
                # Pearson корелация (линейна зависимост)
                corr, _ = pearsonr(feature_data, target_data)
                correlations.append(corr)
                
                # Статистически свойства
                means.append(feature_data.mean())
                stds.append(feature_data.std())
                
                # Тест за промяна в разпределението
                if previous_window_data is not None:
                    from scipy.stats import ks_2samp
                    ks_stat, ks_p = ks_2samp(previous_window_data, feature_data)
                    distribution_tests.append({
                        'ks_statistic': ks_stat,
                        'p_value': ks_p,
                        'significant_change': ks_p < 0.05
                    })
                
                previous_window_data = feature_data.copy()
                
            except Exception as e:
                print(f"Error processing {feature} at {window_start}: {e}")
                continue
        
        # Изчисляване на метрики за стабилност
        if len(mi_scores) > 0:
            stability_results['mutual_info'][feature] = {
                'scores': mi_scores,
                'mean': np.mean(mi_scores),
                'std': np.std(mi_scores),
                'cv': np.std(mi_scores) / np.mean(mi_scores) if np.mean(mi_scores) > 0 else np.inf,
                'trend': np.polyfit(range(len(mi_scores)), mi_scores, 1)[0]  # Slope of trend
            }
            
            stability_results['correlation'][feature] = {
                'scores': correlations,
                'mean': np.mean(correlations),
                'std': np.std(correlations),
                'cv': np.std(correlations) / abs(np.mean(correlations)) if np.mean(correlations) != 0 else np.inf,
                'trend': np.polyfit(range(len(correlations)), correlations, 1)[0]
            }
            
            stability_results['statistical_properties'][feature] = {
                'mean_stability': np.std(means) / np.mean(means) if np.mean(means) > 0 else np.inf,
                'std_stability': np.std(stds) / np.mean(stds) if np.mean(stds) > 0 else np.inf,
                'mean_trend': np.polyfit(range(len(means)), means, 1)[0],
                'std_trend': np.polyfit(range(len(stds)), stds, 1)[0]
            }
            
            stability_results['distribution_changes'][feature] = {
                'tests': distribution_tests,
                'significant_changes': sum(1 for test in distribution_tests if test['significant_change']),
                'change_frequency': sum(1 for test in distribution_tests if test['significant_change']) / len(distribution_tests) if distribution_tests else 0
            }
    
    return stability_results

def create_stability_report(stability_results):
    """
    Създава доклад за стабилността на features
    """
    report = []
    
    for feature in stability_results['mutual_info'].keys():
        mi_cv = stability_results['mutual_info'][feature]['cv']
        corr_cv = stability_results['correlation'][feature]['cv']
        mean_stability = stability_results['statistical_properties'][feature]['mean_stability']
        change_freq = stability_results['distribution_changes'][feature]['change_frequency']
        
        # Общ индекс за нестабилност
        instability_index = mi_cv + corr_cv + mean_stability + change_freq
        
        # Категоризиране
        if instability_index < 1.0:
            stability_category = "Високо стабилен"
        elif instability_index < 2.0:
            stability_category = "Умерено стабилен"
        elif instability_index < 4.0:
            stability_category = "Нестабилен"
        else:
            stability_category = "Много нестабилен"
        
        report.append({
            'feature': feature,
            'instability_index': instability_index,
            'category': stability_category,
            'mi_cv': mi_cv,
            'correlation_cv': corr_cv,
            'mean_stability': mean_stability,
            'change_frequency': change_freq
        })
    
    # Сортиране по стабилност
    report = sorted(report, key=lambda x: x['instability_index'])
    
    return pd.DataFrame(report)
```

### **Визуализация и интерпретация**

```python
def visualize_feature_stability(stability_results, feature_name):
    """
    Създава визуализации за стабилността на feature
    """
    import matplotlib.pyplot as plt
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle(f'Feature Stability Analysis: {feature_name}', fontsize=16)
    
    feature_data = stability_results['mutual_info'][feature_name]
    
    # 1. Mutual Information във времето
    axes[0,0].plot(feature_data['scores'], marker='o')
    axes[0,0].set_title('Mutual Information Over Time')
    axes[0,0].set_ylabel('MI Score')
    axes[0,0].grid(True)
    
    # 2. Корелация във времето
    corr_data = stability_results['correlation'][feature_name]
    axes[0,1].plot(corr_data['scores'], marker='s', color='orange')
    axes[0,1].set_title('Correlation Over Time')
    axes[0,1].set_ylabel('Correlation')
    axes[0,1].grid(True)
    
    # 3. Статистически свойства
    stat_data = stability_results['statistical_properties'][feature_name]
    # Assuming we have the raw means and stds stored
    # This would need to be modified based on actual data structure
    axes[0,2].set_title('Statistical Properties Trend')
    axes[0,2].set_ylabel('Normalized Values')
    axes[0,2].grid(True)
    
    # 4. Разпределение на MI scores
    axes[1,0].hist(feature_data['scores'], bins=15, alpha=0.7, color='skyblue')
    axes[1,0].set_title('MI Score Distribution')
    axes[1,0].set_xlabel('MI Score')
    axes[1,0].set_ylabel('Frequency')
    
    # 5. Разпределение на корелации
    axes[1,1].hist(corr_data['scores'], bins=15, alpha=0.7, color='lightcoral')
    axes[1,1].set_title('Correlation Distribution')
    axes[1,1].set_xlabel('Correlation')
    axes[1,1].set_ylabel('Frequency')
    
    # 6. Честота на промени в разпределението
    dist_changes = stability_results['distribution_changes'][feature_name]
    change_freq = dist_changes['change_frequency']
    
    axes[1,2].bar(['Stable Periods', 'Change Periods'], 
                  [1-change_freq, change_freq],
                  color=['green', 'red'], alpha=0.7)
    axes[1,2].set_title('Distribution Change Frequency')
    axes[1,2].set_ylabel('Proportion')
    
    plt.tight_layout()
    plt.show()

def interpret_stability_results(stability_report):
    """
    Интерпретация на резултатите от анализа на стабилността
    """
    print("=== FEATURE STABILITY ANALYSIS REPORT ===\n")
    
    # Най-стабилни features
    stable_features = stability_report[stability_report['category'] == 'Високо стабилен']
    print(f"🟢 ВИСОКО СТАБИЛНИ FEATURES ({len(stable_features)}):")
    for _, row in stable_features.iterrows():
        print(f"   • {row['feature']}: Индекс {row['instability_index']:.3f}")
    print()
    
    # Умерено стабилни
    moderate_features = stability_report[stability_report['category'] == 'Умерено стабилен']
    print(f"🟡 УМЕРЕНО СТАБИЛНИ FEATURES ({len(moderate_features)}):")
    for _, row in moderate_features.iterrows():
        print(f"   • {row['feature']}: Индекс {row['instability_index']:.3f}")
    print()
    
    # Нестабилни features
    unstable_features = stability_report[stability_report['category'].isin(['Нестабилен', 'Много нестабилен'])]
    print(f"🔴 НЕСТАБИЛНИ FEATURES ({len(unstable_features)}):")
    for _, row in unstable_features.iterrows():
        print(f"   • {row['feature']}: Индекс {row['instability_index']:.3f} - {row['category']}")
        
        # Специфични препоръки
        if row['change_frequency'] > 0.3:
            print(f"     ⚠️  Чести промени в разпределението ({row['change_frequency']:.2%})")
        if row['mi_cv'] > 1.0:
            print(f"     ⚠️  Нестабилна предсказваща сила (CV: {row['mi_cv']:.3f})")
        if row['mean_stability'] > 1.0:
            print(f"     ⚠️  Нестабилни статистически свойства")
    
    print("\n=== ПРЕПОРЪКИ ===")
    print("🔧 За нестабилните features:")
    print("   1. Проверете калибрирането на сензорите")
    print("   2. Анализирайте корелацията с процесни събития")
    print("   3. Разгледайте възможността за заменящи променливи")
    print("   4. Имплементирайте адаптивно преобучение на модела")
    
    return stability_report
```

---

## 📋 **Phase 7: Practical Implementation Steps**

### **Immediate Actions (Седмица 1-2)**

1. **Sensor Audit**
   - Schedule immediate calibration of all sensors, especially PSI300
   - Check sensor installation and wiring integrity
   - Verify sampling rates and data transmission

2. **Data Validation Pipeline**
   ```python
   def implement_realtime_data_validation():
       validation_rules = {
           'range_check': lambda x, min_val, max_val: min_val <= x <= max_val,
           'rate_of_change': lambda x, prev_x, max_change: abs(x - prev_x) <= max_change,
           'correlation_check': lambda sensor1, sensor2, expected_corr: abs(np.corrcoef(sensor1, sensor2)[0,1] - expected_corr) < 0.3,
           'mass_balance': lambda inputs, outputs: abs(sum(inputs) - sum(outputs)) / sum(inputs) < 0.05
       }
       return validation_rules
   ```

3. **Process Documentation**
   - Create detailed logs of maintenance events
   - Document ore blend changes and their timestamps
   - Track operational parameter modifications

### **Medium-term Solutions (Месец 1-3)**

1. **Adaptive Modeling System**
   ```python
   class AdaptiveMillModel:
       def __init__(self, base_model, adaptation_threshold=0.1):
           self.base_model = base_model
           self.adaptation_threshold = adaptation_threshold
           self.performance_history = []
           self.model_versions = []
           
       def predict_with_monitoring(self, X):
           predictions = self.base_model.predict(X)
           return predictions
           
       def evaluate_and_adapt(self, X_new, y_new):
           # Evaluate current performance
           predictions = self.base_model.predict(X_new)
           current_r2 = r2_score(y_new, predictions)
           
           self.performance_history.append(current_r2)
           
           # Check if adaptation is needed
           if len(self.performance_history) > 5:
               recent_avg = np.mean(self.performance_history[-5:])
               historical_avg = np.mean(self.performance_history[:-5])
               
               if abs(recent_avg - historical_avg) > self.adaptation_threshold:
                   print(f"Performance degradation detected. Retraining model...")
                   self.retrain_model(X_new, y_new)
           
           return current_r2
           
       def retrain_model(self, X_new, y_new):
           # Store current model version
           self.model_versions.append(copy.deepcopy(self.base_model))
           
           # Retrain with recent data
           self.base_model.fit(X_new, y_new)
           print("Model retrained successfully")
   ```

2. **Anomaly Detection System**
   ```python
   from sklearn.ensemble import IsolationForest
   from sklearn.preprocessing import StandardScaler
   
   class ProcessAnomalyDetector:
       def __init__(self, contamination=0.1):
           self.scaler = StandardScaler()
           self.detector = IsolationForest(
               contamination=contamination,
               random_state=42
           )
           self.is_fitted = False
           
       def fit(self, normal_data):
           """Train on normal operating conditions"""
           scaled_data = self.scaler.fit_transform(normal_data)
           self.detector.fit(scaled_data)
           self.is_fitted = True
           
       def detect_anomalies(self, new_data):
           """Detect anomalous operating conditions"""
           if not self.is_fitted:
               raise ValueError("Detector must be fitted first")
               
           scaled_data = self.scaler.transform(new_data)
           anomaly_scores = self.detector.decision_function(scaled_data)
           anomalies = self.detector.predict(scaled_data)
           
           return anomalies == -1, anomaly_scores
           
       def get_anomaly_explanation(self, anomalous_data, feature_names):
           """Explain which features contribute to anomaly detection"""
           scaled_data = self.scaler.transform(anomalous_data)
           
           # Calculate feature contributions (simplified approach)
           mean_normal = np.zeros(scaled_data.shape[1])  # Assume normal center at 0
           deviations = np.abs(scaled_data - mean_normal)
           
           explanations = []
           for i, row in enumerate(deviations):
               top_features = np.argsort(row)[-3:][::-1]  # Top 3 contributing features
               explanation = {
                   'sample_idx': i,
                   'top_contributing_features': [
                       {'feature': feature_names[idx], 'deviation': row[idx]} 
                       for idx in top_features
                   ]
               }
               explanations.append(explanation)
               
           return explanations
   ```

3. **Feature Engineering Pipeline**
   ```python
   def create_time_aware_features(data, time_col):
       """Create features that capture process dynamics"""
       
       # Time-based features
       data['hour'] = data[time_col].dt.hour
       data['day_of_week'] = data[time_col].dt.dayofweek
       data['shift'] = pd.cut(data['hour'], bins=[0, 8, 16, 24], labels=['night', 'day', 'evening'])
       
       # Rolling statistics for key process variables
       key_variables = ['mill_power', 'feed_rate', 'water_addition']
       for var in key_variables:
           data[f'{var}_rolling_mean_1h'] = data[var].rolling('1H').mean()
           data[f'{var}_rolling_std_1h'] = data[var].rolling('1H').std()
           data[f'{var}_rolling_trend_1h'] = data[var].rolling('1H').apply(
               lambda x: np.polyfit(range(len(x)), x, 1)[0] if len(x) > 1 else 0
           )
       
       # Process efficiency features
       if 'mill_power' in data.columns and 'feed_rate' in data.columns:
           data['specific_energy'] = data['mill_power'] / data['feed_rate']
           data['energy_efficiency'] = data['specific_energy'].rolling('2H').mean()
       
       # Lag features for process dynamics
       for var in key_variables:
           for lag in [15, 30, 60]:  # minutes
               data[f'{var}_lag_{lag}min'] = data[var].shift(freq=f'{lag}min')
       
       # Change rate features
       for var in key_variables:
           data[f'{var}_change_rate'] = data[var].diff() / data[var].shift(1)
       
       return data
   
   def create_regime_features(data, regime_classifier):
       """Add operating regime information as features"""
       
       # Predict current regime
       regime_features = ['mill_power', 'feed_rate', 'water_addition', 'cyclone_pressure']
       current_regime = regime_classifier.predict(data[regime_features])
       
       # Add regime information
       data['current_regime'] = current_regime
       
       # Add regime stability (how long in current regime)
       data['regime_stability'] = 0
       current_regime_count = 0
       prev_regime = None
       
       for i, regime in enumerate(current_regime):
           if regime == prev_regime:
               current_regime_count += 1
           else:
               current_regime_count = 1
           
           data.iloc[i, data.columns.get_loc('regime_stability')] = current_regime_count
           prev_regime = regime
       
       # Add regime transition indicators
       data['regime_changed'] = (data['current_regime'] != data['current_regime'].shift(1)).astype(int)
       
       return data
   ```

### **Long-term Strategy (Месец 3-12)**

1. **Digital Twin Development**
   ```python
   class MillDigitalTwin:
       def __init__(self):
           self.physics_model = self.create_physics_model()
           self.ml_model = None
           self.hybrid_predictions = None
           
       def create_physics_model(self):
           """Implement first-principles mill model"""
           def physics_based_prediction(mill_power, feed_rate, ore_hardness, water_addition):
               # Bond's Law for grinding
               work_index = ore_hardness  # Work Index (kWh/t)
               
               # Simplified physics model
               # Energy per ton = Work Index * (1/sqrt(P80_product) - 1/sqrt(P80_feed))
               
               # Assume typical values
               p80_feed = 10000  # microns (10mm)
               
               # Calculate theoretical P80 based on energy input
               specific_energy = mill_power / feed_rate  # kWh/t
               
               # Simplified relationship (needs calibration with actual data)
               sqrt_p80_product = 1/p80_feed**0.5 - specific_energy/(work_index * 1000)
               p80_product = (1/sqrt_p80_product)**2 if sqrt_p80_product > 0 else p80_feed
               
               # Convert to -200 mesh fraction (approximate)
               minus_200_fraction = 1 - np.exp(-0.0001 * (10000/p80_product)**2)
               
               return np.clip(minus_200_fraction, 0, 1)
           
           return physics_based_prediction
           
       def train_hybrid_model(self, X_train, y_train):
           """Train ML model with physics constraints"""
           
           # Get physics predictions
           physics_pred = []
           for _, row in X_train.iterrows():
               pred = self.physics_model(
                   row['mill_power'], row['feed_rate'], 
                   row['ore_hardness'], row['water_addition']
               )
               physics_pred.append(pred)
           
           physics_pred = np.array(physics_pred)
           
           # Add physics predictions as feature
           X_enhanced = X_train.copy()
           X_enhanced['physics_prediction'] = physics_pred
           
           # Train ML model
           from xgboost import XGBRegressor
           self.ml_model = XGBRegressor(
               n_estimators=200,
               max_depth=8,
               learning_rate=0.05,
               reg_alpha=0.1,
               reg_lambda=0.1
           )
           
           self.ml_model.fit(X_enhanced, y_train)
           
       def predict(self, X_test):
           """Make hybrid predictions"""
           
           # Physics predictions
           physics_pred = []
           for _, row in X_test.iterrows():
               pred = self.physics_model(
                   row['mill_power'], row['feed_rate'], 
                   row['ore_hardness'], row['water_addition']
               )
               physics_pred.append(pred)
           
           physics_pred = np.array(physics_pred)
           
           # ML predictions
           X_enhanced = X_test.copy()
           X_enhanced['physics_prediction'] = physics_pred
           ml_pred = self.ml_model.predict(X_enhanced)
           
           # Weighted combination (can be learned)
           alpha = 0.3  # Weight for physics model
           hybrid_pred = alpha * physics_pred + (1 - alpha) * ml_pred
           
           return hybrid_pred, physics_pred, ml_pred
   ```

2. **Sensor Redundancy System**
   ```python
   class RedundantSensorSystem:
       def __init__(self):
           self.sensor_groups = {
               'flow_measurement': ['primary_flow', 'backup_flow', 'calculated_flow'],
               'power_measurement': ['power_meter_1', 'power_meter_2', 'calculated_power'],
               'level_measurement': ['level_sensor_1', 'level_sensor_2', 'pressure_derived_level']
           }
           self.fault_detection = {}
           
       def detect_sensor_faults(self, data):
           """Detect faulty sensors using redundancy"""
           faults = {}
           
           for group_name, sensors in self.sensor_groups.items():
               available_sensors = [s for s in sensors if s in data.columns]
               
               if len(available_sensors) >= 2:
                   # Calculate pairwise correlations
                   correlations = []
                   for i in range(len(available_sensors)):
                       for j in range(i+1, len(available_sensors)):
                           corr = np.corrcoef(
                               data[available_sensors[i]].dropna(),
                               data[available_sensors[j]].dropna()
                           )[0,1]
                           correlations.append((available_sensors[i], available_sensors[j], corr))
                   
                   # Identify outlier sensors (low correlation with others)
                   sensor_avg_corr = {}
                   for sensor in available_sensors:
                       corrs = [abs(corr) for s1, s2, corr in correlations 
                               if sensor in [s1, s2]]
                       sensor_avg_corr[sensor] = np.mean(corrs) if corrs else 0
                   
                   # Flag sensors with low average correlation
                   threshold = 0.7
                   faulty_sensors = [s for s, corr in sensor_avg_corr.items() 
                                   if corr < threshold]
                   
                   if faulty_sensors:
                       faults[group_name] = faulty_sensors
           
           return faults
           
       def get_best_sensor_value(self, data, sensor_group):
           """Get the most reliable sensor value from a group"""
           available_sensors = [s for s in self.sensor_groups[sensor_group] 
                               if s in data.columns]
           
           if not available_sensors:
               return None
               
           # Use voting/averaging approach
           values = [data[sensor].iloc[-1] for sensor in available_sensors]
           
           # Remove outliers using IQR method
           Q1 = np.percentile(values, 25)
           Q3 = np.percentile(values, 75)
           IQR = Q3 - Q1
           
           filtered_values = [v for v in values 
                            if Q1 - 1.5*IQR <= v <= Q3 + 1.5*IQR]
           
           if filtered_values:
               return np.median(filtered_values)
           else:
               return np.median(values)  # Fallback to all values
   ```

3. **Continuous Monitoring Dashboard**
   ```python
   def create_monitoring_dashboard():
       """Create real-time monitoring dashboard"""
       
       dashboard_config = {
           'model_performance': {
               'metrics': ['r2_score', 'mae', 'rmse'],
               'time_windows': ['1H', '8H', '24H', '7D'],
               'alert_thresholds': {'r2_score': 0.3, 'mae': 0.05}
           },
           'data_quality': {
               'metrics': ['missing_data_rate', 'outlier_rate', 'sensor_correlation'],
               'alert_thresholds': {
                   'missing_data_rate': 0.1,
                   'outlier_rate': 0.05,
                   'sensor_correlation': 0.7
               }
           },
           'process_stability': {
               'metrics': ['feed_rate_cv', 'power_stability', 'product_consistency'],
               'alert_thresholds': {
                   'feed_rate_cv': 0.15,
                   'power_stability': 0.1,
                   'product_consistency': 0.08
               }
           },
           'feature_stability': {
               'metrics': ['feature_importance_drift', 'correlation_stability'],
               'update_frequency': '1D',
               'alert_thresholds': {
                   'feature_importance_drift': 0.2,
                   'correlation_stability': 0.3
               }
           }
       }
       
       return dashboard_config
   ```

---

## 📊 **Key Success Metrics**

### **Model Performance Indicators**
- **R² Consistency**: Target variance < 0.1 across time periods
- **Prediction Reliability**: 95% of predictions within ±10% of actual values
- **Model Stability**: Feature importance ranking changes < 20% month-over-month

### **Data Quality Metrics**
- **Sensor Health**: < 5% data points flagged as anomalous
- **Missing Data**: < 2% missing values per sensor per day
- **Correlation Stability**: Cross-sensor correlations remain within ±0.2 of baseline

### **Process Understanding**
- **Physical Validity**: All predictions respect mass and energy balance constraints
- **Regime Classification**: > 90% accuracy in identifying operating regimes
- **Anomaly Detection**: < 5% false positive rate for process anomalies

---

## 🎯 **Prioritized Action Plan**

### **Week 1-2: Emergency Response**
1. ✅ **Immediate sensor audit** - Check PSI300 calibration
2. ✅ **Data quality assessment** - Identify obvious sensor failures
3. ✅ **Historical analysis** - Map performance drops to process events

### **Week 3-4: Quick Fixes**
1. ✅ **Implement data validation** - Real-time quality checks
2. ✅ **Feature stability analysis** - Identify unreliable variables
3. ✅ **Regime identification** - Separate models for different conditions

### **Month 2-3: Systematic Solutions**
1. ✅ **Adaptive modeling** - Auto-retraining based on performance
2. ✅ **Anomaly detection** - Flag unusual operating conditions
3. ✅ **Enhanced features** - Time-aware and physics-informed variables

### **Month 4-12: Advanced Implementation**
1. ✅ **Digital twin development** - Hybrid physics-ML model
2. ✅ **Sensor redundancy** - Backup measurement systems
3. ✅ **Continuous monitoring** - Real-time dashboard and alerts

---

## 🔧 **Troubleshooting Common Issues**

### **Problem: Model R² suddenly drops to negative values**
**Likely Causes**:
- Sensor calibration drift
- Change in ore characteristics
- Equipment wear/maintenance needed
- Data preprocessing pipeline failure

**Investigation Steps**:
1. Check sensor readings against expected ranges
2. Compare current ore blend with historical successful periods
3. Examine maintenance logs for recent equipment changes
4. Validate data preprocessing steps

**Solutions**:
- Recalibrate affected sensors
- Retrain model with recent data
- Implement robust preprocessing with outlier handling
- Use ensemble methods for more stable predictions

### **Problem: Inconsistent feature importance across time periods**
**Likely Causes**:
- Sensor failures affecting specific variables
- Process regime changes
- Seasonal variations in ore properties
- Maintenance activities affecting measurement systems

**Investigation Steps**:
1. Run feature stability analysis
2. Cross-reference with process event logs
3. Check for systematic patterns in importance changes
4. Validate sensor correlations

**Solutions**:
- Implement regime-specific models
- Use regularization to reduce feature sensitivity
- Add ensemble methods to smooth importance variations
- Develop backup features for critical measurements

### **Problem: Good training performance but poor generalization**
**Likely Causes**:
- Overfitting to specific time periods
- Data leakage in feature engineering
- Distribution shift between training and test periods
- Insufficient representation of operating conditions

**Investigation Steps**:
1. Analyze train/test data distributions
2. Check for future information in features
3. Validate cross-validation strategy
4. Examine prediction residuals patterns

**Solutions**:
- Use time-series cross-validation
- Implement domain adaptation techniques
- Add regularization and early stopping
- Ensure representative sampling across all conditions

---

## 📚 **References and Further Reading**

### **Industrial Process Modeling**
- "Process Analytics and Control" - Advanced techniques for industrial applications
- "Data-Driven Modeling for Industrial Processes" - Best practices and case studies

### **Machine Learning for Manufacturing**
- "Industrial Machine Learning" - Practical approaches for production environments
- "Sensor Data Analytics in Manufacturing" - Handling real-world sensor data challenges

### **Mineral Processing Applications**
- "Mineral Processing Technology" - Fundamental principles of ore dressing
- "Advanced Control Systems in Mineral Processing" - Modern automation approaches

### **Statistical Process Control**
- "Statistical Quality Control" - Traditional SPC methods
- "Modern Statistical Process Control" - Integration with machine learning

---

## 💡 **Key Takeaways**

1. **Physics First**: Always validate ML predictions against fundamental process constraints
2. **Sensor Health**: Regular calibration and redundancy are critical for model reliability
3. **Adaptive Learning**: Models must evolve with changing process conditions
4. **Feature Stability**: Monitor and maintain consistent variable relationships
5. **Holistic Approach**: Consider upstream processes and environmental factors
6. **Continuous Monitoring**: Real-time performance tracking prevents model degradation
7. **Documentation**: Detailed logging of process changes enables better model maintenance

---

**Document Version**: 1.0  
**Last Updated**: August 2025  
**Authors**: Industrial ML Team  
**Contact**: For questions about implementation, consult your process engineering and data science teams.