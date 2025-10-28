# GPR Model UI Implementation Summary

## Overview

Successfully implemented UI components to support both XGBoost and GPR cascade models with uncertainty visualization and uncertainty-aware optimization.

## Changes Implemented

### 1. **Model Type Selector** ✅

**Location**: Overview Tab - Next to Mill Selector

**Implementation**:
- Two toggle buttons: `[XGBoost] [GPR]`
- Positioned below mill selection dropdown
- Automatically reloads model when type changes
- Disabled during model loading

**Code**: `cascade-optimization-dashboard.tsx` (lines 1424-1452)

```tsx
{/* Model Type Selector */}
<div className="mt-4 space-y-2">
  <div className="flex items-center gap-2">
    <GraduationCap className="h-4 w-4 text-blue-600" />
    <span className="font-medium text-sm">Тип модел</span>
  </div>
  <div className="flex gap-2">
    <Button
      variant={modelType === "xgb" ? "default" : "outline"}
      size="sm"
      onClick={() => handleModelTypeChange("xgb")}
      disabled={isLoadingModel}
      className="flex-1"
    >
      XGBoost
    </Button>
    <Button
      variant={modelType === "gpr" ? "default" : "outline"}
      size="sm"
      onClick={() => handleModelTypeChange("gpr")}
      disabled={isLoadingModel}
      className="flex-1"
    >
      GPR
    </Button>
  </div>
</div>
```

---

### 2. **Uncertainty Display in Predictions** ✅

**Location**: Target Trend Component - Cascade Prediction Value

**Implementation**:
- Shows uncertainty inline with prediction: `23.45 ± 1.2`
- Only visible when GPR model is active
- Uses smaller font for uncertainty value
- Updates in real-time with predictions

**Code**: `target-cascade-trend.tsx` (lines 285-289)

```tsx
{predictionDisplayValue}
{modelType === "gpr" && predictionUncertainty !== null && (
  <span className="ml-1 text-sm font-normal text-slate-500">
    ± {predictionUncertainty.toFixed(2)}
  </span>
)}
```

**Props Added**:
```tsx
interface TargetFractionDisplayProps {
  // ... existing props
  predictionUncertainty?: number | null; // GPR uncertainty (σ)
  modelType?: "xgb" | "gpr";
}
```

---

### 3. **Uncertainty-Aware Optimization Toggle** ✅

**Location**: Optimization Tab - Configuration Section

**Implementation**:
- Checkbox with info icon (ⓘ) and Bulgarian tooltip
- Only visible when GPR model is selected
- Positioned after "Auto-Apply" toggle
- Tooltip explains: "Оптимизацията с несигурност минимизира както целевата стойност, така и несигурността на прогнозата, водейки до по-надеждни решения."

**Code**: `cascade-optimization-dashboard.tsx` (lines 1722-1749)

```tsx
{/* Uncertainty-Aware Optimization Toggle (GPR only) */}
{modelType === "gpr" && (
  <Card className="p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col flex-1">
        <div className="text-sm font-medium flex items-center gap-2">
          Оптимизация с несигурност
          <button
            className="text-slate-400 hover:text-slate-600"
            title="Оптимизацията с несигурност минимизира както целевата стойност, така и несигурността на прогнозата, водейки до по-надеждни решения."
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Използва несигурността на GPR модела за по-надеждна оптимизация
        </div>
      </div>
      <Switch
        checked={cascadeStore.useUncertainty}
        onCheckedChange={cascadeStore.setUseUncertainty}
        disabled={isOptimizing}
      />
    </div>
  </Card>
)}
```

---

### 4. **Confidence Intervals in Visualizations** ⏳

**Status**: Prepared but not fully implemented

**Plan**:
- **Small parameter cards**: No confidence intervals (too cluttered)
- **Main target trend**: Shaded area around prediction line (semi-transparent)
- Only show for GPR predictions

**Implementation Notes**:
- Would require adding `<Area>` component to Recharts
- Need to calculate upper/lower bounds from uncertainty
- Example: `upper = prediction + uncertainty`, `lower = prediction - uncertainty`

**Future Code** (not implemented yet):
```tsx
// In target-cascade-trend.tsx chart
{modelType === "gpr" && (
  <Area
    type="monotone"
    dataKey="predictionUpper"
    stroke="none"
    fill="#f59e0b"
    fillOpacity={0.2}
  />
)}
```

---

## Store Updates

### **cascade-optimization-store.ts**

**Added State**:
```typescript
modelType: "xgb" | "gpr"; // Model type selector
useUncertainty: boolean; // GPR: Use uncertainty-aware optimization
uncertaintyWeight: number; // GPR: Weight for uncertainty penalty
```

**Added Actions**:
```typescript
setModelType: (type: "xgb" | "gpr") => void;
setUseUncertainty: (use: boolean) => void;
setUncertaintyWeight: (weight: number) => void;
```

**Updated Interfaces**:
```typescript
export interface CascadeOptimizationResult {
  // ... existing fields
  // GPR-specific fields
  cv_uncertainties?: Record<string, number>; // Uncertainty for each CV (σ)
  target_uncertainty?: number; // Uncertainty for target prediction (σ)
  best_target_uncertainty?: number; // Uncertainty for best target value (σ)
}
```

---

## Hook Updates

### **useCascadeModelLoader.ts**

**Updated Function**:
```typescript
const loadModelForMill = useCallback(async (
  millNumber: number, 
  modelType: "xgb" | "gpr" = "xgb"
) => {
  // Passes model_type to API endpoints
  const infoResponse = await fetch(
    `${apiUrl}/api/v1/ml/cascade/models/${millNumber}?model_type=${modelType}`
  );
  const loadResponse = await fetch(
    `${apiUrl}/api/v1/ml/cascade/models/${millNumber}/load?model_type=${modelType}`,
    { method: 'POST' }
  );
});
```

### **useCascadePrediction.ts**

**Updated Function**:
```typescript
const predictCascade = useCallback(async (
  mvValues: Record<string, number>,
  dvValues: Record<string, number>,
  modelType: "xgb" | "gpr" = "xgb",
  returnUncertainty: boolean = false
): Promise<CascadePrediction | null> => {
  const requestBody = {
    mv_values: mvValues,
    dv_values: dvValues,
    model_type: modelType,
    return_uncertainty: returnUncertainty,
  };
  // ...
});
```

**Updated Interfaces**:
```typescript
interface PredictionResponse {
  // ... existing fields
  model_type?: string;
  cv_uncertainties?: Record<string, number>;
  target_uncertainty?: number;
}

export interface CascadePrediction {
  // ... existing fields
  cv_uncertainties?: Record<string, number>;
  target_uncertainty?: number;
}
```

### **useCascadeOptimization.ts**

**Updated Request Interfaces**:
```typescript
export interface CascadeOptimizationRequest {
  // ... existing fields
  model_type?: "xgb" | "gpr";
  use_uncertainty?: boolean;
  uncertainty_weight?: number;
}

export interface TargetDrivenOptimizationRequest {
  // ... existing fields
  model_type?: "xgb" | "gpr";
  use_uncertainty?: boolean;
  uncertainty_weight?: number;
}
```

**Updated API Calls**:
```typescript
// Get model type and uncertainty settings from store
const { modelType, useUncertainty, uncertaintyWeight } = 
  useCascadeOptimizationStore.getState();

const request = {
  // ... existing fields
  model_type: modelType,
  use_uncertainty: modelType === "gpr" ? useUncertainty : undefined,
  uncertainty_weight: modelType === "gpr" && useUncertainty ? uncertaintyWeight : undefined,
};
```

---

## Dashboard Updates

### **cascade-optimization-dashboard.tsx**

**Added State**:
```typescript
const [predictionUncertainty, setPredictionUncertainty] = useState<number | null>(null);
```

**Updated Prediction Handlers**:
```typescript
// Store uncertainty when prediction completes
setPredictionUncertainty(prediction.target_uncertainty ?? null);

// Show uncertainty in toast
toast.success(
  `Cascade Prediction: ${prediction.predicted_target.toFixed(2)}${
    prediction.target_uncertainty ? ` ± ${prediction.target_uncertainty.toFixed(2)}` : ''
  }`
);
```

**Model Type Change Handler**:
```typescript
const handleModelTypeChange = async (newModelType: "xgb" | "gpr") => {
  console.log(`🔄 Model type change requested: ${modelType} → ${newModelType}`);
  
  if (newModelType === modelType) return;
  
  try {
    setModelType(newModelType);
    await loadModelForMill(currentMill, newModelType);
    toast.success(`Switched to ${newModelType.toUpperCase()} model`);
  } catch (error) {
    toast.error(`Failed to switch to ${newModelType.toUpperCase()} model`);
  }
};
```

---

## User Experience Flow

### **Switching Model Types**

1. User clicks GPR button → `handleModelTypeChange("gpr")` called
2. Store updates: `setModelType("gpr")`
3. Model reloads: `loadModelForMill(currentMill, "gpr")`
4. API calls with `?model_type=gpr` parameter
5. Success toast: "Switched to GPR model"
6. Uncertainty toggle appears in Optimization tab

### **Making Predictions with GPR**

1. MV sliders change → debounced prediction triggered
2. `predictCascade(mvValues, dvValues, "gpr", true)` called
3. API returns: `{ predicted_target: 23.45, target_uncertainty: 1.2, ... }`
4. UI updates:
   - Target value: `23.45 ± 1.2 %`
   - Toast: "Cascade Prediction: 23.45 ± 1.2"
5. Uncertainty stored in state for visualization

### **Uncertainty-Aware Optimization**

1. User enables "Оптимизация с несигурност" toggle
2. Store updates: `setUseUncertainty(true)`
3. User clicks "Start Optimization"
4. API request includes:
   ```json
   {
     "model_type": "gpr",
     "use_uncertainty": true,
     "uncertainty_weight": 1.0
   }
   ```
5. Optimization minimizes: `objective = mean + k*σ`
6. Results include uncertainty values

---

## API Integration

All API calls now support `model_type` parameter:

| Endpoint | Method | New Parameters |
|----------|--------|----------------|
| `/api/v1/ml/cascade/models` | GET | `?model_type=gpr` |
| `/api/v1/ml/cascade/models/{mill}` | GET | `?model_type=gpr` |
| `/api/v1/ml/cascade/models/{mill}/load` | POST | `?model_type=gpr` |
| `/api/v1/ml/cascade/predict` | POST | `model_type`, `return_uncertainty` |
| `/api/v1/ml/cascade/optimize` | POST | `model_type`, `use_uncertainty`, `uncertainty_weight` |
| `/api/v1/ml/cascade/optimize-target` | POST | `model_type`, `use_uncertainty`, `uncertainty_weight` |

---

## Testing Checklist

- [x] Model type selector buttons render correctly
- [x] Switching between XGBoost and GPR reloads models
- [x] Uncertainty toggle only shows for GPR models
- [x] Predictions show uncertainty inline (± notation)
- [x] Uncertainty updates in real-time
- [x] Optimization requests include uncertainty parameters
- [x] Toast notifications show uncertainty values
- [ ] Confidence intervals in trend charts (future)

---

## Files Modified

### Frontend (TypeScript/React)
1. `cascade-optimization-store.ts` - Added model type and uncertainty state
2. `cascade-optimization-dashboard.tsx` - Added model selector and handlers
3. `target-cascade-trend.tsx` - Added uncertainty display
4. `cascade-simulation-store.ts` - Added uncertainty fields to CascadePrediction
5. `useCascadeModelLoader.ts` - Added model_type parameter
6. `useCascadePrediction.ts` - Added model_type and uncertainty support
7. `useCascadeOptimization.ts` - Added model_type and uncertainty to requests

### Backend (Python/FastAPI)
- No changes needed - already implemented in previous session

---

## Next Steps (Future Enhancements)

1. **Confidence Interval Visualization**:
   - Add shaded area in target trend chart
   - Show ±1σ, ±2σ, ±3σ bands
   - Toggle to show/hide intervals

2. **CV Parameter Uncertainty**:
   - Show uncertainty badges on CV parameter cards
   - Tooltip with detailed uncertainty info
   - Color-code by uncertainty level (green=low, yellow=medium, red=high)

3. **Uncertainty Weight Slider**:
   - Add slider below uncertainty toggle
   - Range: 0.1 to 5.0
   - Default: 1.0
   - Real-time preview of impact

4. **Model Comparison**:
   - Side-by-side XGBoost vs GPR predictions
   - Uncertainty advantage visualization
   - Performance metrics comparison

---

## Summary

✅ **Completed**:
- Model type selector (XGBoost/GPR toggle buttons)
- Uncertainty display in predictions (inline ± notation)
- Uncertainty-aware optimization toggle (GPR only)
- All hooks and stores updated for model_type support
- API integration with model_type parameter
- Real-time uncertainty tracking and display

⏳ **Pending**:
- Confidence interval visualization in charts
- CV parameter uncertainty badges
- Uncertainty weight slider UI

The UI is now fully compatible with both XGBoost and GPR models, with clean separation and no code duplication. Users can seamlessly switch between model types and leverage GPR's uncertainty quantification for more robust optimization.
