# Mill-Specific Cascade Model Organization

This document describes the enhanced cascade optimization system with mill-specific folder organization and comprehensive metadata management.

## 🏭 Overview

The cascade optimization system now supports mill-specific model organization, allowing you to:

- **Train separate models for each mill** (Mill 7, 8, 9, 10, etc.)
- **Organize models in dedicated subfolders** (`mill_7/`, `mill_8/`, etc.)
- **Save comprehensive metadata** for each mill's models
- **Discover and load models** for specific mills
- **Track model performance** across different mills

## 📁 Directory Structure

```
cascade_models/
├── mill_7/
│   ├── metadata.json
│   ├── training_results.json
│   ├── process_model_PulpHC.pkl
│   ├── process_model_DensityHC.pkl
│   ├── process_model_PressureHC.pkl
│   ├── quality_model.pkl
│   ├── scaler_mv_to_PulpHC.pkl
│   ├── scaler_mv_to_DensityHC.pkl
│   ├── scaler_mv_to_PressureHC.pkl
│   └── scaler_quality_model.pkl
├── mill_8/
│   ├── metadata.json
│   ├── training_results.json
│   └── ... (model files)
└── mill_9/
    ├── metadata.json
    ├── training_results.json
    └── ... (model files)
```

## 🚀 Quick Start

### 1. Activate Virtual Environment

```bash
# Windows Command Prompt
C:\venv\crewai311\Scripts\activate

# PowerShell
C:\venv\crewai311\Scripts\Activate.ps1
```

### 2. Basic Usage

```python
from cascade_models import CascadeModelManager

# Create manager for Mill 8
manager = CascadeModelManager("cascade_models", mill_number=8)

# Train models (will save to cascade_models/mill_8/)
results = manager.train_all_models(df, test_size=0.2)

# Get model summary
summary = manager.get_model_summary()
print(f"Mill {summary['mill_number']} models trained successfully")
```

### 3. Discover Available Mills

```python
# List all available mill models
mill_models = CascadeModelManager.list_mill_models("cascade_models")

for mill_num, info in mill_models.items():
    print(f"Mill {mill_num}: {len(info['model_files'])} models")
    print(f"  Complete cascade: {info['has_complete_cascade']}")
    print(f"  Last trained: {info['metadata']['created_at']}")
```

## 🔧 Enhanced Features

### Mill-Specific Model Manager

```python
# Initialize with mill number
manager = CascadeModelManager(
    model_save_path="cascade_models",
    mill_number=8
)

# Models will be saved to: cascade_models/mill_8/
print(f"Models saved to: {manager.model_save_path}")
```

### Comprehensive Metadata

Each mill's models include detailed metadata:

```json
{
  "mill_number": 8,
  "created_at": "2024-01-15T10:30:00",
  "model_version": "1.0.0",
  "training_config": {
    "test_size": 0.2,
    "data_shape": [1500, 18],
    "training_timestamp": "2024-01-15T10:30:00",
    "start_date": "2024-01-01",
    "end_date": "2024-03-31"
  },
  "model_performance": {
    "process_model_PulpHC": {
      "r2_score": 0.847,
      "rmse": 2.34,
      "feature_importance": {...}
    },
    "quality_model": {
      "r2_score": 0.782,
      "rmse": 4.56,
      "feature_importance": {...}
    },
    "chain_validation": {
      "r2_score": 0.756,
      "rmse": 5.23,
      "n_samples": 300
    }
  },
  "data_info": {
    "original_shape": [1800, 18],
    "cleaned_shape": [1500, 18],
    "data_reduction": "16.7%"
  }
}
```

## 🌐 API Endpoints

### New Mill Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/cascade/models` | List all available mill models |
| `GET` | `/api/v1/cascade/models/{mill_number}` | Get info for specific mill |
| `POST` | `/api/v1/cascade/models/{mill_number}/load` | Load models for specific mill |

### Enhanced Existing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/cascade/train` | Train models (now with `mill_number` parameter) |
| `GET` | `/api/v1/cascade/training/status` | Get training status (mill-aware) |
| `POST` | `/api/v1/cascade/predict` | Make predictions (mill-aware) |
| `GET` | `/api/v1/cascade/health` | Health check with mill info |

### API Usage Examples

#### Train Models for Mill 8

```bash
curl -X POST "http://localhost:8000/api/v1/cascade/train" \
  -H "Content-Type: application/json" \
  -d '{
    "mill_number": 8,
    "start_date": "2024-01-01",
    "end_date": "2024-03-31",
    "test_size": 0.2,
    "resample_freq": "1min",
    "model_suffix": "v2"
  }'
```

#### List All Mill Models

```bash
curl -X GET "http://localhost:8000/api/v1/cascade/models"
```

#### Load Mill 8 Models

```bash
curl -X POST "http://localhost:8000/api/v1/cascade/models/8/load"
```

#### Make Prediction (after loading mill models)

```bash
curl -X POST "http://localhost:8000/api/v1/cascade/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "mv_values": {"Ore": 45.2, "WaterMill": 12.8, "WaterZumpf": 8.5},
    "dv_values": {"Shisti": 78.5, "Daiki": 23.1}
  }'
```

## 🧪 Testing

### Run Tests

```bash
# Using batch file (Windows)
run_tests.bat

# Using PowerShell
.\run_tests.ps1

# Manual execution
python test_mill_organization.py
python demonstrate_mill_organization.py
```

### Test Coverage

The test suite covers:

- ✅ Mill-specific directory creation
- ✅ Metadata saving and loading
- ✅ Model performance tracking
- ✅ Mill model discovery
- ✅ API endpoint configuration
- ✅ Directory structure validation

## 📊 Model Performance Tracking

### Per-Mill Performance Comparison

```python
# Compare performance across mills
mill_models = CascadeModelManager.list_mill_models("cascade_models")

for mill_num, info in mill_models.items():
    metadata = info['metadata']
    if 'model_performance' in metadata:
        quality_r2 = metadata['model_performance']['quality_model']['r2_score']
        chain_r2 = metadata['model_performance']['chain_validation']['r2_score']
        
        print(f"Mill {mill_num}:")
        print(f"  Quality Model R²: {quality_r2:.3f}")
        print(f"  Chain Validation R²: {chain_r2:.3f}")
```

### Feature Importance Analysis

```python
# Analyze feature importance across mills
for mill_num, info in mill_models.items():
    metadata = info['metadata']
    quality_model = metadata['model_performance']['quality_model']
    importance = quality_model['feature_importance']
    
    print(f"\nMill {mill_num} Feature Importance:")
    for feature, imp in sorted(importance.items(), key=lambda x: x[1], reverse=True):
        print(f"  {feature}: {imp:.3f}")
```

## 🔄 Migration from Old System

If you have existing models in the old flat structure:

1. **Backup existing models**
2. **Create mill-specific managers**
3. **Move models to appropriate mill folders**
4. **Generate metadata for existing models**

```python
# Migration example
import shutil
import os

# Create new mill-specific structure
old_path = "cascade_models"  # Old flat structure
new_base = "cascade_models_new"

# Assume models were for Mill 8
mill_number = 8
manager = CascadeModelManager(new_base, mill_number=mill_number)

# Move existing model files
for file in os.listdir(old_path):
    if file.endswith('.pkl') or file.endswith('.json'):
        shutil.move(
            os.path.join(old_path, file),
            os.path.join(manager.model_save_path, file)
        )

# Generate metadata for migrated models
manager._save_metadata()
```

## 🛠️ Configuration

### Environment Variables

```bash
# Database configuration (if using real data)
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=mills_database
export DB_USER=mills_user
export DB_PASSWORD=your_password
```

### Model Configuration

```python
# Customize model parameters per mill
model_config = {
    'n_estimators': 200,
    'max_depth': 6,
    'learning_rate': 0.1,
    'random_state': 42
}

manager = CascadeModelManager("cascade_models", mill_number=8)
manager.model_config = model_config
```

## 📈 Best Practices

### 1. Mill-Specific Training

- Train separate models for each mill
- Use mill-specific date ranges
- Consider mill-specific feature engineering

### 2. Model Versioning

- Use model suffixes for versioning (`mill_8_v1`, `mill_8_v2`)
- Keep training logs and metadata
- Document model changes

### 3. Performance Monitoring

- Compare models across mills
- Track performance over time
- Monitor feature importance changes

### 4. Production Deployment

- Load appropriate mill models based on context
- Implement model switching logic
- Monitor prediction quality

## 🐛 Troubleshooting

### Common Issues

1. **Virtual Environment Not Found**
   ```bash
   # Ensure path exists
   ls C:\venv\crewai311\Scripts\
   ```

2. **Import Errors**
   ```python
   # Check Python path
   import sys
   print(sys.path)
   ```

3. **Database Connection Issues**
   ```python
   # Test database connection
   from database.db_connector import MillsDataConnector
   # ... test connection
   ```

4. **Model Loading Failures**
   ```python
   # Check model files exist
   import os
   model_path = "cascade_models/mill_8"
   print(os.listdir(model_path))
   ```

## 📞 Support

For issues or questions:

1. Check the test scripts for examples
2. Review the demonstration script
3. Examine the metadata files for debugging
4. Check the API health endpoint for system status

## 🔮 Future Enhancements

Planned improvements:

- **Model comparison dashboard**
- **Automated model retraining**
- **Performance alerts**
- **Cross-mill model transfer**
- **Advanced model versioning**
- **Model ensemble capabilities**

---

*Last updated: January 2024*
