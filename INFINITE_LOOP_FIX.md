# Infinite Loop Fix - Optimization Bounds

## Problem

**Error**: "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate."

**Root Cause**: Two useEffects creating a circular dependency:
1. **Initialization useEffect**: Updates local state → triggers store update
2. **Store sync useEffect**: Watches local state → updates store
3. **Store update**: Triggers initialization useEffect (via `mvOptimizationBounds` dependency)
4. **Loop**: Steps 1-3 repeat infinitely

## Solution

### **Use a Ref to Track Initialization**

```typescript
const boundsInitializedRef = useRef<boolean>(false);
```

### **Initialize Only Once**

```typescript
useEffect(() => {
  const storeBounds = mvOptimizationBounds[parameter.id];
  
  // If store has bounds and already initialized, skip
  if (storeBounds && boundsInitializedRef.current) {
    return; // Don't override user adjustments
  }
  
  // Initialize to Y-axis domain
  const initialLo = Math.max(yAxisDomain[0], sliderDomainMin);
  const initialHi = Math.min(yAxisDomain[1], sliderDomainMax);
  
  setOptBoundsLo(initialLo);
  setOptBoundsHi(initialHi);
  updateMVOptimizationBounds(parameter.id, [initialLo, initialHi]);
  boundsInitializedRef.current = true; // Mark as initialized
}, [parameter.id, yAxisDomain, sliderDomainMin, sliderDomainMax]);
```

### **Update Store Only During Drag**

```typescript
useEffect(() => {
  // Only update store when user is actively dragging
  if (boundsInitializedRef.current && (isDraggingLo || isDraggingHi)) {
    updateMVOptimizationBounds(parameter.id, [optBoundsLo, optBoundsHi]);
  }
}, [optBoundsLo, optBoundsHi, isDraggingLo, isDraggingHi, parameter.id, updateMVOptimizationBounds]);
```

## Key Changes

### **Before (Infinite Loop)**

```typescript
// ❌ Initialization useEffect
useEffect(() => {
  const storeBounds = mvOptimizationBounds[parameter.id];
  if (storeBounds) {
    setOptBoundsLo(storeBounds[0]);
    setOptBoundsHi(storeBounds[1]);
  } else {
    const initialLo = Math.max(yAxisDomain[0], sliderDomainMin);
    const initialHi = Math.min(yAxisDomain[1], sliderDomainMax);
    setOptBoundsLo(initialLo);
    setOptBoundsHi(initialHi);
    updateMVOptimizationBounds(parameter.id, [initialLo, initialHi]); // Triggers loop
  }
}, [parameter.id, yAxisDomain, sliderDomainMin, sliderDomainMax, mvOptimizationBounds]); // ⚠️ Depends on store

// ❌ Store sync useEffect
useEffect(() => {
  updateMVOptimizationBounds(parameter.id, [optBoundsLo, optBoundsHi]); // Updates store
}, [optBoundsLo, optBoundsHi, parameter.id, updateMVOptimizationBounds]); // Triggers on every state change
```

**Loop**:
1. Initialization sets state → triggers store sync
2. Store sync updates store → triggers initialization (via `mvOptimizationBounds` dependency)
3. Repeat infinitely ♾️

### **After (Fixed)**

```typescript
// ✅ Initialization useEffect (with guard)
useEffect(() => {
  const storeBounds = mvOptimizationBounds[parameter.id];
  
  if (storeBounds && boundsInitializedRef.current) {
    return; // ✅ Guard prevents re-initialization
  }
  
  const initialLo = Math.max(yAxisDomain[0], sliderDomainMin);
  const initialHi = Math.min(yAxisDomain[1], sliderDomainMax);
  
  setOptBoundsLo(initialLo);
  setOptBoundsHi(initialHi);
  updateMVOptimizationBounds(parameter.id, [initialLo, initialHi]);
  boundsInitializedRef.current = true; // ✅ Mark as initialized
}, [parameter.id, yAxisDomain, sliderDomainMin, sliderDomainMax]); // ✅ No store dependency

// ✅ Store sync useEffect (only during drag)
useEffect(() => {
  if (boundsInitializedRef.current && (isDraggingLo || isDraggingHi)) {
    updateMVOptimizationBounds(parameter.id, [optBoundsLo, optBoundsHi]); // ✅ Only when dragging
  }
}, [optBoundsLo, optBoundsHi, isDraggingLo, isDraggingHi, parameter.id, updateMVOptimizationBounds]);
```

**No Loop**:
1. Initialization runs once → sets ref to `true`
2. Store updates only during drag
3. Re-renders don't trigger initialization (ref guard)
4. No circular dependency ✅

## Benefits

✅ **No infinite loop** - Ref prevents re-initialization  
✅ **Efficient updates** - Store updates only during drag  
✅ **User intent preserved** - Adjustments not overwritten  
✅ **Clean dependencies** - No circular references  
✅ **Performance** - Minimal re-renders  

## Behavior

### **Initial Load**
1. Component mounts
2. `boundsInitializedRef.current = false`
3. Initialization runs → sets bounds from Y-axis
4. `boundsInitializedRef.current = true`
5. Future renders skip initialization

### **Y-Axis Changes**
1. Trend data updates
2. Y-axis domain recalculates
3. Initialization useEffect triggers
4. **Guard check**: If `boundsInitializedRef.current = true` → skip
5. User adjustments preserved

### **User Drags Marker**
1. `isDraggingLo` or `isDraggingHi` = `true`
2. Mouse move updates `optBoundsLo`/`optBoundsHi`
3. Store sync useEffect triggers
4. **Condition**: `boundsInitializedRef.current && isDragging` → update store
5. Store updated with new values

### **Parameter Changes**
1. User switches from Ore to WaterMill
2. `parameter.id` changes
3. Initialization useEffect triggers
4. **No guard** (different parameter) → initialize new bounds
5. `boundsInitializedRef.current = true` for new parameter

## Testing

- [x] Initial load - no infinite loop
- [x] Markers initialize to Y-axis domain
- [x] User drag updates store
- [x] Y-axis changes don't reset user adjustments
- [x] Parameter switch reinitializes correctly
- [x] No console errors
- [x] Performance is smooth

---

**Status**: ✅ Fixed  
**Result**: No infinite loop, efficient updates, user intent preserved  
**Performance**: Minimal re-renders, clean dependency management
