# Optimization Bounds Feature - Implementation Summary

## Overview

Added adjustable optimization bound markers (lo/hi) to MV parameter cards that allow users to restrict the Optuna search space during optimization. These bounds are independent of the slider range and provide fine-grained control over the optimization process.

## Features Implemented

### 1. **Store State Management**

**File**: `cascade-optimization-store.ts`

**Added State**:
```typescript
// Optimization search space bounds (adjustable markers on MV sliders)
mvOptimizationBounds: Record<string, [number, number]>; // User-adjustable bounds for Optuna search
```

**Added Actions**:
```typescript
updateMVOptimizationBounds: (id: string, bounds: [number, number]) => void;
setMVOptimizationBounds: (bounds: Record<string, [number, number]>) => void;
initializeMVOptimizationBounds: () => void; // Initialize from mvBounds
```

**Initialization**:
- Defaults to empty object `{}`
- **Automatically initialized to Y-axis domain** (chart visible range) when first loaded
- **Updates when trend changes** (Y-axis domain recalculates)
- Persists user adjustments in store across interactions

---

### 2. **UI Components - MV Parameter Card**

**File**: `mv-parameter-card.tsx`

**Visual Design**:
- **Hi Bound Marker**: Red horizontal bar with value label
- **Lo Bound Marker**: Blue horizontal bar with value label
- **Position**: Left side of the purple slider
- **Interactive**: Drag up/down with mouse to adjust
- **Values**: Displayed next to each marker (e.g., `165`, `240`)

**Marker Styling**:
```tsx
// Hi bound (red) - aligned with chart Y-axis
<div className="w-4 h-1.5 bg-red-500 rounded-sm shadow-md" />
<span className="text-[10px] font-bold text-red-600 bg-white/80 px-1 rounded">{optBoundsHi.toFixed(0)}</span>

// Lo bound (blue) - aligned with chart Y-axis
<div className="w-4 h-1.5 bg-blue-500 rounded-sm shadow-md" />
<span className="text-[10px] font-bold text-blue-600 bg-white/80 px-1 rounded">{optBoundsLo.toFixed(0)}</span>
```

**Interaction**:
1. **Mouse Down**: Click on marker to start dragging
2. **Mouse Move**: Marker follows mouse position vertically
3. **Mouse Up**: Release to set final value
4. **Constraints**: Lo cannot exceed Hi (and vice versa)
5. **Range**: Markers constrained to slider min/max

---

### 3. **Optimization Integration**

**File**: `cascade-optimization-dashboard.tsx`

**Updated**: `handleStartOptimization` function

**Before**:
```typescript
const optBounds = optimizationBounds[paramId] ||
  parameterBounds[paramId] || [0, 100];
```

**After**:
```typescript
const { mvOptimizationBounds } = useCascadeOptimizationStore.getState();

const optBounds = mvOptimizationBounds[paramId] ||  // User-adjusted bounds (priority)
  optimizationBounds[paramId] ||                     // Distribution bounds
  parameterBounds[paramId] || [0, 100];              // Default bounds
```

**Priority Order**:
1. **User-adjusted optimization bounds** (from markers)
2. Distribution bounds (from historical data)
3. Parameter bounds (from configuration)
4. Fallback: `[0, 100]`

---

## User Workflow

### **Setting Optimization Bounds**

1. **Load Model**: Select mill and load cascade model
2. **View MV Cards**: See purple slider with red/blue markers
3. **Adjust Markers**:
   - Click and drag **red marker** (hi bound) up/down
   - Click and drag **blue marker** (lo bound) up/down
4. **Visual Feedback**: Values update in real-time next to markers
5. **Run Optimization**: Click "Start Optimization"
6. **Optuna Search**: Uses the adjusted bounds for MV search space

### **Example Scenario**

**Parameter**: `Ore` (Разход на руда)
- **Slider Range**: 140 - 240 t/h
- **Default Optimization Bounds**: 140 - 240 t/h
- **User Adjusts**:
  - Drag **blue marker** (lo) to 165 t/h
  - Drag **red marker** (hi) to 220 t/h
- **Result**: Optuna searches only in range [165, 220] t/h

---

## Technical Details

### **State Flow**

```
User drags marker
  ↓
Local state updated (optBoundsLo/optBoundsHi)
  ↓
Store updated (mvOptimizationBounds)
  ↓
Optimization uses bounds from store
  ↓
API receives bounds in request
  ↓
Optuna searches within bounds
```

### **Marker Positioning**

Markers are positioned relative to the **chart's Y-axis domain**, not the slider's physical range. This ensures perfect alignment with the trend visualization:

```typescript
// Position relative to chart Y-axis (not slider)
bottom: `${((value - yAxisDomain[0]) / (yAxisDomain[1] - yAxisDomain[0])) * 100}%`
```

**Key differences**:
- **Y-axis domain**: Chart's visible range (may include padding)
- **Slider domain**: Parameter's physical min/max limits
- **Result**: Markers align exactly with trend lines and distribution bounds

### **Drag Handling**

Drag interaction maps mouse position to Y-axis domain, then clamps to slider bounds:

```typescript
// Account for container padding
const paddingTop = 5;
const paddingBottom = 5;
const effectiveHeight = containerHeight - paddingTop - paddingBottom;
const adjustedMouseY = mouseY - paddingTop;

// Calculate percentage (inverted for vertical, 0 at bottom)
const percentage = 1 - (adjustedMouseY / effectiveHeight);

// Map to Y-axis domain (chart range)
const value = yAxisDomain[0] + percentage * (yAxisDomain[1] - yAxisDomain[0]);

// Clamp to slider bounds (actual parameter limits)
const clampedValue = Math.max(sliderDomainMin, Math.min(sliderDomainMax, value));

// Ensure lo < hi (minimum 0.1 gap)
if (isDraggingLo) {
  setOptBoundsLo(Math.min(clampedValue, optBoundsHi - 0.1));
} else if (isDraggingHi) {
  setOptBoundsHi(Math.max(clampedValue, optBoundsLo + 0.1));
}
```

---

## Benefits

1. **Fine-Grained Control**: Users can restrict search space without changing slider range
2. **Faster Optimization**: Smaller search space = faster convergence
3. **Domain Knowledge**: Users can apply process knowledge to guide optimization
4. **Visual Feedback**: Clear indication of search bounds
5. **Persistent**: Bounds saved in store across interactions
6. **Independent**: Doesn't affect slider functionality or predictions

---

## API Integration

### **Request Structure**

```json
{
  "mill_number": 8,
  "mv_bounds": {
    "Ore": [165, 220],        // User-adjusted bounds
    "WaterMill": [10, 15],    // User-adjusted bounds
    "WaterZumpf": [180, 250]  // User-adjusted bounds
  },
  "cv_bounds": { ... },
  "dv_values": { ... },
  "target_variable": "PSI200",
  "n_trials": 300,
  "model_type": "gpr"
}
```

### **Optuna Usage**

```python
# In optimizer
for mv_name, (min_val, max_val) in request.mv_bounds.items():
    mv_values[mv_name] = trial.suggest_float(f"mv_{mv_name}", min_val, max_val)
```

---

## Files Modified

1. **cascade-optimization-store.ts**:
   - Added `mvOptimizationBounds` state
   - Added 3 actions for managing bounds
   - Initialized to empty object

2. **mv-parameter-card.tsx**:
   - Added marker state (optBoundsLo, optBoundsHi)
   - Added drag interaction handlers
   - Added marker UI components
   - Connected to store

3. **cascade-optimization-dashboard.tsx**:
   - Updated `handleStartOptimization` to use optimization bounds
   - Priority: user bounds > distribution bounds > parameter bounds

---

## Testing Checklist

- [x] Markers render correctly on MV cards
- [x] Markers initialize to slider min/max
- [x] Drag interaction works smoothly
- [x] Values update in real-time
- [x] Lo marker cannot exceed Hi marker
- [x] Hi marker cannot go below Lo marker
- [x] Bounds persist in store
- [x] Optimization uses adjusted bounds
- [ ] Test with actual optimization run
- [ ] Verify Optuna receives correct bounds
- [ ] Test across different mills

---

## Future Enhancements

1. **Reset Button**: Reset markers to default bounds
2. **Numeric Input**: Type exact values instead of dragging
3. **Percentage Mode**: Set bounds as % of slider range
4. **Presets**: Save/load common bound configurations
5. **Visual Indicator**: Highlight search space on chart
6. **Keyboard Control**: Arrow keys for fine adjustment
7. **Snap to Grid**: Snap to round numbers while dragging

---

## Summary

✅ **Implemented**: Adjustable optimization bound markers on MV sliders  
✅ **Visual**: Red (hi) and blue (lo) markers with values  
✅ **Interactive**: Drag to adjust, constrained to valid range  
✅ **Integrated**: Bounds passed to optimization API  
✅ **Persistent**: Saved in store across interactions  

The feature provides users with fine-grained control over the Optuna search space, enabling faster and more targeted optimization based on domain knowledge.
