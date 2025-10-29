# Optimization Marker Positioning Fix

## Issue
The lo/hi optimization bound markers were not aligned with the trend chart. They were positioned relative to the slider's physical container instead of the chart's Y-axis domain.

## Root Cause
```typescript
// ❌ BEFORE: Positioned relative to slider domain
bottom: `${((value - sliderDomainMin) / (sliderDomainMax - sliderDomainMin)) * 100}%`
```

**Problem**: 
- Slider domain: Parameter's physical limits (e.g., 140-240)
- Chart Y-axis: Visible range with padding (e.g., 155-175)
- **Result**: Markers didn't align with trend lines

## Solution
```typescript
// ✅ AFTER: Positioned relative to chart Y-axis domain
bottom: `${((value - yAxisDomain[0]) / (yAxisDomain[1] - yAxisDomain[0])) * 100}%`
```

**Fix**:
- Use `yAxisDomain` instead of `sliderDomainMin/Max`
- Markers now align perfectly with chart visualization
- Distribution bounds and trend lines match marker positions

## Visual Improvements

### **Marker Styling**
- **Size**: Increased from `w-3 h-1` to `w-4 h-1.5` (more visible)
- **Shadow**: Changed from `shadow-sm` to `shadow-md` (better depth)
- **Labels**: 
  - Font size: `9px` → `10px`
  - Weight: `semibold` → `bold`
  - Background: Added `bg-white/80` with `px-1 rounded` (better contrast)

### **Spacing**
- **Container width**: `w-16` → `w-20` (more room for markers)
- **Marker area**: `w-12` → `w-10` (optimized width)
- **Slider offset**: `ml-12` → `ml-10` (balanced spacing)
- **Vertical alignment**: `top: 4px, bottom: 12px` (matches slider height exactly)
- **Height**: `calc(100% - 16px)` (aligns with slider's 85% height)

## Drag Interaction Update

### **Before**
```typescript
const percentage = 1 - (mouseY / sliderHeight);
const value = sliderDomainMin + percentage * (sliderDomainMax - sliderDomainMin);
```

### **After**
```typescript
// Account for marker container positioning (matches slider height)
const paddingTop = 4;
const paddingBottom = 12;
const effectiveHeight = containerHeight - paddingTop - paddingBottom;
const adjustedMouseY = mouseY - paddingTop;

// Map to Y-axis domain
const percentage = 1 - (adjustedMouseY / effectiveHeight);
const value = yAxisDomain[0] + percentage * (yAxisDomain[1] - yAxisDomain[0]);

// Clamp to slider bounds
const clampedValue = Math.max(sliderDomainMin, Math.min(sliderDomainMax, value));
```

**Key changes**:
1. Account for container padding (5px top/bottom)
2. Map mouse position to Y-axis domain (chart range)
3. Clamp result to slider bounds (parameter limits)

## Result

### **Alignment**
✅ **Hi marker** aligns with trend high values  
✅ **Lo marker** aligns with trend low values  
✅ Markers track chart Y-axis perfectly  
✅ Distribution bounds match marker positions  

### **Visibility**
✅ Larger markers (easier to see)  
✅ Better shadows (improved depth)  
✅ Clearer labels (white background)  
✅ More left margin (less crowded)  

### **Interaction**
✅ Drag follows chart scale  
✅ Smooth movement  
✅ Accurate value mapping  
✅ Proper padding handling  

## Example

**Parameter**: `Ore` (Разход на руда)
- **Slider domain**: 140 - 240 t/h
- **Chart Y-axis**: 156 - 179 t/h (with padding)
- **Markers**: Now positioned at 169 (lo) and 175 (hi)
- **Visual**: Markers align exactly with trend lines at those values

## Files Modified

1. **mv-parameter-card.tsx**:
   - Updated marker positioning to use `yAxisDomain`
   - Increased marker size and improved styling
   - Added padding compensation in drag handler
   - Increased container width and left margin

2. **OPTIMIZATION_BOUNDS_FEATURE.md**:
   - Updated positioning documentation
   - Added Y-axis domain explanation
   - Updated drag handling code examples

## Testing

- [x] Markers align with chart Y-axis
- [x] Hi marker at trend high
- [x] Lo marker at trend low
- [x] Drag interaction accurate
- [x] Values update correctly
- [x] Padding accounted for
- [x] Labels readable
- [x] Sufficient spacing

---

**Status**: ✅ Fixed and tested  
**Impact**: Markers now perfectly aligned with trend visualization  
**User Experience**: Intuitive visual feedback for optimization bounds
