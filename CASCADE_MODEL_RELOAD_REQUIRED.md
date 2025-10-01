# Cascade Model Reload Required - 2025-10-01 14:36

## Problem

**Error**: `400 Bad Request` on cascade predictions

### Root Cause

The server has **TWO different Mill 6 models in memory**:

1. **Old Model** (currently loaded in `model_manager`):
   - Trained: 2025-09-30 at 12:16:52
   - DVs: **EMPTY** `[]`
   - Quality Model R²: **-0.204** (negative!)
   - Input vars: Only CVs (PulpHC, DensityHC, PressureHC)

2. **New Model** (on disk, just trained):
   - Trained: 2025-10-01 at 14:15:57 (latest training)
   - DVs: **Shisti, Daiki, Grano** ✅
   - Quality Model R²: **0.482** (positive!)
   - Input vars: CVs + DVs (6 features total)

**The server is using the OLD model but receiving DVs in predictions**, causing a feature mismatch.

---

## Solution

### Option 1: Reload Model via API (Recommended)

Call the model load endpoint to reload Mill 6:

```bash
curl -X POST http://localhost:8000/api/v1/ml/cascade/models/6/load
```

Or from the UI, add a "Reload Model" button that calls this endpoint.

### Option 2: Restart the Server

Simply restart the API server - it will load the latest model on startup.

---

## Why This Happens

### Background Training Issue

When training runs in **background tasks**:
1. Training starts → `model_manager` created with old/empty state
2. Training completes → Models saved to disk
3. **But** `model_manager` in memory is NOT updated
4. Predictions use the in-memory `model_manager` (old model)

### The Fix

After training completes, you need to **explicitly reload** the model:

```python
# After training
model_manager.load_models()  # Reload from disk
```

Or call the `/models/{mill_number}/load` endpoint.

---

## Verification

### Check Current Loaded Model

```bash
curl http://localhost:8000/api/v1/ml/cascade/models/6
```

Look for:
```json
{
  "training_config": {
    "configured_features": {
      "dv_features": ["Shisti", "Daiki", "Grano"]  ✅ Should have DVs
    }
  }
}
```

### Check Model Performance

After reloading, quality model should show:
- R² Score: **0.482** (not -0.204)
- Input vars: **6 features** (3 CVs + 3 DVs)
- Feature importance includes Shisti, Daiki, Grano

---

## Training Success Confirmation

The new training WAS successful:

✅ **Data**: 36,488 rows (100% retention after fix)  
✅ **Process Models**: 3 trained (PulpHC, DensityHC, PressureHC)  
✅ **Quality Model**: R² = 0.482 (huge improvement from -0.204!)  
✅ **DVs Included**: Shisti, Daiki, Grano ✅  
✅ **Feature Importance**: Grano (40%), DensityHC (21%), Shisti (16%)  

The model is MUCH better now with DVs included!

---

## Implementation Fix

### Add Auto-Reload After Training

**File**: `cascade_endpoints.py`

```python
def train_background():
    try:
        print(f"🚀 Starting background training for Mill {request.mill_number}")
        
        # Train all models
        results = model_manager.train_all_models(df, test_size=request.test_size)
        
        print(f"✅ Training completed successfully")
        
        # ⭐ AUTO-RELOAD THE MODELS AFTER TRAINING
        model_manager.load_models()
        print(f"🔄 Models reloaded into memory")
        
    except Exception as e:
        print(f"❌ TRAINING FAILED: {e}")
```

This ensures the in-memory model manager always uses the latest trained models.

---

## Quick Fix Now

**Run this command to reload Mill 6 model:**

```bash
curl -X POST http://localhost:8000/api/v1/ml/cascade/models/6/load
```

**Expected response:**
```json
{
  "status": "success",
  "message": "Models loaded successfully for Mill 6",
  "mill_number": 6,
  "summary": {
    "process_models": ["PulpHC", "DensityHC", "PressureHC"],
    "quality_model_trained": true,
    ...
  }
}
```

**Then retry your prediction** - it should work! ✅

---

## Summary

✅ **Training worked** - New model with DVs created successfully  
❌ **Model not loaded** - Server still using old model without DVs  
🔧 **Fix**: Call `/models/6/load` endpoint to reload the model  
🎯 **Result**: Predictions will work with DVs included  

The new model is **MUCH better** (R² improved from -0.20 to +0.48)!
