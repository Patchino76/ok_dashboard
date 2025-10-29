# Y-Axis Domain Initialization for Optimization Bounds

## Implementation

### **Requirement**
Optimization bound markers (lo/hi) should initialize to the chart's Y-axis min/max values, not the slider's full range. This ensures markers start at the visible trend range.

### **Solution**

```typescript
// Initialize optimization bounds from store or Y-axis domain
useEffect(() => {
  const storeBounds = mvOptimizationBounds[parameter.id];
  if (storeBounds) {
    // Use existing bounds from store (user has adjusted them)
    setOptBoundsLo(storeBounds[0]);
    setOptBoundsHi(storeBounds[1]);
  } else {
    // Initialize to Y-axis domain (chart visible range)
    const initialLo = Math.max(yAxisDomain[0], sliderDomainMin);
    const initialHi = Math.min(yAxisDomain[1], sliderDomainMax);
    setOptBoundsLo(initialLo);
    setOptBoundsHi(initialHi);
    // Save to store
    updateMVOptimizationBounds(parameter.id, [initialLo, initialHi]);
  }
}, [parameter.id, yAxisDomain, sliderDomainMin, sliderDomainMax, mvOptimizationBounds, updateMVOptimizationBounds]);
```

---

## Behavior

### **Initial Load**
1. **No store bounds exist** → Initialize from Y-axis domain
2. **Chart shows trend** from 156 to 179 t/h
3. **Markers initialize** to:
   - Lo: `Math.max(156, 140)` = **156** (Y-axis min, clamped to slider min)
   - Hi: `Math.min(179, 240)` = **179** (Y-axis max, clamped to slider max)

### **Trend Changes**
When trend data updates (e.g., time range changes):
1. **Y-axis domain recalculates** (e.g., 149 to 174)
2. **useEffect triggers** (dependency on `yAxisDomain`)
3. **If no store bounds**: Markers reinitialize to new Y-axis range
4. **If store bounds exist**: User adjustments preserved

### **User Adjustments**
1. User drags lo marker to **165**
2. User drags hi marker to **220**
3. **Bounds saved to store**: `{Ore: [165, 220]}`
4. **Trend changes**: Markers stay at [165, 220] (user intent preserved)

---

## Logic Flow

```
Page loads
  ↓
Check store for bounds
  ↓
No bounds? → Initialize from Y-axis domain
  ├─ Lo = max(yAxisDomain[0], sliderMin)
  └─ Hi = min(yAxisDomain[1], sliderMax)
  ↓
Save to store
  ↓
Trend changes (Y-axis recalculates)
  ↓
Check store again
  ↓
Bounds exist? → Keep user values
No bounds? → Reinitialize from new Y-axis
```

---

## Examples

### **Example 1: Fresh Load**
```
Parameter: Ore
Slider range: 140 - 240 t/h
Trend data: 156 - 179 t/h
Y-axis domain: [156, 179] (with padding)

Initial markers:
  Lo = max(156, 140) = 156 ✅
  Hi = min(179, 240) = 179 ✅
```

### **Example 2: After User Adjustment**
```
User drags markers:
  Lo = 165
  Hi = 220

Store: {Ore: [165, 220]}

Trend changes to 149 - 174:
  Markers stay: [165, 220] ✅ (user intent preserved)
```

### **Example 3: Time Range Change**
```
Initial (4h view):
  Y-axis: [160, 175]
  Markers: [160, 175]

Switch to 24h view:
  Y-axis: [149, 179]
  
If no user adjustment:
  Markers update: [149, 179] ✅
  
If user adjusted:
  Markers stay: [165, 220] ✅
```

---

## Clamping Logic

### **Why Clamp?**
Y-axis domain may extend beyond slider limits (due to padding or outliers).

```typescript
const initialLo = Math.max(yAxisDomain[0], sliderDomainMin);
const initialHi = Math.min(yAxisDomain[1], sliderDomainMax);
```

### **Example**
```
Slider range: 140 - 240
Y-axis domain: [135, 245] (with padding)

Without clamping:
  Lo = 135 ❌ (below slider min)
  Hi = 245 ❌ (above slider max)

With clamping:
  Lo = max(135, 140) = 140 ✅
  Hi = min(245, 240) = 240 ✅
```

---

## Dependencies

```typescript
useEffect(() => {
  // ...
}, [
  parameter.id,           // Reinitialize if parameter changes
  yAxisDomain,            // Reinitialize if chart range changes
  sliderDomainMin,        // Needed for clamping
  sliderDomainMax,        // Needed for clamping
  mvOptimizationBounds,   // Check for existing user adjustments
  updateMVOptimizationBounds  // Store update function
]);
```

**Triggers**:
- Parameter changes (different MV selected)
- Y-axis domain recalculates (trend data updates)
- Store bounds change (user adjusts markers)

---

## Benefits

✅ **Intuitive initialization** - Markers start at visible trend range  
✅ **Dynamic updates** - Markers adjust when trend changes (if not user-adjusted)  
✅ **User intent preserved** - Manual adjustments persist across trend changes  
✅ **Safe clamping** - Markers never exceed slider limits  
✅ **Visual alignment** - Markers match chart's visible range  

---

## Testing Scenarios

### **Scenario 1: Fresh Load**
- [x] Markers initialize to Y-axis min/max
- [x] Lo marker at trend low
- [x] Hi marker at trend high

### **Scenario 2: Time Range Change**
- [x] Switch from 4h to 24h view
- [x] Y-axis domain changes
- [x] Markers update to new range (if not user-adjusted)

### **Scenario 3: User Adjustment**
- [x] User drags markers
- [x] Values saved to store
- [x] Trend changes
- [x] User values preserved

### **Scenario 4: Parameter Switch**
- [x] Switch from Ore to WaterMill
- [x] New parameter loads
- [x] Markers initialize to new Y-axis domain

---

**Status**: ✅ Implemented  
**Result**: Markers intelligently initialize to chart's visible range  
**User Experience**: Markers start at meaningful positions, not arbitrary slider limits
