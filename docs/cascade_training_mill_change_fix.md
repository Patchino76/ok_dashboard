# Cascade Training Section - Mill Change Fix

## Issue Identified

When changing the mill selection in the **Training tab** of the cascade optimization page, the evaluation metrics and graphs in the `CascadeModelInsights` component were not updating properly.

## Root Cause

The `EnhancedModelTraining` component's `onMillChange` prop was connected to `cascadeStore.setMillNumber`, which only updated the mill number in the store but did NOT:
1. Reload the cascade model for the new mill
2. Fetch updated model metadata
3. Trigger evaluation metrics refresh
4. Update feature importance graphs

## Solution Implemented

### Changed Mill Change Handler
**File:** `cascade-optimization-dashboard.tsx` (line 1497)

**Before:**
```tsx
<EnhancedModelTraining
  currentMill={currentMill}
  onMillChange={cascadeStore.setMillNumber}  // ❌ Only updates store
  onTrainModel={handleTrainModel}
  // ... other props
/>
```

**After:**
```tsx
<EnhancedModelTraining
  currentMill={currentMill}
  onMillChange={handleMillChange}  // ✅ Full mill change flow
  onTrainModel={handleTrainModel}
  // ... other props
/>
```

## What `handleMillChange` Does

The `handleMillChange` function (lines 966-1013) performs a complete mill transition:

1. **Stops real-time updates** for the current mill
2. **Updates mill number** in both cascade and XGBoost stores
3. **Resets feature values** to defaults
4. **Loads cascade model** via `loadModelForMill(newMill)` ✅
5. **Restarts real-time updates** for the new mill after 2 seconds
6. **Shows success toast** notification

## Data Flow for Model Insights

```
Mill Selection Change
  ↓
handleMillChange(newMill)
  ↓
loadModelForMill(newMill)
  ↓
Fetches: /api/v1/ml/cascade/models/{millNumber}
  ↓
Updates: modelMetadata state
  ↓
Propagates to: modelInfo={modelMetadata?.model_info}
  ↓
CascadeModelInsights component receives new data
  ↓
Displays updated:
  - Cascade Validation (R², RMSE, MAE)
  - Training Window (MVs, CVs, DVs counts)
  - Data Coverage (row counts, reduction)
  - Feature Importance graphs (Target + Process Models)
```

## Components Affected

### 1. EnhancedModelTraining
- **Location:** `enhanced-model-training.tsx`
- **Mill selector:** Lines 193-208
- **Now triggers:** Full `handleMillChange` flow

### 2. CascadeModelInsights
- **Location:** `cascade-model-insights.tsx`
- **Receives:** `modelInfo` prop from `modelMetadata?.model_info`
- **Displays:** 
  - Cascade validation metrics (lines 232-265)
  - Training configuration (lines 267-300)
  - Data coverage stats (lines 302-335)
  - Feature importance charts (lines 338-498)

### 3. CascadeOptimizationDashboard
- **Location:** `cascade-optimization-dashboard.tsx`
- **Mill change handler:** Lines 966-1013
- **Training section:** Lines 1485-1509

## Testing Checklist

When changing mills in the Training tab, verify:

- [ ] Mill number updates in the dropdown
- [ ] Loading indicator appears briefly
- [ ] Success toast shows "Switched to Mill X"
- [ ] **Cascade Validation metrics update** (R², RMSE, MAE)
- [ ] **Training Window shows correct feature counts**
- [ ] **Data Coverage displays new mill's data stats**
- [ ] **Feature Importance graphs refresh** with new mill's data
- [ ] Training timestamp updates to new mill's last training date
- [ ] Target variable badge shows correct target for new mill
- [ ] No console errors during transition

## API Endpoints Used

1. **Get Model Info:**
   - `GET /api/v1/ml/cascade/models/{millNumber}`
   - Returns: Model metadata, performance metrics, feature classification

2. **Load Model:**
   - `POST /api/v1/ml/cascade/models/{millNumber}/load`
   - Loads model into memory for predictions

## Benefits of This Fix

✅ **Consistent behavior** across all mill selection dropdowns (Overview, Training, Optimization tabs)
✅ **Automatic metric updates** when switching mills
✅ **Proper model loading** ensures predictions use correct mill's model
✅ **Real-time data sync** restarts for new mill
✅ **User feedback** via toast notifications
✅ **State consistency** across cascade and XGBoost stores

## Related Files

- `cascade-optimization-dashboard.tsx` - Main dashboard with mill change handler
- `enhanced-model-training.tsx` - Training section with mill selector
- `cascade-model-insights.tsx` - Metrics and graphs display component
- `useCascadeModelLoader.ts` - Hook for loading cascade models
- `cascade-optimization-store.ts` - Cascade state management

## Future Enhancements

Consider adding:
- Loading skeleton for metrics during mill change
- Comparison view to compare metrics across mills
- Historical training runs per mill
- Model version selector per mill
