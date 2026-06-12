import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
import xgboost as xgb
import optuna

class MultiOutputBallMillModel:
    """
    Single model that predicts all targets (CVs + Quality) from MVs
    """
    
    def __init__(self):
        self.model = None
        self.scaler_X = StandardScaler()
        self.scaler_y = StandardScaler()
        self.feature_names = ['ore_feed_rate', 'mill_water_flow', 'sump_water_flow', 'ball_dosage']
        self.target_names = ['motor_power', 'pulp_density', 'pulp_flow', 'hydrocyclone_pressure', 'plus_200_micron']
        
    def prepare_data(self, df):
        """
        Prepare input (MVs) and output (CVs + Quality) data
        """
        X = df[self.feature_names].values
        y = df[self.target_names].values
        
        return X, y
    
    def train(self, df, model_type='xgboost'):
        """
        Train multi-output model
        """
        X, y = self.prepare_data(df)
        
        # Train-test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler_X.fit_transform(X_train)
        X_test_scaled = self.scaler_X.transform(X_test)
        
        # Scale targets
        y_train_scaled = self.scaler_y.fit_transform(y_train)
        y_test_scaled = self.scaler_y.transform(y_test)
        
        if model_type == 'xgboost':
            # XGBoost doesn't natively support multi-output, so we use MultiOutputRegressor
            base_model = xgb.XGBRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            )
            self.model = MultiOutputRegressor(base_model)
            
        elif model_type == 'random_forest':
            # Random Forest natively supports multi-output
            self.model = RandomForestRegressor(
                n_estimators=200,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        
        # Train model
        print(f"Training {model_type} multi-output model...")
        self.model.fit(X_train_scaled, y_train_scaled)
        
        # Evaluate
        y_pred_scaled = self.model.predict(X_test_scaled)
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled)
        
        # Calculate metrics for each target
        print("\nModel Performance:")
        print("-" * 50)
        for i, target_name in enumerate(self.target_names):
            r2 = r2_score(y_test[:, i], y_pred[:, i])
            rmse = np.sqrt(mean_squared_error(y_test[:, i], y_pred[:, i]))
            print(f"{target_name:20s}: R² = {r2:.3f}, RMSE = {rmse:.3f}")
        
        # Overall performance
        overall_r2 = np.mean([r2_score(y_test[:, i], y_pred[:, i]) for i in range(len(self.target_names))])
        print(f"\nOverall R²: {overall_r2:.3f}")
        
        return X_test, y_test, y_pred
    
    def predict(self, mvs):
        """
        Predict all targets from MVs
        
        Args:
            mvs: array-like, [ore_feed, mill_water, sump_water, ball_dosage]
        
        Returns:
            dict with predicted CVs and quality
        """
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        # Ensure mvs is 2D array
        mvs = np.array(mvs).reshape(1, -1)
        
        # Scale input
        mvs_scaled = self.scaler_X.transform(mvs)
        
        # Predict scaled outputs
        predictions_scaled = self.model.predict(mvs_scaled)
        
        # Inverse scale predictions
        predictions = self.scaler_y.inverse_transform(predictions_scaled)
        
        # Return as dictionary
        result = {}
        for i, target_name in enumerate(self.target_names):
            result[target_name] = predictions[0, i]
        
        return result
    
    def predict_batch(self, mvs_array):
        """
        Predict for multiple MV combinations
        """
        mvs_scaled = self.scaler_X.transform(mvs_array)
        predictions_scaled = self.model.predict(mvs_scaled)
        predictions = self.scaler_y.inverse_transform(predictions_scaled)
        
        results = []
        for row in predictions:
            result = {}
            for i, target_name in enumerate(self.target_names):
                result[target_name] = row[i]
            results.append(result)
        
        return results

def create_synthetic_data(n_samples=5000):
    """
    Create synthetic ball mill data for demonstration
    Replace this with your actual historical data
    """
    np.random.seed(42)
    
    # Generate MVs within realistic ranges
    ore_feed = np.random.uniform(50, 150, n_samples)
    mill_water = np.random.uniform(10, 50, n_samples)
    sump_water = np.random.uniform(5, 30, n_samples)
    ball_dosage = np.random.uniform(0.5, 2.0, n_samples)
    
    # Simulate realistic relationships (replace with your actual data)
    motor_power = (600 + ore_feed * 3 + ball_dosage * 50 + 
                  np.random.normal(0, 20, n_samples))
    
    pulp_density = (1.2 + ore_feed * 0.003 - (mill_water + sump_water) * 0.01 + 
                   np.random.normal(0, 0.05, n_samples))
    
    pulp_flow = (80 + ore_feed * 0.8 + (mill_water + sump_water) * 1.5 + 
                np.random.normal(0, 5, n_samples))
    
    hydrocyclone_pressure = (1.0 + ore_feed * 0.008 + (mill_water + sump_water) * 0.02 + 
                           np.random.normal(0, 0.1, n_samples))
    
    # Quality depends on all CVs
    plus_200_micron = (15 - 0.01 * motor_power + 
                      5 * (pulp_density - 1.45)**2 +
                      0.02 * pulp_flow - 
                      hydrocyclone_pressure + 
                      np.random.normal(0, 0.5, n_samples))
    
    # Create DataFrame
    df = pd.DataFrame({
        'ore_feed_rate': ore_feed,
        'mill_water_flow': mill_water,
        'sump_water_flow': sump_water,
        'ball_dosage': ball_dosage,
        'motor_power': motor_power,
        'pulp_density': pulp_density,
        'pulp_flow': pulp_flow,
        'hydrocyclone_pressure': hydrocyclone_pressure,
        'plus_200_micron': plus_200_micron
    })
    
    return df

def optimize_with_multi_output_model(model, n_trials=1000):
    """
    Optimize using the multi-output model
    """
    
    # Define MV bounds
    MV_BOUNDS = {
        'ore_feed_rate': (50, 150),
        'mill_water_flow': (10, 50),
        'sump_water_flow': (5, 30),
        'ball_dosage': (0.5, 2.0)
    }
    
    # Define CV constraints
    CV_CONSTRAINTS = {
        'motor_power': (500, 1200),
        'pulp_density': (1.2, 1.6),
        'pulp_flow': (80, 200),
        'hydrocyclone_pressure': (1.0, 3.0)
    }
    
    def objective(trial):
        """
        This function defines WHAT WE WANT TO OPTIMIZE
        Whatever this function returns will be minimized by Optuna
        """
        # Sample MVs (these are the variables Optuna will adjust)
        ore_feed = trial.suggest_float('ore_feed_rate', *MV_BOUNDS['ore_feed_rate'])
        mill_water = trial.suggest_float('mill_water_flow', *MV_BOUNDS['mill_water_flow'])
        sump_water = trial.suggest_float('sump_water_flow', *MV_BOUNDS['sump_water_flow'])
        ball_dosage = trial.suggest_float('ball_dosage', *MV_BOUNDS['ball_dosage'])
        
        # Predict all targets with single model call
        predictions = model.predict([ore_feed, mill_water, sump_water, ball_dosage])
        # Example: predictions = {
        #     'motor_power': 850.5,
        #     'pulp_density': 1.42,
        #     'pulp_flow': 155.3,
        #     'hydrocyclone_pressure': 1.8,
        #     'plus_200_micron': 9.2  ← THIS IS WHAT WE WANT TO MINIMIZE!
        # }
        
        # Check CV constraints (reject if infeasible)
        for cv_name, (min_val, max_val) in CV_CONSTRAINTS.items():
            if not (min_val <= predictions[cv_name] <= max_val):
                return 100.0  # High penalty for infeasible solutions
        
        # CRITICAL: Return the value we want to minimize
        # Since we want LESS +200 μm scrap, we return this value
        # Optuna will try to find MVs that make this as SMALL as possible
        return predictions['plus_200_micron']
    
    # THIS LINE TELLS OPTUNA TO MINIMIZE WHATEVER objective() RETURNS
    # Since objective() returns +200 μm fraction, Optuna will minimize that
    study = optuna.create_study(direction='minimize')  # ← KEY LINE!
    study.optimize(objective, n_trials=n_trials)
    
    # Get best result
    best_params = study.best_params
    best_value = study.best_value
    
    print(f"\nOptimization Results:")
    print(f"Best +200 μm fraction: {best_value:.2f}%")
    print(f"Optimal parameters:")
    for param, value in best_params.items():
        print(f"  {param}: {value:.2f}")
    
    # Predict all targets with optimal parameters
    optimal_predictions = model.predict([
        best_params['ore_feed_rate'],
        best_params['mill_water_flow'],
        best_params['sump_water_flow'],
        best_params['ball_dosage']
    ])
    
    print(f"\nPredicted process conditions:")
    for target, value in optimal_predictions.items():
        print(f"  {target}: {value:.2f}")
    
    return best_params, study

# Demonstration
if __name__ == "__main__":
    # Create synthetic data (replace with your actual data)
    print("Creating synthetic data...")
    df = create_synthetic_data(n_samples=5000)
    
    # Initialize and train model
    model = MultiOutputBallMillModel()
    X_test, y_test, y_pred = model.train(df, model_type='xgboost')
    
    # Test single prediction
    print(f"\nTesting single prediction:")
    test_mvs = [100, 25, 15, 1.2]  # Example MVs
    prediction = model.predict(test_mvs)
    print(f"Input MVs: {test_mvs}")
    print(f"Predicted targets: {prediction}")
    
    # Run optimization
    print(f"\nRunning optimization...")
    optimal_params, study = optimize_with_multi_output_model(model, n_trials=1000)